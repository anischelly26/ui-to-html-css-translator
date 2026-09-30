# FORM — Vision to Code Studio

A local-first studio built from Anis Chelli’s VERMEG UI-to-HTML/CSS prototype. Upload a screenshot, inspect the detected text and components, correct mistakes, edit the generated HTML/CSS, and export a standalone page.

## What works

- PNG, JPEG, and WebP upload, drag-and-drop, and clipboard paste.
- One page-level Tesseract pass with bounded geometric component inference.
- Source overlays, low-confidence filtering, element search, and editable text/type/colors.
- Responsive row/grid reconstruction, HTML/CSS editing, source/preview comparison, and three preview widths.
- Optional Ollama vision generation with structured responses and server-side sanitation.
- IndexedDB workspaces, automatic saving, validated JSON backup/import, and undo that restores code and inspector state together.
- Light/dark themes, keyboard shortcuts, arrow-key tabs, focus states, modal focus management, and reduced-motion support.
- Sanitized ZIP export; no scripts or remote assets in exported documents.

The Orbit workspace is an explicitly labelled editable example. Its OCR confidence and processing time are not fabricated. Local reconstruction is heuristic: it does not recover an application’s business logic, original fonts, images, or interactions. OCR confidence measures text recognition, not screenshot fidelity. Vision-generated code also needs review.

## Quick start

Install **Python 3.11+**, **Node 24+**, and **Tesseract with the English language pack**. On Debian/Ubuntu: `sudo apt-get install tesseract-ocr`.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.lock
pip install --no-deps -e .
npm --prefix web ci
npm --prefix web run build
uvicorn studio.api:app --host 127.0.0.1 --port 8000
```

Open `http://localhost:8000`. On Windows, activate with `.venv\Scripts\Activate.ps1`. If Tesseract is not on PATH, set `FORM_TESSERACT_CMD` to its executable path.

### Development

Run the Python server above and `npm --prefix web run dev` in another terminal. The Vite app uses port 5173 and proxies `/api` to the Python server. Rebuild before using the production server after frontend edits.

### Optional vision model

```bash
ollama pull llava
ollama serve
```

The server defaults to `http://127.0.0.1:11434` and model `llava`. Configure another supported vision model with `FORM_OLLAMA_MODEL`. Refresh Connection settings to check availability. Provider requests use structured JSON, a low temperature, fixed output limits, and no environment proxy. A live Ollama generation was not available during this upgrade; its response contract was tested with mocked HTTP responses.

### CLI

```bash
form-studio screenshot.png --output output
form-studio screenshot.png --engine ollama --output output
```

The CLI writes `index.html`, `styles.css`, and `analysis.json`, and exits with a failure status when conversion fails. The old `python main.py` entry point delegates to this same pipeline; old internal function signatures have been replaced by typed interfaces.

## Configuration and security

See `.env.example`. Configuration comes from process environment; the file is not automatically loaded.

- Default processing access is loopback-only, with origin and host validation against DNS rebinding.
- Set a strong `FORM_API_KEY` before exposing the server beyond your machine, and enter it in Connection settings. Browser keys remain in memory and are never saved in workspaces.
- This key is for one trusted workspace/server. It is **not multi-user authentication or tenant isolation**.
- The API accepts at most 8 MB per image, 12 million decoded pixels, 2400px per dimension, and 180 detected elements. JSON bodies are also bounded, including chunked requests.
- Two workers process at most eight active/queued jobs. Job capabilities are unguessable; completed results expire and retention is bounded. Images are not written to server disk.
- Cancellation discards output and stops at stage boundaries; a running OCR or model call finishes or times out before releasing its slot.
- HTML allowlists, parsed CSS filtering, sandboxed previews, restrictive CSP, and export sanitation block scripts and remote resources. No general-purpose JavaScript execution is supported.

## Tests

```bash
pip install 'pytest>=8,<10' 'ruff>=0.11,<1'
pytest -q
ruff check studio tests config.py main.py element_detector.py image_processor.py html_generator.py
npm --prefix web run build
npm --prefix web test
npm --prefix web audit
```

Tests cover actual OCR on a synthetic screenshot, image bounds, malformed input, HTML escaping, hostile HTML/CSS, provider contracts, API authorization/origin checks, reconstruction/export, queue saturation, cancellation, workspace backups, and IndexedDB persistence. GitHub Actions also builds the production Docker image and exercises the studio with Chromium. See [verification notes](docs/VERIFICATION.md) for actual results and limits.

For a local browser regression run, activate the Python environment, build the frontend, then run:

```bash
cd web
npx playwright install chromium
npm run test:e2e
```

The runner starts the Python service automatically. To test an existing service, set `FORM_TEST_BASE_URL` and `FORM_TEST_KEY` to its URL and operator key. CI uses a synthetic screenshot and an explicitly test-only key. Screenshots and failure traces are retained as the `studio-browser-evidence` artifact. See [testing guide](docs/TESTING.md).

## Deployment and scale

The Dockerfile builds the frontend and runs the Python service as an unprivileged user. Build with `docker build -t form-studio .`; set `FORM_API_KEY` and run it with a port bound to localhost. Docker build and startup are checked in CI; public hosting and production load remain unverified.

```bash
docker build -t form-studio .
# Set FORM_API_KEY in your terminal to your own strong operator key first.
docker run --rm -p 127.0.0.1:8000:8000 --env FORM_API_KEY form-studio
```

This is a **single-process studio**, not a service proven for millions of users. Do not add multiple Uvicorn workers: jobs live in process memory. A public product needs per-user identity/authorization, a shared durable queue, isolated workers, persistent storage with retention controls, distributed rate limiting, monitoring, and measured load tests. See [architecture](docs/ARCHITECTURE.md).

Built by Anis Chelli. Original VERMEG work: OpenCV + Tesseract UI reconstruction; this upgrade adds the inspectable studio and optional vision-provider integration.
