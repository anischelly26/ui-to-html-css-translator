import io
from pathlib import Path

import pytest
from PIL import Image, ImageDraw, ImageFont


@pytest.fixture
def screenshot():
    font_path = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
    if not font_path.exists():
        pytest.skip("The synthetic OCR fixture needs DejaVu Sans.")
    image = Image.new("RGB", (800, 500), "white")
    draw = ImageDraw.Draw(image)
    heading = ImageFont.truetype(str(font_path), 44)
    font = ImageFont.truetype(str(font_path), 25)
    draw.text((45, 45), "Hello FORM", fill="#161b22", font=heading)
    draw.text((45, 135), "Build something useful", fill="#161b22", font=font)
    draw.rectangle((45, 200, 445, 255), outline="#777777", width=2)
    draw.text((65, 212), "Email address", fill="#444444", font=font)
    draw.rounded_rectangle((45, 295, 255, 350), radius=7, fill="#cdea8c")
    draw.text((75, 307), "Continue", fill="#161b22", font=font)
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()
