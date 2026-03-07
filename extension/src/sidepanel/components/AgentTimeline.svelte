<script>
  let { steps = [], live = false } = $props();
</script>

{#if steps.length > 0}
  <div class="timeline" class:live>
    {#each steps as step, i (step.id)}
      <div class="step" class:running={step.status === 'running'} class:error={step.status === 'error'}>
        <!-- Connector line -->
        {#if i > 0}
          <div class="connector"></div>
        {/if}

        <div class="step-row">
          <!-- Icon -->
          <div class="step-icon">
            {#if step.status === 'running' && step.name === '_working'}
              <!-- Nexus spinner -->
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L8 6l4 4-4 4 4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M12 2l4 4-4 4 4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            {:else if step.icon === 'search' || step.icon === 'eye'}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            {:else if step.icon === 'click'}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 3l1 14 4-4 6 6 2-2-6-6 4-4z"/>
              </svg>
            {:else if step.icon === 'keyboard'}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M8 16h8"/>
              </svg>
            {:else if step.icon === 'camera'}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/>
              </svg>
            {:else if step.icon === 'plan'}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
              </svg>
            {:else if step.icon === 'navigate'}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
              </svg>
            {:else if step.icon === 'code'}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
              </svg>
            {:else if step.icon === 'network'}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
            {:else if step.icon === 'scroll'}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5v14M5 12l7 7 7-7"/>
              </svg>
            {:else if step.icon === 'text'}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
            {:else}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06A1.65 1.65 0 0015 19.4a1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
              </svg>
            {/if}
          </div>

          <!-- Label -->
          <span class="step-label">
            {#if step.name === '_working'}
              Working
            {:else}
              {step.label}
            {/if}
          </span>
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .timeline {
    display: flex;
    flex-direction: column;
    padding: 4px 0;
  }

  .step {
    position: relative;
    padding-left: 0;
  }

  .connector {
    position: absolute;
    left: 19px;
    top: -10px;
    width: 1.5px;
    height: 10px;
    background: #44403c;
  }

  .step-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 8px;
    border-radius: 8px;
  }

  .step-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    color: #78716c;
  }

  .step.running .step-icon {
    color: #d4845a;
    animation: pulse-icon 1.5s ease-in-out infinite;
  }

  .step.error .step-icon {
    color: #f87171;
  }

  @keyframes pulse-icon {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .step-label {
    font-size: 13px;
    font-weight: 500;
    color: #a8a29e;
    line-height: 1.3;
  }

  .step.running .step-label {
    color: #d6d3d1;
  }

  .step.error .step-label {
    color: #f87171;
  }

  /* When rendered as a persisted timeline message (not live) */
  .timeline:not(.live) .step-icon {
    color: #78716c;
    animation: none;
  }

  .timeline:not(.live) .step-label {
    color: #a8a29e;
  }

  /* Completed step indicator: Done badge */
  .timeline:not(.live) .step .step-row::after {
    content: '';
  }
</style>
