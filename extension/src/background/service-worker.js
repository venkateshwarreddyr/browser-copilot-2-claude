// Use openPanelOnActionClick so Chrome opens the panel immediately on icon click
// (preserves user gesture context — manual open() after async work loses it).
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// After the panel opens, group the tab in the background
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;

  trackedWindowId = tab.windowId;
  trackedGroupId = tab.groupId ?? -1;

  try {
    await ensureTabGroup();
  } catch {
    // Tab grouping may fail (e.g. on chrome:// pages) — panel is already open
  }
});

// ── Track current window & tab group context ──
// Kept up-to-date via event listeners so every getTabsContext() call
// already knows the scope without relying on the caller.
let trackedWindowId = null;
let trackedGroupId = -1;

async function refreshTrackedContext() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab) {
      trackedWindowId = tab.windowId;
      trackedGroupId = tab.groupId ?? -1;
    }
  } catch {
    // ignore – service worker may wake before any window exists
  }
}

// Initialise on service-worker start
refreshTrackedContext();

// Update whenever the user switches tabs
chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
  trackedWindowId = windowId;
  try {
    const tab = await chrome.tabs.get(tabId);
    trackedGroupId = tab.groupId ?? -1;
  } catch {
    trackedGroupId = -1;
  }
});

// Update when a different window gains focus
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  trackedWindowId = windowId;
  // Re-derive the groupId from the new window's active tab
  chrome.tabs.query({ active: true, windowId }).then(([tab]) => {
    trackedGroupId = tab?.groupId ?? -1;
  }).catch(() => { trackedGroupId = -1; });
});

// Update when a tab's groupId changes (user drags tab in/out of a group)
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.groupId !== undefined && tab.active && tab.windowId === trackedWindowId) {
    trackedGroupId = tab.groupId ?? -1;
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-side-panel') return;

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.id) return;

  trackedWindowId = activeTab.windowId;
  trackedGroupId = activeTab.groupId ?? -1;

  // Open panel first to preserve user gesture, then group
  try {
    await chrome.sidePanel.open({ tabId: activeTab.id });
  } catch {
    try {
      await chrome.sidePanel.open({ windowId: activeTab.windowId });
    } catch {
      // Cannot open side panel
    }
  }

  try {
    await ensureTabGroup();
  } catch {
    // Tab grouping may fail — panel is already open
  }
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
  ENSURE_TAB_GROUP: () => ensureTabGroup(),
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

      case 'tabs_group_create':
        return await handleTabsGroupCreate(input);

      case 'tabs_group_list':
        return await handleTabsGroupList();

      case 'tabs_group_update':
        return await handleTabsGroupUpdate(input);

      case 'tabs_group_move':
        return await handleTabsGroupMove(input);

      case 'tabs_group_ungroup':
        return await handleTabsGroupUngroup(input);

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

// Auto-create a tab group for the current tab when the side panel opens.
// If the active tab is already in a group, just track that group.
// Returns the group info so the side panel knows the scope.
async function ensureTabGroup() {
  await refreshTrackedContext();

  // Already in a group — nothing to do
  if (trackedGroupId != null && trackedGroupId !== -1) {
    try {
      const group = await chrome.tabGroups.get(trackedGroupId);
      return { groupId: trackedGroupId, title: group.title || '', color: group.color, created: false };
    } catch {
      // Group was deleted, fall through to create a new one
    }
  }

  // Get the active tab
  const [activeTab] = await chrome.tabs.query({ active: true, windowId: trackedWindowId || undefined });
  if (!activeTab) return { error: 'No active tab found.' };

  // Create a new group with just this tab
  const groupId = await chrome.tabs.group({
    tabIds: [activeTab.id],
    createProperties: trackedWindowId ? { windowId: trackedWindowId } : {},
  });

  await chrome.tabGroups.update(groupId, { title: 'Nexus', color: 'blue' });

  // Update tracked context
  trackedGroupId = groupId;

  return { groupId, title: 'Nexus', color: 'blue', created: true };
}

async function getTabsContext() {
  const windowId = trackedWindowId;
  const groupId = trackedGroupId;

  // Scope to the current window (fall back to all tabs if window unknown)
  const tabs = await chrome.tabs.query(windowId ? { windowId } : {});

  let filteredTabs = tabs.filter(
    (t) => t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://')
  );

  // ALWAYS scope to the tracked group — extension only accesses grouped tabs
  if (groupId != null && groupId !== -1) {
    filteredTabs = filteredTabs.filter((t) => t.groupId === groupId);
  } else {
    // No group tracked — should not happen after ensureTabGroup, but
    // return empty to enforce group-only access
    filteredTabs = [];
  }

  return filteredTabs.map((t) => ({
    tabId: t.id,
    title: t.title || '',
    url: t.url,
    active: t.active,
    windowId: t.windowId,
    groupId: t.groupId ?? -1,
    pinned: Boolean(t.pinned),
    audible: Boolean(t.audible),
    discarded: Boolean(t.discarded),
  }));
}

