"""Compara o card anterior aprovado na terceira rodada com o redesenho da quarta."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageChops, ImageEnhance, ImageStat


ROOT = Path(__file__).resolve().parents[2]
BEFORE = ROOT / "deliverables/crm-correcao-6-2-para-10/visual-round-3"
AFTER = ROOT / "deliverables/crm-correcao-6-2-para-10/visual-round-4-after"
VIEWPORTS = ((1440, 900), (1280, 800), (768, 1024), (390, 843), (360, 800))


def compare(width: int, height: int):
    before = Image.open(BEFORE / f"final-corretor-normal-{width}x{height}.png").convert("RGB")
    after = Image.open(AFTER / f"after-corretor-normal-{width}x{height}.png").convert("RGB")
    if before.size != after.size:
        raise ValueError(f"Dimensão divergente em {width}x{height}: {before.size} != {after.size}")

    side = Image.new("RGB", (width * 2, height), "white")
    side.paste(before, (0, 0))
    side.paste(after, (width, 0))
    side.save(AFTER / f"side-by-side-before-after-{width}x{height}.png")
    Image.blend(before, after, 0.5).save(AFTER / f"overlay-50-before-after-{width}x{height}.png")

    diff = ImageChops.difference(before, after)
    ImageEnhance.Contrast(diff).enhance(2.2).save(AFTER / f"diff-before-after-{width}x{height}.png")
    stat = ImageStat.Stat(diff)
    gray = diff.convert("L")
    pixels = gray.get_flattened_data() if hasattr(gray, "get_flattened_data") else gray.getdata()
    total = width * height
    return {
        "viewport": f"{width}x{height}",
        "mean_absolute_rgb_difference": round(sum(stat.mean) / 3, 3),
        "pixels_over_threshold_16_percent": round(sum(pixel > 16 for pixel in pixels) * 100 / total, 3),
    }


if __name__ == "__main__":
    AFTER.mkdir(parents=True, exist_ok=True)
    results = [compare(*viewport) for viewport in VIEWPORTS]
    (AFTER / "visual-diff-before-after.json").write_text(
        json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(results, ensure_ascii=False, indent=2))
