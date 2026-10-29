#!/usr/bin/env python3
"""Phase 46.9: mounted production navigation/lazy-module smoke journey.

The public preview MUST remain disconnected. This test does not grant a scope,
exercise privileged commands, or prove tenant-specific authorization.
"""
import argparse
import re
from playwright.sync_api import sync_playwright, expect
from browser_journey_contract import SCREEN_TITLES, is_unauthorized_api_request

parser = argparse.ArgumentParser()
parser.add_argument('--base-url', default='http://127.0.0.1:4174')
parser.add_argument('--chromium', default=None)
args = parser.parse_args()
errors = []
unexpected_api_calls = []
with sync_playwright() as playwright:
    kwargs = {'headless': True}
    if args.chromium:
        kwargs['executable_path'] = args.chromium
    browser = playwright.chromium.launch(**kwargs)
    try:
        page = browser.new_page(viewport={'width': 1280, 'height': 800})
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('request', lambda request: unexpected_api_calls.append(request.method + ' ' + request.url)
                if is_unauthorized_api_request(request.url, args.base_url) else None)
        page.goto(args.base_url.rstrip('/'), wait_until='domcontentloaded')
        expect(page.locator('.next-page-title')).to_contain_text('One integrity system')
        expect(page.get_by_role('navigation', name='Recently visited workspaces')).to_have_count(0)
        for screen_id, selector in [
            ('SCR-AIR-001', '.aim-asset-workspace'),
            ('SCR-COR-001', '.cor-workspace'),
            ('SCR-INS-001', '.ins-workspace'),
        ]:
            page.evaluate('id => window.location.hash = "#/screens/" + id', screen_id)
            # Check exact screen identity, not just any nonempty (possibly stale) heading.
            expect(page).to_have_url(re.compile(r'#/screens/' + re.escape(screen_id) + r'$'))
            expect(page.locator('.next-screen-preview .next-section-head h2')).to_have_text(SCREEN_TITLES[screen_id])
            expect(page.locator('.next-screen-preview > .next-section-head > div > .next-eyebrow')).to_contain_text(screen_id)
            expect(page.get_by_text('No authenticated session')).to_be_visible()
            if screen_id != 'SCR-AIR-001':
                expect(page.locator(selector)).to_be_visible()
        history = page.get_by_role('navigation', name='Recently visited workspaces')
        expect(history).to_be_visible()
        # The trail contains only canonical screen titles, not record identities.
        expect(history).not_to_contain_text('V-101')
        expect(history).not_to_contain_text('tenant')
        history.get_by_role('button', name=re.compile('Corrosion Loop & Circuit Workspace', re.I)).click()
        expect(page).to_have_url(re.compile(r'#/screens/SCR-COR-001$'))
        expect(page.locator('.next-screen-preview .next-section-head h2')).to_have_text(SCREEN_TITLES['SCR-COR-001'])
        expect(page.locator('.cor-workspace')).to_be_visible()
        # Keyboard focus must move to the returned workspace, not remain on a stale trail button.
        expect(page.locator('#next-main')).to_be_focused()
        # Reload loses the ephemeral trail instead of recovering a previous scope.
        page.reload(wait_until='domcontentloaded')
        expect(page.locator('.next-screen-preview .next-section-head h2')).to_have_text(SCREEN_TITLES['SCR-COR-001'])
        expect(page.locator('.cor-workspace')).to_be_visible()
        expect(page.get_by_role('navigation', name='Recently visited workspaces')).to_have_count(0)
        expect(page.get_by_text('No authenticated session')).to_be_visible()
        assert not unexpected_api_calls, f'Disconnected application attempted same-origin API access: {unexpected_api_calls}'
        assert not errors, f'Uncaught page errors: {errors}'
        print('PASS Phase 46.10 mounted Chromium journey: exact AIR/COR/INS identity, recent COR focus and reload reset; no unexpected API requests or page errors.')
    finally:
        browser.close()
