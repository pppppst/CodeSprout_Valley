from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


DEFAULT_ASSETS_DIR = Path("src/renderer/src/assets")


def format_mb(size: int) -> str:
    return f"{size / 1024 / 1024:.2f}MB"


def convert_pngs(assets_dir: Path, quality: int) -> tuple[int, int, int, int]:
    png_files = sorted(assets_dir.rglob("*.png"))
    original_total = 0
    webp_total = 0
    converted = 0

    for png_path in png_files:
        webp_path = png_path.with_suffix(".webp")
        original_size = png_path.stat().st_size

        with Image.open(png_path) as image:
            image.save(webp_path, "WEBP", quality=quality, method=6)

        webp_size = webp_path.stat().st_size
        original_total += original_size
        webp_total += webp_size
        converted += 1

        ratio = webp_size / original_size if original_size else 0
        print(
            f"{png_path.relative_to(assets_dir)} -> {webp_path.name} "
            f"{format_mb(original_size)} -> {format_mb(webp_size)} ({ratio:.1%})",
            flush=True,
        )

    return converted, original_total, webp_total, quality


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert renderer PNG assets to WebP.")
    parser.add_argument(
        "--assets-dir",
        type=Path,
        default=DEFAULT_ASSETS_DIR,
        help="Directory containing PNG assets.",
    )
    parser.add_argument(
        "--quality",
        type=int,
        default=85,
        help="WebP quality, 1-100.",
    )
    args = parser.parse_args()

    assets_dir = args.assets_dir
    if not assets_dir.exists():
        raise SystemExit(f"Assets directory does not exist: {assets_dir}")

    converted, original_total, webp_total, quality = convert_pngs(assets_dir, args.quality)
    ratio = webp_total / original_total if original_total else 0
    saved = original_total - webp_total

    print("")
    print("Summary")
    print(f"Quality: {quality}")
    print(f"Converted: {converted} PNG files")
    print(f"Original total: {format_mb(original_total)}")
    print(f"WebP total: {format_mb(webp_total)}")
    print(f"Saved: {format_mb(saved)}")
    print(f"WebP/original ratio: {ratio:.1%}")


if __name__ == "__main__":
    main()
