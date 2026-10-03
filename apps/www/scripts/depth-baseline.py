"""Offline relative-depth comparison; never treat camera depth as world height.
Usage: python apps/www/scripts/depth-baseline.py
Requires: torch, transformers (4.x), pillow.
"""
from pathlib import Path
import json
import time
from PIL import Image
from transformers import pipeline

root = Path(__file__).resolve().parents[3]
started = time.monotonic()
model = "depth-anything/Depth-Anything-V2-Small-hf"
estimator = pipeline(task="depth-estimation", model=model, device="cpu")
source = Image.open(root / "docs/art/moodboards/02-eigene-welt/it2-waldhuette-abend.jpg").convert("RGB")
result = estimator(source)
depth = result["depth"].resize(source.size, Image.Resampling.NEAREST)
output = root / "docs/lab/experiments/heightmap-test/iteration-3"
output.mkdir(parents=True, exist_ok=True)
depth.save(output / "depth-anything.png")
depth.save(root / "apps/www/public/image-to-voxel/cabin-depth.png")
metadata = {"model": model, "durationSeconds": time.monotonic() - started, "apiCostUsd": 0, "device": "cpu", "meaning": "relative camera proximity, normalized per image; not world height", "size": source.size}
(output / "depth-run.json").write_text(json.dumps(metadata, indent=2) + "\n")
print(json.dumps(metadata))
