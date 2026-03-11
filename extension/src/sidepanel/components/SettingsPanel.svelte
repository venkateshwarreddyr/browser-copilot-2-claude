<script>
  import { getSettings, saveSettings, ENVIRONMENTS, MODEL_PRESETS } from '../lib/storage.js';

  let { onClose } = $props();
  let environment = $state('local');
  let backendUrl = $state('');
  let apiKey = $state('');
  let model = $state('');
  let systemPrompt = $state('');
  let autoApprovePlans = $state(false);
  let persistSession = $state(true);
  let saved = $state(false);

  $effect(() => {
    getSettings().then((s) => {
      environment = s.environment || 'local';
      backendUrl = s.backendUrl;
      apiKey = s.apiKey || '';
      model = s.model;
      systemPrompt = s.systemPrompt || '';
      autoApprovePlans = Boolean(s.autoApprovePlans);
      persistSession = s.persistSession !== false;
    });
  });

  function switchEnv(env) {
    environment = env;
    const preset = ENVIRONMENTS[env];
    if (preset) {
      backendUrl = preset.backendUrl;
      apiKey = preset.apiKey;
    }
  }

  async function save() {
    await saveSettings({ environment, backendUrl, apiKey, model, systemPrompt, autoApprovePlans, persistSession });
    saved = true;
    setTimeout(() => {
      saved = false;
    }, 2000);
  }
</script>

<section class="settings">
  <div class="header">
    <div>
      <div class="title">Settings</div>
      <div class="subtitle">Connection, model, and session behavior</div>
    </div>
    <button class="close" onclick={onClose} aria-label="Close settings">&times;</button>
  </div>

  <label>
    Environment
    <div class="env-switcher">
      {#each Object.entries(ENVIRONMENTS) as [key, env]}
        <button
          class="env-btn"
          class:active={environment === key}
          onclick={() => switchEnv(key)}
        >
          <span class="env-dot" class:local={key === 'local'} class:prod={key === 'prod'} class:openrouter={key === 'openrouter'}></span>
          {env.label}
        </button>
      {/each}
    </div>
  </label>

  <label>
    Backend URL
    <input type="text" bind:value={backendUrl} placeholder="http://localhost:3001" />
  </label>

  <label>
    API Key
    <input type="password" bind:value={apiKey} placeholder="(optional — matches API_SECRET on server)" />
  </label>

  <label>
    Model
    <select bind:value={model} class="model-select">
      {#each MODEL_PRESETS as preset}
        <option value={preset.value}>{preset.label}</option>
      {/each}
      {#if model && !MODEL_PRESETS.some(p => p.value === model)}
        <option value={model}>{model}</option>
      {/if}
    </select>
    <input type="text" bind:value={model} placeholder="Or type a custom model ID" />
  </label>

  <label>
    Extra System Prompt
    <textarea bind:value={systemPrompt} rows="3" placeholder="Optional team/task-specific instructions"></textarea>
  </label>

  <label class="row">
    <input type="checkbox" bind:checked={autoApprovePlans} />
    Auto-approve plans
  </label>

  <label class="row">
    <input type="checkbox" bind:checked={persistSession} />
    Persist session history
  </label>

  <button class="save-btn" onclick={save}>
    {saved ? 'Saved!' : 'Save Changes'}
  </button>
</section>

<style>
  .settings {
    padding: 14px;
    background: #292524;
    border: 1px solid #3f3a36;
    border-radius: 14px;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 12px;
  }

  .title {
    font-weight: 760;
    font-size: 14px;
    color: #fafaf9;
  }

  .subtitle {
    margin-top: 2px;
    font-size: 11px;
    color: #78716c;
  }

  .close {
    background: #3f3a36;
    border: 1px solid #57534e;
    border-radius: 8px;
    width: 30px;
    height: 30px;
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
    color: #a8a29e;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close:hover {
    background: #57534e;
    color: #e7e5e4;
  }

  label {
    display: block;
    font-size: 12px;
    font-weight: 650;
    color: #a8a29e;
    margin-bottom: 10px;
  }

  .env-switcher {
    display: flex;
    gap: 6px;
    margin-top: 5px;
  }

  .env-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 7px 10px;
    border: 1px solid #3f3a36;
    border-radius: 9px;
    background: #1c1917;
    color: #a8a29e;
    font-size: 12px;
    font-weight: 650;
    cursor: pointer;
    transition: all 100ms ease;
  }

  .env-btn:hover {
    border-color: #57534e;
    color: #d6d3d1;
  }

  .env-btn.active {
    border-color: #d4845a;
    background: rgba(212, 132, 90, 0.1);
    color: #d4845a;
  }

  .env-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .env-dot.local {
    background: #4ade80;
  }

  .env-dot.prod {
    background: #f97316;
  }

  .env-dot.openrouter {
    background: #a78bfa;
  }

  .model-select {
    display: block;
    width: 100%;
    margin-top: 5px;
    margin-bottom: 5px;
    padding: 8px 10px;
    border: 1px solid #3f3a36;
    border-radius: 9px;
    font-size: 13px;
    outline: none;
    font-family: inherit;
    color: #e7e5e4;
    background: #1c1917;
    cursor: pointer;
  }

  .model-select:focus {
    border-color: #d4845a;
    box-shadow: 0 0 0 2px rgba(212, 132, 90, 0.2);
  }

  input[type='text'],
  input[type='password'],
  textarea {
    display: block;
    width: 100%;
    margin-top: 5px;
    padding: 8px 10px;
    border: 1px solid #3f3a36;
    border-radius: 9px;
    font-size: 13px;
    outline: none;
    font-family: inherit;
    color: #e7e5e4;
    background: #1c1917;
  }

  input:focus,
  textarea:focus {
    border-color: #d4845a;
    box-shadow: 0 0 0 2px rgba(212, 132, 90, 0.2);
  }

  input[type='checkbox'] {
    accent-color: #d4845a;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 9px;
    margin-bottom: 8px;
    font-weight: 600;
    color: #d6d3d1;
  }

  .save-btn {
    width: 100%;
    margin-top: 8px;
    padding: 9px;
    background: #d4845a;
    color: #fff;
    border: 1px solid #b86e48;
    border-radius: 10px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 700;
    transition: all 100ms ease;
  }

  .save-btn:hover {
    background: #b86e48;
  }
</style>
