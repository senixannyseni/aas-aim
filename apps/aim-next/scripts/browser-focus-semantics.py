#!/usr/bin/env python3
"""Isolated Chromium proof: inert nodes reject focus until inert is removed.

Uses a tiny DOM fixture, NOT the mounted AAS-AIM React app. Browser E2E
remains a separate release gate and is not substituted by this check.
"""
import argparse
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--chromium", default=None, help="Path to locally installed Chromium")
args = parser.parse_args()
with sync_playwright() as p:
    opts = {"headless": True}
    if args.chromium:
        opts["executable_path"] = args.chromium
    browser = p.chromium.launch(**opts)
    try:
        page = browser.new_page()
        page.set_content('<main id="main" inert><button id="menu">Menu</button></main><button id="dialog">Dialog</button>')
        result = page.evaluate("""() => {
          const menu = document.getElementById('menu');
          const dialog = document.getElementById('dialog');
          const main = document.getElementById('main');
          dialog.focus();
          menu.focus();
          const before = document.activeElement.id;
          main.removeAttribute('inert');
          menu.focus();
          const after = document.activeElement.id;
          return {before, after};
        }""")
        if result != {"before": "dialog", "after": "menu"}:
            raise AssertionError(f"Unexpected inert-focus browser behavior: {result}")
        print("PASS: Chromium ignored focus on an inert menu and permitted focus after inert removal (DOM fixture only)")
    finally:
        browser.close()
