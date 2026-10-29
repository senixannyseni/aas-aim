#!/usr/bin/env python3
"""Fail-closed verifier for a *fresh* Phase 46.36 mounted screenshot set.

Validating hashes is not, alone, proof of a React build. This verifier must run
immediately AFTER the actual mounted proof command in the same release script.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone, timedelta
from hashlib import sha256
import json
from pathlib import Path
import struct

EXPECTED_NAMES = ('desktop-home','desktop-asset-register','mobile-home','mobile-asset-register')
EXPECTED_WIDTHS = (1440,1440,390,390)
EXPECTED_HEIGHTS = (900,900,844,844)


def verify(directory: Path, max_age_minutes: int = 15, now: datetime | None = None) -> dict:
    directory = directory.resolve(strict=True)
    metadata = directory / 'evidence.json'
    doc = json.loads(metadata.read_text(encoding='utf-8'))
    if doc.get('evidenceType') != 'MOUNTED_REACT_APP' or doc.get('syntheticScreenshot') is not False:
        raise ValueError('Requires a real mounted-app evidence type, not a synthetic preview')
    if doc.get('engineeringApproval') is not False or doc.get('sourceRecords') != 'DISCONNECTED_NO_FIXTURE':
        raise ValueError('Invalid authority/source provenance claims')
    if doc.get('javascriptErrors') != []:
        raise ValueError('Unresolved mounted-browser JavaScript errors')
    if doc.get('baseUrl') not in ('http://127.0.0.1:4174','http://localhost:4174'):
        raise ValueError('Proof source must be the local built Vite preview')
    timestamp = datetime.fromisoformat(doc['timestampUtc'].replace('Z','+00:00'))
    clock = now or datetime.now(timezone.utc)
    delta = clock - timestamp
    if delta < timedelta(minutes=-1) or delta > timedelta(minutes=max_age_minutes):
        raise ValueError('Mounted screenshot evidence is stale or from the future')
    shots = doc.get('screenshots')
    if not isinstance(shots,list) or len(shots)!=4:
        raise ValueError('Exactly four mounted screenshots are required')
    for index, item in enumerate(shots):
        name=EXPECTED_NAMES[index]
        if item.get('name')!=name or item.get('path')!=f'phase46-36-{name}.png':
            raise ValueError(f'Expected screenshot {name} at position {index}')
        if item.get('width')!=EXPECTED_WIDTHS[index] or item.get('height')!=EXPECTED_HEIGHTS[index]:
            raise ValueError('Viewport dimensions must match the Phase 46.36 matrix')
        if item.get('tokenVerified') is not True or item.get('noHorizontalOverflow') is not True:
            raise ValueError('Incomplete browser visual assertions')
        image_file=directory/item['path']
        if image_file.resolve().parent!=directory:
            raise ValueError('Screenshot path must stay inside the proof directory')
        blob=image_file.read_bytes()
        if sha256(blob).hexdigest()!=item.get('sha256'):
            raise ValueError(f'Screenshot digest mismatch: {name}')
        if len(blob)<24 or blob[:8]!=b'\x89PNG\r\n\x1a\n' or blob[12:16]!=b'IHDR':
            raise ValueError(f'Invalid PNG image: {name}')
        width,height=struct.unpack('>II',blob[16:24])
        if width!=EXPECTED_WIDTHS[index] or height<EXPECTED_HEIGHTS[index]:
            raise ValueError(f'Screenshot PNG dimensions incorrect: {name}')
    return {'verified':True,'screenshots':len(shots),'evidenceType':'MOUNTED_REACT_APP'}


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--output-dir',default='qa/runtime/phase46-36-mounted-visuals')
    args=ap.parse_args()
    result=verify(Path(args.output_dir))
    print(f"PASS Phase 46.37 mounted evidence attestation: {result['screenshots']} fresh screenshots")

if __name__=='__main__':
    main()
