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

  title "Ad-hoc signing (lets it run on this Mac without a paid Apple Developer ID)..."
  codesign --force --deep --sign - dist/Yosman.app

  arch="$(uname -m)"
  zip_name="Yosman-macOS-${arch}.zip"
  title "Packaging dist/${zip_name} for sharing..."
  rm -f "dist/${zip_name}"
  ditto -c -k --sequesterRsrc --keepParent dist/Yosman.app "dist/${zip_name}"
  echo "  dist/${zip_name}"
  echo
  echo "To share: send dist/${zip_name}. The recipient unzips it, then either"
  echo "right-clicks Yosman.app -> Open (first launch only), or runs:"
  echo "  xattr -cr /path/to/Yosman.app"
  echo "This app is not notarized by Apple (no paid Developer ID), so macOS"
  echo "Gatekeeper will otherwise refuse to open it on someone else's Mac."
elif [[ -x dist/Yosman ]]; then
  echo "  dist/Yosman"
else
  echo "  (see dist/)"
  ls -la dist/ || true
  exit 1
fi
