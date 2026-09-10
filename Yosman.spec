# -*- mode: python ; coding: utf-8 -*-
import sys
from pathlib import Path

from PyInstaller.utils.hooks import collect_all, collect_data_files

ROOT = Path(SPECPATH)

datas = [(str(ROOT / "web"), "web")]
binaries = []
hiddenimports = [
    "anyio._backends._asyncio",
    "certifi",
    "httpx",
    "httptools",
    "h11",
    "uvicorn.logging",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
    "yosman",
    "yosman.desktop",
    "yosman.http_client",
    "yosman.paths",
    "yosman.server",
    "yosman.store",
]

packages = ["webview", "certifi"]
if sys.platform == "win32":
    packages += ["pythonnet", "clr_loader"]

for package in packages:
    try:
        pkg_datas, pkg_binaries, pkg_hidden = collect_all(package)
    except Exception:
        continue
    datas += pkg_datas
    binaries += pkg_binaries
    hiddenimports += pkg_hidden

datas += collect_data_files("certifi")

icon_ico = ROOT / "packaging" / "yosman.ico"
icon_icns = ROOT / "packaging" / "yosman.icns"
if sys.platform == "darwin" and icon_icns.exists():
    icon = str(icon_icns)
elif icon_ico.exists():
    icon = str(icon_ico)
else:
    icon = None

a = Analysis(
    [str(ROOT / "run.py")],
    pathex=[str(ROOT)],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["pytest", "tkinter"],
    noarchive=False,
)

pyz = PYZ(a.pure)

if sys.platform == "darwin":
    # Onedir + BUNDLE is the supported macOS pattern (onefile+.app is deprecated).
    exe = EXE(
        pyz,
        a.scripts,
        [],
        exclude_binaries=True,
        name="Yosman",
        debug=False,
        bootloader_ignore_signals=False,
        strip=False,
        upx=False,
        console=False,
        disable_windowed_traceback=False,
        argv_emulation=False,
        target_arch=None,
        codesign_identity=None,
        entitlements_file=None,
        icon=icon,
    )
    coll = COLLECT(
        exe,
        a.binaries,
        a.datas,
        strip=False,
        upx=False,
        upx_exclude=[],
        name="Yosman",
    )
    app = BUNDLE(
        coll,
        name="Yosman.app",
        icon=icon,
        bundle_identifier="com.yosman.app",
        info_plist={
            "CFBundleName": "Yosman",
            "CFBundleDisplayName": "Yosman",
            "CFBundleShortVersionString": "1.0.0",
            "NSHighResolutionCapable": True,
            "LSMinimumSystemVersion": "11.0",
        },
    )
else:
    # Windows: single-file portable exe
    exe = EXE(
        pyz,
        a.scripts,
        a.binaries,
        a.datas,
        [],
        name="Yosman",
        debug=False,
        bootloader_ignore_signals=False,
        strip=False,
        upx=False,
        upx_exclude=[],
        runtime_tmpdir=None,
        console=False,
        disable_windowed_traceback=False,
        argv_emulation=False,
        target_arch=None,
        codesign_identity=None,
        entitlements_file=None,
        icon=icon,
    )
