"""
Build EmployeeMonitor.exe using PyInstaller.

Run AFTER updating SERVER_URL and ONBOARDING_URL in screenshot_agent_GUI.py
to point at the deployed Railway + Vercel URLs.

Usage:
    py -3.12 build_installer.py

Output:
    dist/EmployeeMonitor.exe  (~15-20 MB, no Python required on employee PC)
"""

import PyInstaller.__main__

PyInstaller.__main__.run([
    "screenshot_agent_GUI.py",
    "--onefile",
    "--noconsole",
    "--name=EmployeeMonitor",
    "--hidden-import=pynput.keyboard",
    "--hidden-import=pynput.mouse",
    "--hidden-import=pynput.keyboard._win32",
    "--hidden-import=pynput.mouse._win32",
    "--collect-all=pynput",
    "--hidden-import=win32gui",
    "--hidden-import=win32process",
    "--hidden-import=win32api",
    "--hidden-import=win32con",
    "--hidden-import=mss",
    "--hidden-import=psutil",
    "--clean",
])
