export const ENVIRONMENTS = {
  local: {
    label: 'Local',
    backendUrl: 'http://localhost:3001',
    apiKey: '',
  },
  prod: {
    label: 'Production',
    backendUrl: 'https://cvaw4xieqxrlyldec2rndibrfy0jrhfu.lambda-url.us-east-1.on.aws',
    apiKey: '',
  },
  openrouter: {
    label: 'OpenRouter',
    backendUrl: 'http://localhost:3001',
    apiKey: '',
  },
};

export const MODEL_PRESETS = [
  { value: '', label: 'Server default' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'claude-sonnet-4-5-20250514', label: 'Claude Sonnet 4.5' },
  { value: 'grok-3', label: 'Grok 3' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4.1', label: 'GPT-4.1' },
];

const DEFAULTS = {
  environment: 'local',
  backendUrl: ENVIRONMENTS.local.backendUrl,
  apiKey: '',
  model: '',
  systemPrompt: '',
  autoApprovePlans: false,
  persistSession: true,
};

const SESSION_KEY = 'chatSession';
const TEACH_WORKFLOWS_KEY = 'teachWorkflows';
const MAX_TEACH_WORKFLOWS = 50;

export async function getSettings() {
  try {
    const result = await chrome.storage.local.get(DEFAULTS);
    return result;
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveSettings(settings) {
  await chrome.storage.local.set(settings);
}

export async function saveSession(session) {
  await chrome.storage.local.set({ [SESSION_KEY]: session });
}

export async function loadSession() {
  try {
    const result = await chrome.storage.local.get(SESSION_KEY);
    return result[SESSION_KEY] || null;
  } catch {
    return null;
  }
}

export async function clearSession() {
  await chrome.storage.local.remove(SESSION_KEY);
}

export async function loadTeachWorkflows() {
  try {
    const result = await chrome.storage.local.get(TEACH_WORKFLOWS_KEY);
    const workflows = Array.isArray(result[TEACH_WORKFLOWS_KEY]) ? result[TEACH_WORKFLOWS_KEY] : [];
    return workflows.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  } catch {
    return [];
  }
}

export async function saveTeachWorkflow(workflow) {
  const existing = await loadTeachWorkflows();
  const merged = [workflow, ...existing.filter((w) => w.id !== workflow.id)].slice(0, MAX_TEACH_WORKFLOWS);
  await chrome.storage.local.set({ [TEACH_WORKFLOWS_KEY]: merged });
}

export async function deleteTeachWorkflow(workflowId) {
  const existing = await loadTeachWorkflows();
  const filtered = existing.filter((w) => w.id !== workflowId);
  await chrome.storage.local.set({ [TEACH_WORKFLOWS_KEY]: filtered });
}

export async function markTeachWorkflowRun(workflowId) {
  const existing = await loadTeachWorkflows();
  const now = Date.now();
  const updated = existing.map((w) => (w.id === workflowId ? { ...w, lastRunAt: now, updatedAt: now } : w));
  await chrome.storage.local.set({ [TEACH_WORKFLOWS_KEY]: updated });
}
