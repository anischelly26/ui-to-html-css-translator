# Verification — 30 September 2026

- Python regression suite: 32 tests passed, including real Tesseract OCR and the API → job → reconstruction → ZIP workflow.
- Ruff: all checks passed.
- TypeScript and production Vite build: passed.
- npm audit, including development dependencies: zero reported vulnerabilities at the time of the check.
- Production assets: approximately 86.9 KB compressed JavaScript and 6.7 KB compressed CSS.

The tests exercise malicious markup/CSS, size and pixel limits, invalid images, origin/key authorization, actual OCR, exported archives, model response parsing, cancellation, and queue saturation.

Not verified: rendered UI or a mobile browser walkthrough (the cloud browser could not reach the local preview); a live Ollama model; Docker build/runtime; public deployment; production load or per-user isolation. A Starlette test-client deprecation warning is present; it does not cause failures. The current implementation is a bounded single-process studio, not a service validated for millions of users.
