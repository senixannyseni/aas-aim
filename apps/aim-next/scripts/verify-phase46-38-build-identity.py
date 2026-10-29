#!/usr/bin/env python3
"""Fail-closed build identity binding for Phase 46.36/37 mounted screenshot proof.

Intended to run after screenshot capture and the Phase 46.37 image verifier,
against the same immutable local dist directory. It does not verify screenshots
in isolation; the previous proof gates are mandatory.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
from phase46_38_build_identity import build_identity, valid_sha256


def verify(directory: Path, dist: Path) -> dict:
    evidence = json.loads((Path(directory) / 'evidence.json').read_text(encoding='utf-8'))
    if evidence.get('evidenceType') != 'MOUNTED_REACT_APP' or evidence.get('syntheticScreenshot') is not False:
        raise ValueError('Build identity requires mounted, non-synthetic proof')
    if evidence.get('engineeringApproval') is not False:
        raise ValueError('Build identity cannot imply engineering approval')
    recorded = evidence.get('buildSha256')
    count = evidence.get('buildFileCount')
    if not valid_sha256(recorded) or type(count) is not int or count < 2:
        raise ValueError('Missing or malformed production build identity')
    actual, actual_count = build_identity(dist)
    if recorded != actual or count != actual_count:
        raise ValueError('Mounted evidence is not bound to the current production build')
    return {'verified': True, 'buildSha256': actual, 'buildFileCount': actual_count,
            'proofType': 'LOCAL_DIST_FINGERPRINT_NOT_CI_SIGNATURE'}


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--output-dir', default='qa/runtime/phase46-36-mounted-visuals')
    p.add_argument('--dist-dir', default='apps/aim-next/dist')
    args = p.parse_args()
    result = verify(Path(args.output_dir), Path(args.dist_dir))
    print('PASS Phase 46.38 mounted build identity:', result['buildFileCount'], 'files')

if __name__ == '__main__':
    main()
