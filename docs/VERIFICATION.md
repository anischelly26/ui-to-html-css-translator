# Verification — 30 September 2026

- Python regression suite: 39 tests passed, including real Tesseract OCR and the API → job → reconstruction → ZIP workflow.
- Frontend workspace suite: 14 tests passed for backup validation, consistent undo, and IndexedDB persistence.
- Chromium suite: all 4 complete user journeys passed against the production Docker service.
- Docker: production image built, service started, health endpoint responded, and runtime user was confirmed as UID 10001.
- Ruff: all checks passed.
- TypeScript and production Vite build: passed.
- npm audit, including development dependencies: zero reported vulnerabilities at the time of the check.
- Production assets: approximately 87.9 KB compressed JavaScript and 6.9 KB compressed CSS.

The tests exercise malicious markup/CSS, size and pixel limits, invalid images, origin/key authorization, non-ASCII key headers, actionable validation errors, actual OCR, exported archives, model response parsing/discovery, cancellation, and queue saturation.

The browser journeys exercise real screenshot upload and OCR; element correction and undo of code/inspector/baseline; ZIP download; editing/autosave/reload; deleting during pending autosave and recovering a copy; valid/invalid backup import; offline editing and backup; arrow-key tabs; and a 390px layout without horizontal page overflow. Captured desktop/light, desktop/dark, and mobile screenshots were reviewed.

Evidence: [successful GitHub Actions run](https://github.com/anischelly26/ui-to-html-css-translator/actions/runs/36706049347) on commit `5fa280b225252249043182b3b88cb65208e659c9`. The `studio-browser-evidence` artifact contains screenshots and the browser report. Later commits can be checked through the PR’s checks tab.

Not verified: a live Ollama model; physical mobile devices; Safari/Firefox; full accessibility compliance; public deployment; production load or per-user isolation. A Starlette test-client deprecation warning is present; it does not cause failures. The current implementation is a bounded single-process studio, not a service validated for millions of users.
