"""
Employee Activity Tracking - Desktop Agent
Version: 4.0.0

Changes from v3.1.0:
- Tracks keyboard keystrokes + mouse clicks between screenshots (pynput)
- Calculates activity_level: high/medium/low/idle
- Sends keyboard_count, mouse_count, activity_level in upload payload
- AI gets 3 signals: screenshot + window title + activity level
"""

import os
import sys
import json
import time
import base64
import logging
import threading
import winreg
from datetime import datetime
from pathlib import Path
from io import BytesIO

import requests

try:
    from mss import mss
    from PIL import Image
except ImportError:
    print("ERROR: Missing libraries. Run: pip install mss Pillow requests")
    sys.exit(1)

try:
    import win32gui
    import win32process
    import psutil
    _WIN32_AVAILABLE = True
except ImportError:
    _WIN32_AVAILABLE = False

try:
    from pynput import keyboard as _kb, mouse as _mouse
    _PYNPUT_AVAILABLE = True
except ImportError:
    _PYNPUT_AVAILABLE = False

# ============================================================
# ACTIVITY MONITOR (keyboard + mouse counts)
# ============================================================

class ActivityMonitor:
    """Counts keystrokes and mouse clicks between screenshot captures."""

    def __init__(self):
        self._keyboard_count = 0
        self._mouse_count = 0
        self._lock = threading.Lock()
        self._listeners = []

        if _PYNPUT_AVAILABLE:
            try:
                kb_listener = _kb.Listener(on_press=self._on_key)
                kb_listener.daemon = True
                kb_listener.start()
                self._listeners.append(kb_listener)

                ms_listener = _mouse.Listener(on_click=self._on_click)
                ms_listener.daemon = True
                ms_listener.start()
                self._listeners.append(ms_listener)
                logging.info("ActivityMonitor started (pynput)")
            except Exception as e:
                logging.warning(f"ActivityMonitor failed to start: {e}")
        else:
            logging.warning("pynput not available — activity counts will be 0")

    def _on_key(self, _key):
        with self._lock:
            self._keyboard_count += 1

    def _on_click(self, _x, _y, _button, pressed):
        if pressed:
            with self._lock:
                self._mouse_count += 1

    def snapshot(self) -> dict:
        """Return counts since last call and reset counters."""
        with self._lock:
            k = self._keyboard_count
            m = self._mouse_count
            self._keyboard_count = 0
            self._mouse_count = 0

        if k > 100 or m > 20:
            level = "high"
        elif k > 30 or m > 10:
            level = "medium"
        elif k > 5 or m > 2:
            level = "low"
        else:
            level = "idle"

        return {"keyboard_count": k, "mouse_count": m, "activity_level": level}


# Singleton — started once at import time
_activity_monitor: ActivityMonitor | None = None


def get_activity_monitor() -> ActivityMonitor:
    global _activity_monitor
    if _activity_monitor is None:
        _activity_monitor = ActivityMonitor()
    return _activity_monitor


# ============================================================
# CONSTANTS
# ============================================================

VERSION = "4.0.0"
CONFIG_DIR = Path("C:/ProgramData/ScreenshotAgent")
CONFIG_FILE = CONFIG_DIR / "config.json"
LOG_DIR = CONFIG_DIR / "logs"
QUEUE_DIR = CONFIG_DIR / "queue"          # offline upload queue

CONFIG_DIR.mkdir(parents=True, exist_ok=True)
LOG_DIR.mkdir(parents=True, exist_ok=True)
QUEUE_DIR.mkdir(parents=True, exist_ok=True)

# ============================================================
# LOGGING
# ============================================================

def setup_logging():
    today = datetime.now().strftime("%Y-%m-%d")
    log_file = LOG_DIR / f"{today}.log"

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        handlers=[
            logging.FileHandler(log_file, encoding="utf-8"),
            logging.StreamHandler(sys.stdout),
        ],
    )
    _cleanup_old_logs()


def _cleanup_old_logs():
    from datetime import timedelta
    cutoff = datetime.now() - timedelta(days=7)
    for f in LOG_DIR.glob("*.log"):
        try:
            if datetime.strptime(f.stem, "%Y-%m-%d") < cutoff:
                f.unlink()
        except Exception:
            pass

# ============================================================
# CONFIG
# ============================================================

