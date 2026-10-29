"""Phase 46.38: deterministic, file-content identity of the *built* Vite dist.

This is an offline file fingerprint, not a cryptographic CI signature or an
assertion that React was mounted. A release trace and real browser checks are
still required before any runtime success claim.
"""
from __future__ import annotations
import hashlib
import os
from pathlib import Path
import re

_HEX = re.compile(r'^[0-9a-f]{64}$')


def build_identity(dist: Path) -> tuple[str, int]:
    dist = Path(dist)
    if dist.is_symlink() or not dist.is_dir():
        raise ValueError('Production dist must be a real directory')
    entries: list[tuple[str, bytes]] = []
    for root, dirs, files in os.walk(dist, topdown=True, followlinks=False):
        for name in dirs + files:
            if (Path(root) / name).is_symlink():
                raise ValueError('Production dist cannot contain symlinks')
        for name in files:
            path = Path(root) / name
            if not path.is_file():
                raise ValueError('Production dist contains a non-regular file')
            relative = path.relative_to(dist).as_posix()
            body = path.read_bytes()
            if not body:
                raise ValueError(f'Empty production build artifact: {relative}')
            entries.append((relative, body))
    names = {name for name, _ in entries}
    if 'index.html' not in names or not any(
        re.fullmatch(r'assets/[A-Za-z0-9._-]+\.js', name) for name in names
    ):
        raise ValueError('Production dist needs built index.html and JavaScript asset')
    index_html = dict(entries)['index.html'].decode('utf-8')
    if 'id="root"' not in index_html or not re.search(r'/assets/[\w.-]+\.js', index_html):
        raise ValueError('Production entry must reference the built React bundle')
    digest = hashlib.sha256()
    for name, body in sorted(entries):
        # Length-prefix paths and data: unambiguous across file boundaries.
        name_bytes = name.encode('utf-8')
        digest.update(len(name_bytes).to_bytes(8, 'big'))
        digest.update(name_bytes)
        digest.update(len(body).to_bytes(8, 'big'))
        digest.update(hashlib.sha256(body).digest())
    return digest.hexdigest(), len(entries)


def valid_sha256(value: object) -> bool:
    return isinstance(value, str) and _HEX.fullmatch(value) is not None
