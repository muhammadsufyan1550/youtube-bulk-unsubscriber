"""
YouTube Bulk Unsubscriber (Official YouTube Data API v3)
========================================================
Uses the official Google YouTube Data API v3 to list and remove subscriptions.

Prerequisites:
    pip install google-api-python-client google-auth-oauthlib google-auth-httplib2

Setup:
    1. Go to Google Cloud Console (https://console.cloud.google.com/)
    2. Create a project and enable "YouTube Data API v3".
    3. Configure OAuth consent screen (External, add your email as Test User).
    4. Create Credentials -> OAuth Client ID (Desktop App).
    5. Download client secrets JSON and save it as `client_secret.json` in this folder.

IMPORTANT QUOTA WARNING:
    YouTube API charges 50 quota units for each `subscriptions.delete` call.
    Default free project quota is 10,000 units/day.
    This means you can unsubscribe from at most ~200 channels per 24-hour period via API.
    For unlimited unsubscribing, use `yt_unsubscriber_ui.js` or `playwright_unsubscribe.py` instead.
"""

import os
import sys
import time
import argparse
from pathlib import Path

try:
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
    from google_auth_oauthlib.flow import InstalledAppFlow
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
except ImportError:
    print("Missing Google API libraries. Please run:")
    print("pip install google-api-python-client google-auth-oauthlib google-auth-httplib2")
    sys.exit(1)

SCOPES = ["https://www.googleapis.com/auth/youtube.force-ssl"]
CLIENT_SECRETS_FILE = Path(__file__).parent / "client_secret.json"
TOKEN_FILE = Path(__file__).parent / "token.json"

def get_authenticated_service():
    creds = None
    if TOKEN_FILE.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not CLIENT_SECRETS_FILE.exists():
                print("=" * 60)
                print("❌ ERROR: `client_secret.json` not found in this directory!")
                print("Please download your OAuth 2.0 Client credentials from:")
                print("https://console.cloud.google.com/apis/credentials")
                print("and place it at:", CLIENT_SECRETS_FILE)
                print("=" * 60)
                sys.exit(1)

            flow = InstalledAppFlow.from_client_secrets_file(str(CLIENT_SECRETS_FILE), SCOPES)
            creds = flow.run_local_server(port=0)

        with open(TOKEN_FILE, "w") as token:
            token.write(creds.to_json())

    return build("youtube", "v3", credentials=creds)

def main(max_delete: int, delay: float):
    print("=" * 60)
    print("▶ YouTube Bulk Unsubscriber (Official API)")
    print("=" * 60)

    youtube = get_authenticated_service()

    total_unsubscribed = 0
    quota_spent = 0

    while True:
        if max_delete > 0 and total_unsubscribed >= max_delete:
            print(f"\n[Limit reached] Processed {total_unsubscribed} channels.")
            break

        # List subscriptions (costs 1 quota unit)
        try:
            request = youtube.subscriptions().list(
                part="snippet",
                mine=True,
                maxResults=50
            )
            response = request.execute()
            quota_spent += 1
        except HttpError as e:
            print(f"API Error fetching subscriptions: {e}")
            break

        items = response.get("items", [])
        if not items:
            print("\n🎉 No subscriptions found! Your account has 0 subscribed channels.")
            break

        print(f"\nFound batch of {len(items)} subscriptions.")

        for item in items:
            if max_delete > 0 and total_unsubscribed >= max_delete:
                break

            sub_id = item["id"]
            channel_title = item["snippet"]["title"]

            print(f"[{total_unsubscribed + 1}] Unsubscribing: {channel_title}...", end=" ", flush=True)

            try:
                # Delete subscription (costs 50 quota units)
                youtube.subscriptions().delete(id=sub_id).execute()
                total_unsubscribed += 1
                quota_spent += 50
                print(f"✓ Done (Quota spent: ~{quota_spent} units)")
                time.sleep(delay)
            except HttpError as e:
                if "quotaExceeded" in str(e):
                    print("\n" + "!" * 60)
                    print("⚠️ QUOTA EXCEEDED: You hit Google's daily API limit (10,000 units).")
                    print("Each unsubscribe costs 50 units (~200 deletions/day max on free tier).")
                    print("Try again tomorrow, or use `yt_unsubscriber_ui.js` which has no quota limits!")
                    print("!" * 60)
                    return
                else:
                    print(f"❌ Failed: {e}")

    print("\n" + "=" * 60)
    print(f"Finished! Total unsubscribed: {total_unsubscribed}")
    print(f"Estimated quota used: {quota_spent} / 10,000 units")
    print("=" * 60)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Unsubscribe via official YouTube API")
    parser.add_argument("--max", type=int, default=0, help="Max channels to delete (0 = as many as quota allows)")
    parser.add_argument("--delay", type=float, default=0.2, help="Delay between API calls in seconds (default: 0.2)")
    args = parser.parse_args()

    main(max_delete=args.max, delay=args.delay)
