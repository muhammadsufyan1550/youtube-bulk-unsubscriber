document.addEventListener('DOMContentLoaded', async () => {
  const statusDesc = document.getElementById('status-desc');
  const actionBtn = document.getElementById('action-btn');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url) {
    statusDesc.textContent = 'Unable to detect active tab.';
    return;
  }

  const isSubsPage = tab.url.includes('youtube.com/feed/channels');

  if (isSubsPage) {
    statusDesc.textContent = 'Ready! Click below to open the Bulk Unsubscriber panel on your YouTube page.';
    actionBtn.textContent = '⚡ Launch Control Panel';
    actionBtn.className = 'btn btn-primary';
    actionBtn.style.display = 'flex';

    actionBtn.onclick = async () => {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['yt_unsubscriber_ui.js']
      });
      window.close();
    };
  } else {
    statusDesc.textContent = 'Navigate to your YouTube Subscriptions manager to use this tool.';
    actionBtn.textContent = '👉 Go to Subscriptions Page';
    actionBtn.className = 'btn btn-secondary';
    actionBtn.style.display = 'flex';

    actionBtn.onclick = async () => {
      await chrome.tabs.update(tab.id, { url: 'https://www.youtube.com/feed/channels' });
      window.close();
    };
  }
});