async function handleTabsCreate() {
  const createOpts = { active: false };
  if (trackedWindowId) createOpts.windowId = trackedWindowId;

  const tab = await chrome.tabs.create(createOpts);

  // If the active tab is in a Chrome tab group, add the new tab to the same group
  if (trackedGroupId != null && trackedGroupId !== -1) {
    try {
      await chrome.tabs.group({ tabIds: [tab.id], groupId: trackedGroupId });
    } catch {
      // Group may have been closed between check and create
    }
  }

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

async function handleTabsGroupCreate(input) {
  const { title, color, tabIds } = input || {};

  let ids = tabIds;
  if (!ids || ids.length === 0) {
    const [activeTab] = await chrome.tabs.query({ active: true, windowId: trackedWindowId || undefined });
    if (!activeTab) return 'Error: No active tab found to create a group.';
    ids = [activeTab.id];
  }

  const groupId = await chrome.tabs.group({
    tabIds: ids,
    createProperties: trackedWindowId ? { windowId: trackedWindowId } : {},
  });

  const updateProps = {};
  if (title) updateProps.title = title;
  updateProps.color = color || 'blue';

  await chrome.tabGroups.update(groupId, updateProps);

  // Update tracked context to the new group
  trackedGroupId = groupId;

  return { groupId, title: title || '', color: updateProps.color, tabIds: ids };
}

async function handleTabsGroupList() {
  const queryOpts = trackedWindowId ? { windowId: trackedWindowId } : {};
  const allTabs = await chrome.tabs.query(queryOpts);

  // Collect unique group IDs (excluding ungrouped tabs)
  const groupIds = [...new Set(allTabs.filter((t) => t.groupId !== -1).map((t) => t.groupId))];

  const groups = [];
  for (const gid of groupIds) {
    try {
      const group = await chrome.tabGroups.get(gid);
      const memberTabs = allTabs
        .filter((t) => t.groupId === gid)
        .map((t) => ({ tabId: t.id, title: t.title || '', url: t.url, active: t.active }));

      groups.push({
        groupId: group.id,
        title: group.title || '',
        color: group.color,
        collapsed: group.collapsed,
        tabCount: memberTabs.length,
        tabs: memberTabs,
      });
    } catch {
      // Group may have been removed
    }
  }

  // Also count ungrouped tabs
  const ungroupedTabs = allTabs
    .filter((t) => t.groupId === -1 && t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://'))
    .map((t) => ({ tabId: t.id, title: t.title || '', url: t.url, active: t.active }));

  return {
    groups,
    ungroupedTabs: { tabCount: ungroupedTabs.length, tabs: ungroupedTabs },
    currentGroupId: trackedGroupId,
  };
}

async function handleTabsGroupUpdate(input) {
  const { groupId, title, color, collapsed } = input || {};
  if (!groupId && groupId !== 0) return 'Error: groupId is required';

  const updateProps = {};
  if (title !== undefined) updateProps.title = title;
  if (color !== undefined) updateProps.color = color;
  if (collapsed !== undefined) updateProps.collapsed = collapsed;

  if (Object.keys(updateProps).length === 0) return 'Error: Provide at least one of title, color, or collapsed to update.';

  await chrome.tabGroups.update(groupId, updateProps);
  const updated = await chrome.tabGroups.get(groupId);
  return { groupId: updated.id, title: updated.title, color: updated.color, collapsed: updated.collapsed };
}

async function handleTabsGroupMove(input) {
  const { tabIds, groupId } = input || {};
  if (!tabIds || tabIds.length === 0) return 'Error: tabIds array is required';
  if (!groupId && groupId !== 0) return 'Error: groupId is required';

  await chrome.tabs.group({ tabIds, groupId });
  return `Moved ${tabIds.length} tab(s) to group ${groupId}`;
}

async function handleTabsGroupUngroup(input) {
  const { tabIds } = input || {};
  if (!tabIds || tabIds.length === 0) return 'Error: tabIds array is required';

  await chrome.tabs.ungroup(tabIds);
  return `Ungrouped ${tabIds.length} tab(s)`;
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