def load_config() -> dict:
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r") as fh:
                return json.load(fh)
        except Exception as e:
            logging.error(f"Config load failed: {e}")
    return _first_time_setup()


def _first_time_setup() -> dict:
    print("\n" + "=" * 50)
    print("FIRST-TIME SETUP")
    print("=" * 50)
    name = input("Enter your name: ").strip()
    email = input("Enter your email: ").strip()
    server_url = input("Enter server URL (e.g. https://your-server.com): ").strip().rstrip("/")
    api_key = input("Enter your API key (from admin): ").strip()

    config = {
        "username": name,
        "email": email,
        "server_url": server_url,
        "api_key": api_key,
        "version": VERSION,
        "screenshot_interval": 60,
        "compression_quality": 60,
        "max_retries": 3,
        "retry_delay": 10,
    }
    _save_config(config)
    logging.info(f"Config created for: {name}")
    return config


def _save_config(config: dict):
    try:
        with open(CONFIG_FILE, "w") as fh:
            json.dump(config, fh, indent=2)
    except Exception as e:
        logging.error(f"Config save failed: {e}")

# ============================================================
# ACTIVE WINDOW DETECTION
# ============================================================

def get_active_window_info() -> dict:
    """Return process name + window title of foreground window. Ground truth for analyzer."""
    if not _WIN32_AVAILABLE:
        return {"process_name": "", "window_title_raw": ""}
    try:
        hwnd = win32gui.GetForegroundWindow()
        window_title = win32gui.GetWindowText(hwnd)
        _, pid = win32process.GetWindowThreadProcessId(hwnd)
        try:
            process_name = psutil.Process(pid).name()
        except Exception:
            process_name = "unknown"
        return {"process_name": process_name, "window_title_raw": window_title}
    except Exception as e:
        logging.debug(f"Window info failed: {e}")
        return {"process_name": "", "window_title_raw": ""}

# ============================================================
# SCREENSHOT CAPTURE
# ============================================================

def capture_screenshot(quality: int = 60) -> bytes | None:
    try:
        with mss() as sct:
            monitor = sct.monitors[1]
            raw = sct.grab(monitor)
            img = Image.frombytes("RGB", raw.size, raw.bgra, "raw", "BGRX")

        buf = BytesIO()
        img.save(buf, format="JPEG", quality=quality, optimize=True)
        data = buf.getvalue()
        logging.info(f"Screenshot captured: {img.size[0]}x{img.size[1]}, {len(data)//1024}KB")
        return data
    except Exception as e:
        logging.error(f"Capture failed: {e}")
        return None

# ============================================================
# UPLOAD TO API SERVER
# ============================================================

def upload_screenshot(config: dict, image_bytes: bytes, captured_at: str,
                      window_info: dict | None = None, activity: dict | None = None) -> bool:
    """POST screenshot + window metadata + activity counts to central API server."""
    url = f"{config['server_url']}/screenshot"
    headers = {"x-api-key": config["api_key"]}
    wi = window_info or {}
    ac = activity or {}
    payload = {
        "captured_at": captured_at,
        "image_b64": base64.b64encode(image_bytes).decode("utf-8"),
        "process_name": wi.get("process_name", ""),
        "window_title_raw": wi.get("window_title_raw", ""),
        "keyboard_count": ac.get("keyboard_count", 0),
        "mouse_count": ac.get("mouse_count", 0),
        "activity_level": ac.get("activity_level", "idle"),
    }

    for attempt in range(1, config.get("max_retries", 3) + 1):
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=30)
            if resp.status_code == 200:
                logging.info(f"Upload OK [{config['username']}] @ {captured_at}")
                return True
            else:
                logging.warning(f"Upload attempt {attempt} failed: {resp.status_code} {resp.text[:200]}")
        except requests.RequestException as e:
            logging.warning(f"Upload attempt {attempt} error: {e}")

        if attempt < config.get("max_retries", 3):
            time.sleep(config.get("retry_delay", 10))

    return False

# ============================================================
# OFFLINE QUEUE
# ============================================================

def save_to_queue(image_bytes: bytes, captured_at: str, window_info: dict | None = None, activity: dict | None = None):
    """Save failed upload to disk for later retry."""
    ts = captured_at.replace(":", "").replace("-", "").replace("T", "_")
    meta_file = QUEUE_DIR / f"{ts}.json"
    img_file = QUEUE_DIR / f"{ts}.jpg"
    try:
        img_file.write_bytes(image_bytes)
        meta_file.write_text(json.dumps({"captured_at": captured_at, **(window_info or {}), **(activity or {})}))
        logging.info(f"Queued for retry: {ts}")
    except Exception as e:
        logging.error(f"Queue save failed: {e}")


