<script>
  let { onSend, disabled = false, isRunning = false, onStop, quickPrompts = [] } = $props();
  let text = $state('');

  function handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function submit() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    text = '';
  }

  function pickPrompt(prompt) {
    if (disabled) return;
    onSend(prompt);
  }
</script>

{#if quickPrompts.length > 0}
  <section class="quick-prompts" aria-label="Quick prompts">
    {#each quickPrompts as prompt}
      <button class="prompt-chip" onclick={() => pickPrompt(prompt)} disabled={disabled} title={prompt}>
        {prompt}
      </button>
    {/each}
  </section>
{/if}

<div class="composer-area">
  <div class="composer" class:disabled={disabled}>
    <textarea
      bind:value={text}
      onkeydown={handleKeydown}
      placeholder="Reply to Nexus"
      rows="1"
      {disabled}
    ></textarea>
    <div class="composer-bar">
      <div class="composer-bar-left">
        <!-- Ask before acting indicator -->
        <span class="safety-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Ask before acting
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </span>
      </div>
      <div class="composer-bar-right">
        <!-- Teach icon -->
        <button class="bar-icon" disabled={disabled} title="Teach mode">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3l1 14 4-4 6 6 2-2-6-6 4-4z"/></svg>
        </button>
        <!-- Attach -->
        <button class="bar-icon" disabled={disabled} title="Attach">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <!-- Send or Stop -->
        {#if isRunning}
          <button class="send-btn stop" onclick={onStop} title="Stop">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
          </button>
        {:else}
          <button class="send-btn" onclick={submit} disabled={disabled || !text.trim()} aria-label="Send">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94l18.04-8.01a.75.75 0 000-1.37L3.478 2.405z"/>
            </svg>
          </button>
        {/if}
      </div>
    </div>
  </div>

  <p class="disclaimer">Nexus is AI and can make mistakes. Please double-check responses.</p>
</div>

<style>
  .quick-prompts {
    display: flex;
    gap: 6px;
    padding: 6px 10px 0;
    overflow-x: auto;
    background: transparent;
    scroll-snap-type: x mandatory;
  }

  .quick-prompts::-webkit-scrollbar {
    height: 4px;
  }

  .quick-prompts::-webkit-scrollbar-thumb {
    background: #44403c;
    border-radius: 999px;
  }

  .prompt-chip {
    scroll-snap-align: start;
    min-width: 200px;
    text-align: left;
    border: 1px solid #3f3a36;
    background: #1c1917;
    color: #a8a29e;
    border-radius: 12px;
    padding: 8px 10px;
    font-size: 11px;
    font-weight: 500;
    line-height: 1.35;
    cursor: pointer;
    transition: all 100ms ease;
  }

  .prompt-chip:hover:not(:disabled) {
    background: #292524;
    border-color: #57534e;
    color: #d6d3d1;
  }

  .prompt-chip:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* ─── Composer area ─── */
  .composer-area {
    padding: 6px 10px 8px;
    background: #292524;
    flex-shrink: 0;
  }

  .composer {
    background: #f5f5f4;
    border-radius: 18px;
    padding: 10px 14px 6px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  textarea {
    width: 100%;
    resize: none;
    min-height: 22px;
    max-height: 120px;
    border: none;
    outline: none;
    font-size: 14px;
    line-height: 1.45;
    font-family: inherit;
    color: #1c1917;
    background: transparent;
    padding: 0;
  }

  textarea::placeholder {
    color: #a8a29e;
  }

  textarea:disabled {
    color: #78716c;
    cursor: not-allowed;
  }

  .composer-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2px 0;
  }

  .composer-bar-left {
    display: flex;
    align-items: center;
  }

  .safety-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    font-weight: 500;
    color: #78716c;
    cursor: pointer;
    padding: 3px 6px;
    border-radius: 6px;
    transition: background 100ms ease;
  }

  .safety-badge:hover {
    background: #e7e5e4;
  }

  .composer-bar-right {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .bar-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: none;
    background: transparent;
    color: #78716c;
    border-radius: 8px;
    cursor: pointer;
    transition: all 100ms ease;
  }

  .bar-icon:hover:not(:disabled) {
    background: #e7e5e4;
    color: #44403c;
  }

  .bar-icon:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .send-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: none;
    background: #1c1917;
    color: #fafaf9;
    border-radius: 50%;
    cursor: pointer;
    transition: all 100ms ease;
  }

  .send-btn:hover:not(:disabled) {
    background: #44403c;
  }

  .send-btn:disabled {
    background: #d6d3d1;
    color: #a8a29e;
    cursor: not-allowed;
  }

  .send-btn.stop {
    background: #1c1917;
    color: #fafaf9;
  }

  .send-btn.stop:hover {
    background: #44403c;
  }

  .composer.disabled {
    background: #e7e5e4;
    opacity: 0.7;
  }

  .disclaimer {
    text-align: center;
    font-size: 11px;
    color: #78716c;
    margin: 6px 0 0;
    line-height: 1.3;
  }
</style>
