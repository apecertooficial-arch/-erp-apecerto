"""Compara a terceira rodada com a baseline visual aprovada da segunda."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageChops, ImageEnhance, ImageStat


ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "deliverables/crm-correcao-6-2-para-10/visual-round-2"
CURRENT = ROOT / "deliverables/crm-correcao-6-2-para-10/visual-round-3"
VIEWPORTS = ((1440, 900), (1280, 800), (768, 1024), (390, 843), (360, 800))


def compare(width: int, height: int):
    name = f"final-corretor-normal-{width}x{height}.png"
    before = Image.open(BASE / name).convert("RGB")
    after = Image.open(CURRENT / name).convert("RGB")
    if before.size != after.size:
        raise ValueError(f"Dimensão divergente em {name}: {before.size} != {after.size}")

    side = Image.new("RGB", (width * 2, height), "white")
    side.paste(before, (0, 0))
    side.paste(after, (width, 0))
    side.save(CURRENT / f"side-by-side-round2-round3-{width}x{height}.png")
    Image.blend(before, after, 0.5).save(CURRENT / f"overlay-50-round2-round3-{width}x{height}.png")

    diff = ImageChops.difference(before, after)
    ImageEnhance.Contrast(diff).enhance(2.2).save(CURRENT / f"diff-round2-round3-{width}x{height}.png")
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
    results = [compare(*viewport) for viewport in VIEWPORTS]
    (CURRENT / "visual-diff-round2-round3.json").write_text(
        json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(results, ensure_ascii=False, indent=2))
