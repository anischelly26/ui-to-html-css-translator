"""Validate before allocating an OpenCV matrix; normalize orientation and dimensions."""

import io
import warnings
from dataclasses import dataclass

import cv2
import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

from studio.settings import Settings


class ImageValidationError(ValueError):
    pass


@dataclass
class LoadedImage:
    pixels: np.ndarray
    png: bytes
    original_size: tuple[int, int]
    resized: bool


def load_image(data: bytes, config: Settings) -> LoadedImage:
    if not data or len(data) > config.max_upload_bytes:
        raise ImageValidationError("Choose an image smaller than 8 MB.")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as probe:
                if probe.format not in {"PNG", "JPEG", "WEBP"}:
                    raise ImageValidationError("Only PNG, JPEG, and WebP screenshots are supported.")
                if probe.width * probe.height > config.max_pixels:
                    raise ImageValidationError("The screenshot must contain fewer than 12 million pixels.")
                if getattr(probe, "n_frames", 1) != 1:
                    raise ImageValidationError("Choose a still image, not an animation.")
                probe.verify()
            with Image.open(io.BytesIO(data)) as source:
                source = ImageOps.exif_transpose(source).convert("RGBA")
                original = source.size
                background = Image.new("RGBA", source.size, "white")
                background.alpha_composite(source)
                normalized = background.convert("RGB")
                normalized.thumbnail((config.max_dimension, config.max_dimension), Image.Resampling.LANCZOS)
                out = io.BytesIO()
                normalized.save(out, format="PNG")
                return LoadedImage(
                    pixels=cv2.cvtColor(np.array(normalized), cv2.COLOR_RGB2BGR),
                    png=out.getvalue(),
                    original_size=original,
                    resized=normalized.size != original,
                )
    except ImageValidationError:
        raise
    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        Image.DecompressionBombWarning,
        Image.DecompressionBombError,
    ) as exc:
        raise ImageValidationError("This file could not be decoded as a valid screenshot.") from exc


def preprocess_image(image: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    enhanced = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gray)
    return cv2.adaptiveThreshold(enhanced, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 31, 5)


def sample_color(image: np.ndarray) -> str:
    """Median of a bounded sample avoids expensive per-contour k-means and BGR confusion."""
    pixels = image.reshape(-1, 3)
    b, g, r = np.median(pixels[:: max(1, len(pixels) // 1024)], axis=0).astype(int)
    return f"#{r:02x}{g:02x}{b:02x}"


def contrast_ratio(a: str, b: str) -> float:
    def luminance(color):
        values = [int(color[i : i + 2], 16) / 255 for i in (1, 3, 5)]
        linear = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in values]
        return sum(v * weight for v, weight in zip(linear, (0.2126, 0.7152, 0.0722), strict=True))

    light, dark = sorted((luminance(a), luminance(b)), reverse=True)
    return (light + 0.05) / (dark + 0.05)


def foreground_for(color: str) -> str:
    return "#ffffff" if contrast_ratio(color, "#ffffff") >= contrast_ratio(color, "#161b22") else "#161b22"
