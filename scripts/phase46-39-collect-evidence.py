#!/usr/bin/env python3
"""Package the REAL canonical release attempt into one bounded diagnostics archive.

This utility never runs tests, creates screenshots, or claims a release pass.
It collects only explicitly allowed runtime files and local command output.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
from hashlib import sha256
import json
from pathlib import Path
import re
from zipfile import ZipFile, ZIP_DEFLATED

SCREEN_NAMES = (
    'desktop-home', 'desktop-asset-register', 'mobile-home', 'mobile-asset-register'
)
MAX_LOG = 12 * 1024 * 1024
MAX_IMAGE = 25 * 1024 * 1024
MAX_JSON = 2 * 1024 * 1024


def collect(root: Path, log: Path, output: Path, exit_code: int, *, current_time: datetime | None = None) -> dict:
    root = root.resolve(strict=True)
    log = log.resolve(strict=True)
    output = output.resolve(strict=False)
    runtime = root / 'qa' / 'runtime'
    # Logs can contain machine-specific paths. The report is meant to be reviewed
    # by the owner before it is uploaded; never include .env or application files.
    if log.stat().st_size > MAX_LOG:
        raise ValueError('Release log exceeds the 12 MiB bound; inspect it locally')
    if output == log or output == runtime / 'phase32-release-gates.json':
        raise ValueError('Output must not overwrite a release artifact')
    now = current_time or datetime.now(timezone.utc)
    entries: dict[str, bytes] = {'release-validation.log': log.read_bytes()}
    absent = []

    def add(source: Path, name: str, max_bytes: int) -> None:
        if not source.exists():
            absent.append(name)
            return
        if source.is_symlink() or not source.is_file():
            raise ValueError(f'Refusing non-regular evidence source: {name}')
        if source.stat().st_size > max_bytes:
            raise ValueError(f'Evidence file exceeds size bound: {name}')
        entries[name] = source.read_bytes()

    trace = runtime / 'phase32-release-gates.json'
    add(trace, 'release-gates.json', MAX_JSON)
    visual = runtime / 'phase46-36-mounted-visuals'
    if visual.is_symlink():
        raise ValueError('Visual evidence directory cannot be a symlink')
    add(visual / 'evidence.json', 'mounted-visuals/evidence.json', MAX_JSON)
    for shot in SCREEN_NAMES:
        add(visual / f'phase46-36-{shot}.png', f'mounted-visuals/phase46-36-{shot}.png', MAX_IMAGE)

    gate = None
    if 'release-gates.json' in entries:
        try:
            gate = json.loads(entries['release-gates.json'])
        except (ValueError, UnicodeDecodeError) as e:
            raise ValueError('Unreadable canonical release-gates.json') from e
    if gate is not None and not isinstance(gate, dict):
        raise ValueError('Invalid canonical release gate trace')
    # An exit code of zero is not sufficient proof of a full release.
    status = 'RUNTIME_COMPLETED_AWAITING_REVIEW' if (
        exit_code == 0 and gate and gate.get('status') == 'RUNTIME_GATES_PASSED_AWAITING_REVIEW'
        and len(absent) == 0
    ) else 'FAILED_OR_INCOMPLETE'
    report = {
        'phase': '46.39',
        'purpose': 'Local real-release diagnostics; NOT an engineering approval',
        'status': status,
        'releaseCommandExitCode': exit_code,
        'canonicalTraceStatus': gate.get('status') if gate else None,
        'canonicalPassedGateCount': len(gate.get('passedGates', [])) if gate else None,
        'missingExpectedFiles': absent,
        'createdAtUtc': now.isoformat(),
        'imageProvenance': 'Only existing mounted-app screenshot bytes, never synthesized',
        'privateDataCaution': 'Review logs and screenshots before sharing. Machine paths may appear in logs.',
        'files': {name: {'sha256': sha256(data).hexdigest(), 'bytes': len(data)} for name, data in sorted(entries.items())},
    }
    if status == 'RUNTIME_COMPLETED_AWAITING_REVIEW':
        # Keep the status deliberately narrow: the existing independent verifier
        # is authoritative for screenshots; human engineering review is separate.
        if gate.get('releaseApproved') is True:
            raise ValueError('Unexpected releaseApproved=true in local gate trace')
    entries['summary.json'] = (json.dumps(report, indent=2) + '\n').encode()
    output.parent.mkdir(parents=True, exist_ok=True)
    # ZIP writes to a new temp archive first, then atomically replaces any older
    # diagnostic ZIP, never mixing evidence from separate attempts.
    tmp = output.with_name(output.name + '.tmp')
    try:
        with ZipFile(tmp, 'w', ZIP_DEFLATED, compresslevel=8) as z:
            for name, data in sorted(entries.items()):
                z.writestr(name, data)
        with ZipFile(tmp) as z:
            if z.testzip() is not None:
                raise ValueError('Diagnostic ZIP CRC check failed')
            if len(z.namelist()) != len(entries):
                raise ValueError('Diagnostic ZIP entry count mismatch')
        tmp.replace(output)
    finally:
        tmp.unlink(missing_ok=True)
    return report


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    p.add_argument('--log', type=Path, required=True)
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--exit-code', type=int, required=True)
    args = p.parse_args()
    report = collect(args.root, args.log, args.output, args.exit_code)
    print(f"Phase 46.39: {report['status']} | {report['canonicalPassedGateCount']} gates recorded")
    print(f"Evidence ZIP: {args.output.resolve()}")
    if report['missingExpectedFiles']:
        print('Missing evidence is explicitly listed in the ZIP summary; no screenshots were fabricated.')


if __name__ == '__main__':
    main()
