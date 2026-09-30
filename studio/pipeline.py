"""The single conversion path used by both command-line and web workflows."""

import time
from collections.abc import Callable

from studio.detection import OCRUnavailable, detect_elements
from studio.generation import generate_code
from studio.images import load_image, sample_color
from studio.models import ImageInfo, Result
from studio.providers import generate_with_ollama
from studio.settings import Settings


def convert(
    data: bytes, config: Settings, engine: str = "local", progress: Callable = lambda *_: None
) -> Result:
    started = time.monotonic()
    progress("preparing", 15)
    source = load_image(data, config)
    progress("detecting", 35)
    warnings = []
    try:
        elements, image, warnings = detect_elements(source.pixels, config)
    except OCRUnavailable:
        if engine == "local":
            raise
        height, width = source.pixels.shape[:2]
        elements, image = [], ImageInfo(width=width, height=height, background=sample_color(source.pixels))
        warnings.append("OCR was unavailable. The vision model received the screenshot without OCR guidance.")
    progress("generating", 65)
    if engine == "ollama":
        code, provider_warnings = generate_with_ollama(source.png, elements, config)
        warnings.extend(provider_warnings)
    else:
        code = generate_code(elements, image)
    if source.resized:
        warnings.append("The screenshot was scaled to a maximum dimension of 2400px for processing.")
    progress("reviewing", 90)
    palette = list(dict.fromkeys([image.background] + [element.color for element in elements]))[:8]
    return Result(
        code=code,
        elements=elements,
        image=image,
        engine=engine,
        duration_ms=round((time.monotonic() - started) * 1000),
        warnings=warnings,
        palette=palette,
    )
