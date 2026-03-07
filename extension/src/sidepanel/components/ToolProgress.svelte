<script>
  let { text } = $props();
</script>

{#if text}
  <div class="progress" role="status" aria-live="polite">
    <div class="spinner"></div>
    <span>{text}</span>
  </div>
{/if}

<style>
  .progress {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    margin: 2px 0 8px;
    font-size: 12px;
    font-weight: 600;
    color: #a8a29e;
    background: #292524;
    border: 1px solid #3f3a36;
    border-radius: 999px;
    width: fit-content;
  }

  .spinner {
    width: 13px;
    height: 13px;
    border: 2px solid #44403c;
    border-top-color: #d4845a;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
