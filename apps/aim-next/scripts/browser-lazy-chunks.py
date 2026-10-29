#!/usr/bin/env python3
"""Production-only Chromium check for deferred workspaces and no implied authorization."""
import argparse
import json
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import urlopen
from time import sleep
from playwright.sync_api import sync_playwright, expect

PERMITTED_LAZY_DOMAIN = ("corrosion", "inspection")
parser = argparse.ArgumentParser()
parser.add_argument("--base-url", default="http://127.0.0.1:4174")
parser.add_argument("--chromium", default=None)
args = parser.parse_args()
base = args.base_url.rstrip("/")
manifest_path = Path(__file__).resolve().parents[1] / "dist" / ".vite" / "manifest.json"
manifest = json.loads(manifest_path.read_text())
module_chunks = {}
for domain in PERMITTED_LAZY_DOMAIN:
    matches = [(key, node) for key, node in manifest.items()
        if key.endswith(f"/features/{domain}/{domain.capitalize()}DomainWorkspace.tsx")]
    # Manifest keys use the full filename; validation requires direct imports,
    # preventing aliasing to an unrelated bundle here.
    if len(matches) != 1 or not matches[0][1].get("isDynamicEntry"):
        raise SystemExit(f"FAIL: missing dedicated lazy workspace entry for {domain}")
    module_chunks[domain] = "/" + matches[0][1]["file"].lstrip("/")

last_error = None
for _ in range(40):
    try:
        with urlopen(base, timeout=2) as response:
            if response.status != 200:
                raise RuntimeError(f"HTTP {response.status}")
        last_error = None
        break
    except Exception as error:
        last_error = error
        sleep(0.5)
if last_error is not None:
    raise SystemExit(f"FAIL: preview is not ready: {last_error}")

errors = []
with sync_playwright() as playwright:
    launch = {"headless": True}
    if args.chromium:
        launch["executable_path"] = args.chromium
    browser = playwright.chromium.launch(**launch)
    try:
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(base, wait_until="domcontentloaded")
        expect(page.locator(".next-page-title")).to_contain_text("One integrity system")
        # Google Fonts may be blocked/offline; React heading is enough to prove boot.
        paths = lambda: page.evaluate("""() => performance.getEntriesByType('resource').map(entry => new URL(entry.name).pathname)""")
        assert all(chunk not in paths() for chunk in module_chunks.values()), "Deferred workspace loaded during architecture landing"
        for domain, screen_id, selector in (("corrosion", "SCR-COR-001", ".cor-workspace"), ("inspection", "SCR-INS-001", ".ins-workspace")):
            page.evaluate("id => {window.location.hash = '#/screens/' + id}", screen_id)
            expect(page.locator(".next-screen-preview .next-section-head h2")).not_to_be_empty()
            page.wait_for_function("chunk => performance.getEntriesByType('resource').some(x => new URL(x.name).pathname === chunk)",
                arg=module_chunks[domain])
            expect(page.locator(selector)).to_be_visible()
            expect(page.locator(".next-workspace-loading")).to_have_count(0)
            expect(page.locator(".next-workspace-load-error")).to_have_count(0)
            expect(page.get_by_text("No authenticated session")).to_be_visible()
        assert not errors, f"Unhandled browser errors: {errors}"
        print("PASS Phase 46.7 real Chromium lazy chunks: architecture loads neither domain; COR and INS load only on demand; no browser errors or implied login.")
    finally:
        browser.close()
