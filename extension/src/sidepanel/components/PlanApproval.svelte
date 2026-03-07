<script>
  let { plan, onApprove } = $props();
</script>

{#if plan}
  <section class="plan-card">
    <header class="plan-header">
      <div class="title">Plan Approval Required</div>
      <div class="subtitle">Review scope and execution steps before running tools.</div>
    </header>

    <div class="section">
      <div class="section-title">Domains</div>
      <ul>
        {#each plan.domains as domain}
          <li>{domain}</li>
        {/each}
      </ul>
    </div>

    <div class="section">
      <div class="section-title">Approach</div>
      <ol>
        {#each plan.approach as step}
          <li>{step}</li>
        {/each}
      </ol>
    </div>

    <footer class="actions">
      <button class="reject" onclick={() => onApprove(false, plan)}>Reject</button>
      <button class="approve" onclick={() => onApprove(true, plan)}>Approve and Run</button>
    </footer>
  </section>
{/if}

<style>
  .plan-card {
    margin: 6px 0;
    padding: 14px;
    background: #292524;
    border: 1px solid #d4845a;
    border-radius: 14px;
  }

  .plan-header {
    margin-bottom: 12px;
  }

  .title {
    font-weight: 800;
    font-size: 14px;
    color: #fbbf24;
  }

  .subtitle {
    font-size: 12px;
    color: #a8a29e;
    margin-top: 3px;
  }

  .section {
    margin-bottom: 10px;
  }

  .section-title {
    font-size: 11px;
    font-weight: 800;
    color: #d4845a;
    margin-bottom: 5px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  ul,
  ol {
    margin: 0;
    padding-left: 18px;
    font-size: 13px;
    color: #d6d3d1;
    line-height: 1.45;
  }

  li {
    margin-bottom: 4px;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 12px;
  }

  .approve,
  .reject {
    border: 1px solid transparent;
    border-radius: 9px;
    padding: 7px 12px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: all 100ms ease;
  }

  .approve {
    background: #16a34a;
    color: #fff;
    border-color: #15803d;
  }

  .approve:hover {
    background: #15803d;
  }

  .reject {
    background: #292524;
    border-color: #7f1d1d;
    color: #f87171;
  }

  .reject:hover {
    background: #451a1a;
  }
</style>
