#!/usr/bin/env python3
"""Optional browser check of *shell CSS only*; NOT a React, Vitest, or app E2E test.

Requires Python playwright with Chromium installed. Exercises the actual stylesheet
against a small structural fixture at four viewport widths. Never uses mock
engineering data or claims to exercise interactive domain components.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

css = (Path(__file__).resolve().parents[1] / "src" / "styles.css").read_text()
# Avoid external font imports; these are not required for layout verification.
css = "\n".join(line for line in css.splitlines() if not line.lstrip().startswith("@import"))
html = f"""<!doctype html><html lang='en'><head><meta name='viewport' content='width=device-width, initial-scale=1'>
<style>{css}</style></head><body><div class='next-app'>
<aside class='next-sidebar' aria-label='Primary navigation'><div class='next-brand'>Bandha AIM</div></aside>
<div class='next-body'><header class='next-topbar'><button class='next-menu'>Menu</button></header>
<main class='next-main'><!-- Phase 42: realistic narrow domain heading --><div class='next-page-heading'><div><h1 class='next-page-title'>Recommendations</h1><p class='next-page-description'>Domain view at mobile width</p></div><span class='next-domain-bigcode'>REC</span></div><div class='next-page-heading'><div><h1 class='next-page-title'>Recommendations</h1><p class='next-page-description'>Domain view at mobile width</p></div><span class='next-domain-bigcode'>REC</span></div><section class='next-panel'>
<div class='next-domain-layout'><div class='next-domain-primary'><p>Content</p></div></div></section></main></div></div></body></html>"""

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    try:
        for width in (320,375,768,1280):
            page=browser.new_page(viewport={"width":width,"height":800},device_scale_factor=1)
            page.set_content(html,wait_until='domcontentloaded')
            initial=page.evaluate("""() => ({viewport:innerWidth,scroll:document.documentElement.scrollWidth,
                sidebar:getComputedStyle(document.querySelector('.next-sidebar')).visibility,
                menu:getComputedStyle(document.querySelector('.next-menu')).display})""")
            assert initial['scroll']<=width, f"Horizontal overflow in shell and domain-heading fixture: {width}px {initial}"
            if width<=800:
                assert initial['sidebar']=='hidden', f"Collapsed sidebar is keyboard-visible: {width}px {initial}"
                page.locator('.next-sidebar').evaluate("e=>e.classList.add('mobile-open')")
                expanded=page.evaluate("getComputedStyle(document.querySelector('.next-sidebar')).visibility")
                assert expanded=='visible', f"Expanded sidebar invisible at {width}px"
                assert initial['menu']!='none', f"Mobile menu is hidden at {width}px"
            else:
                assert initial['sidebar']=='visible', f"Desktop sidebar invisible at {width}px"
            print(f"{width}px: shell CSS fixture passed (scroll={initial['scroll']}, sidebar={initial['sidebar']})")
            page.close()
    finally:
        browser.close()
print('NOTE: stylesheet fixture only; full React app/UI NOT executed')
