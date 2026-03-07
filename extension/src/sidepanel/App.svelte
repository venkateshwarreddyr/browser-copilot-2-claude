<script>
  import { onMount } from 'svelte';
  import {
    chatState,
    sendMessage,
    clearChat,
    approvePlan,
    initChatState,
    stopAgent,
    exportConversationJson,
    exportConversationMarkdown,
  } from './lib/chat.svelte.js';
  import ChatMessage from './components/ChatMessage.svelte';
  import ChatInput from './components/ChatInput.svelte';
  import PlanApproval from './components/PlanApproval.svelte';
  import AgentTimeline from './components/AgentTimeline.svelte';
  import SettingsPanel from './components/SettingsPanel.svelte';
  import {
    loadTeachWorkflows,
    saveTeachWorkflow,
    deleteTeachWorkflow,
    markTeachWorkflowRun,
    getSettings,
  } from './lib/storage.js';

  let showSettings = $state(false);
  let showMenu = $state(false);
  let messagesEl = $state(null);
  let teachRecording = $state(false);
  let teachBusy = $state(false);
  let teachStatus = $state('');
  let teachWorkflows = $state([]);
  let teachWorkflowsBusy = $state(false);

  const QUICK_PROMPTS = [
    'Open the current page, read console errors, identify likely root cause, and suggest a fix.',
    'Extract structured data from this page into JSON with key fields and values.',
    'Read the current page and summarize the top 5 key insights in bullet points.',
    'Find the main form on this page and fill it with realistic sample test data.',
  ];

  $effect(() => {
    initChatState();
  });

  onMount(async () => {
    refreshTeachWorkflows();
  });

  $effect(() => {
    if (chatState.messages.length && messagesEl) {
      setTimeout(() => {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }, 50);
    }
  });

  // Also scroll when steps change (live timeline updates)
  $effect(() => {
    if (chatState.steps.length && messagesEl) {
      setTimeout(() => {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }, 50);
    }
  });

  async function copyMarkdown() {
    const text = exportConversationMarkdown();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // no-op
    }
    showMenu = false;
  }

  function downloadJson() {
    const json = exportConversationJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus-session-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showMenu = false;
  }

  function handleClear() {
    clearChat();
    showMenu = false;
  }

  function handleSettings() {
    showSettings = !showSettings;
    showMenu = false;
  }

  async function getActiveTabId() {
    const currentWindowTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (currentWindowTabs[0]?.id) return currentWindowTabs[0].id;
    const tabs = await chrome.runtime.sendMessage({ type: 'GET_TABS_CONTEXT' });
    const active = tabs.find((t) => t.active) || tabs[0];
    return active?.tabId;
  }

  async function refreshTeachWorkflows() {
    if (teachWorkflowsBusy) return;
    teachWorkflowsBusy = true;
    try {
      teachWorkflows = await loadTeachWorkflows();
    } finally {
      teachWorkflowsBusy = false;
    }
  }

  function workflowId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function workflowName(page, createdAt) {
    const title = String(page?.title || '').trim();
    const cleanTitle = title ? title.slice(0, 48) : 'Untitled page';
    const ts = new Date(createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `Teach: ${cleanTitle} (${ts})`;
  }

  function formatWhen(ts) {
    if (!ts) return 'Never';
    try {
      return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Unknown';
    }
  }

  function buildTeachPrompt(payload, mode = 'capture') {
    const steps = Array.isArray(payload?.steps) ? payload.steps : [];
    const page = payload?.page || {};
    const teachName = payload?.name || 'Unnamed workflow';

    const lines = steps.map((step, index) => {
      const base = `${index + 1}. ${step.type} on ${step.selector || 'unknown target'}`;
      const extras = [];
      if (step.label) extras.push(`label="${step.label}"`);
      if (Object.prototype.hasOwnProperty.call(step, 'value')) extras.push(`value="${step.value}"`);
      if (typeof step.timeOffsetMs === 'number') extras.push(`t=${(step.timeOffsetMs / 1000).toFixed(1)}s`);
      return extras.length > 0 ? `${base} (${extras.join(', ')})` : base;
    });

    return [
      mode === 'replay'
        ? 'Run this previously taught workflow. Convert it into a robust automation plan, ask for approval with update_plan, then execute it with tools.'
        : 'I used Teach mode and recorded a browser workflow. Convert it into a robust automation plan, ask for approval with update_plan, then execute it with tools.',
      '',
      `Workflow Name: ${teachName}`,
      `Context URL: ${page.url || 'unknown'}`,
      `Context Title: ${page.title || 'unknown'}`,
      `Recorded Steps: ${steps.length}`,
      '',
      ...lines,
      '',
      'Make the automation resilient: use find/read_page before acting, and verify outcomes after each critical step.',
    ].join('\n');
  }

  async function startTeach() {
    if (teachBusy || teachRecording || chatState.isRunning) return;
    teachBusy = true;
    teachStatus = '';

    try {
      const tabId = await getActiveTabId();
      if (!tabId) {
        teachStatus = 'No active tab found.';
        return;
      }

      const result = await chrome.runtime.sendMessage({ type: 'START_TEACH', tabId });
      if (!result?.ok) {
        teachStatus = result?.error || result?.message || 'Failed to start Teach mode.';
        return;
      }

      teachRecording = true;
      teachStatus = 'Teach mode is recording actions on the active tab.';
    } catch (err) {
      teachStatus = `Failed to start Teach mode: ${err.message}`;
    } finally {
      teachBusy = false;
    }
  }

  async function runSavedWorkflow(workflow) {
    if (!workflow || teachBusy || teachRecording || chatState.isRunning) return;
    teachStatus = `Running saved workflow: ${workflow.name}`;

    try {
      const prompt = buildTeachPrompt(workflow, 'replay');
      await sendMessage(prompt);
      await markTeachWorkflowRun(workflow.id);
      await refreshTeachWorkflows();
      teachStatus = `Workflow run completed: ${workflow.name}`;
    } catch (err) {
      teachStatus = `Failed to run workflow: ${err.message}`;
    }
  }

  async function removeWorkflow(workflowIdToDelete) {
    if (!workflowIdToDelete || teachBusy || teachRecording || chatState.isRunning) return;
    await deleteTeachWorkflow(workflowIdToDelete);
    await refreshTeachWorkflows();
  }

  async function stopTeach() {
    if (teachBusy || !teachRecording) return;
    teachBusy = true;

    try {
      const tabId = await getActiveTabId();
      if (!tabId) {
        teachStatus = 'No active tab found.';
        return;
      }

      const result = await chrome.runtime.sendMessage({ type: 'STOP_TEACH', tabId });
      teachRecording = false;

      if (!result?.ok) {
        teachStatus = result?.error || result?.message || 'Failed to stop Teach mode.';
        return;
      }

      const steps = Array.isArray(result.steps) ? result.steps : [];
      if (steps.length === 0) {
        teachStatus = 'No steps captured. Try again and interact with the page.';
        return;
      }

      const createdAt = Date.now();
      const workflow = {
        id: workflowId(),
        name: workflowName(result?.page, createdAt),
        createdAt,
        updatedAt: createdAt,
        durationMs: result?.durationMs || 0,
        page: result?.page || {},
        steps,
      };
      await saveTeachWorkflow(workflow);
      await refreshTeachWorkflows();

      teachStatus = `Captured ${steps.length} steps. Sending to agent...`;
      const prompt = buildTeachPrompt(workflow, 'capture');
      await sendMessage(prompt);
      teachStatus = `Teach workflow captured and saved (${steps.length} steps).`;
    } catch (err) {
      teachRecording = false;
      teachStatus = `Failed to stop Teach mode: ${err.message}`;
    } finally {
      teachBusy = false;
    }
  }
</script>

<div class="app">
  <!-- Top bar -->
  <header class="topbar">
    <div class="topbar-left">
    </div>
    <div class="topbar-hat">
      <!-- Teach button -->
      {#if teachRecording}
        <button class="topbar-btn danger" onclick={stopTeach} disabled={teachBusy || chatState.isRunning} title="Stop recording">
          <span class="rec-dot-sm"></span>
        </button>
      {:else}
        <button class="topbar-btn" onclick={startTeach} disabled={teachBusy || chatState.isRunning} title="Teach mode">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
        </button>
      {/if}

      <!-- New chat -->
      <button class="topbar-btn" onclick={handleClear} title="New chat">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
      </button>

      <!-- Three-dot menu -->
      <div class="menu-anchor">
        <button class="topbar-btn" onclick={() => showMenu = !showMenu} title="More options" class:active={showMenu}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
        </button>

        {#if showMenu}
          <div class="dropdown-menu">
            <button class="menu-item" onclick={copyMarkdown}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              Copy as Markdown
            </button>
            <button class="menu-item" onclick={downloadJson}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export JSON
            </button>
            <button class="menu-item" onclick={handleSettings}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
              Settings
            </button>
            {#if teachWorkflows.length > 0}
              <button class="menu-item" onclick={refreshTeachWorkflows} disabled={teachWorkflowsBusy}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
                Refresh Workflows
              </button>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </header>

  <!-- Inner rounded panel -->
  <div class="inner-panel">
    {#if teachStatus}
      <div class="teach-status">{teachStatus}</div>
    {/if}

    {#if teachWorkflows.length > 0}
      <div class="workflow-list">
        {#each teachWorkflows as workflow (workflow.id)}
          <div class="workflow-item">
            <div class="workflow-info">
              <div class="workflow-name">{workflow.name}</div>
              <div class="workflow-meta">
                {workflow.steps?.length || 0} steps
                {#if workflow.lastRunAt}· Last run {formatWhen(workflow.lastRunAt)}{/if}
              </div>
            </div>
            <div class="workflow-actions">
              <button
                class="wf-btn run"
                onclick={() => runSavedWorkflow(workflow)}
                disabled={teachBusy || teachRecording || chatState.isRunning}
              >Run</button>
              <button
                class="wf-btn del"
                onclick={() => removeWorkflow(workflow.id)}
                disabled={teachBusy || teachRecording || chatState.isRunning}
              >&times;</button>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    {#if showSettings}
      <div class="settings-wrap">
        <SettingsPanel onClose={() => showSettings = false} />
      </div>
    {/if}

    <!-- Messages area -->
    <main class="messages" bind:this={messagesEl}>
      {#if chatState.messages.length === 0 && chatState.steps.length === 0}
        <div class="empty-state">
          <div class="empty-icon">
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="3" width="14" height="10" rx="2" stroke="#6b7280" stroke-width="1.5"/>
              <rect x="8" y="7" width="14" height="10" rx="2" stroke="#6b7280" stroke-width="1.5"/>
              <path d="M14 14l3 3" stroke="#6b7280" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </div>
          <h2 class="empty-title">Teach Nexus your workflow</h2>
          <p class="empty-copy">Describe your automation goal or use Teach mode to demonstrate a workflow. Nexus will learn the process and repeat it for you.</p>
        </div>
      {/if}

      {#each chatState.messages as message (message.id)}
        {#if message.role === 'plan'}
          <PlanApproval plan={message.content} onApprove={approvePlan} />
        {:else if message.role === 'timeline'}
          <AgentTimeline steps={message.content} />
        {:else}
          <ChatMessage {message} />
        {/if}
      {/each}

      <!-- Live timeline (during execution) -->
      {#if chatState.steps.length > 0}
        <AgentTimeline steps={chatState.steps} live={true} />
      {/if}
    </main>
  </div>

  <!-- Bottom composer -->
  <ChatInput onSend={sendMessage} disabled={chatState.isRunning || teachRecording} isRunning={chatState.isRunning} onStop={stopAgent} quickPrompts={chatState.messages.length === 0 ? QUICK_PROMPTS : []} />
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    background: #292524;
    color: #e7e5e4;
    -webkit-font-smoothing: antialiased;
  }

  :global(*) {
    box-sizing: border-box;
  }

  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #292524;
  }

  /* ─── Top bar ─── */
  .topbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 8px;
    background: #292524;
    flex-shrink: 0;
  }

  .topbar-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .topbar-hat {
    display: flex;
    align-items: center;
    gap: 2px;
    background: #1c1917;
    border: 1px solid #3f3a36;
    border-radius: 10px;
    padding: 2px;
  }

  .topbar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    color: #a8a29e;
    border-radius: 6px;
    cursor: pointer;
    transition: all 100ms ease;
  }

  .topbar-btn:hover {
    background: #3f3a36;
    color: #e7e5e4;
  }

  .topbar-btn.active {
    background: #44403c;
    color: #fafaf9;
  }

  .topbar-btn.danger {
    color: #fca5a5;
  }

  .topbar-btn.danger:hover {
    background: #451a1a;
  }

  .topbar-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .rec-dot-sm {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #ef4444;
    animation: pulse-dot 1.2s ease-in-out infinite;
  }

  @keyframes pulse-dot {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  /* ─── Dropdown menu ─── */
  .menu-anchor {
    position: relative;
  }

  .dropdown-menu {
    position: absolute;
    right: 0;
    top: 38px;
    min-width: 180px;
    background: #1c1917;
    border: 1px solid #3f3a36;
    border-radius: 12px;
    padding: 4px;
    z-index: 100;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 10px;
    border: none;
    background: transparent;
    color: #d6d3d1;
    font-size: 13px;
    font-weight: 500;
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    transition: background 100ms ease;
  }

  .menu-item:hover {
    background: #292524;
    color: #fafaf9;
  }

  .menu-item:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* ─── Inner rounded panel ─── */
  .inner-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    margin: 0 6px;
    background: #1c1917;
    border-radius: 16px;
    border: 1px solid #3f3a36;
    overflow: hidden;
    min-height: 0;
  }

  /* ─── Teach status ─── */
  .teach-status {
    padding: 8px 12px;
    font-size: 12px;
    font-weight: 500;
    color: #a8a29e;
    border-bottom: 1px solid #2e2926;
  }

  /* ─── Workflows ─── */
  .workflow-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
    max-height: 140px;
    overflow-y: auto;
    border-bottom: 1px solid #2e2926;
    background: #292524;
  }

  .workflow-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 12px;
    background: #1c1917;
  }

  .workflow-info {
    min-width: 0;
    flex: 1;
  }

  .workflow-name {
    font-size: 12px;
    font-weight: 600;
    color: #d6d3d1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .workflow-meta {
    font-size: 11px;
    color: #78716c;
    margin-top: 1px;
  }

  .workflow-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .wf-btn {
    padding: 4px 10px;
    border: 1px solid #44403c;
    background: #292524;
    color: #a8a29e;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 100ms ease;
  }

  .wf-btn:hover:not(:disabled) {
    background: #44403c;
    color: #e7e5e4;
  }

  .wf-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .wf-btn.run {
    border-color: #3f6212;
    color: #a3e635;
  }

  .wf-btn.run:hover:not(:disabled) {
    background: #1a2e05;
  }

  .wf-btn.del {
    border-color: #7f1d1d;
    color: #f87171;
    font-size: 14px;
    padding: 2px 8px;
  }

  .wf-btn.del:hover:not(:disabled) {
    background: #451a1a;
  }

  /* ─── Settings ─── */
  .settings-wrap {
    padding: 10px 12px;
    border-bottom: 1px solid #2e2926;
  }

  /* ─── Messages ─── */
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px 14px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    scroll-behavior: smooth;
  }

  .messages::-webkit-scrollbar {
    width: 6px;
  }

  .messages::-webkit-scrollbar-thumb {
    background: #44403c;
    border-radius: 999px;
  }

  /* ─── Empty state ─── */
  .empty-state {
    margin: auto;
    text-align: center;
    max-width: 260px;
    padding: 16px 12px;
  }

  .empty-icon {
    margin-bottom: 12px;
    opacity: 0.5;
  }

  .empty-title {
    font-size: 16px;
    font-weight: 700;
    color: #fafaf9;
    margin: 0 0 8px;
  }

  .empty-copy {
    font-size: 13px;
    line-height: 1.5;
    color: #78716c;
    margin: 0;
  }
</style>
