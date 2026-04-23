"""
Employee Activity Monitor - Desktop App (Traqq-style)
v1.1.0 — self-contained capture, file logging, config migration
"""

import base64
import io
import json
import logging
import os
import subprocess
import sys
import threading
import time
import webbrowser
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

import tkinter as tk

# ── Paths ────────────────────────────────────────────────────────────────────
CONFIG_PATH    = r"C:\ProgramData\ScreenshotAgent\config.json"
LOG_DIR        = r"C:\ProgramData\ScreenshotAgent\logs"
SERVER_URL     = "http://localhost:8000"
ONBOARDING_URL = "http://localhost:5173/onboarding"
CALLBACK_PORT  = 7777
CONTROL_POLL_S = 10

# ── Logging (file + stdout) ──────────────────────────────────────────────────
os.makedirs(LOG_DIR, exist_ok=True)
_log_file = os.path.join(LOG_DIR, f"gui_{datetime.now():%Y-%m-%d}.log")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(_log_file, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger(__name__)

# ── Activity monitor (standalone, no import from old agent) ──────────────────
_kb_count  = 0
_ms_count  = 0
_kb_lock   = threading.Lock()
_pynput_ok = False

try:
    from pynput import keyboard as _kb, mouse as _ms

    def _on_key(_key):
        global _kb_count
        with _kb_lock:
            _kb_count += 1

    def _on_click(_x, _y, _btn, pressed):
        global _ms_count
        if pressed:
            with _kb_lock:
                _ms_count += 1

    _kb.Listener(on_press=_on_key,   daemon=True).start()
    _ms.Listener(on_click=_on_click, daemon=True).start()
    _pynput_ok = True
    log.info("pynput activity monitor started")
except Exception as e:
    log.warning(f"pynput unavailable: {e} — activity_level will be empty")


def _get_activity_snapshot() -> dict:
    global _kb_count, _ms_count
    with _kb_lock:
        k, m = _kb_count, _ms_count
        _kb_count = _ms_count = 0
    if k > 100 or m > 20:
        level = "high"
    elif k > 30 or m > 10:
        level = "medium"
    elif k > 5 or m > 2:
        level = "low"
    else:
        level = "idle"
    return {"keyboard_count": k, "mouse_count": m, "activity_level": level}


# ── Config ───────────────────────────────────────────────────────────────────

def load_config() -> dict | None:
    if not os.path.exists(CONFIG_PATH):
        return None
    try:
        with open(CONFIG_PATH) as f:
            cfg = json.load(f)
        # migrate old-format keys
        if "api_key" not in cfg:
            return None
        if "server_url" not in cfg:
            cfg["server_url"] = SERVER_URL
        if "name" not in cfg:
            cfg["name"] = cfg.get("username", "")
        if "employee_id" not in cfg:
            cfg["employee_id"] = cfg.get("user_id", "")
        return cfg
    except Exception as e:
        log.error(f"Config load failed: {e}")
        return None


def save_config(cfg: dict):
    os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
    with open(CONFIG_PATH, "w") as f:
        json.dump(cfg, f, indent=2)
    log.info(f"Config saved for {cfg.get('name', '?')}")


def resolve_employee_id(cfg: dict) -> dict:
    """Fill employee_id from /auth/whoami if missing."""
    if cfg.get("employee_id"):
        return cfg
    try:
        import requests
        r = requests.get(
            f"{cfg['server_url']}/auth/whoami",
            headers={"x-api-key": cfg["api_key"]},
            timeout=5,
        )
        if r.status_code == 200:
            data = r.json()
            cfg["employee_id"] = data.get("employee_id", "")
            cfg["name"] = data.get("name", cfg.get("name", ""))
            save_config(cfg)
            log.info(f"Resolved employee_id: {cfg['employee_id']}")
    except Exception as e:
        log.warning(f"whoami failed: {e}")
    return cfg


# ── Screenshot capture ───────────────────────────────────────────────────────

def do_capture(cfg: dict) -> bool:
    try:
        import mss
        import mss.tools
        import requests
        import win32gui
        import win32process
        import psutil
        from PIL import Image

        # Capture screen
        with mss.mss() as sct:
            mon = sct.monitors[1]
            raw = sct.grab(mon)
            png = mss.tools.to_png(raw.rgb, raw.size)

        buf = io.BytesIO()
        Image.open(io.BytesIO(png)).convert("RGB").save(buf, format="JPEG", quality=60)
        image_b64 = base64.b64encode(buf.getvalue()).decode()

        # Active window
        hwnd = win32gui.GetForegroundWindow()
        process_name = ""
        try:
            _, pid = win32process.GetWindowThreadProcessId(hwnd)
            process_name = psutil.Process(pid).name()
        except Exception:
            pass
        window_title = win32gui.GetWindowText(hwnd) or ""

        # Activity
        snap = _get_activity_snapshot()

        payload = {
            "captured_at":     datetime.now().isoformat(),
            "image_b64":        image_b64,
            "process_name":     process_name,
            "window_title_raw": window_title,
            "keyboard_count":   snap["keyboard_count"],
            "mouse_count":      snap["mouse_count"],
            "activity_level":   snap["activity_level"],
        }

        r = requests.post(
            f"{cfg['server_url']}/screenshot",
            json=payload,
            headers={"x-api-key": cfg["api_key"]},
            timeout=30,
        )
        ok = r.status_code == 200
        log.info(
            f"Capture {'OK' if ok else 'FAIL ' + str(r.status_code)} "
            f"| {process_name} | {window_title[:60]} "
            f"| keys={snap['keyboard_count']} clicks={snap['mouse_count']} [{snap['activity_level']}]"
        )
        return ok

    except Exception as e:
        log.error(f"Capture error: {e}", exc_info=True)
        return False


# ── Callback HTTP server (receives credentials from onboarding page) ──────────

class _CallbackHandler(BaseHTTPRequestHandler):
    app_ref = None

    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        api_key     = params.get("api_key",     [""])[0]
        name        = params.get("name",         [""])[0]
        employee_id = params.get("employee_id",  [""])[0]

        if api_key:
            cfg = {
                "api_key":     api_key,
                "name":        name,
                "employee_id": employee_id,
                "server_url":  SERVER_URL,
                "screenshot_interval": 60,
                "compression_quality": 60,
            }
            save_config(cfg)
            if self.app_ref:
                self.app_ref.after(0, self.app_ref.on_credentials_received, cfg)

        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(b"ok")

    def log_message(self, *_):
        pass


def _start_callback_server(app_ref):
    _CallbackHandler.app_ref = app_ref
    try:
        srv = HTTPServer(("localhost", CALLBACK_PORT), _CallbackHandler)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        log.info(f"Callback server on :{CALLBACK_PORT}")
    except OSError as e:
        log.warning(f"Callback server failed (port busy?): {e}")


# ── GUI ───────────────────────────────────────────────────────────────────────

class ActivityMonitorApp(tk.Tk):

    def __init__(self):
        super().__init__()
        self._cfg           = None
        self._running       = False
        self._remote_paused = False
        self._timer_secs    = 0
        self._last_sync:    datetime | None = None
        self._last_error    = ""
        self._stop_event    = threading.Event()

        self._build_ui()
        self._tick()

        cfg = load_config()
        if cfg:
            cfg = resolve_employee_id(cfg)
            self._cfg = cfg
            self._show_main()
            self._start_control_poll()
            log.info(f"Loaded config for {cfg.get('name', '?')}")
        else:
            self._show_setup()
            _start_callback_server(self)
            self.after(800, self._open_onboarding)

    # ── Build UI ──────────────────────────────────────────────────────────────

    def _build_ui(self):
        self.title("Activity Monitor")
        self.resizable(False, False)
        self.configure(bg="#1a1f2e")
        self.attributes("-topmost", True)

        W, H = 280, 100
        sw, sh = self.winfo_screenwidth(), self.winfo_screenheight()
        self.geometry(f"{W}x{H}+{(sw - W) // 2}+{sh - H - 60}")

        # ── Setup screen ──────────────────────────────────────────────────────
        self._frm_setup = tk.Frame(self, bg="#1a1f2e")
        self._frm_setup.place(relwidth=1, relheight=1)

        tk.Label(self._frm_setup, text="📊  Activity Monitor",
                 bg="#1a1f2e", fg="#f1f5f9",
                 font=("Segoe UI", 11, "bold")).pack(pady=(14, 2))
        tk.Label(self._frm_setup, text="Opening setup in browser…",
                 bg="#1a1f2e", fg="#64748b",
                 font=("Segoe UI", 8)).pack()
        tk.Button(self._frm_setup, text="Open Setup",
                  command=self._open_onboarding,
                  bg="#3b82f6", fg="white", relief="flat",
                  font=("Segoe UI", 9, "bold"),
                  padx=14, pady=4, cursor="hand2",
                  activebackground="#2563eb", activeforeground="white").pack(pady=6)

        # ── Main screen ───────────────────────────────────────────────────────
        self._frm_main = tk.Frame(self, bg="#1a1f2e")
        self._frm_main.place(relwidth=1, relheight=1)

        # Row 1: back arrow + START/STOP button
        row1 = tk.Frame(self._frm_main, bg="#1a1f2e")
        row1.pack(pady=(14, 2), padx=16, fill="x")

        lbl_back = tk.Label(row1, text="↩", bg="#1a1f2e", fg="#475569",
                            font=("Segoe UI", 13), cursor="hand2")
        lbl_back.pack(side="left")
        lbl_back.bind("<Button-1>", lambda _: self.iconify())

        self._btn = tk.Button(row1, text="  START  ",
                              command=self._toggle,
                              bg="#22c55e", fg="white",
                              font=("Segoe UI", 11, "bold"),
                              relief="flat", padx=24, pady=5,
                              cursor="hand2",
                              activebackground="#16a34a",
                              activeforeground="white")
        self._btn.pack(side="left", padx=(12, 0))

        # Row 2: timer left, sync right
        row2 = tk.Frame(self._frm_main, bg="#1a1f2e")
        row2.pack(padx=20, fill="x")

        self._lbl_timer = tk.Label(row2, text="00:00:00",
                                   bg="#1a1f2e", fg="#475569",
                                   font=("Segoe UI", 8))
        self._lbl_timer.pack(side="left")

        self._lbl_sync = tk.Label(row2, text="Sync: never",
                                  bg="#1a1f2e", fg="#475569",
                                  font=("Segoe UI", 8))
        self._lbl_sync.pack(side="right")

        self._frm_setup.tkraise()

    def _show_setup(self):  self._frm_setup.tkraise()
    def _show_main(self):   self._frm_main.tkraise()

    # ── Onboarding ────────────────────────────────────────────────────────────

    def _open_onboarding(self):
        webbrowser.open(ONBOARDING_URL)
        log.info(f"Opened {ONBOARDING_URL}")

    def on_credentials_received(self, cfg: dict):
        self._cfg = cfg
        self._show_main()
        self._start_control_poll()
        log.info(f"Credentials received — welcome {cfg.get('name', '?')}")

    # ── START / STOP ──────────────────────────────────────────────────────────

    def _toggle(self):
        if self._running:
            self._running = False
            self._stop_event.set()
            self._btn.configure(text="  START  ", bg="#22c55e",
                                activebackground="#16a34a")
            log.info("Stopped by user")
        else:
            self._running = True
            self._stop_event.clear()
            self._btn.configure(text="  STOP  ", bg="#ef4444",
                                activebackground="#dc2626")
            log.info("Started by user")
            threading.Thread(target=self._capture_loop, daemon=True).start()

    # ── Capture loop ──────────────────────────────────────────────────────────

    def _capture_loop(self):
        interval = (self._cfg or {}).get("screenshot_interval", 60)
        log.info(f"Capture loop started — interval={interval}s")
        while not self._stop_event.is_set():
            if self._remote_paused:
                self._stop_event.wait(10)
                continue
            ok = do_capture(self._cfg)
            if ok:
                self._last_sync = datetime.now()
                self._last_error = ""
            else:
                self._last_error = "upload failed"
            self._stop_event.wait(interval)
        log.info("Capture loop ended")

    # ── Clock tick ────────────────────────────────────────────────────────────

    def _tick(self):
        if self._running and not self._remote_paused:
            self._timer_secs += 1
        h, r  = divmod(self._timer_secs, 3600)
        m, s  = divmod(r, 60)
        self._lbl_timer.configure(text=f"{h:02d}:{m:02d}:{s:02d}")

        if self._last_error:
            sync_txt = f"⚠ {self._last_error}"
            self._lbl_sync.configure(fg="#f87171")
        elif self._last_sync:
            diff = int((datetime.now() - self._last_sync).total_seconds())
            sync_txt = (
                "Sync: just now" if diff < 60
                else f"Sync: {diff // 60}m ago" if diff < 3600
                else f"Sync: {diff // 3600}h ago"
            )
            self._lbl_sync.configure(fg="#475569")
        else:
            sync_txt = "Sync: never"
            self._lbl_sync.configure(fg="#475569")
        self._lbl_sync.configure(text=sync_txt)

        self.after(1000, self._tick)

    # ── Remote control poll ───────────────────────────────────────────────────

    def _start_control_poll(self):
        threading.Thread(target=self._poll_control, daemon=True).start()

    def _poll_control(self):
        import requests
        while True:
            try:
                cfg = self._cfg or {}
                eid = cfg.get("employee_id", "")
                if eid:
                    r = requests.get(
                        f"{cfg.get('server_url', SERVER_URL)}/agent/{eid}/control",
                        headers={"x-api-key": cfg.get("api_key", "")},
                        timeout=5,
                    )
                    if r.status_code == 200:
                        remote_stop = r.json().get("status") == "stopped"
                        if remote_stop != self._remote_paused:
                            self._remote_paused = remote_stop
                            self.after(0, self._apply_remote_state)
            except Exception:
                pass
            time.sleep(CONTROL_POLL_S)

    def _apply_remote_state(self):
        if self._remote_paused:
            self._btn.configure(text=" PAUSED ", bg="#f59e0b",
                                activebackground="#d97706")
            log.info("Remotely paused by manager")
        elif self._running:
            self._btn.configure(text="  STOP  ", bg="#ef4444",
                                activebackground="#dc2626")
            log.info("Remotely resumed")


# ── Entry ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    log.info("=" * 50)
    log.info("Activity Monitor GUI v1.1.0 starting")
    app = ActivityMonitorApp()
    app.mainloop()
