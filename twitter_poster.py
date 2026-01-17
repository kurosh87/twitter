#!/usr/bin/env python3
"""
Twitter/X Poster - Automated posting via Playwright
Uses existing browser session (must be logged into X.com)
"""

import asyncio
import json
import sys
from pathlib import Path
from playwright.async_api import async_playwright

DRAFTS_DIR = Path(__file__).parent / "drafts"


async def post_tweet(draft_id: str, language: str = "english"):
    """Post a tweet from an approved draft."""

    # Find draft in approved folder
    draft_path = DRAFTS_DIR / "approved" / f"{draft_id}.json"
    if not draft_path.exists():
        # Try with draft_ prefix
        draft_path = DRAFTS_DIR / "approved" / f"draft_{draft_id}.json"

    if not draft_path.exists():
        print(f"❌ Draft not found: {draft_id}")
        print(f"   Looked in: {DRAFTS_DIR / 'approved'}")
        return None

    with open(draft_path, 'r') as f:
        draft = json.load(f)

    # Get tweet text based on language preference
    if language == "persian" and draft.get("persian"):
        tweet_text = draft["persian"]
    else:
        tweet_text = draft.get("english", "")

    if not tweet_text:
        print(f"❌ No tweet text found for language: {language}")
        return None

    print(f"📝 Posting: {tweet_text[:60]}...")

    async with async_playwright() as p:
        # Connect to existing Chrome instance or launch new one
        # Using persistent context to maintain login session
        user_data_dir = Path.home() / ".playwright-twitter-session"

        browser = await p.chromium.launch_persistent_context(
            user_data_dir=str(user_data_dir),
            headless=False,
            args=['--disable-blink-features=AutomationControlled']
        )

        page = browser.pages[0] if browser.pages else await browser.new_page()

        try:
            # Go to Twitter compose
            await page.goto("https://x.com/compose/tweet", wait_until="networkidle")
            await asyncio.sleep(2)

            # Check if logged in
            if "login" in page.url.lower():
                print("⚠️  Not logged in. Please log in manually first.")
                print("   Run: python twitter_poster.py --login")
                await browser.close()
                return None

            # Find and fill the tweet compose box
            # Twitter uses contenteditable divs
            compose_box = page.locator('[data-testid="tweetTextarea_0"]')
            await compose_box.click()
            await asyncio.sleep(0.5)

            # Type the tweet
            await compose_box.fill(tweet_text)
            await asyncio.sleep(1)

            # Click the Post button
            post_button = page.locator('[data-testid="tweetButton"]')
            await post_button.click()

            print("✅ Tweet posted!")
            await asyncio.sleep(3)

            # Get the tweet URL (after redirect)
            tweet_url = page.url
            print(f"   URL: {tweet_url}")

            # Mark draft as posted
            draft["posted_at"] = __import__("datetime").datetime.now().isoformat()
            draft["tweet_url"] = tweet_url

            # Move to posted folder
            posted_path = DRAFTS_DIR / "posted" / draft_path.name
            with open(posted_path, 'w') as f:
                json.dump(draft, f, indent=2, ensure_ascii=False)
            draft_path.unlink()

            print(f"   Moved to: {posted_path}")

            return tweet_url

        except Exception as e:
            print(f"❌ Error posting: {e}")
            # Take screenshot for debugging
            await page.screenshot(path="/tmp/twitter-error.png")
            print("   Screenshot saved: /tmp/twitter-error.png")
            return None

        finally:
            await browser.close()


async def login_flow():
    """Open browser for manual login to Twitter."""
    async with async_playwright() as p:
        user_data_dir = Path.home() / ".playwright-twitter-session"

        browser = await p.chromium.launch_persistent_context(
            user_data_dir=str(user_data_dir),
            headless=False,
            args=['--disable-blink-features=AutomationControlled']
        )

        page = browser.pages[0] if browser.pages else await browser.new_page()
        await page.goto("https://x.com/login")

        print("🔐 Please log in to Twitter manually in the browser window.")
        print("   Press Enter here when done...")
        input()

        await browser.close()
        print("✅ Session saved. You can now post tweets.")


async def post_both_languages(draft_id: str):
    """Post a tweet in both English and Persian (as a thread)."""

    draft_path = DRAFTS_DIR / "approved" / f"draft_{draft_id}.json"
    if not draft_path.exists():
        draft_path = DRAFTS_DIR / "approved" / f"{draft_id}.json"

    if not draft_path.exists():
        print(f"❌ Draft not found: {draft_id}")
        return

    with open(draft_path, 'r') as f:
        draft = json.load(f)

    english = draft.get("english", "")
    persian = draft.get("persian", "")

    if not english:
        print("❌ No English text")
        return

    print(f"📝 English: {english[:50]}...")
    print(f"📝 Persian: {persian[:50] if persian else '(none)'}...")

    async with async_playwright() as p:
        user_data_dir = Path.home() / ".playwright-twitter-session"

        browser = await p.chromium.launch_persistent_context(
            user_data_dir=str(user_data_dir),
            headless=False,
            args=['--disable-blink-features=AutomationControlled']
        )

        page = browser.pages[0] if browser.pages else await browser.new_page()

        try:
            await page.goto("https://x.com/compose/tweet", wait_until="networkidle")
            await asyncio.sleep(2)

            if "login" in page.url.lower():
                print("⚠️  Not logged in. Run: python twitter_poster.py --login")
                await browser.close()
                return

            # Post English first
            compose_box = page.locator('[data-testid="tweetTextarea_0"]')
            await compose_box.click()
            await compose_box.fill(english)
            await asyncio.sleep(1)

            if persian:
                # Add reply (thread) with Persian
                add_button = page.locator('[data-testid="addButton"]')
                await add_button.click()
                await asyncio.sleep(0.5)

                # Fill Persian in second tweet
                compose_box_2 = page.locator('[data-testid="tweetTextarea_1"]')
                await compose_box_2.fill(persian)
                await asyncio.sleep(1)

            # Post thread
            post_button = page.locator('[data-testid="tweetButton"]')
            await post_button.click()

            print("✅ Thread posted!")
            await asyncio.sleep(3)

            tweet_url = page.url
            print(f"   URL: {tweet_url}")

            # Mark as posted
            draft["posted_at"] = __import__("datetime").datetime.now().isoformat()
            draft["tweet_url"] = tweet_url
            posted_path = DRAFTS_DIR / "posted" / draft_path.name
            with open(posted_path, 'w') as f:
                json.dump(draft, f, indent=2, ensure_ascii=False)
            draft_path.unlink()

            return tweet_url

        except Exception as e:
            print(f"❌ Error: {e}")
            await page.screenshot(path="/tmp/twitter-error.png")
            return None

        finally:
            await browser.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python twitter_poster.py --login           # Login to Twitter first")
        print("  python twitter_poster.py <draft_id>        # Post English only")
        print("  python twitter_poster.py <draft_id> --fa   # Post Persian only")
        print("  python twitter_poster.py <draft_id> --both # Post EN+FA as thread")
        sys.exit(1)

    if sys.argv[1] == "--login":
        asyncio.run(login_flow())
    elif len(sys.argv) >= 3 and sys.argv[2] == "--both":
        asyncio.run(post_both_languages(sys.argv[1]))
    elif len(sys.argv) >= 3 and sys.argv[2] == "--fa":
        asyncio.run(post_tweet(sys.argv[1], language="persian"))
    else:
        asyncio.run(post_tweet(sys.argv[1], language="english"))
