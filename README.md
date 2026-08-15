<div align="center">

# UI → HTML/CSS Translator

### Computer vision + OCR prototype for reconstructing web interfaces from screenshots

![Python](https://img.shields.io/badge/Python-3.x-111111?style=for-the-badge&logo=python)
![OpenCV](https://img.shields.io/badge/OpenCV-Computer%20Vision-111111?style=for-the-badge&logo=opencv)
![Tesseract](https://img.shields.io/badge/Tesseract-OCR-111111?style=for-the-badge)

</div>

---

## What it does

This project explores a simple idea: **turn a UI screenshot into editable web structure**.

The current prototype processes an input screenshot, detects visual interface elements, extracts text with OCR, estimates dominant colors and geometry, then generates an HTML representation of the detected components.

It is an experimental foundation for a broader **UI-to-Code** workflow.

## Pipeline

```text
UI Screenshot
     ↓
Image preprocessing
     ↓
Contour / component detection
     ↓
OCR text extraction
     ↓
Element classification
     ↓
Position + color estimation
     ↓
Generated HTML
```

## Core ideas

- **Image preprocessing** with grayscale conversion, CLAHE and adaptive thresholding
- **UI element detection** using OpenCV contours and geometry
- **Text extraction** with Tesseract OCR
- **Basic component classification** for buttons, labels and input fields
- **Dominant-color extraction** using clustering
- **HTML generation** from detected positions, dimensions, colors and text
- **Debug visualizations** to inspect the detection pipeline

## Project structure

```text
ui-to-html-css-translator/
├── config.py             # thresholds, paths and detection settings
├── image_processor.py    # image loading and preprocessing
├── element_detector.py   # detection, OCR and classification
├── html_generator.py     # HTML generation utilities
├── main.py               # end-to-end pipeline
├── input/                # source screenshots
└── output/               # generated files / debug images
```

## Current scope

This repository is a **prototype**, not a production UI generator. The current approach is intentionally lightweight and heuristic-based, which makes the project useful for experimenting with the core reconstruction pipeline before moving to richer vision-language models and semantic layout understanding.

## Next steps

- Improve responsive layout reconstruction
- Detect a wider range of UI components
- Reconstruct CSS more accurately
- Add semantic grouping and hierarchy detection
- Improve OCR robustness
- Compare heuristic detection with vision-language-model approaches
- Generate React / component-based output

## About

Built by **Anis Chelly**, Software Engineering student focused on **AI, computer vision, backend systems and intelligent software products**.

> I’m interested in building software that does more than display information — software that understands, transforms and automates it.
