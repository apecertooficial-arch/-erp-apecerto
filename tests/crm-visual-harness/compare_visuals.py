"""Gera evidência visual normalizada do Funil local contra o Claude Design.

Desktop ignora apenas a barra preta do laboratório e a sidebar obrigatória do
ERP. A referência é redimensionada para a área útil do produto; por isso a
estatística serve para regressão estrutural, não como pixel-perfect de dados.
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageChops, ImageEnhance, ImageOps, ImageStat


ROOT = Path(__file__).resolve().parents[2]
REFERENCE = ROOT / "deliverables/crm-v3-paridade-20260827/claude-design"
EVIDENCE = ROOT / "deliverables/crm-correcao-6-2-para-10/visual-round-2"


def normalize(reference: Image.Image, actual: Image.Image, viewport: int):
    if viewport > 900:
        reference = reference.crop((0, 46, reference.width, reference.height))
        actual = actual.crop((228, 0, actual.width, actual.height))
    reference = ImageOps.fit(reference, actual.size, method=Image.Resampling.LANCZOS)
    return reference.convert("RGB"), actual.convert("RGB")


def compare(viewport: int, height: int):
    reference_path = REFERENCE / f"claude-design-{viewport}x{height}.png"
    actual_path = EVIDENCE / f"final-corretor-normal-{viewport}x{height}.png"
    reference, actual = normalize(Image.open(reference_path), Image.open(actual_path), viewport)

    side = Image.new("RGB", (reference.width * 2, reference.height), "white")
    side.paste(reference, (0, 0))
    side.paste(actual, (reference.width, 0))
    side.save(EVIDENCE / f"side-by-side-{viewport}x{height}.png")

    Image.blend(reference, actual, 0.5).save(EVIDENCE / f"overlay-50-{viewport}x{height}.png")
    raw_diff = ImageChops.difference(reference, actual)
    ImageEnhance.Contrast(raw_diff).enhance(2.2).save(EVIDENCE / f"diff-{viewport}x{height}.png")

    stat = ImageStat.Stat(raw_diff)
    mean = sum(stat.mean) / len(stat.mean)
    luminance = raw_diff.convert("L")
    pixels = luminance.get_flattened_data() if hasattr(luminance, "get_flattened_data") else luminance.getdata()
    changed = sum(1 for pixel in pixels if pixel > 16)
    total = raw_diff.width * raw_diff.height
    return {
        "viewport": f"{viewport}x{height}",
        "comparison_size": list(actual.size),
        "mean_absolute_rgb_difference": round(mean, 3),
        "pixels_over_threshold_16_percent": round(changed * 100 / total, 3),
        "normalization": "Claude sem barra do laboratório; produção sem sidebar ERP" if viewport > 900 else "viewport integral",
    }


if __name__ == "__main__":
    results = [compare(1440, 900), compare(1280, 800), compare(390, 843)]
    (EVIDENCE / "visual-diff-metrics.json").write_text(
        json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(results, ensure_ascii=False, indent=2))
