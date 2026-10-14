"""
YouTube Bulk Unsubscriber (Playwright Automation)
=================================================
Automates unsubscribing from YouTube channels using Playwright.
Saves browser session/cookies in a local directory (`./chrome_profile`) so you only have to log in once.

Prerequisites:
    pip install playwright
    playwright install chromium

Usage:
    python playwright_unsubscribe.py [--delay 1.5] [--max 100]
"""

import asyncio
import argparse
import sys
import os
from pathlib import Path
from playwright.async_api import async_playwright

PROFILE_DIR = Path(__file__).parent / "chrome_profile"

async def main(delay: float, max_count: int):
    print("=" * 60)
    print("▶ Starting YouTube Bulk Unsubscriber (Playwright)")
    print(f"  Delay between unsubscriptions: {delay}s")
    print(f"  Max channels to unsubscribe: {'Unlimited' if max_count == 0 else max_count}")
    print(f"  Local browser profile directory: {PROFILE_DIR}")
    print("=" * 60)

    PROFILE_DIR.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as p:
        # Launch persistent context to preserve login session
        browser = await p.chromium.launch_persistent_context(
            user_data_dir=str(PROFILE_DIR),
            headless=False,
            channel="chrome",  # Uses your system's Google Chrome if installed, falls back to chromium
            args=[
                "--disable-blink-features=AutomationControlled",
                "--start-maximized"
            ],
            no_viewport=True
        )

        page = browser.pages[0] if browser.pages else await browser.new_page()

        print("\nNavigating to YouTube Subscriptions page...")
        await page.goto("https://www.youtube.com/feed/channels")

        # Check if user needs to log in
        login_btn = await page.query_selector('a[href*="accounts.google.com/ServiceLogin"], yt-button-shape a[href*="ServiceLogin"]')
        if login_btn:
            print("\n" + "!" * 60)
            print("🔑 ACTION REQUIRED: Please log into your Google Account in the browser window.")
            print("   After logging in, navigate to https://www.youtube.com/feed/channels if not there.")
            print("   Press Enter in this terminal once you are logged in and ready...")
            print("!" * 60 + "\n")
            input("Press Enter to continue after logging in...")

        print("\nWaiting for channels list to load...")
        try:
            await page.wait_for_selector("ytd-channel-renderer", timeout=15000)
        except Exception:
            print("Notice: No channels detected immediately. Scrolling or checking feed...")

        unsubscribed_count = 0
        empty_scrolls = 0

        while True:
            if max_count > 0 and unsubscribed_count >= max_count:
                print(f"\n[Limit reached] Processed {unsubscribed_count} channels as requested.")
                break

            channel_rows = await page.query_selector_all("ytd-channel-renderer")
            processed_in_batch = False

            for row in channel_rows:
                if max_count > 0 and unsubscribed_count >= max_count:
                    break

                # Extract channel name
                title_el = await row.query_selector("#channel-title, #title, #text")
                channel_name = (await title_el.inner_text()).strip() if title_el else "Unknown Channel"

                # Locate the Subscribed button
                # We specifically look for buttons that indicate an active subscription
                buttons = await row.query_selector_all("button, yt-button-shape")
                sub_btn = None

                for b in buttons:
                    aria = (await b.get_attribute("aria-label") or "").lower()
                    text = (await b.inner_text() or "").strip().lower()

                    if (
                        text == "subscribed" or
                        "unsubscribe from" in aria or
                        "subscribed to" in aria or
                        "current subscription" in aria
                    ):
                        tag = await b.evaluate("el => el.tagName.toLowerCase()")
                        if tag == "button":
                            sub_btn = b
                        else:
                            nested_b = await b.query_selector("button")
                            sub_btn = nested_b if nested_b else b
                        break

                if not sub_btn:
                    continue  # Already unsubscribed or button not recognized

                print(f"[{unsubscribed_count + 1}] Processing: {channel_name}...", end=" ", flush=True)

                try:
                    await sub_btn.scroll_into_view_if_needed()
                    await page.wait_for_timeout(300)
                    await sub_btn.click()
                    await page.wait_for_timeout(400)

                    # Check if an action menu popped up (All, Personalized, None, Unsubscribe)
                    menu_items = await page.query_selector_all(
                        "ytd-menu-service-item-renderer, tp-yt-paper-item, ytd-menu-popup-renderer tp-yt-paper-item"
                    )
                    for item in menu_items:
                        item_text = (await item.inner_text() or "").lower()
                        if "unsubscribe" in item_text:
                            await item.click()
                            await page.wait_for_timeout(400)
                            break

                    # Check for confirmation dialog: yt-confirm-dialog-renderer
                    confirm_btn = await page.query_selector(
                        "yt-confirm-dialog-renderer #confirm-button button, yt-confirm-dialog-renderer yt-button-shape#confirm-button button, yt-confirm-dialog-renderer #confirm-button"
                    )

                    if confirm_btn:
                        await confirm_btn.click()
                        unsubscribed_count += 1
                        processed_in_batch = True
                        empty_scrolls = 0
                        print(f"✓ Successfully unsubscribed! (Total: {unsubscribed_count})")
                        await page.wait_for_timeout(int(delay * 1000))
                    else:
                        # Check if button changed to 'Subscribe' directly
                        await page.wait_for_timeout(300)
                        btn_text = (await sub_btn.inner_text() or "").strip().lower()
                        if btn_text == "subscribe":
                            unsubscribed_count += 1
                            processed_in_batch = True
                            empty_scrolls = 0
                            print(f"✓ Unsubscribed (Direct)! (Total: {unsubscribed_count})")
                            await page.wait_for_timeout(int(delay * 1000))
                        else:
                            print("⚠️ Skipped (Confirmation dialog not detected).")
                            await page.keyboard.press("Escape")
                            await page.wait_for_timeout(300)

                except Exception as ex:
                    print(f"❌ Error: {ex}")
                    await page.keyboard.press("Escape")
                    await page.wait_for_timeout(500)

            # Auto-scroll if all visible channels have been unsubscribed
            if not processed_in_batch:
                if empty_scrolls < 4:
                    empty_scrolls += 1
                    print(f"\nScrolling down to load more channels (attempt {empty_scrolls}/4)...")
                    await page.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)")
                    await page.wait_for_timeout(2500)
                else:
                    print("\n🎉 All channels processed! No more active subscriptions found.")
                    break

        print("\n" + "=" * 60)
        print(f"Finished! Total unsubscribed channels: {unsubscribed_count}")
        print("=" * 60)
        await browser.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Unsubscribe all channels from YouTube via Playwright.")
    parser.add_argument("--delay", type=float, default=1.5, help="Seconds to wait between actions (default: 1.5)")
    parser.add_argument("--max", type=int, default=0, help="Maximum channels to unsubscribe (0 = all, default: 0)")
    args = parser.parse_args()

    asyncio.run(main(delay=args.delay, max_count=args.max))
