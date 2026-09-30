"""Same-origin API. Default access is local; remote processing requires an operator key."""

import hmac
import ipaddress
import time
from collections import deque
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal
from urllib.parse import urlparse

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool

from studio.generation import generate_code
from studio.jobs import JobStore, QueueFull
from studio.models import Code, ExportRequest, RegenerateRequest
from studio.providers import ollama_available
from studio.security import document, export_zip, sanitize_code
from studio.settings import Settings, settings


class BodyLimitMiddleware:
    """Bound JSON before validation and image bytes before queue submission, even when chunked."""

    def __init__(self, app, max_upload: int):
        self.app, self.max_upload = app, max_upload

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] not in {"POST", "PUT", "PATCH"}:
            return await self.app(scope, receive, send)
        limit = self.max_upload if scope["path"] == "/api/jobs" else 400_000
        chunks, total = [], 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            body = message.get("body", b"")
            total += len(body)
            if total > limit:
                response = JSONResponse(
                    {"error": "The upload or code document is too large."}, status_code=413
                )
                return await response(scope, receive, send)
            chunks.append(body)
            if not message.get("more_body", False):
                break
        delivered = False

        async def replay():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {"type": "http.request", "body": b"".join(chunks), "more_body": False}
            return await receive()

        await self.app(scope, replay, send)


def create_app(config: Settings = settings) -> FastAPI:
    store = JobStore(config)
    submissions = deque(maxlen=20)

    @asynccontextmanager
    async def lifespan(app):
        yield
        await run_in_threadpool(store.close)

    app = FastAPI(
        title="FORM Vision Studio",
        version="2.0.0",
        lifespan=lifespan,
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    app.state.jobs = store
    app.add_middleware(BodyLimitMiddleware, max_upload=config.max_upload_bytes)

    async def authorize(request: Request):
        host = request.client.host if request.client else ""
        try:
            local = ipaddress.ip_address(host).is_loopback
        except ValueError:
            local = host == "testclient"
        if config.api_key:
            if not hmac.compare_digest(request.headers.get("x-form-key", ""), config.api_key):
                raise HTTPException(401, "Enter the server access key in Connection settings.")
        elif not local:
            raise HTTPException(403, "Remote processing requires a server access key.")
        origin = request.headers.get("origin")
        if origin:
            parsed = urlparse(origin)
            same_origin = parsed.netloc == request.headers.get("host") and parsed.scheme == request.url.scheme
            if origin not in config.allowed_origins and not same_origin:
                raise HTTPException(403, "This origin is not allowed to access the API.")
        if not config.api_key and request.url.hostname not in {"localhost", "127.0.0.1", "::1", "testserver"}:
            raise HTTPException(403, "Use localhost to access the local API.")

    @app.middleware("http")
    async def headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; "
            "frame-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
        )
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.exception_handler(HTTPException)
    async def known_error(request, exc):
        return JSONResponse({"error": exc.detail}, status_code=exc.status_code, headers=exc.headers)

    @app.get("/api/health")
    async def health():
        return {
            "status": "ok",
            "version": "2.0.0",
            "ocr_available": bool(config.tesseract_cmd),
            "access_key_required": bool(config.api_key),
            "max_upload_mb": 8,
        }

    @app.get("/api/engines", dependencies=[Depends(authorize)])
    async def engines():
        return {
            "local": bool(config.tesseract_cmd),
            "ollama": await ollama_available(config),
            "model": config.ollama_model,
        }

    @app.post("/api/jobs", status_code=202, dependencies=[Depends(authorize)])
    async def create_job(request: Request, engine: Literal["local", "ollama"] = "local"):
        while submissions and time.monotonic() - submissions[0] > 60:
            submissions.popleft()
        if len(submissions) >= 20:
            raise HTTPException(
                429, "Too many conversions. Try again in a minute.", headers={"Retry-After": "60"}
            )
        submissions.append(time.monotonic())
        data = await request.body()
        valid_magic = data.startswith((b"\x89PNG\r\n\x1a\n", b"\xff\xd8\xff"))
        valid_magic |= data.startswith(b"RIFF") and data[8:12] == b"WEBP"
        if not valid_magic:
            raise HTTPException(422, "Choose a PNG, JPEG, or WebP screenshot.")
        try:
            identifier = store.submit(data, engine)
        except QueueFull as exc:
            raise HTTPException(429, str(exc), headers={"Retry-After": "5"}) from exc
        return {"id": identifier, "status": "queued"}

    @app.get("/api/jobs/{identifier}", dependencies=[Depends(authorize)])
    async def get_job(identifier: str):
        job = store.get(identifier)
        if not job:
            raise HTTPException(404, "This conversion has expired or does not exist.")
        return job

    @app.delete("/api/jobs/{identifier}", dependencies=[Depends(authorize)])
    async def cancel_job(identifier: str):
        if not store.cancel(identifier):
            raise HTTPException(404, "This conversion does not exist.")
        return {"status": "cancelled"}

    @app.post("/api/regenerate", dependencies=[Depends(authorize)])
    async def regenerate(payload: RegenerateRequest):
        return generate_code(payload.elements, payload.image)

    @app.post("/api/preview", dependencies=[Depends(authorize)])
    async def preview(code: Code):
        clean, removed = await run_in_threadpool(sanitize_code, code)
        return {"document": document(clean), "removed_unsafe": removed}

    @app.post("/api/export", dependencies=[Depends(authorize)])
    async def export(payload: ExportRequest):
        archive = await run_in_threadpool(export_zip, payload.code, payload.name)
        return Response(
            archive,
            media_type="application/zip",
            headers={"Content-Disposition": 'attachment; filename="form-interface.zip"'},
        )

    dist = Path(__file__).resolve().parents[1] / "web" / "dist"
    if dist.is_dir():
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

        @app.get("/{path:path}")
        async def frontend(path: str):
            if path.startswith("api/"):
                raise HTTPException(404, "Unknown API endpoint.")
            return FileResponse(dist / "index.html")

    return app


app = create_app()
