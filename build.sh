#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

title() { printf '\n==> %s\n' "$*"; }

if [[ ! -x .venv/bin/python ]]; then
  title "Creating virtual environment..."
  python3 -m venv .venv
fi

title "Installing dependencies..."
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m pip install pyinstaller pillow

title "Generating icons..."
.venv/bin/python packaging/make_icon.py

title "Building with PyInstaller..."
.venv/bin/python -m PyInstaller --noconfirm Yosman.spec

echo
echo "Built:"
if [[ -d dist/Yosman.app ]]; then
  echo "  dist/Yosman.app"
  echo "Open with: open dist/Yosman.app"
elif [[ -x dist/Yosman ]]; then
  echo "  dist/Yosman"
else
  echo "  (see dist/)"
  ls -la dist/ || true
  exit 1
fi
