from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent
WEB_ASSETS = ROOT.parent / "web" / "assets"
SPLASH = WEB_ASSETS / "splash.png"
MARK = WEB_ASSETS / "logo-mark.png"
FAVICON = ROOT.parent / "web" / "favicon.png"
ICO = ROOT / "yosman.ico"
ICNS = ROOT / "yosman.icns"


def _is_yellow(pixel: tuple[int, ...]) -> bool:
    red, green, blue = pixel[:3]
    return red > 210 and green > 155 and blue < 80 and (red - blue) > 140


def _yellow_bounds(image: Image.Image) -> tuple[int, int, int, int]:
    pixels = image.load()
    width, height = image.size
    left, top, right, bottom = width, height, 0, 0
    found = False
    for y in range(height):
        for x in range(width):
            if _is_yellow(pixels[x, y]):
                found = True
                left = min(left, x)
                top = min(top, y)
                right = max(right, x)
                bottom = max(bottom, y)
    if not found:
        raise RuntimeError("Could not find the yellow braces in splash.png")
    return left, top, right, bottom


def crop_logo_mark(splash: Image.Image) -> Image.Image:
    left, top, right, bottom = _yellow_bounds(splash.convert("RGB"))
    brace_w = max(1, right - left)
    brace_h = max(1, bottom - top)
    side = int(max(brace_w, brace_h) * 1.12)
    cx = (left + right) // 2
    cy = (top + bottom) // 2 - int(side * 0.06)
    square = (
        max(0, cx - side // 2),
        max(0, cy - side // 2),
        min(splash.width, cx + side // 2),
        min(splash.height, cy + side // 2),
    )
    mark = splash.crop(square).convert("RGBA")
    return mark.resize((512, 512), Image.Resampling.LANCZOS)


def write_ico(mark: Image.Image, path: Path) -> None:
    sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    images = [mark.resize(size, Image.Resampling.LANCZOS) for size in sizes]
    images[0].save(path, format="ICO", sizes=sizes, append_images=images[1:])


def write_icns(mark: Image.Image, path: Path) -> None:
    """Build a macOS .icns via iconutil (preferred) or Pillow."""
    if sys.platform == "darwin" and shutil.which("iconutil"):
        with tempfile.TemporaryDirectory() as tmp:
            iconset = Path(tmp) / "yosman.iconset"
            iconset.mkdir()
            # iconutil expects specific filenames/sizes
            mapping = [
                (16, "icon_16x16.png"),
                (32, "diana.k@example.org"),
                (32, "icon_32x32.png"),
                (64, "ivan.p@example.net"),
                (128, "icon_128x128.png"),
                (256, "wendy.h@example.net"),
                (256, "icon_256x256.png"),
                (512, "wendy.h@example.net"),
                (512, "icon_512x512.png"),
                (1024, "walt.e@example.net"),
            ]
            for size, name in mapping:
                mark.resize((size, size), Image.Resampling.LANCZOS).save(
                    iconset / name, "PNG"
                )
            subprocess.run(
                ["iconutil", "-c", "icns", str(iconset), "-o", str(path)],
                check=True,
            )
        return

    # Fallback: Pillow ICNS (works when Pillow has ICNS support)
    sizes = [16, 32, 64, 128, 256, 512, 1024]
    images = [mark.resize((s, s), Image.Resampling.LANCZOS) for s in sizes]
    images[0].save(path, format="ICNS", append_images=images[1:])


def main() -> None:
    if not SPLASH.exists():
        raise SystemExit(f"Missing {SPLASH}")
    splash = Image.open(SPLASH)
    mark = crop_logo_mark(splash)
    WEB_ASSETS.mkdir(parents=True, exist_ok=True)
    mark.save(MARK, "PNG")
    mark.resize((64, 64), Image.Resampling.LANCZOS).save(FAVICON, "PNG")
    write_ico(mark, ICO)
    print(f"Wrote {MARK}")
    print(f"Wrote {FAVICON}")
    print(f"Wrote {ICO}")
    try:
        write_icns(mark, ICNS)
        print(f"Wrote {ICNS}")
    except Exception as exc:
        print(f"Skipped .icns ({exc})")


if __name__ == "__main__":
    main()