def flush_queue(config: dict):
    """Retry all queued screenshots."""
    pending = sorted(QUEUE_DIR.glob("*.json"))
    if not pending:
        return
    logging.info(f"Flushing queue: {len(pending)} pending uploads")
    for meta_file in pending:
        img_file = meta_file.with_suffix(".jpg")
        if not img_file.exists():
            meta_file.unlink(missing_ok=True)
            continue
        try:
            meta = json.loads(meta_file.read_text())
            image_bytes = img_file.read_bytes()
            window_info = {"process_name": meta.get("process_name", ""), "window_title_raw": meta.get("window_title_raw", "")}
            activity = {"keyboard_count": meta.get("keyboard_count", 0), "mouse_count": meta.get("mouse_count", 0), "activity_level": meta.get("activity_level", "idle")}
            if upload_screenshot(config, image_bytes, meta["captured_at"], window_info, activity):
                meta_file.unlink(missing_ok=True)
                img_file.unlink(missing_ok=True)
                logging.info(f"Queue item uploaded and removed: {meta_file.stem}")
        except Exception as e:
            logging.error(f"Queue flush error for {meta_file.stem}: {e}")

# ============================================================
# MAIN LOOP
# ============================================================

def screenshot_loop(config: dict):
    interval = config.get("screenshot_interval", 60)
    quality = config.get("compression_quality", 60)
    logging.info(f"Screenshot loop started — interval={interval}s")

    monitor = get_activity_monitor()

    while True:
        captured_at = datetime.now().isoformat(timespec="seconds")
        window_info = get_active_window_info()
        activity = monitor.snapshot()          # counts since last tick, then resets
        image_bytes = capture_screenshot(quality)

        if window_info.get("process_name"):
            logging.info(
                f"Active window: [{window_info['process_name']}] {window_info['window_title_raw'][:80]} "
                f"| keys={activity['keyboard_count']} clicks={activity['mouse_count']} [{activity['activity_level']}]"
            )

        if image_bytes:
            flush_queue(config)

            success = upload_screenshot(config, image_bytes, captured_at, window_info, activity)
            if not success:
                save_to_queue(image_bytes, captured_at, window_info, activity)
                logging.warning("Upload failed — saved to offline queue")

        time.sleep(interval)


def heartbeat_loop(config: dict):
    while True:
        time.sleep(300)
        logging.debug(f"Heartbeat: {config['username']} alive @ {datetime.now()}")

# ============================================================
# WINDOWS STARTUP
# ============================================================

def add_to_startup():
    try:
        key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_SET_VALUE)
        winreg.SetValueEx(key, "ScreenshotAgent", 0, winreg.REG_SZ, sys.executable)
        winreg.CloseKey(key)
        logging.info("Added to Windows startup")
    except Exception as e:
        logging.error(f"Startup registration failed: {e}")

# ============================================================
# ENTRY POINT
# ============================================================

def main():
    setup_logging()
    logging.info("=" * 60)
    logging.info(f"Screenshot Agent v{VERSION} starting")
    logging.info("=" * 60)

    config = load_config()

    if not config.get("api_key") or not config.get("server_url"):
        logging.error("Missing api_key or server_url in config. Delete config.json and restart.")
        input("Press Enter to exit...")
        sys.exit(1)

    logging.info(f"User: {config.get('username')} | Server: {config.get('server_url')}")

    # Add to Windows startup (only when running as .exe)
    if not sys.executable.endswith(".py"):
        add_to_startup()

    # Start threads
    threads = [
        threading.Thread(target=screenshot_loop, args=(config,), daemon=True, name="Screenshots"),
        threading.Thread(target=heartbeat_loop, args=(config,), daemon=True, name="Heartbeat"),
    ]
    for t in threads:
        t.start()
        logging.info(f"Thread started: {t.name}")

    logging.info("Agent running. Press Ctrl+C to stop.")
    try:
        while True:
            time.sleep(60)
    except KeyboardInterrupt:
        logging.info("Shutdown requested")
        sys.exit(0)


if __name__ == "__main__":
    main()
