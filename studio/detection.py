"""One page-level OCR pass, then bounded geometry inference and text grouping."""

from collections import defaultdict

import cv2
import pytesseract

from studio.images import foreground_for, sample_color
from studio.models import Bounds, Element, ImageInfo
from studio.settings import Settings


class OCRUnavailable(RuntimeError):
    pass


def detect_elements(image, config: Settings) -> tuple[list[Element], ImageInfo, list[str]]:
    if not config.tesseract_cmd:
        raise OCRUnavailable("Tesseract is not installed. Install it and restart the server.")
    pytesseract.pytesseract.tesseract_cmd = config.tesseract_cmd
    height, width = image.shape[:2]
    ocr_image = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    # Grayscale keeps antialiased text while avoiding colored button backgrounds being skipped.
    try:
        data = pytesseract.image_to_data(
            ocr_image,
            lang=config.ocr_language,
            config="--oem 3 --psm 11",
            output_type=pytesseract.Output.DICT,
            timeout=config.ocr_timeout,
        )
    except pytesseract.TesseractNotFoundError as exc:
        raise OCRUnavailable("The configured Tesseract executable was not found.") from exc
    except (pytesseract.TesseractError, RuntimeError) as exc:
        raise OCRUnavailable("OCR could not finish. Check the language pack or try a smaller image.") from exc

    lines = defaultdict(list)
    for i, text in enumerate(data["text"]):
        confidence = float(data["conf"][i])
        if text.strip() and confidence >= 25:
            key = (data["block_num"][i], data["par_num"][i], data["line_num"][i])
            lines[key].append(i)

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    rectangles = []
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        if 30 <= w < width * 0.9 and 20 <= h <= 100 and w / h > 1.2:
            approximation = cv2.approxPolyDP(contour, 0.025 * cv2.arcLength(contour, True), True)
            if 4 <= len(approximation) <= 10:
                rectangles.append((x, y, w, h))
    rectangles.sort(key=lambda box: box[2] * box[3])

    elements = []
    used_boxes = set()
    for indices in sorted(lines.values(), key=lambda line: (data["top"][line[0]], data["left"][line[0]])):
        x = min(data["left"][i] for i in indices)
        y = min(data["top"][i] for i in indices)
        right = max(data["left"][i] + data["width"][i] for i in indices)
        bottom = max(data["top"][i] + data["height"][i] for i in indices)
        text = " ".join(data["text"][i].strip() for i in indices)[:3000]
        w, h = max(1, right - x), max(1, bottom - y)
        kind = "heading" if h >= max(24, height * 0.035) else "text"
        color = sample_color(
            image[max(0, y - 3) : min(height, bottom + 3), max(0, x - 3) : min(width, right + 3)]
        )
        for box in rectangles:
            bx, by, bw, bh = box
            if bx <= x and by <= y and bx + bw >= right and by + bh >= bottom and bw < max(w * 5, 200):
                if box in used_boxes:
                    break
                used_boxes.add(box)
                color = sample_color(image[by : by + bh, bx : bx + bw])
                # These are suggestions, not semantic certainty. The studio makes them editable.
                kind = "input" if bw / bh > 5 and color.lower() in {"#ffffff", "#fefefe"} else "button"
                x, y, w, h = box
                break
        w, h = min(w, width - x), min(h, height - y)
        elements.append(
            Element(
                id=f"element-{len(elements) + 1}",
                kind=kind,
                text=text,
                confidence=round(sum(float(data["conf"][i]) for i in indices) / len(indices), 1),
                bounds=Bounds(x=x, y=y, width=w, height=h),
                color=color,
                foreground=foreground_for(color),
            )
        )
        if len(elements) >= config.max_elements:
            break

    info = ImageInfo(width=width, height=height, background=sample_color(image))
    warnings = ["Component types and layout are heuristic estimates. Review them before exporting."]
    if not elements:
        warnings.append("No readable text was detected. Try a sharper screenshot or the vision model.")
    if len(elements) == config.max_elements:
        warnings.append("The element limit was reached; consider cropping the screenshot into sections.")
    if any(element.confidence is not None and element.confidence < 65 for element in elements):
        warnings.append("Some text has low OCR confidence. Review the highlighted elements.")
    return elements, info, warnings
