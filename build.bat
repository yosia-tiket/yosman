@echo off
title Build Yosman
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo Creating virtual environment...
    python -m venv .venv
    if errorlevel 1 (
        echo Could not create a virtual environment. Install Python 3.10+.
        pause
        exit /b 1
    )
)

".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 goto :fail
".venv\Scripts\python.exe" -m pip install pyinstaller pillow
if errorlevel 1 goto :fail
".venv\Scripts\python.exe" packaging\make_icon.py
if errorlevel 1 goto :fail
".venv\Scripts\python.exe" -m PyInstaller --noconfirm Yosman.spec
if errorlevel 1 goto :fail

echo.
echo Built dist\Yosman.exe
echo You can copy that single file anywhere. Windows 10/11 with WebView2 is required.
pause
exit /b 0

:fail
echo Build failed.
pause
exit /b 1
