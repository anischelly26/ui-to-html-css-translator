"""Keep reconstructed documents inert, including when exported outside the studio."""

import io
import re
import zipfile
from html import escape

import tinycss2
from bs4 import BeautifulSoup

from studio.models import Code

ALLOWED_TAGS = frozenset(
    "main section article aside header footer nav div span p h1 h2 h3 h4 h5 h6 "
    "button label input textarea select option ul ol li table thead tbody tr th td "
    "strong em small b i br hr pre code figure figcaption a form details summary".split()
)
ALLOWED_ATTRS = frozenset(
    "id class title role type placeholder value disabled checked selected name for "
    "rows cols colspan rowspan aria-label aria-hidden aria-describedby data-element-id".split()
)
DROP_CONTENT = frozenset(
    {"script", "style", "iframe", "object", "embed", "svg", "math", "template", "noscript"}
)
PREVIEW_CSP = (
    "default-src 'none'; style-src 'unsafe-inline'; img-src data:; "
    "font-src 'none'; form-action 'none'; base-uri 'none'"
)


def safe_css(css: str) -> str:
    """Parse CSS: strip network-capable functions and unsupported at-rules recursively."""
    if "<" in css:
        return ""

    def unsafe(tokens):
        for token in tokens:
            if token.type in {"url", "error", "bad-url"}:
                return True
            if token.type == "function":
                if token.lower_name in {"url", "expression", "image-set", "-webkit-image-set", "attr"}:
                    return True
                if unsafe(token.arguments):
                    return True
            if hasattr(token, "content") and unsafe(token.content):
                return True
        return False

    def rules(tokens):
        output = []
        for rule in tokens:
            if rule.type == "qualified-rule" and not unsafe(rule.prelude):
                declarations = tinycss2.parse_declaration_list(
                    rule.content, skip_comments=True, skip_whitespace=True
                )
                accepted = [
                    d
                    for d in declarations
                    if d.type == "declaration"
                    and not unsafe(d.value)
                    and d.lower_name not in {"behavior", "-moz-binding"}
                ]
                if accepted:
                    output.append(tinycss2.serialize(rule.prelude) + "{" + tinycss2.serialize(accepted) + "}")
            elif rule.type == "at-rule" and rule.lower_at_keyword in {"media", "supports"}:
                if rule.content is not None and not unsafe(rule.prelude):
                    nested = rules(
                        tinycss2.parse_rule_list(rule.content, skip_comments=True, skip_whitespace=True)
                    )
                    output.append(f"@{rule.lower_at_keyword} {tinycss2.serialize(rule.prelude)}{{{nested}}}")
        return "\n".join(output)

    return rules(tinycss2.parse_stylesheet(css, skip_comments=True, skip_whitespace=True))


def sanitize_code(code: Code) -> tuple[Code, bool]:
    soup = BeautifulSoup(code.html, "html.parser")
    for tag in list(soup.find_all(True)):
        if not tag.name or tag.parent is None:
            continue
        if tag.name in DROP_CONTENT:
            tag.decompose()
        elif tag.name not in ALLOWED_TAGS:
            tag.unwrap()
        else:
            for attr in list(tag.attrs):
                if attr not in ALLOWED_ATTRS:
                    del tag.attrs[attr]
            if tag.name == "input" and tag.get("type") not in {
                "text",
                "email",
                "password",
                "number",
                "checkbox",
                "radio",
                "search",
                "date",
            }:
                tag["type"] = "text"
            if tag.name == "button":
                tag["type"] = "button"
    clean = Code(html=str(soup), css=safe_css(code.css))
    risky = bool(
        re.search(
            r"<\s*(script|iframe|object|embed|svg|math|meta|link|base)|\bon\w+\s*=|javascript:|https?://",
            code.html,
            re.I,
        )
    )
    risky |= bool(re.search(r"@import|url\s*\(|expression\s*\(|</style", code.css, re.I))
    return clean, risky


def document(code: Code, title: str = "Reconstructed interface") -> str:
    clean, _ = sanitize_code(code)
    return (
        '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        f'<meta http-equiv="Content-Security-Policy" content="{escape(PREVIEW_CSP, quote=True)}">\n'
        f"<title>{escape(title)}</title>\n<style>{clean.css}</style>\n</head>\n"
        f"<body>\n{clean.html}\n</body>\n</html>"
    )


def export_zip(code: Code, name: str) -> bytes:
    clean, removed = sanitize_code(code)
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("index.html", document(clean, name))
        archive.writestr("styles.css", clean.css)
        archive.writestr(
            "README.txt",
            "Generated with FORM Vision Studio.\n\n"
            "Open index.html in your browser; its CSS is embedded for portability.\n"
            "styles.css is included for editing. No scripts or remote assets are included.\n"
            "Review layout, content, semantics, and accessibility before production use.\n"
            + ("Unsafe constructs were removed during export.\n" if removed else ""),
        )
    return output.getvalue()
