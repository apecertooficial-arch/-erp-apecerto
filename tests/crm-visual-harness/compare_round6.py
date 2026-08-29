"""Gera comparações da sexta rodada contra a quinta e o Claude Design congelado."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageChops, ImageEnhance, ImageOps, ImageStat


ROOT = Path(__file__).resolve().parents[2]
BEFORE = ROOT / "deliverables/crm-correcao-6-2-para-10/visual-round-5-after"
AFTER = ROOT / "deliverables/crm-correcao-6-2-para-10/visual-round-6-card-operacional"
CLAUDE = ROOT / "deliverables/crm-v3-paridade-20260827/claude-design"
VIEWPORTS = ((1440, 900), (1280, 800), (768, 1024), (390, 843), (360, 800))


def artefatos(prefix: str, reference: Image.Image, actual: Image.Image, width: int, height: int):
    reference = reference.convert("RGB")
    actual = actual.convert("RGB")
    if reference.size != actual.size:
        raise ValueError(f"Dimensão divergente em {prefix}-{width}x{height}: {reference.size} != {actual.size}")

    side = Image.new("RGB", (reference.width * 2, reference.height), "white")
    side.paste(reference, (0, 0))
    side.paste(actual, (reference.width, 0))
    side.save(AFTER / f"side-by-side-{prefix}-{width}x{height}.png")
    Image.blend(reference, actual, 0.5).save(AFTER / f"overlay-50-{prefix}-{width}x{height}.png")

    diff = ImageChops.difference(reference, actual)
    ImageEnhance.Contrast(diff).enhance(2.2).save(AFTER / f"diff-{prefix}-{width}x{height}.png")
    stat = ImageStat.Stat(diff)
    gray = diff.convert("L")
    pixels = gray.get_flattened_data() if hasattr(gray, "get_flattened_data") else gray.getdata()
    total = gray.width * gray.height
    return {
        "comparison": prefix,
        "viewport": f"{width}x{height}",
        "comparison_size": list(actual.size),
        "mean_absolute_rgb_difference": round(sum(stat.mean) / 3, 3),
        "pixels_over_threshold_16_percent": round(sum(pixel > 16 for pixel in pixels) * 100 / total, 3),
    }


def round5_round6(width: int, height: int):
    before = Image.open(BEFORE / f"after-corretor-normal-{width}x{height}.png")
    after = Image.open(AFTER / f"after-corretor-normal-{width}x{height}.png")
    return artefatos("round5-round6", before, after, width, height)


def claude_round6(width: int, height: int):
    reference = Image.open(CLAUDE / f"claude-design-{width}x{height}.png")
    actual = Image.open(AFTER / f"after-corretor-normal-{width}x{height}.png")
    if width > 900:
        reference = reference.crop((0, 46, reference.width, reference.height))
        actual = actual.crop((228, 0, actual.width, actual.height))
    reference = ImageOps.fit(reference, actual.size, method=Image.Resampling.LANCZOS)
    return artefatos("claude-round6", reference, actual, width, height)


if __name__ == "__main__":
    AFTER.mkdir(parents=True, exist_ok=True)
    results = [round5_round6(*viewport) for viewport in VIEWPORTS]
    results.extend(claude_round6(*viewport) for viewport in ((1440, 900), (1280, 800), (390, 843)))
    (AFTER / "visual-diff-round6.json").write_text(
        json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(results, ensure_ascii=False, indent=2))
