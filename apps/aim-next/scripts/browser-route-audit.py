#!/usr/bin/env python3
"""Real browser E2E gate for a *running built AIM Next app*.

Unlike the offline model suite or stylesheet fixture, this mounts the React app
in Chromium, navigates every canonical route, and checks critical shell UI.

Prerequisites:
  pnpm --filter @bandha/aim-next build
  pnpm --filter @bandha/aim-next preview
  python -m pip install playwright==1.57.0
  python -m playwright install chromium
  python apps/aim-next/scripts/browser-route-audit.py --base-url http://127.0.0.1:4174

No fixtures or mock engineering decisions are supplied. The app is disconnected.
"""
import argparse
import re
import sys
from urllib.request import urlopen
from time import sleep

from playwright.sync_api import sync_playwright, expect
from browser_audit_matrix import VIEWPORT_WIDTHS, load_canonical_rows, responsive_matrix

try:
    ROWS = load_canonical_rows()
except ValueError as error:
    raise SystemExit(f"FAIL: {error}") from error

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--base-url", default="http://127.0.0.1:4174")
parser.add_argument("--chromium", default=None, help="Optional installed Chromium executable")
args = parser.parse_args()
base = args.base_url.rstrip("/")
last_error: Exception | None = None
for _attempt in range(40):
    try:
        with urlopen(base, timeout=2) as resp:
            if resp.status != 200:
                raise RuntimeError(f"HTTP {resp.status}")
        last_error = None
        break
    except Exception as error:
        last_error = error
        sleep(0.5)
if last_error is not None:
    raise SystemExit(f"FAIL: no running built app at {base}: {last_error}")

