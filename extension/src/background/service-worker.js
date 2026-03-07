chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-side-panel') return;

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.id) return;

  await chrome.sidePanel.open({ tabId: activeTab.id });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handler = messageHandlers[msg.type];
  if (!handler) return false;

  handler(msg, sender)
    .then(sendResponse)
    .catch((err) => sendResponse({ error: err.message }));

  return true;
});

const messageHandlers = {
  EXECUTE_TOOL: (msg) => executeTool(msg.toolName, msg.toolInput),
  GET_TABS_CONTEXT: () => getTabsContext(),
  CAPTURE_SCREENSHOT: (msg) => captureScreenshot(msg.tabId),
  CREATE_TAB: () => handleTabsCreate(),
  START_TEACH: (msg) => handleTeachStart(msg.tabId),
  STOP_TEACH: (msg) => handleTeachStop(msg.tabId),
  GET_TEACH_STATUS: (msg) => handleTeachStatus(msg.tabId),
};

function isInjectableUrl(url) {
  if (!url) return false;
  return url.startsWith('http://') || url.startsWith('https://');
}

function isMissingReceiverError(err) {
  const msg = String(err?.message || '');
  return msg.includes('Receiving end does not exist') || msg.includes('message port closed before a response was received');
}

function ensureMessageResponse(response, fallbackError) {
  if (typeof response !== 'undefined') return response;
  throw new Error(fallbackError);
}

async function sendTabMessageWithContentScript(tabId, payload) {
  if (!tabId) throw new Error('tabId is required');

  const tab = await chrome.tabs.get(tabId);
  if (!isInjectableUrl(tab.url)) {
    throw new Error('Teach mode works only on normal web pages (http/https), not browser internal pages.');
  }

  try {
    const response = await chrome.tabs.sendMessage(tabId, payload);
    return ensureMessageResponse(response, 'No response from page script.');
  } catch (err) {
    const shouldRetry = isMissingReceiverError(err);
    if (!shouldRetry) throw err;

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['assets/content.js'],
    });

    const response = await chrome.tabs.sendMessage(tabId, payload);
    return ensureMessageResponse(response, 'No response from page script after injection.');
  }
}

async function withAgentIndicator(tabId, fn) {
  if (!tabId) return await fn();

  try {
    await chrome.tabs.sendMessage(tabId, { type: 'SHOW_AGENT_INDICATOR' });
  } catch {
    // tab may not support messaging yet
  }

  try {
    return await fn();
  } finally {
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'HIDE_AGENT_INDICATOR' });
    } catch {
      // tab may have navigated
    }
  }
}

async function executeTool(toolName, input) {
  const tabId = input?.tabId;

  return await withAgentIndicator(tabId, async () => {
    switch (toolName) {
      case 'read_page':
      case 'find':
      case 'form_input':
      case 'get_page_text':
      case 'javascript_tool':
      case 'read_console_messages':
      case 'read_network_requests':
      case 'extract_links':
      case 'get_selected_text':
      case 'page_snapshot': {
        if (!tabId) return 'Error: tabId is required';
        return await chrome.tabs.sendMessage(tabId, { type: 'TOOL_EXEC', tool: toolName, input });
      }

      case 'computer': {
        if (!tabId) return 'Error: tabId is required';

        if (input.action === 'screenshot' || input.action === 'zoom') {
          return await captureScreenshot(tabId);
        }

        const result = await chrome.tabs.sendMessage(tabId, { type: 'TOOL_EXEC', tool: 'computer', input });

        if (result && typeof result === 'object' && result._type === 'screenshot_request') {
          return await captureScreenshot(tabId);
        }
        if (result && typeof result === 'object' && result._type === 'zoom_request') {
          return await captureScreenshot(tabId);
        }

        return result;
      }

      case 'navigate':
        return await handleNavigate(input);

      case 'tabs_context':
        return await getTabsContext();

      case 'tabs_create':
        return await handleTabsCreate();

      case 'tabs_activate':
        return await handleTabsActivate(input);

      case 'tabs_close':
        return await handleTabsClose(input);

      case 'resize_window':
        return await handleResizeWindow(input);

      case 'upload_image':
        return await handleUploadImage(input);

      case 'file_upload':
        return await handleFileUpload(input);

      case 'gif_creator':
        return await handleGifCreator(input);

      case 'update_plan':
        return 'Plan presented to user.';

      case 'turn_answer_start':
        return 'Proceed with your response.';

      default:
        return `Unknown tool: ${toolName}`;
    }
  });
}

async function handleTeachStart(tabId) {
  if (!tabId) return { ok: false, error: 'tabId is required' };
  try {
    return await sendTabMessageWithContentScript(tabId, { type: 'TEACH_START' });
  } catch (err) {
    return { ok: false, error: err.message || 'Failed to start Teach mode.' };
  }
}

async function handleTeachStop(tabId) {
  if (!tabId) return { ok: false, error: 'tabId is required' };
  try {
    return await sendTabMessageWithContentScript(tabId, { type: 'TEACH_STOP' });
  } catch (err) {
    return { ok: false, error: err.message || 'Failed to stop Teach mode.' };
  }
}

