# Architecture and upgrade audit

## Original weaknesses

The detector had an unclosed parenthesis and undefined detection constants. Configuration validated a hardcoded Windows Tesseract path during import and created directories as a side effect. OCR ran twice per contour, a one-cluster k-means pass was repeated, and BGR colors were treated as RGB. Two HTML generators disagreed about input type names, omitted labels, inserted unescaped text, and used absolute coordinates. Exceptions were swallowed and the CLI did not report failure through its exit status. No dependency manifest, tests, API, studio interface, or actual vision-provider integration was present.

## Current boundaries

| Layer | Responsibility |
| --- | --- |
| `studio/settings.py` | Environment configuration, limits, portable Tesseract discovery |
| `studio/images.py` | Byte/pixel validation, EXIF normalization, resizing, RGB color sampling |
| `studio/detection.py` | One grayscale OCR pass; grouped words and component suggestions |
| `studio/generation.py` | Escaped, semantic HTML and responsive grid/row CSS |
| `studio/providers.py` | Optional Ollama integration with bounded, validated output |
| `studio/security.py` | HTML allowlists, parsed CSS filtering, standalone document and ZIP export |
| `studio/jobs.py` | Bounded worker pool, expiring job capabilities, cancellation |
| `studio/api.py` | Same-origin API, operator-key access, body limits, static frontend |
| `web/src/components` | Canvas, editor, inspector, shared keyboard tabs, and accessible modal boundaries |
| `web/src/hooks/useWorkspace.ts` | Autosave, workspace switching, deletion/recovery, and consistent reconstruction undo |
| `web/src/hooks/usePreview.ts` | Debounced, cancellable previews tied to the current code |
| `web/src/workspace.ts` | Typed backup validation and reconstruction snapshots |
| `web/src/storage.ts` | Versioned IndexedDB persistence |

The CLI and API share the conversion pipeline. Uploaded data is handled in memory and discarded when processing finishes. Browser projects are independent from expiring server jobs; they can be backed up and imported. Source text is treated as untrusted data in both heuristic and model generation.

## Product direction

The product’s differentiator is inspectability and correction: see what the pipeline understood, correct it, compare the result, and edit the code. Example data is clearly identified and no unsupported visual-fidelity score is shown. The visual system uses neutral surfaces, green accents, reusable components, system typography, and light/dark tokens. The sample is functional HTML rather than a decorative mock image.

## Scale limits and next architecture

Current jobs are bounded and in memory. Process restart loses unfinished/retained jobs. The global operator key is suitable for one trusted operator, not separate customers. Screenshots are not persisted on the server, and no user accounts or billing are fabricated.

For a public service: introduce an identity provider and object-level authorization, replace capabilities with user-owned durable jobs, use a shared queue with isolated workers, set user quotas, add opt-in object storage with retention/deletion, use distributed rate limiting and monitoring, and benchmark representative screenshots and model workloads. Multi-process deployment requires these changes first.

## Evidence limits

The source and pipeline were directly inspected and exercised. Repository CI builds and starts the unprivileged Docker image and runs Chromium against that production service. Its browser suite covers source upload, real OCR, element correction/undo, editing, persistence, backup/import, offline states, ZIP download, keyboard tabs, and a mobile viewport. Screenshots and traces provide reviewable evidence; actual run status is recorded in [verification notes](VERIFICATION.md). Live model generation, physical mobile devices, full accessibility compliance, and production scale remain outside the measured evidence. Deployment preparation does not constitute deployment.
