# -*- coding: utf-8 -*-
"""Capture demo screenshots (1600x900, deviceScaleFactor 2).

usage: python scripts/capture.py <base_url> <out_dir> [<out_dir2> ...]
ASCII-only source. Korean descriptions live in docs/shots/INDEX.md.
"""
import os
import sys
import shutil
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")

BASE = sys.argv[1].rstrip("/")
OUTS = sys.argv[2:] or ["docs/shots"]

# (file name, path, extra action, full_page)
SHOTS = [
    ("00_home.png", "/", None, True),
    ("01_architecture.png", "/architecture", None, True),
    ("02_sdk.png", "/sdk", None, False),
    ("s1_1_delay_gleo_ask.png", "/demo?mute=1&s=S1&step=1", None, False),
    ("s1_2_delay_notice_sent.png", "/demo?mute=1&s=S1&step=2", None, False),
    ("s1_3_touch_blocked.png", "/demo?mute=1&s=S1&step=4", "fast", False),
    ("s2_1_postpone_replan.png", "/demo?mute=1&s=S2&step=1", None, False),
    ("s2_2_earlier_ok_ops.png", "/demo?mute=1&s=S2&step=2", "ops", False),
    ("s2_3_read_next_job.png", "/demo?mute=1&s=S2&step=4", None, False),
    ("s3_1_arrived_parked.png", "/demo?mute=1&s=S3&step=2", None, False),
    ("s3_2_overrun_ask.png", "/demo?mute=1&s=S3&step=4", None, False),
    ("s3_3_departed_ops.png", "/demo?mute=1&s=S3&step=6", "ops", False),
    ("s4_1_prearrival_parking_card.png", "/demo?mute=1&s=S4&step=1", None, False),
    ("s4_2_change_to_parking_ask.png", "/demo?mute=1&s=S4&step=3", None, False),
    ("s4_3_arrived_underground.png", "/demo?mute=1&s=S4&step=6", None, False),
]


def main():
    for o in OUTS:
        os.makedirs(o, exist_ok=True)
    only = os.environ.get("ONLY")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--disable-gpu"])
        for name, path, extra, full in SHOTS:
            if only and only not in name:
                continue
            ctx = browser.new_context(viewport={"width": 1600, "height": 900}, device_scale_factor=2)
            page = ctx.new_page()
            page.goto(BASE + path, wait_until="networkidle")
            if path.startswith("/demo"):
                page.wait_for_selector("[data-testid=car-screen]", timeout=20000)
                if extra == "fast":
                    page.wait_for_timeout(300)
                else:
                    page.wait_for_timeout(1200)
                if extra == "ops":
                    page.locator("[data-testid=tab-ops]").click()
                    page.wait_for_timeout(400)
            else:
                page.wait_for_timeout(1500)
            target = os.path.join(OUTS[0], name)
            page.screenshot(path=target, full_page=full)
            for o in OUTS[1:]:
                shutil.copyfile(target, os.path.join(o, name))
            print("saved", name)
            ctx.close()
        browser.close()


if __name__ == "__main__":
    main()
