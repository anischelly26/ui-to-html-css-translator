"""Deterministic responsive row reconstruction; OCR text is always escaped."""

from html import escape
from math import ceil

from studio.images import foreground_for
from studio.models import Code, Element, ImageInfo


def generate_code(elements: list[Element], image: ImageInfo) -> Code:
    rows: list[list[Element]] = []
    for element in sorted(elements, key=lambda item: (item.bounds.y, item.bounds.x)):
        if rows and abs(element.bounds.y - rows[-1][0].bounds.y) <= max(12, element.bounds.height // 2):
            rows[-1].append(element)
        else:
            rows.append([element])
    markup = ['<main class="reconstructed" aria-label="Reconstructed interface">']
    rules = [
        f":root {{ --surface: {image.background}; --ink: {foreground_for(image.background)}; }}",
        "* { box-sizing: border-box; }",
        "body { margin: 0; color: var(--ink); background: var(--surface); "
        "font-family: system-ui, sans-serif; }",
        f".reconstructed {{ width: min(100%, {image.width}px); margin-inline: auto; "
        "padding: clamp(12px, 2vw, 24px); display: grid; gap: 18px; }",
        ".ui-row { display: grid; grid-template-columns: repeat(24, minmax(0, 1fr)); "
        "align-items: center; gap: 8px; }",
        ".ui-row > * { max-width: 100%; overflow-wrap: anywhere; }",
        ".ui-text, .ui-heading { margin: 0; line-height: 1.5; }",
        ".ui-button { min-height: 44px; padding: 10px 20px; border: 0; border-radius: 8px; "
        "font: inherit; cursor: pointer; }",
        ".ui-input { display: grid; gap: 6px; font-size: 13px; }",
        ".ui-input input { min-height: 44px; width: 100%; border: 1px solid #a3a3a3; border-radius: 8px; "
        "padding: 10px 12px; font: inherit; background: #fff; color: #161b22; }",
        ":focus-visible { outline: 3px solid #2563eb; outline-offset: 3px; }",
        "@media (max-width: 600px) { .ui-row { display: flex; flex-direction: column; "
        "align-items: flex-start; gap: 12px; } .ui-input { width: 100%; } }",
    ]
    for row in rows:
        markup.append('  <section class="ui-row" aria-label="Interface row">')
        for element in sorted(row, key=lambda item: item.bounds.x):
            identifier = escape(element.id, quote=True)
            text = escape(element.text, quote=True)
            attribute = f'data-element-id="{identifier}"'
            start = min(24, max(1, round(element.bounds.x / image.width * 24) + 1))
            span = min(25 - start, max(1, ceil(element.bounds.width / image.width * 24)))
            rules.append(
                f'[data-element-id="{identifier}"] {{ grid-column: {start} / span {span}; '
                f"color: {element.foreground}; }}"
            )
            if element.kind == "button":
                markup.append(
                    f'    <button class="ui-button" {attribute} type="button">{text or "Button"}</button>'
                )
                rules.append(
                    f'[data-element-id="{identifier}"] {{ background: {element.color}; '
                    f"color: {element.foreground}; }}"
                )
            elif element.kind == "input":
                markup.append(
                    f'    <label class="ui-input" {attribute}>{text or "Text input"}'
                    f'<input type="text" placeholder="{text}" /></label>'
                )
                rules.append(
                    f'[data-element-id="{identifier}"] input {{ background: {element.color}; '
                    f"color: {element.foreground}; }}"
                )
            else:
                if element.kind == "heading":
                    tag, cls = "h2", "ui-heading"
                elif element.kind == "container":
                    tag, cls = "div", "ui-container"
                    rules.append(f'[data-element-id="{identifier}"] {{ background: {element.color}; }}')
                else:
                    tag, cls = "p", "ui-text"
                markup.append(f'    <{tag} class="{cls}" {attribute}>{text}</{tag}>')
                if element.kind == "heading":
                    size = min(48, max(22, round(element.bounds.height * 0.85)))
                    rules.append(
                        f'[data-element-id="{identifier}"] {{ font-size: clamp(22px, 4vw, {size}px); }}'
                    )
        markup.append("  </section>")
    markup.append("</main>")
    return Code(html="\n".join(markup), css="\n".join(rules))
