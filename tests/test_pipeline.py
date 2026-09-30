import io
from dataclasses import replace

import numpy as np
import pytest
from PIL import Image
from pydantic import ValidationError

from studio.detection import OCRUnavailable
from studio.generation import generate_code
from studio.images import ImageValidationError, foreground_for, load_image, sample_color
from studio.models import Bounds, Element, ImageInfo, RegenerateRequest
from studio.pipeline import convert
from studio.settings import Settings


@pytest.mark.parametrize("data", [b"", b"not an image", b"<svg></svg>"])
def test_rejects_invalid_images(data):
    with pytest.raises(ImageValidationError):
        load_image(data, Settings())


def test_rejects_size_and_pixel_limits(screenshot):
    with pytest.raises(ImageValidationError):
        load_image(screenshot, replace(Settings(), max_upload_bytes=3))
    with pytest.raises(ImageValidationError):
        load_image(screenshot, replace(Settings(), max_pixels=10))


def test_normalizes_alpha_and_scales():
    output = io.BytesIO()
    Image.new("RGBA", (3000, 900), (0, 0, 0, 0)).save(output, "PNG")
    image = load_image(output.getvalue(), Settings())
    assert image.pixels.shape == (720, 2400, 3)
    assert image.resized
    assert sample_color(image.pixels) == "#ffffff"


def test_color_channel_order_is_rgb():
    assert sample_color(np.array([[[0, 0, 255]]], dtype=np.uint8)) == "#ff0000"
    assert foreground_for("#ffffff") == "#161b22"
    assert foreground_for("#161b22") == "#ffffff"


def test_generation_escapes_text_and_preserves_all_kinds():
    elements = [
        Element(
            id=f"e-{i}",
            kind=kind,
            text='<script>alert("x")</script>',
            bounds=Bounds(x=10, y=i * 45, width=190, height=35),
        )
        for i, kind in enumerate(["text", "heading", "button", "input", "container"])
    ]
    code = generate_code(elements, ImageInfo(width=500, height=300, background="#ffffff"))
    assert "<script>" not in code.html
    assert "&lt;script&gt;" in code.html
    assert all(f'data-element-id="e-{i}"' in code.html for i in range(5))
    assert "position: absolute" not in code.css
    assert "@media" in code.css


def test_bounds_and_duplicate_ids_are_validated():
    element = Element(id="e-1", kind="text", bounds=Bounds(x=90, y=0, width=20, height=10))
    image = ImageInfo(width=100, height=100, background="#ffffff")
    with pytest.raises(ValidationError):
        RegenerateRequest(elements=[element], image=image)
    element.bounds.x = 1
    with pytest.raises(ValidationError):
        RegenerateRequest(elements=[element, element], image=image)


def test_missing_ocr_is_actionable(screenshot):
    with pytest.raises(OCRUnavailable, match="Tesseract"):
        convert(screenshot, replace(Settings(), tesseract_cmd=""))


def test_actual_ocr_and_generation(screenshot):
    if not Settings().tesseract_cmd:
        pytest.skip("Tesseract not installed")
    stages = []
    result = convert(screenshot, Settings(), progress=lambda status, value: stages.append((status, value)))
    recognized = " ".join(element.text for element in result.elements)
    assert "Hello FORM" in recognized
    assert "Continue" in recognized
    assert result.duration_ms > 0
    assert result.image.width == 800
    assert result.code.html
    assert stages[0][0] == "preparing" and stages[-1][0] == "reviewing"
    assert all(element.bounds.x + element.bounds.width <= 800 for element in result.elements)
