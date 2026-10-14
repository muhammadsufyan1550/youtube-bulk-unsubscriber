/**
 * ==============================================================================
 * YouTube Bulk Unsubscriber - Continuous Forward Scroll Edition
 * ==============================================================================
 * Run on: https://www.youtube.com/feed/channels
 * Features:
 * - Remembers all processed channels (never scrolls back to the top!)
 * - Strictly ignores channels already showing "Subscribe"
 * - Automatically scrolls down continuously to load and process new channels
 * - Real user clicks + TrustedHTML safe + state verification
 * ==============================================================================
 */

(function () {
  const existing = document.getElementById('yt-unsubscriber-hub');
  if (existing) existing.remove();
  const existingStyle = document.getElementById('yt-unsubscriber-styles');
  if (existingStyle) existingStyle.remove();

  let isRunning = false;
  let isPaused = false;
  let shouldStop = false;
  let totalUnsubscribed = 0;
  let delayMs = 1800; // Balanced speed
  let autoScroll = true;

  // Track all processed channel names so we NEVER scroll back up to them
  const processedChannels = new Set();

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'style' && typeof v === 'object') {
        Object.assign(node.style, v);
      } else if (k.startsWith('on')) {
        node[k] = v;
      } else if (k === 'text') {
        node.textContent = v;
      } else {
        node.setAttribute(k, v);
      }
    }
    for (const child of children) {
      if (typeof child === 'string') {
        node.appendChild(document.createTextNode(child));
      } else if (child) {
        node.appendChild(child);
      }
    }
    return node;
  }

  // Inject Styles
  const style = el('style', { id: 'yt-unsubscriber-styles', text: `
    #yt-unsubscriber-hub {
      position: fixed; bottom: 24px; right: 24px; width: 340px;
      background: #0f0f0f; color: #f1f1f1; border: 1px solid #272727;
      border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.7);
      font-family: Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      z-index: 999999999; overflow: hidden;
    }
    #yt-unsub-header {
      background: #1f1f1f; padding: 10px 14px; display: flex;
      justify-content: space-between; align-items: center;
      border-bottom: 1px solid #333; cursor: grab; user-select: none;
    }
    #yt-unsub-header button {
      background: transparent; border: none; color: #aaa; font-size: 16px;
      cursor: pointer; padding: 2px 6px; border-radius: 4px;
    }
    #yt-unsub-header button:hover { background: #333; color: #fff; }
    #yt-unsub-body { padding: 14px; display: flex; flex-direction: column; gap: 12px; }
    #yt-unsub-status-bar { display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
    #yt-unsub-badge {
      font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 20px;
      letter-spacing: 0.5px; text-transform: uppercase;
    }
    .badge-idle { background: #383838; color: #ccc; }
    .badge-running { background: #1b5e20; color: #a5d6a7; border: 1px solid #2e7d32; }
    .badge-paused { background: #e65100; color: #ffe0b2; }
    .badge-stopped { background: #b71c1c; color: #ffcdd2; }
    .badge-done { background: #01579b; color: #b3e5fc; }
    .yt-unsub-controls { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #bbb; }
    .yt-unsub-controls select {
      background: #222; color: #eee; border: 1px solid #444; padding: 6px 8px;
      border-radius: 6px; font-size: 12px; outline: none;
    }
    .yt-unsub-checkbox-group { font-size: 12px; color: #bbb; display: flex; align-items: center; }
    .yt-unsub-checkbox-group input { margin-right: 6px; cursor: pointer; }
    .yt-unsub-actions { display: flex; gap: 8px; }
    .btn {
      flex: 1; padding: 8px 10px; border-radius: 6px; border: none;
      font-size: 12px; font-weight: 600; cursor: pointer;
    }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-primary { background: #cc0000; color: #fff; }
    .btn-primary:hover:not(:disabled) { background: #ff0000; }
    .btn-secondary { background: #383838; color: #fff; }
    .btn-danger { background: #4a1515; color: #ff8b8b; }
    #yt-unsub-log-box {
      background: #141414; border: 1px solid #282828; border-radius: 6px;
      height: 120px; overflow-y: auto; padding: 6px 8px; font-family: monospace;
      font-size: 11px; display: flex; flex-direction: column; gap: 4px;
    }
    .log-entry { line-height: 1.3; }
    .log-info { color: #8ab4f8; }
    .log-success { color: #81c995; }
    .log-warn { color: #fdd663; }
    .log-error { color: #f28b82; }
  `});
  document.head.appendChild(style);

  // Pure DOM Elements
  const minBtn = el('button', { id: 'yt-unsub-min-btn', title: 'Minimize', text: '−' });
  const closeBtn = el('button', { id: 'yt-unsub-close-btn', title: 'Close', text: '×' });

  const header = el('div', { id: 'yt-unsub-header' }, [
    el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
      el('span', { text: '🛑' }),
      el('strong', { text: 'YT Bulk Unsubscriber' })
    ]),
    el('div', { style: { display: 'flex', gap: '6px' } }, [minBtn, closeBtn])
  ]);

  const badge = el('span', { id: 'yt-unsub-badge', class: 'badge-idle', text: 'IDLE' });
  const countNum = el('strong', { text: '0' });
  const countDisplay = el('span', { id: 'yt-unsub-count-display' }, [
    document.createTextNode('Unsubscribed: '),
    countNum
  ]);

  const statusBar = el('div', { id: 'yt-unsub-status-bar' }, [badge, countDisplay]);

  const speedSelect = el('select', { id: 'yt-unsub-speed' }, [
    el('option', { value: '2500', text: '🐢 Safe & Relaxed (2.5s)' }),
    el('option', { value: '1800', selected: 'true', text: '🛡️ Balanced (1.8s - Recommended)' }),
    el('option', { value: '1000', text: '⚡ Faster (1.0s)' })
  ]);

  const controls = el('div', { class: 'yt-unsub-controls' }, [
    el('label', { text: 'Speed / Delay:' }),
    speedSelect
  ]);

  const autoscrollCheck = el('input', { type: 'checkbox', id: 'yt-unsub-autoscroll', checked: 'true' });
  const checkboxGroup = el('div', { class: 'yt-unsub-checkbox-group' }, [
    el('label', {}, [
      autoscrollCheck,
      document.createTextNode(' Auto-scroll downward')
    ])
  ]);

  const startBtn = el('button', { id: 'yt-unsub-start-btn', class: 'btn btn-primary', text: '▶ Start' });
  const pauseBtn = el('button', { id: 'yt-unsub-pause-btn', class: 'btn btn-secondary', disabled: 'true', text: '⏸ Pause' });
  const stopBtn = el('button', { id: 'yt-unsub-stop-btn', class: 'btn btn-danger', disabled: 'true', text: '⏹ Stop' });

  const actions = el('div', { class: 'yt-unsub-actions' }, [startBtn, pauseBtn, stopBtn]);
  const initialLog = el('div', { class: 'log-entry log-info', text: '[Ready] Click ▶ Start to begin.' });
  const logBox = el('div', { id: 'yt-unsub-log-box' }, [initialLog]);

  const body = el('div', { id: 'yt-unsub-body' }, [
    statusBar,
    controls,
    checkboxGroup,
    actions,
    logBox
  ]);

  const hud = el('div', { id: 'yt-unsubscriber-hub' }, [header, body]);
  document.body.appendChild(hud);

  // Dragging support
  let isDragging = false;
  let startX, startY, initialRight, initialBottom;
  header.onmousedown = (e) => {
    if (e.target.tagName === 'BUTTON') return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = hud.getBoundingClientRect();
    initialRight = window.innerWidth - rect.right;
    initialBottom = window.innerHeight - rect.bottom;
    document.onmousemove = (e) => {
      if (!isDragging) return;
      hud.style.right = `${Math.max(10, initialRight - (e.clientX - startX))}px`;
      hud.style.bottom = `${Math.max(10, initialBottom - (e.clientY - startY))}px`;
    };
    document.onmouseup = () => {
      isDragging = false;
      document.onmousemove = null;
      document.onmouseup = null;
    };
  };

  function log(msg, type = 'info') {
    const time = new Date().toLocaleTimeString([], { hour12: false });
    const row = el('div', { class: `log-entry log-${type}`, text: `[${time}] ${msg}` });
    logBox.appendChild(row);
    logBox.scrollTop = logBox.scrollHeight;
    console.log(`[YT-Unsubscriber] ${msg}`);
  }

  function setBadge(text, className) {
    badge.textContent = text;
    badge.className = className;
  }

  closeBtn.onclick = () => { shouldStop = true; hud.remove(); style.remove(); };

  let isMinimized = false;
  minBtn.onclick = () => {
    isMinimized = !isMinimized;
    body.style.display = isMinimized ? 'none' : 'flex';
    minBtn.textContent = isMinimized ? '+' : '−';
  };

  speedSelect.onchange = (e) => {
    delayMs = parseInt(e.target.value, 10);
    log(`Delay set to ${delayMs}ms`, 'info');
  };

  autoscrollCheck.onchange = (e) => { autoScroll = e.target.checked; };

  startBtn.onclick = () => {
    isRunning = true; isPaused = false; shouldStop = false;
    startBtn.disabled = true; pauseBtn.disabled = false; stopBtn.disabled = false;
    setBadge('RUNNING', 'badge-running');
    log('Started.', 'info');
    run();
  };

  pauseBtn.onclick = () => {
    isPaused = !isPaused;
    if (isPaused) {
      pauseBtn.textContent = '▶ Resume';
      setBadge('PAUSED', 'badge-paused');
      log('Paused.', 'warn');
    } else {
      pauseBtn.textContent = '⏸ Pause';
      setBadge('RUNNING', 'badge-running');
      log('Resumed.', 'info');
    }
  };

  stopBtn.onclick = () => {
    shouldStop = true; isRunning = false;
    startBtn.disabled = false; pauseBtn.disabled = true; stopBtn.disabled = true;
    setBadge('STOPPED', 'badge-stopped');
    log('Stopping...', 'warn');
  };

  function isVisible(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function simulateUserClick(target) {
    target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
    target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    target.click();
  }

  // Strictly finds only active 'Subscribed' buttons. Returns null if already 'Subscribe'
  function findSubscribedButton(row) {
    const buttons = Array.from(row.querySelectorAll('button'));
    
    // First, check if ANY button already says "Subscribe" (meaning it is already unsubscribed)
    for (const b of buttons) {
      const txt = (b.innerText || b.textContent || '').trim().toLowerCase();
      if (txt === 'subscribe') {
        return null; // ALREADY UNSUBSCRIBED!
      }
    }

    // Now look for the active "Subscribed" button
    for (const b of buttons) {
      const txt = (b.innerText || b.textContent || '').trim().toLowerCase();
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();

      if (txt === 'subscribe' || aria.startsWith('subscribe to ')) {
        return null;
      }

      if (
        txt === 'subscribed' ||
        aria.includes('current subscription') ||
        (aria.includes('subscribed to') && !aria.includes('subscribe to '))
      ) {
        return b;
      }
    }
    return null;
  }

  async function waitAndClickMenuItem() {
    for (let attempt = 0; attempt < 12; attempt++) {
      await sleep(100);
      const items = Array.from(document.querySelectorAll(
        'ytd-menu-service-item-renderer, tp-yt-paper-item, yt-list-item-view-model'
      ));
      for (const item of items) {
        if (isVisible(item)) {
          const txt = (item.innerText || item.textContent || '').toLowerCase();
          const aria = (item.getAttribute('aria-label') || '').toLowerCase();
          if (txt.includes('unsubscribe') || aria.includes('unsubscribe')) {
            simulateUserClick(item);
            return true;
          }
        }
      }
    }
    return false;
  }

  // Finds and clicks the visible "Unsubscribe" button in the modal dialog
  async function waitAndClickConfirm() {
    for (let attempt = 0; attempt < 25; attempt++) {
      await sleep(100);

      const buttons = Array.from(document.querySelectorAll(
        'tp-yt-paper-dialog #confirm-button button, yt-confirm-dialog-renderer #confirm-button button, #confirm-button button, #confirm-button, button'
      ));

      for (const b of buttons) {
        const txt = (b.innerText || b.textContent || '').trim().toLowerCase();
        if (txt === 'unsubscribe') {
          if (isVisible(b)) {
            const actualBtn = b.tagName.toLowerCase() === 'button' ? b : (b.querySelector('button') || b);
            actualBtn.focus();
            simulateUserClick(actualBtn);
            return true;
          }
        }
      }
    }
    return false;
  }

  async function verifyUnsubscribed(row) {
    for (let attempt = 0; attempt < 25; attempt++) {
      await sleep(150);
      const buttons = Array.from(row.querySelectorAll('button'));
      for (const b of buttons) {
        const txt = (b.innerText || b.textContent || '').trim().toLowerCase();
        if (txt === 'subscribe') {
          return true;
        }
      }
    }
    return false;
  }

  async function run() {
    let emptyScrolls = 0;

    while (isRunning && !shouldStop) {
      if (isPaused) {
        await sleep(500);
        continue;
      }

      const rows = Array.from(document.querySelectorAll('ytd-channel-renderer'));
      let processedInBatch = false;

      for (const row of rows) {
        if (shouldStop) break;
        while (isPaused && !shouldStop) await sleep(500);
        if (shouldStop) break;

        const titleEl = row.querySelector('#channel-title, #title, #text');
        const channelName = titleEl ? titleEl.textContent.trim() : null;

        // 1. NEVER re-process a channel we already handled (avoids scrolling back to top!)
        if (!channelName || processedChannels.has(channelName) || row.hasAttribute('data-yt-unsub-done')) {
          continue;
        }

        // 2. Check if this row is active or already unsubscribed
        const subBtn = findSubscribedButton(row);
        if (!subBtn) {
          // It already says "Subscribe", mark it done so we never touch it again
          processedChannels.add(channelName);
          row.setAttribute('data-yt-unsub-done', 'true');
          continue;
        }

        log(`Processing: "${channelName}"...`, 'info');

        // Smooth scroll to the current row ONLY (never jumps back up!)
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(350);

        // Click Subscribed button
        simulateUserClick(subBtn);
        await sleep(350);

        // Click "Unsubscribe" in popup menu
        await waitAndClickMenuItem();
        await sleep(350);

        // Click "Unsubscribe" in confirmation modal
        const clickedConfirm = await waitAndClickConfirm();

        // Verify that button changed to "Subscribe"
        const verified = await verifyUnsubscribed(row);

        if (verified) {
          totalUnsubscribed++;
          countNum.textContent = totalUnsubscribed;
          processedChannels.add(channelName);
          row.setAttribute('data-yt-unsub-done', 'true');
          log(`✓ Unsubscribed: "${channelName}"`, 'success');
          processedInBatch = true;
          emptyScrolls = 0;
          await sleep(delayMs);
        } else {
          if (clickedConfirm) {
            await sleep(800);
            const retryVerified = await verifyUnsubscribed(row);
            if (retryVerified) {
              totalUnsubscribed++;
              countNum.textContent = totalUnsubscribed;
              processedChannels.add(channelName);
              row.setAttribute('data-yt-unsub-done', 'true');
              log(`✓ Unsubscribed: "${channelName}"`, 'success');
              processedInBatch = true;
              emptyScrolls = 0;
              await sleep(delayMs);
              continue;
            }
          }
          log(`⚠️ Skipped "${channelName}"`, 'warn');
          processedChannels.add(channelName);
          row.setAttribute('data-yt-unsub-done', 'true');
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          await sleep(400);
        }
      }

      // If all currently visible channels are done, scroll DOWNWARD to load the next chunk
      if (!processedInBatch) {
        if (autoScroll && emptyScrolls < 5) {
          emptyScrolls++;
          log(`Loading next batch below (scroll ${emptyScrolls}/5)...`, 'info');
          // Scroll DOWN by 2 screen heights from current position (never scrolls up!)
          window.scrollBy({ top: window.innerHeight * 2, behavior: 'smooth' });
          await sleep(2500);
        } else {
          log(`Done! All available channels have been checked.`, 'success');
          setBadge('DONE', 'badge-done');
          isRunning = false;
          startBtn.disabled = false;
          pauseBtn.disabled = true;
          stopBtn.disabled = true;
          break;
        }
      }
    }
  }
})();
