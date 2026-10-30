# -*- coding: utf-8 -*-
"""Quality gate: open pages headless, collect console errors / page errors,
and auto-play every scenario on /demo until the last step (x60).

usage: python scripts/check_console.py http://localhost:3123
ASCII-only source (Korean text is not needed here).
"""
import sys
import time
import re
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")

BASE = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://localhost:3123"
PAGES = ["/", "/demo", "/architecture", "/sdk", "/car", "/companion", "/ops", "/sim", "/c/k4m9"]
SCENARIOS = ["S1", "S2", "S3", "S4"]


def attach(page, bucket, tag):
    def on_console(msg):
        if msg.type == "error":
            bucket.append("%s console.error: %s" % (tag, msg.text))

    def on_pageerror(err):
        bucket.append("%s pageerror: %s" % (tag, err))

    page.on("console", on_console)
    page.on("pageerror", on_pageerror)


def step_text(page):
    el = page.locator("[data-testid=caption] .badge").first
    return el.inner_text() if el.count() else ""


def main():
    errors = []
    results = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--disable-gpu"])
        for path in PAGES:
            ctx = browser.new_context(viewport={"width": 1600, "height": 900})
            page = ctx.new_page()
            attach(page, errors, path)
            page.goto(BASE + path, wait_until="networkidle")
            page.wait_for_timeout(1500)
            results[path] = page.title()
            ctx.close()

        # scenario auto-play, each in its own context (BroadcastChannel is per context)
        pages = []
        for sc in SCENARIOS:
            ctx = browser.new_context(viewport={"width": 1600, "height": 900})
            page = ctx.new_page()
            attach(page, errors, "/demo?s=" + sc)
            page.goto(BASE + "/demo?mute=1&s=" + sc, wait_until="networkidle")
            page.wait_for_selector("[data-testid=play]", timeout=15000)
            page.get_by_role("button", name="×60").click()
            page.locator("[data-testid=play]").click()
            pages.append((sc, ctx, page))

        deadline = time.time() + 150
        done = {}
        while time.time() < deadline and len(done) < len(pages):
            for sc, ctx, page in pages:
                if sc in done:
                    continue
                txt = step_text(page)
                m = re.search(r"(\d+)/(\d+)", txt)
                playing = page.locator("[data-testid=play]").count() == 0
                if m and m.group(1) == m.group(2) and not playing:
                    done[sc] = txt
            time.sleep(1)
        for sc, ctx, page in pages:
            ctx.close()
        browser.close()

    print("titles:")
    for k, v in results.items():
        print("  %-14s %s" % (k, v))
    print("scenarios finished: %d/%d %s" % (len(done), len(SCENARIOS), done))
    print("console errors: %d" % len(errors))
    for e in errors:
        print("  " + e)
    ok = len(errors) == 0 and len(done) == len(SCENARIOS)
    print("RESULT: " + ("PASS" if ok else "FAIL"))
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
