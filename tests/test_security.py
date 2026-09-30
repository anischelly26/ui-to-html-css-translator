import io
import zipfile

import pytest

from studio.models import Code
from studio.security import document, export_zip, safe_css, sanitize_code


@pytest.mark.parametrize(
    "payload",
    [
        '<script>parent.location="https://evil.test"</script><p>Keep me</p>',
        '<img src="https://evil.test/track" onerror="alert(1)"><p>Keep me</p>',
        '<iframe srcdoc="<script>alert(1)</script>"></iframe><p>Keep me</p>',
        '<svg><a href="javascript:alert(1)">x</a></svg><p>Keep me</p>',
        '<meta http-equiv="refresh" content="0; url=https://evil.test"><p>Keep me</p>',
        '<form action="https://evil.test"><button formaction="https://evil.test">Keep me</button></form>',
    ],
)
def test_generated_markup_is_inert(payload):
    clean, _ = sanitize_code(Code(html=payload, css="p { color: red; }"))
    assert "Keep me" in clean.html
    for forbidden in [
        "<script",
        "<img",
        "<iframe",
        "<svg",
        "<meta",
        "onerror=",
        "action=",
        "javascript:",
        "https://",
    ]:
        assert forbidden not in clean.html


@pytest.mark.parametrize(
    "css",
    [
        '@import "https://evil.test/x.css"; p { color: red; }',
        "p { background: url(https://evil.test/x); color: red; }",
        "p { background: u\\72l(https://evil.test/x); color: red; }",
        "@media (min-width: 300px) { p { background: url(https://evil.test/x); color: red; } }",
        "p { width: expression(alert(1)); color: red; }",
    ],
)
def test_css_blocks_network_and_expressions(css):
    result = safe_css(css)
    assert "https" not in result
    assert "expression" not in result
    assert "color: red" in result


def test_css_preserves_responsive_rules_and_child_selectors():
    css = ".row > * { padding: 10px; } @media (max-width: 600px) { .row { display: grid; } }"
    assert ".row > *" in safe_css(css)
    assert "@media" in safe_css(css)


def test_style_breakout_is_rejected():
    output = document(Code(html="<p>safe</p>", css="</style><script>alert(1)</script>"))
    assert "<script>" not in output
    assert "default-src &#x27;none&#x27;" in output


def test_zip_is_portable_and_safe():
    archive = export_zip(
        Code(html="<h1>Hello</h1><script>bad()</script>", css="h1 { color: red; }"), "../../x"
    )
    with zipfile.ZipFile(io.BytesIO(archive)) as files:
        assert set(files.namelist()) == {"index.html", "styles.css", "README.txt"}
        document_text = files.read("index.html").decode()
        assert "<script>" not in document_text
        assert "<style>" in document_text
        assert "Content-Security-Policy" in document_text
