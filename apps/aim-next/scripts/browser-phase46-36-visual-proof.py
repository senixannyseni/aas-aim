#!/usr/bin/env python3
"""Phase 46.36: capture REAL mounted React app visuals after frozen Vite build.

Runs ONLY against a served built app; never supplies synthetic source data or
substitutes a standalone HTML mock. This audit records the disconnected default
shell and Asset Register route. An authorized investigation requires an actual
source/session fixture and is NOT demonstrated by these screenshots.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from urllib.parse import urlparse
from pathlib import Path
from urllib.request import urlopen
from datetime import datetime, timezone

from phase46_38_build_identity import build_identity

EXPECTED = {
    '--bandha-v18-deep': '#101b1d',
    '--bandha-v18-deep-2': '#152325',
    '--bandha-v18-paper': '#eee9df',
    '--bandha-v18-copper': '#c48e65',
    '--bandha-v18-mint': '#9baba0',
}
SHOTS = (
    ('desktop-home', 1440, 900, ''),
    ('desktop-asset-register', 1440, 900, '#/screens/SCR-AIR-001'),
    ('mobile-home', 390, 844, ''),
    ('mobile-asset-register', 390, 844, '#/screens/SCR-AIR-001'),
)


def check_tokens(tokens: dict[str, str]) -> None:
    for key, value in EXPECTED.items():
        if tokens.get(key, '').lower() != value:
            raise AssertionError(f'Bandha v1.8 token {key}: expected {value}, got {tokens.get(key)!r}')


def assert_no_overflow(metrics: dict[str, int], label: str) -> None:
    if metrics['scroll'] > metrics['viewport'] + 1:
        raise AssertionError(f'Horizontal page overflow on {label}: {metrics}')


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def capture(base: str, output: Path, chromium: str | None) -> dict:
    # Verify we are testing a loopback-built preview, not an arbitrary public
    # page or hand-crafted HTML fixture served elsewhere.
    parsed = urlparse(base)
    if parsed.scheme != 'http' or parsed.hostname not in ('127.0.0.1', 'localhost'):
        raise RuntimeError('Mounted proof requires the local Vite preview server')
    # This prevents accidental "success" against a missing/empty local fixture.
    with urlopen(base, timeout=8) as response:
        if response.status != 200:
            raise RuntimeError(f'Vite preview failed HTTP {response.status}')
        html = response.read().decode('utf-8', errors='replace')
        if 'id="root"' not in html or '<script' not in html:
            raise RuntimeError('Preview does not contain the expected React entry HTML')
    # Bind the browser capture to the exact built files on disk.
    dist = Path(__file__).resolve().parents[1] / "dist"
    build_sha, build_files = build_identity(dist)
    if html != (dist / "index.html").read_text(encoding="utf-8"):
        raise RuntimeError("Vite preview HTML differs from the current production build")
    output.mkdir(parents=True, exist_ok=True)
    # The output directory may be reused between CI attempts: never allow a
    # previous partial or successful run to survive a new failed capture.
    for name, _, _, _ in SHOTS:
        (output / f'phase46-36-{name}.png').unlink(missing_ok=True)
    (output / 'evidence.json').unlink(missing_ok=True)
    screenshots = []
    errors: list[str] = []
    # Keep the offline contract module importable without a browser runtime.
    # Real mounted-app capture still requires Playwright; do not skip this
    # dependency, use synthetic screenshots, or mark the release as passed.
    try:
        from playwright.sync_api import sync_playwright, expect
    except ModuleNotFoundError as exc:
        if exc.name == 'playwright' or (exc.name or '').startswith('playwright.'):
            raise RuntimeError(
                'Mounted React visual capture requires Python Playwright. '
                'Activate the project Python environment and install '
                'playwright==1.57.0; also provide a compatible Chromium browser.'
            ) from exc
        raise
    with sync_playwright() as driver:
        opts: dict = {'headless': True}
        if chromium:
            opts['executable_path'] = chromium
        browser = driver.chromium.launch(**opts)
        try:
            for name, width, height, route in SHOTS:
                page = browser.new_page(viewport={'width': width, 'height': height}, device_scale_factor=1)
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.goto(base + '/' + route, wait_until='domcontentloaded')
                if not route:
                    expect(page.get_by_role('heading', name=re.compile('One integrity system', re.I))).to_be_visible(timeout=10000)
                if route:
                    expect(page.locator('.next-screen-preview .next-section-head h2')).to_have_text('Asset Register', timeout=10000)
                    backend = page.locator('.next-sidebar-footer')
                    expect(backend).to_contain_text('Backend offline', timeout=10000)
                    if width <= 800:
                        # The responsive navigation is intentionally hidden. Validate
                        # its accessibility through the actual drawer interaction,
                        # then close it before taking the normal page screenshot.
                        toggle = page.get_by_role('button', name='Toggle navigation')
                        expect(toggle).to_be_visible()
                        toggle.click()
                        expect(backend).to_be_visible(timeout=10000)
                        expect(toggle).to_have_attribute('aria-expanded', 'true')
                        page.get_by_role('button', name='Close mobile navigation').click()
                        expect(toggle).to_have_attribute('aria-expanded', 'false')
                    else:
                        expect(backend).to_be_visible(timeout=10000)
                # Verify actual computed token declarations on the mounted root.
                tokens = page.evaluate('''keys => Object.fromEntries(keys.map(key => [key, getComputedStyle(document.documentElement).getPropertyValue(key).trim()]))''', list(EXPECTED))
                check_tokens(tokens)
                # Browser chrome and the application should share v1.8's dark teal.
                theme = page.locator('meta[name="theme-color"]').get_attribute('content')
                if theme != EXPECTED['--bandha-v18-deep']:
                    raise AssertionError(f'Browser theme-color drift on {name}: {theme!r}')
                metrics = page.evaluate('''() => ({viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth})''')
                assert_no_overflow(metrics, name)
                # Confirm React content actually exists in the document.
                if page.locator('.next-app .next-sidebar .next-navigation-label').count() == 0:
                    raise AssertionError(f'Mounted React shell absent on {name}')
                dest = output / f'phase46-36-{name}.png'
                page.screenshot(path=str(dest), full_page=True, animations='disabled')
                screenshots.append({'name': name, 'path': dest.name, 'width': width, 'height': height,
                                    'sha256': sha256(dest), 'tokenVerified': True, 'noHorizontalOverflow': True})
                page.close()
        finally:
            browser.close()
    if build_identity(dist) != (build_sha, build_files):
        raise RuntimeError("Production build changed during mounted screenshot capture")
    if errors:
        raise RuntimeError('Mounted browser JavaScript errors: ' + '; '.join(errors[:10]))
    return {'phase': '46.36', 'evidenceType': 'MOUNTED_REACT_APP', 'sourceRecords': 'DISCONNECTED_NO_FIXTURE',
            'syntheticScreenshot': False, 'engineeringApproval': False,
            'timestampUtc': datetime.now(timezone.utc).isoformat(), 'baseUrl': base,
            'buildSha256': build_sha, 'buildFileCount': build_files,
            'screenshots': screenshots, 'javascriptErrors': errors}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default='http://127.0.0.1:4174')
    parser.add_argument('--output-dir', default='qa/runtime/phase46-36-mounted-visuals')
    parser.add_argument('--chromium', default=None)
    args = parser.parse_args()
    result = capture(args.base_url.rstrip('/'), Path(args.output_dir), args.chromium)
    outfile = Path(args.output_dir) / 'evidence.json'
    outfile.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print('PASS Phase 46.36 mounted React visual proof:', len(result['screenshots']), 'screenshots, 0 JS errors')


if __name__ == '__main__':
    main()