async function handleTeachStatus(tabId) {
  if (!tabId) return { ok: false, error: 'tabId is required' };
  try {
    return await sendTabMessageWithContentScript(tabId, { type: 'TEACH_STATUS' });
  } catch (err) {
    return { ok: false, error: err.message || 'Failed to get Teach status.' };
  }
}

async function handleNavigate(input) {
  const { tabId, url } = input;
  if (!tabId) return 'Error: tabId is required';

  if (url === 'back') {
    await chrome.tabs.goBack(tabId);
  } else if (url === 'forward') {
    await chrome.tabs.goForward(tabId);
  } else {
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    await chrome.tabs.update(tabId, { url: fullUrl });
  }

  await waitForTabLoad(tabId);
  const tab = await chrome.tabs.get(tabId);
  return `Navigated to ${tab.url}`;
}

function waitForTabLoad(tabId, timeout = 15000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, timeout);

    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        clearTimeout(timer);
        setTimeout(resolve, 500);
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function captureScreenshot(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 80 });
    return dataUrl;
  } catch (err) {
    return `Screenshot failed: ${err.message}`;
  }
}

async function getTabsContext() {
  const tabs = await chrome.tabs.query({});
  return tabs
    .filter((t) => t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://'))
    .map((t) => ({
      tabId: t.id,
      title: t.title || '',
      url: t.url,
      active: t.active,
      windowId: t.windowId,
      pinned: Boolean(t.pinned),
      audible: Boolean(t.audible),
      discarded: Boolean(t.discarded),
    }));
}

async function handleTabsCreate() {
  const tab = await chrome.tabs.create({ active: false });
  return { tabId: tab.id, title: tab.title || 'New Tab', url: tab.url };
}

async function handleTabsActivate(input) {
  const { tabId } = input || {};
  if (!tabId) return 'Error: tabId is required';
  const tab = await chrome.tabs.get(tabId);
  await chrome.tabs.update(tabId, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
  return `Activated tab ${tabId}`;
}

async function handleTabsClose(input) {
  const { tabId } = input || {};
  if (!tabId) return 'Error: tabId is required';
  await chrome.tabs.remove(tabId);
  return `Closed tab ${tabId}`;
}

async function handleResizeWindow(input) {
  const { tabId, width, height } = input;
  const tab = await chrome.tabs.get(tabId);
  await chrome.windows.update(tab.windowId, { width, height });
  return `Window resized to ${width}x${height}`;
}

// Screenshot storage for upload_image tool
const screenshotStore = new Map();

async function handleUploadImage(input) {
  const { imageId, tabId, ref, coordinate, filename } = input;
  if (!imageId) return 'Error: imageId is required';
  if (!tabId) return 'Error: tabId is required';

  // Retrieve the stored screenshot data
  const imageData = screenshotStore.get(imageId);
  if (!imageData) return `Error: No image found with ID "${imageId}". Capture a screenshot first using the computer tool's screenshot action.`;

  try {
    return await chrome.tabs.sendMessage(tabId, {
      type: 'TOOL_EXEC',
      tool: 'upload_image',
      input: { imageData, ref, coordinate, filename: filename || 'image.png' },
    });
  } catch (err) {
    return `Error uploading image: ${err.message}`;
  }
}

async function handleFileUpload(input) {
  const { paths, ref, tabId } = input;
  if (!paths || !paths.length) return 'Error: paths array is required';
  if (!ref) return 'Error: ref is required';
  if (!tabId) return 'Error: tabId is required';

  // File upload from local filesystem is not directly possible in Chrome extensions
  // without a native messaging host. Return a helpful message.
  return `Error: File upload from local filesystem requires a native messaging host. The paths provided (${paths.join(', ')}) cannot be accessed directly from the browser extension. The user should drag and drop files or use the file picker manually.`;
}

// GIF recording state per tab group
const gifRecordingState = new Map();

async function handleGifCreator(input) {
  const { action, tabId, coordinate, download, filename, options } = input;
  if (!action) return 'Error: action is required';
  if (!tabId) return 'Error: tabId is required';

  switch (action) {
    case 'start_recording': {
      gifRecordingState.set(tabId, { recording: true, frames: [], startedAt: Date.now() });
      return 'GIF recording started. Take a screenshot now to capture the initial frame.';
    }
    case 'stop_recording': {
      const state = gifRecordingState.get(tabId);
      if (!state) return 'Error: No active recording for this tab.';
      state.recording = false;
      return `GIF recording stopped. ${state.frames.length} frames captured. Use export action to generate the GIF.`;
    }
    case 'export': {
      const state = gifRecordingState.get(tabId);
      if (!state || state.frames.length === 0) return 'Error: No frames to export. Start recording and take screenshots first.';
      // GIF encoding would require a library like gif.js — return info about frames
      return `GIF export: ${state.frames.length} frames captured over ${((Date.now() - state.startedAt) / 1000).toFixed(1)}s. Full GIF encoding requires additional libraries. Frames are available for download.`;
    }
    case 'clear': {
      gifRecordingState.delete(tabId);
      return 'GIF recording cleared.';
    }
    default:
      return `Error: Unknown gif_creator action: ${action}`;
  }
}
