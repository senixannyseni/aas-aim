"""Pure, dependency-free definition of the mounted browser route/viewport matrix.

Defining the matrix separately lets offline unit tests verify what a future
Chromium run *would* cover. It does not mean Chromium ran.
"""
from __future__ import annotations

import re
from pathlib import Path

CANONICAL_COUNT = 78
VIEWPORT_WIDTHS = (320, 375, 768, 1280)
REGISTRY = Path(__file__).resolve().parents[1] / "src" / "screenRegistry.ts"
SCREEN_ROW_PATTERN = re.compile(r'^\s*\["(SCR-[A-Z]{3}-\d{3})","([^"]+)",', re.M)


def load_canonical_rows(registry: Path = REGISTRY) -> tuple[tuple[str, str], ...]:
    rows = tuple(SCREEN_ROW_PATTERN.findall(registry.read_text(encoding="utf-8")))
    ids = [screen_id for screen_id, _ in rows]
    if len(rows) != CANONICAL_COUNT or len(set(ids)) != CANONICAL_COUNT:
        raise ValueError(f"Expected {CANONICAL_COUNT} unique canonical rows; got {len(rows)} total and {len(set(ids))} unique")
    if any(not title.strip() for _, title in rows):
        raise ValueError("Canonical screen title must not be blank")
    return rows


def responsive_matrix(rows: tuple[tuple[str, str], ...], widths: tuple[int, ...] = VIEWPORT_WIDTHS):
    if not widths or len(set(widths)) != len(widths) or any(width <= 0 for width in widths):
        raise ValueError("Viewport widths must be distinct positive integers")
    for width in widths:
        for screen_id, title in rows:
            yield width, screen_id, title
