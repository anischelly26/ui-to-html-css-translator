# Testing the complete studio

The user story is screenshot upload → bounded Python job → real OCR → inspect/correct → responsive preview → standalone HTML/CSS export. Workspaces live independently in IndexedDB and remain editable when processing is unavailable.

## Regression layers

| Layer | Command | What failures mean |
| --- | --- | --- |
| Pipeline, API, sanitation and workers | `pytest -q` | Image validation, OCR, generation, authorization, export or resource limits changed |
| Python quality | `ruff check studio tests config.py main.py element_detector.py image_processor.py html_generator.py` | Source conventions or accidental mistakes need correction |
| Workspace contracts and persistence | `npm --prefix web test` | Backups, geometry validation, reconstruction snapshots or storage operations changed |
| Frontend types and production assets | `npm --prefix web run build` | Components or application contracts no longer compile |
| Dependency report | `npm --prefix web audit` | Review current reported vulnerabilities |
| Complete browser workflow | `npm --prefix web run test:e2e` | A user journey fails against the real service |

The browser suite uses a generated PNG with readable text, not mocked detection results. CI runs it against the production Docker image, confirms UID 10001, and waits for `/api/health` before testing. The optional Ollama integration is tested with controlled HTTP responses; these tests do not establish live model availability or quality.

The Chromium tests check editing/reload, deleting during a pending autosave, undoing removal, valid/invalid backup import, offline editing/backup, OCR correction and complete undo, ZIP download, keyboard navigation, light/dark rendering, and a 390px layout with no horizontal page overflow. Desktop, dark and mobile screenshots are stored with the GitHub Actions artifact. Failed tests retain their screenshot, error context and trace. Only synthetic fixtures and the public test key are used in CI.

## Manual review before a public launch

Review representative screenshots with different languages, dense layouts, low contrast, tables and mobile crops. Compare generated structure and text with the source; OCR confidence cannot establish visual fidelity. Check keyboard focus, screen-reader announcements, browser zoom, touch targets, Safari/Firefox, and physical mobile devices. Start the configured Ollama model and test its real timeout/error and reconstruction behavior.

A public multi-user launch additionally requires the identity, queue, storage, quota and load-test architecture described in [ARCHITECTURE.md](ARCHITECTURE.md). Passing this suite establishes the bounded studio workflow, not multi-tenant security or production capacity.
