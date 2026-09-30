"""Portable command-line entry point with meaningful exit status."""

import argparse
import json
import logging
from pathlib import Path

from studio.pipeline import convert
from studio.security import document
from studio.settings import settings


def main():
    parser = argparse.ArgumentParser(description="Reconstruct a screenshot as an inspectable HTML interface.")
    parser.add_argument("image", type=Path)
    parser.add_argument("--output", type=Path, default=Path("output"))
    parser.add_argument("--engine", choices=["local", "ollama"], default="local")
    args = parser.parse_args()
    try:
        if args.image.stat().st_size > settings.max_upload_bytes:
            raise ValueError("Choose an image smaller than 8 MB.")
        result = convert(args.image.read_bytes(), settings, args.engine)
        args.output.mkdir(parents=True, exist_ok=True)
        (args.output / "index.html").write_text(document(result.code), encoding="utf-8")
        (args.output / "styles.css").write_text(result.code.css, encoding="utf-8")
        (args.output / "analysis.json").write_text(
            json.dumps(result.model_dump(), indent=2), encoding="utf-8"
        )
        print(
            f"Reconstructed {len(result.elements)} elements in {result.duration_ms}ms "
            f"→ {args.output / 'index.html'}"
        )
        for warning in result.warnings:
            print(f"Review: {warning}")
    except (OSError, ValueError, RuntimeError) as exc:
        logging.error("Conversion failed: %s", exc)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
