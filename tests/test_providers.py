import json
from dataclasses import replace

import httpx
import pytest

from studio.models import Code
from studio.providers import ProviderError, generate_with_ollama
from studio.settings import Settings


def test_vision_provider_contract_and_sanitation(monkeypatch):
    captured = {}

    def handler(request):
        captured.update(json.loads(request.content))
        return httpx.Response(
            200,
            json={
                "response": json.dumps(
                    {
                        "html": "<main><h1>Hello</h1><script>bad()</script></main>",
                        "css": "h1 { color: red; background: url(https://evil.test); }",
                    }
                )
            },
        )

    real_client = httpx.Client
    monkeypatch.setattr(
        "studio.providers.httpx.Client", lambda **kwargs: real_client(transport=httpx.MockTransport(handler))
    )
    code, warnings = generate_with_ollama(b"test-image", [], Settings())
    assert isinstance(code, Code)
    assert "Hello" in code.html
    assert "<script>" not in code.html and "evil" not in code.css
    assert captured["images"] == ["dGVzdC1pbWFnZQ=="]
    assert captured["format"]["properties"]["html"]["type"] == "string"
    assert captured["stream"] is False
    assert any("removed" in warning for warning in warnings)


def test_vision_provider_invalid_response_is_actionable(monkeypatch):
    real_client = httpx.Client
    monkeypatch.setattr(
        "studio.providers.httpx.Client",
        lambda **kwargs: real_client(
            transport=httpx.MockTransport(lambda request: httpx.Response(200, json={"response": "not JSON"}))
        ),
    )
    with pytest.raises(ProviderError, match="valid code"):
        generate_with_ollama(b"image", [], Settings())


def test_provider_configuration_rejects_embedded_credentials():
    with pytest.raises(ValueError, match="without credentials"):
        replace(Settings(), ollama_url="https://user:password@host.test")
