import time
from dataclasses import replace

from fastapi.testclient import TestClient

from studio.api import create_app
from studio.settings import Settings


def test_api_auth_origin_and_limits():
    config = replace(Settings(), api_key="test-only-key", max_upload_bytes=12)
    with TestClient(create_app(config)) as client:
        assert client.get("/api/health").status_code == 200
        assert client.get("/api/engines").status_code == 401
        headers = {"X-Form-Key": "test-only-key"}
        assert client.get("/api/jobs/missing", headers=headers).status_code == 404
        assert client.post("/api/jobs", content=b"not an image", headers=headers).status_code == 422
        assert client.post("/api/jobs", content=b"x" * 13, headers=headers).status_code == 413
        assert (
            client.post(
                "/api/preview",
                json={"html": "<p>x</p>", "css": ""},
                headers={**headers, "Origin": "https://evil.test"},
            ).status_code
            == 403
        )
        safe = client.post(
            "/api/preview", json={"html": "<p>x</p><script>bad()</script>", "css": ""}, headers=headers
        )
        assert safe.status_code == 200
        assert safe.json()["removed_unsafe"]
        assert "<script>" not in safe.json()["document"]
        assert safe.headers["X-Content-Type-Options"] == "nosniff"
        assert client.post("/api/preview", content=b"x" * 400001, headers=headers).status_code == 413


def test_dns_rebinding_is_rejected():
    with TestClient(create_app(replace(Settings(), api_key="")), base_url="http://evil.test") as client:
        assert client.get("/api/jobs/missing").status_code == 403


def test_request_validation_returns_actionable_errors_without_echoing_input():
    with TestClient(create_app(replace(Settings(), api_key=""))) as client:
        response = client.post(
            "/api/export", json={"code": {"html": "private uploaded content", "css": ""}, "name": ""}
        )
        assert response.status_code == 422
        assert "name" in response.json()["error"]
        assert "private uploaded content" not in response.text


def test_non_ascii_key_header_is_rejected_without_a_server_error():
    with TestClient(create_app(replace(Settings(), api_key="test-key"))) as client:
        response = client.get("/api/engines", headers={"X-Form-Key": b"\xff"})
        assert response.status_code == 401


def test_api_workflow_with_real_ocr(screenshot):
    with TestClient(create_app(replace(Settings(), api_key=""))) as client:
        submitted = client.post("/api/jobs?engine=local", content=screenshot)
        assert submitted.status_code == 202
        identifier = submitted.json()["id"]
        assert len(identifier) >= 40
        deadline = time.monotonic() + 10
        job = None
        while time.monotonic() < deadline:
            job = client.get("/api/jobs/" + identifier).json()
            if job["status"] in {"complete", "failed"}:
                break
            time.sleep(0.05)
        assert job and job["status"] == "complete", job
        result = job["result"]
        assert result["elements"]
        changed = result["elements"]
        changed[0]["text"] = "Corrected title"
        code = client.post("/api/regenerate", json={"elements": changed, "image": result["image"]}).json()
        assert "Corrected title" in code["html"]
        archive = client.post("/api/export", json={"code": code, "name": "test"})
        assert archive.status_code == 200
        assert archive.content.startswith(b"PK")
        assert client.delete("/api/jobs/" + identifier).status_code == 200


def test_truncated_image_fails_with_useful_message():
    with TestClient(create_app(replace(Settings(), api_key=""))) as client:
        job_id = client.post("/api/jobs", content=b"\x89PNG\r\n\x1a\ntruncated").json()["id"]
        for _ in range(100):
            job = client.get("/api/jobs/" + job_id).json()
            if job["status"] == "failed":
                break
            time.sleep(0.01)
        assert job["status"] == "failed"
        assert "valid screenshot" in job["error"]
