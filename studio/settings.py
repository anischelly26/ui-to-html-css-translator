"""Environment configuration without filesystem or OCR side effects at import."""

import os
import shutil
from dataclasses import dataclass, field
from urllib.parse import urlparse


@dataclass(frozen=True)
class Settings:
    max_upload_bytes: int = 8 * 1024 * 1024
    max_pixels: int = 12_000_000
    max_dimension: int = 2400
    max_elements: int = 180
    ocr_timeout: int = 25
    max_jobs: int = 8
    workers: int = 2
    job_ttl: int = 1800
    api_key: str = field(default_factory=lambda: os.getenv("FORM_API_KEY", ""))
    ocr_language: str = field(default_factory=lambda: os.getenv("FORM_OCR_LANGUAGE", "eng"))
    tesseract_cmd: str = field(
        default_factory=lambda: os.getenv("FORM_TESSERACT_CMD") or shutil.which("tesseract") or ""
    )
    ollama_url: str = field(default_factory=lambda: os.getenv("FORM_OLLAMA_URL", "http://127.0.0.1:11434"))
    ollama_model: str = field(default_factory=lambda: os.getenv("FORM_OLLAMA_MODEL", "llava"))
    allowed_origins: tuple[str, ...] = field(
        default_factory=lambda: tuple(
            x.strip()
            for x in os.getenv(
                "FORM_ALLOWED_ORIGINS",
                "http://localhost:8000,http://127.0.0.1:8000,http://localhost:5173,http://127.0.0.1:5173",
            ).split(",")
            if x.strip()
        )
    )

    def __post_init__(self):
        url = urlparse(self.ollama_url)
        if url.scheme not in {"http", "https"} or not url.hostname or url.username or url.password:
            raise ValueError("FORM_OLLAMA_URL must be an HTTP(S) server URL without credentials.")
        if url.query or url.fragment:
            raise ValueError("FORM_OLLAMA_URL cannot contain a query or fragment.")


settings = Settings()
