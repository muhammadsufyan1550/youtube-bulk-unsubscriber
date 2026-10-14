# YouTube Bulk Unsubscriber 🛑

A clean, privacy-first tool to bulk-unsubscribe from YouTube channels with an in-page floating control panel.

---

## 🚀 Features

- **⚡ 1-Click Launch**: Run as a **Chrome Extension** or directly in your browser Console.
- **🛡️ 100% Client-Side & Private**: Runs purely in your local browser session. No credentials, tokens, or personal data ever leave your machine.
- **🔒 TrustedHTML Compliant**: Built with pure DOM APIs to bypass Google's strict Trusted Types Content Security Policy (CSP).
- **⏳ Anti-Rate-Limit Throttling**: Human-like pacing (1.8s–2.5s) prevents YouTube's anti-bot system from issuing temporary HTTP 429 soft blocks.
- **✅ Double State Verification**: Only increments the counter after confirming that YouTube's server flipped the button from *"Subscribed"* to *"Subscribe"*.
- **⬇️ Continuous Downward Scrolling**: Remembers all processed channels and moves strictly downward—never jumping back up to the top.

---

## 🧩 Option 1: Install as a Chrome Extension (Recommended)

You can load this directly into **Chrome**, **Brave**, or **Edge**:

1. Open your browser and go to `chrome://extensions` (or `edge://extensions`).
2. Toggle on **"Developer mode"** in the top-right corner.
3. Click the **"Load unpacked"** button in the top-left.
4. Select the **`extension`** folder inside this directory:
   ```
   C:\Users\media\Music\yt-unsubscriber\extension
   ```
5. Pin the extension to your toolbar. When you visit [youtube.com/feed/channels](https://www.youtube.com/feed/channels), click the extension icon and hit **"⚡ Launch Control Panel"**!

---

## 💻 Option 2: Run via Browser Console (Zero Install)

1. Open [https://www.youtube.com/feed/channels](https://www.youtube.com/feed/channels).
2. Press **`F12`** (or `Ctrl + Shift + I`) to open Developer Tools.
3. Switch to the **Console** tab.
4. Copy and paste the entire contents of [`yt_unsubscriber_ui.js`](./yt_unsubscriber_ui.js) and press **Enter**.
5. Use the on-screen HUD to Start, Pause, or Adjust Speed.

---

## 🐍 Option 3: Python Automation (Playwright)

For headless or scripted automated browser runs:

```powershell
pip install -r requirements.txt
playwright install chromium
python playwright_unsubscribe.py --delay 1.8
```

---

## ☁️ Option 4: YouTube Data API v3

Included in [`api_unsubscribe.py`](./api_unsubscribe.py) for developers who have a Google Cloud OAuth client.
*(Note: Google caps free deletions at ~200 channels/day due to API quota limits).*
