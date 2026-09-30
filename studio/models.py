"""Typed contracts shared by the pipeline, API, CLI, and exporters."""

from typing import Literal

from pydantic import BaseModel, Field, model_validator

ElementKind = Literal["text", "heading", "button", "input", "container"]


class Bounds(BaseModel):
    x: int = Field(ge=0)
    y: int = Field(ge=0)
    width: int = Field(ge=1, le=2400)
    height: int = Field(ge=1, le=2400)


class Element(BaseModel):
    id: str = Field(pattern=r"^[a-zA-Z0-9_-]{1,48}$")
    kind: ElementKind
    text: str = Field(default="", max_length=3000)
    confidence: float | None = Field(default=None, ge=0, le=100)
    bounds: Bounds
    color: str = Field(default="#ffffff", pattern=r"^#[0-9a-fA-F]{6}$")
    foreground: str = Field(default="#161b22", pattern=r"^#[0-9a-fA-F]{6}$")


class ImageInfo(BaseModel):
    width: int = Field(ge=1, le=2400)
    height: int = Field(ge=1, le=2400)
    background: str = Field(pattern=r"^#[0-9a-fA-F]{6}$")


class Code(BaseModel):
    html: str = Field(max_length=150_000)
    css: str = Field(max_length=100_000)


class GenerationRequest(BaseModel):
    engine: Literal["local", "ollama"] = "local"


class RegenerateRequest(BaseModel):
    elements: list[Element] = Field(max_length=180)
    image: ImageInfo

    @model_validator(mode="after")
    def validate_elements(self):
        ids = [element.id for element in self.elements]
        if len(ids) != len(set(ids)):
            raise ValueError("Element identifiers must be unique.")
        for element in self.elements:
            box = element.bounds
            if box.x + box.width > self.image.width or box.y + box.height > self.image.height:
                raise ValueError("Element bounds must lie within the source image.")
        return self


class Result(BaseModel):
    code: Code
    elements: list[Element]
    image: ImageInfo
    engine: Literal["local", "ollama"]
    duration_ms: int
    warnings: list[str]
    palette: list[str]


class ExportRequest(BaseModel):
    code: Code
    name: str = Field(default="interface", min_length=1, max_length=80)
