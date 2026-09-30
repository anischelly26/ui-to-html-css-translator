import threading
from dataclasses import replace

import pytest

from studio.jobs import JobStore, QueueFull
from studio.settings import Settings


def test_queue_bound_and_cancellation(monkeypatch):
    started, release = threading.Event(), threading.Event()

    def blocked(data, config, engine, progress):
        progress("detecting", 35)
        started.set()
        release.wait(3)
        progress("generating", 65)

    monkeypatch.setattr("studio.jobs.convert", blocked)
    store = JobStore(replace(Settings(), max_jobs=1, workers=1))
    try:
        identifier = store.submit(b"fixture", "local")
        assert started.wait(2)
        with pytest.raises(QueueFull):
            store.submit(b"fixture", "local")
        assert store.cancel(identifier)
        assert store.get(identifier)["status"] == "cancelled"
        # Cancelled jobs retain their resource slot until the in-flight stage finishes.
        with pytest.raises(QueueFull):
            store.submit(b"fixture", "local")
    finally:
        release.set()
        store.close()
    assert store.get(identifier)["status"] == "cancelled"
