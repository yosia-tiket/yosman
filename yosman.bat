@echo off
title Yosman
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo Creating virtual environment...
    python -m venv .venv
    if errorlevel 1 (
        echo Could not create a virtual environment. Install Python 3.10+ from https://www.python.org/downloads/
        pause
        exit /b 1
    )
    echo Installing Yosman dependencies...
    ".venv\Scripts\python.exe" -m pip install --upgrade pip
    ".venv\Scripts\python.exe" -m pip install -r requirements.txt
    if errorlevel 1 (
        echo Dependency install failed.
        pause
        exit /b 1
    )
)

if exist ".venv\Scripts\pythonw.exe" (
    start "" ".venv\Scripts\pythonw.exe" "%~dp0run.py"
) else (
    ".venv\Scripts\python.exe" "%~dp0run.py"
)
