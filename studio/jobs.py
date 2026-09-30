"""Bounded in-process jobs with expiring capabilities and explicit cancellation."""

import secrets
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field

from studio.detection import OCRUnavailable
from studio.images import ImageValidationError
from studio.pipeline import convert
from studio.providers import ProviderError
from studio.settings import Settings


class QueueFull(RuntimeError):
    pass


@dataclass
class Job:
    id: str
    created: float = field(default_factory=time.monotonic)
    status: str = "queued"
    progress: int = 0
    result: dict | None = None
    error: str | None = None
    cancelled: bool = False
    finished: bool = False

    def public(self):
        return {
            "id": self.id,
            "status": self.status,
            "progress": self.progress,
            "result": self.result,
            "error": self.error,
        }


class JobStore:
    def __init__(self, config: Settings):
        self.config = config
        self.lock = threading.Lock()
        self.jobs: dict[str, Job] = {}
        self.executor = ThreadPoolExecutor(max_workers=config.workers, thread_name_prefix="form-worker")

    def submit(self, data: bytes, engine: str) -> str:
        with self.lock:
            self._cleanup()
            if sum(not job.finished for job in self.jobs.values()) >= self.config.max_jobs:
                raise QueueFull(
                    "The processing queue is full. Wait for a conversion to finish and try again."
                )
            if len(self.jobs) >= 40:
                completed = [job for job in self.jobs.values() if job.finished]
                if completed:
                    del self.jobs[min(completed, key=lambda job: job.created).id]
            identifier = secrets.token_urlsafe(32)
            self.jobs[identifier] = Job(identifier)
        self.executor.submit(self._run, identifier, data, engine)
        return identifier

    def _cleanup(self):
        expired = [
            identifier
            for identifier, job in self.jobs.items()
            if job.finished and time.monotonic() - job.created > self.config.job_ttl
        ]
        for identifier in expired:
            del self.jobs[identifier]

    def get(self, identifier: str) -> dict | None:
        with self.lock:
            self._cleanup()
            job = self.jobs.get(identifier)
            return job.public() if job else None

    def cancel(self, identifier: str) -> bool:
        with self.lock:
            job = self.jobs.get(identifier)
            if not job:
                return False
            if not job.finished:
                job.cancelled = True
                job.status = "cancelled"
            return True

    def _run(self, identifier: str, data: bytes, engine: str):
        def progress(status, value):
            with self.lock:
                job = self.jobs[identifier]
                if job.cancelled:
                    raise InterruptedError
                job.status, job.progress = status, value

        try:
            result = convert(data, self.config, engine, progress)
            with self.lock:
                job = self.jobs[identifier]
                if not job.cancelled:
                    job.result, job.status, job.progress = result.model_dump(), "complete", 100
        except InterruptedError:
            pass
        except (OCRUnavailable, ImageValidationError, ProviderError) as exc:
            with self.lock:
                job = self.jobs[identifier]
                if not job.cancelled:
                    job.status, job.error = "failed", str(exc)
        except Exception:
            import logging

            logging.getLogger(__name__).exception("Conversion failed")
            with self.lock:
                job = self.jobs[identifier]
                if not job.cancelled:
                    job.status, job.error = (
                        "failed",
                        "The conversion could not finish. Try another screenshot.",
                    )
        finally:
            with self.lock:
                self.jobs[identifier].finished = True

    def close(self):
        self.executor.shutdown(wait=True, cancel_futures=False)