checks = 0
errors: list[str] = []
with sync_playwright() as playwright:
    launch_args = {"headless": True}
    if args.chromium:
        launch_args["executable_path"] = args.chromium
    browser = playwright.chromium.launch(**launch_args)
    try:
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(base, wait_until="domcontentloaded")
        expect(page.get_by_role("heading", name=re.compile("One integrity system", re.I))).to_be_visible()
        checks += 1
        # Hash navigation is exercised against one mounted React tree (not 78 reloads).
        for screen_id, title in ROWS:
            page.evaluate("id => { window.location.hash = '#/screens/' + id; }", screen_id)
            heading = page.locator(".next-screen-preview .next-section-head h2")
            expect(heading).to_have_text(title, timeout=7000)
            expect(page.locator(".next-screen-preview > .next-section-head > div > .next-eyebrow")).to_contain_text(screen_id)
            # The system is unauthenticated and must not imply approval.
            expect(page.get_by_text("Backend offline")).to_be_visible()
            checks += 1
        # An unknown route must fail closed, without displaying a stale record workspace.
        page.evaluate("() => { window.location.hash = '#/screens/SCR-FAKE-001'; }")
        expect(page.get_by_role("heading", name=re.compile("One integrity system", re.I))).to_be_visible()
        expect(page.locator(".next-screen-preview")).to_have_count(0)
        checks += 1
        # Skip navigation previously overwrote the hash with #next-main, incorrectly
        # returning the app to the architecture landing page.
        page.evaluate("() => { window.location.hash = '#/screens/SCR-AIR-001'; }")
        expect(page.locator(".next-screen-preview .next-section-head h2")).to_have_text("Asset Register")
        page.get_by_role("link", name="Skip to main content").focus()
        page.keyboard.press("Enter")
        expect(page.locator("#next-main")).to_be_focused()
        expect(page).to_have_url(re.compile(r"#/screens/SCR-AIR-001$"))
        expect(page.locator(".next-screen-preview .next-section-head h2")).to_have_text("Asset Register")
        checks += 1
        # The function-inspector dialog must be keyboard dismissible and restore focus.
        capability = page.locator(".next-function-list .next-capability").first
        capability.click()
        inspector = page.get_by_role("dialog", name="Function detail")
        expect(inspector).to_be_visible()
        expect(inspector.get_by_role("button", name="Close function detail")).to_be_focused()
        expect(page.locator(".next-body")).to_have_attribute("inert", "")
        expect(page.locator(".next-sidebar")).to_have_attribute("inert", "")
        expect(page.locator(".next-skip")).to_have_attribute("inert", "")
        expect(page.locator(".next-backdrop")).to_have_attribute("tabindex", "-1")
        expect(page.locator("body")).to_have_css("overflow", "hidden")
        checks += 1
        page.keyboard.press("Escape")
        expect(inspector).to_have_count(0)
        expect(capability).to_be_focused()
        expect(page.locator(".next-body")).not_to_have_attribute("inert", "")
        expect(page.locator("body")).not_to_have_css("overflow", "hidden")
        checks += 1
        # Verify the same real-browser focus restoration when dismissing by
        # the close control and backdrop, not only the Escape key.
        capability.click()
        inspector = page.get_by_role("dialog", name="Function detail")
        inspector.get_by_role("button", name="Close function detail").click()
        expect(inspector).to_have_count(0)
        expect(capability).to_be_focused()
        expect(page.locator(".next-body")).not_to_have_attribute("inert", "")
        checks += 1
        capability.click()
        inspector = page.get_by_role("dialog", name="Function detail")
        page.locator(".next-backdrop").click(position={"x": 1, "y": 1})
        expect(inspector).to_have_count(0)
        expect(capability).to_be_focused()
        checks += 1
        capability.click()
        inspector = page.get_by_role("dialog", name="Function detail")
        target = inspector.locator(".next-mapped-targets button").first
        target_id = target.locator("code").inner_text()
        target.click()
        expect(inspector).to_have_count(0)
        expect(page).to_have_url(re.compile(r"#/screens/" + re.escape(target_id) + r"$"))
        expect(page.locator("#next-main")).to_be_focused()
        checks += 1
        page.close()

        for width in VIEWPORT_WIDTHS:
            mobile = width <= 800
            page = browser.new_page(viewport={"width": width, "height": 800})
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(base + "/#/screens/SCR-AIR-001", wait_until="domcontentloaded")
            expect(page.locator(".next-screen-preview .next-section-head h2")).to_have_text("Asset Register")
            # Unlike the original responsive smoke check (one screen per width),
            # measure every canonical workspace at all four breakpoints.
            # Explicit heading + eyebrow assertions prevent false passes when the
            # router accidentally falls back to another screen or landing page.
            responsive_checked = 0
            for audited_width, screen_id, title in responsive_matrix(ROWS, (width,)):
                page.evaluate("id => { window.location.hash = '#/screens/' + id; }", screen_id)
                expect(page.locator(".next-screen-preview .next-section-head h2")).to_have_text(title)
                expect(page.locator(".next-screen-preview > .next-section-head > div > .next-eyebrow")).to_contain_text(screen_id)
                size = page.evaluate("() => ({viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth})")
                if size["scroll"] > size["viewport"] + 1:
                    # Report the actual oversized boxes rather than masking horizontal
                    # overflow or requiring another CI run just to identify its source.
                    offenders = page.evaluate("""() => {
                        const viewport = document.documentElement.clientWidth;
                        return Array.from(document.querySelectorAll('body *'))
                          .map(element => {
                            const bounds = element.getBoundingClientRect();
                            return {element: element.tagName.toLowerCase(),
                              className: typeof element.className === 'string' ? element.className.slice(0, 100) : '',
                              right: Math.round(bounds.right), width: Math.round(bounds.width)};
                          })
                          .filter(entry => entry.right > viewport + 1)
                          .sort((a, b) => b.right - a.right)
                          .slice(0, 10);
                    }""")
                    raise AssertionError(f"Horizontal overflow at {audited_width}px on {screen_id}: {size}; right-edge offenders: {offenders}")
                responsive_checked += 1
                checks += 1
            assert responsive_checked == 78, f"Expected 78 responsive screens at {width}px, checked {responsive_checked}"
            # Reset to a known route before keyboard accessibility assertions.
            page.evaluate("() => { window.location.hash = '#/screens/SCR-AIR-001'; }")
            expect(page.locator(".next-screen-preview .next-section-head h2")).to_have_text("Asset Register")
            if mobile:
                menu = page.get_by_role("button", name="Toggle navigation")
                expect(menu).to_be_visible()
                menu.click()
                drawer = page.get_by_role("dialog", name="Primary navigation")
                expect(drawer).to_have_attribute("aria-modal", "true")
                expect(drawer).to_be_visible()
                expect(page.locator(".next-body")).to_have_attribute("inert", "")
                expect(page.locator(".next-skip")).to_have_attribute("inert", "")
                expect(page.locator(".next-mobile-backdrop")).to_have_attribute("tabindex", "-1")
                expect(page.locator("body")).to_have_css("overflow", "hidden")
                buttons = drawer.locator("button:not(:disabled)")
                expect(buttons.first).to_be_focused()
                buttons.last.focus()
                page.keyboard.press("Tab")
                expect(buttons.first).to_be_focused()
                buttons.first.focus()
                page.keyboard.press("Shift+Tab")
                expect(buttons.last).to_be_focused()
                checks += 2
                if width == 375:
                    # Rotation/resizing while the modal is open must not leave
                    # desktop content inert or focus stuck in a hidden drawer.
                    page.set_viewport_size({"width": 1280, "height": 800})
                    expect(drawer).to_have_count(0)
                    expect(page.locator(".next-body")).not_to_have_attribute("inert", "")
                    expect(page.locator("#next-main")).to_be_focused()
                    checks += 1
                    page.set_viewport_size({"width": 375, "height": 800})
                    menu.click()
                    drawer = page.get_by_role("dialog", name="Primary navigation")
                    expect(drawer).to_be_visible()
                page.keyboard.press("Escape")
                expect(drawer).to_have_count(0)
                expect(menu).to_be_focused()
                expect(page.locator(".next-body")).not_to_have_attribute("inert", "")
                expect(page.locator("body")).not_to_have_css("overflow", "hidden")
                checks += 1
                menu.click()
                page.get_by_role("button", name="Close mobile navigation").click(position={"x": 310, "y": 120})
                expect(drawer).to_have_count(0)
                expect(menu).to_be_focused()
                checks += 1
                menu.click()
                drawer.get_by_role("button", name=re.compile("Degradation Mechanisms", re.I)).click()
                expect(page.locator(".next-screen-preview .next-section-head h2")).to_be_visible()
                expect(page.locator("#next-main")).to_be_focused()
                checks += 1
            page.close()
    finally:
        browser.close()

if errors:
    for error in errors[:10]:
        print(f"FAIL: browser uncaught error: {error}", file=sys.stderr)
    raise SystemExit(1)
print(f"PASS: {checks} mounted Chromium assertions; {len(ROWS)} canonical routes tested at desktop plus {len(ROWS)*len(VIEWPORT_WIDTHS)} route-viewport combinations at {list(VIEWPORT_WIDTHS)}px; no uncaught page errors")
