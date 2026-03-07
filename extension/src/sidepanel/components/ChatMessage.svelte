<script>
  let { message } = $props();

  function formatTime(ts) {
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }
</script>

{#if message.role === 'plan'}
  <!-- Plan messages are handled by PlanApproval -->
{:else if message.role === 'user'}
  <article class="message-row user-row">
    <div class="user-bubble">
      {message.content}
    </div>
  </article>
{:else}
  <article class="message-row">
    <div class="assistant-msg" class:streaming={message.isStreaming}>
      <div class="content">{message.content}</div>
      {#if message.isStreaming}
        <span class="cursor">|</span>
      {/if}
    </div>
  </article>
{/if}

<style>
  .message-row {
    display: flex;
  }

  .user-row {
    justify-content: flex-end;
  }

  /* ─── User bubble ─── */
  .user-bubble {
    max-width: 88%;
    background: #44403c;
    border-radius: 16px 16px 4px 16px;
    padding: 10px 14px;
    font-size: 14px;
    line-height: 1.5;
    color: #fafaf9;
    white-space: pre-wrap;
    word-break: break-word;
  }

  /* ─── Assistant message (no bubble) ─── */
  .assistant-msg {
    max-width: 100%;
    font-size: 14px;
    line-height: 1.6;
    color: #d6d3d1;
    white-space: pre-wrap;
    word-break: break-word;
    padding: 2px 4px;
  }

  .content {
    color: inherit;
  }

  .cursor {
    animation: blink 1s step-end infinite;
    color: #d4845a;
    font-weight: 700;
    margin-left: 2px;
  }

  @keyframes blink {
    50% {
      opacity: 0;
    }
  }
</style>
