/**
 * Chat orchestrator — owns Svelte $state and exposes the public API.
 * Delegates prompt building, step tracking, and the agent loop to separate modules.
 */

import { getSettings, loadSession, saveSession, clearSession } from './storage.js';
import { buildTabReminder, getSelectionContext, PLANNING_MODE_REMINDER } from './prompt.js';
import { createStepTracker } from './steps.js';
import { runAgentLoop } from './agent-loop.js';

// ── Svelte reactive state ────────────────────────────────────────────

let messages = $state([]);
let isRunning = $state(false);
let progress = $state(null);
let steps = $state([]);
let pendingPlan = $state(null);
let conversationHistory = $state([]);
let initialized = false;
let stopRequested = false;
let planResolve = null;

export const chatState = {
  get messages() { return messages; },
  get isRunning() { return isRunning; },
  get progress() { return progress; },
  get steps() { return steps; },
  get pendingPlan() { return pendingPlan; },
};

// ── Step tracker (bridges $state with pure step logic) ───────────────

const stepTracker = createStepTracker({
  getSteps: () => steps,
  setSteps: (v) => { steps = v; },
});

// ── Session persistence ──────────────────────────────────────────────

async function persistSession() {
  const settings = await getSettings();
  if (!settings.persistSession) {
    await clearSession();
    return;
  }
  await saveSession({ messages, conversationHistory, savedAt: Date.now() });
}

// ── Tab context ──────────────────────────────────────────────────────

async function getTabContext() {
  try {
    return await chrome.runtime.sendMessage({ type: 'GET_TABS_CONTEXT' });
  } catch {
    return [];
  }
}

// ── Plan approval ────────────────────────────────────────────────────

function handlePlanApproval(planInput) {
  return new Promise((resolve) => {
    pendingPlan = planInput;
    planResolve = resolve;
    messages = [...messages, { id: Date.now().toString(), role: 'plan', content: planInput }];
  });
}

export function approvePlan(approved, plan) {
  if (planResolve) {
    const resultText = approved
      ? `User has approved your plan. You can now start executing the plan.\n\nPlan steps:\n${plan.approach.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nStart by using the TodoWrite tool to track your progress through these steps.`
      : 'User has rejected your plan. Please ask the user what they would like you to do instead.';
    planResolve(resultText);
    planResolve = null;
    pendingPlan = null;
  }
}

// ── Agent loop context bridge ────────────────────────────────────────
// The agent loop is a plain JS module. This context bag lets it read/write
// Svelte $state indirectly, keeping the loop stateless.

function buildAgentContext() {
  return {
    getConversationHistory: () => conversationHistory,
    setConversationHistory: (v) => { conversationHistory = v; },
    addMessage: (msg) => { messages = [...messages, msg]; },
    updateMessage: (id, updates) => {
      messages = messages.map(m => m.id === id ? { ...m, ...updates } : m);
    },
    isStopRequested: () => stopRequested,
    setProgress: (v) => { progress = v; },
    pushStep: stepTracker.pushStep,
    updateStep: stepTracker.updateStep,
    getSteps: () => steps,
    handlePlanApproval,
    persistSession,
  };
}

// ── Public API ───────────────────────────────────────────────────────

export async function initChatState() {
  if (initialized) return;
  initialized = true;

  try {
    await chrome.runtime.sendMessage({ type: 'ENSURE_TAB_GROUP' });
  } catch {
    // Service worker may not be ready yet
  }

  const settings = await getSettings();
  if (!settings.persistSession) return;

  const session = await loadSession();
  if (!session) return;

  messages = Array.isArray(session.messages) ? session.messages : [];
  conversationHistory = Array.isArray(session.conversationHistory) ? session.conversationHistory : [];
}

export async function clearChat() {
  messages = [];
  conversationHistory = [];
  isRunning = false;
  progress = null;
  steps = [];
  pendingPlan = null;
  stopRequested = false;
  stepTracker.reset();
  await clearSession();
}

export function stopAgent() {
  if (!isRunning) return;
  stopRequested = true;
  progress = 'Stopping current run...';
}

export function exportConversationJson() {
  return JSON.stringify({ messages, conversationHistory }, null, 2);
}

export function exportConversationMarkdown() {
  return messages.map((m) => {
    if (m.role === 'plan') {
      const domains = Array.isArray(m.content?.domains) ? m.content.domains.join(', ') : '';
      const stepsText = Array.isArray(m.content?.approach) ? m.content.approach.map((s, i) => `${i + 1}. ${s}`).join('\n') : '';
      return `## Plan\n\nDomains: ${domains}\n\n${stepsText}`;
    }
    const role = m.role === 'user' ? 'User' : 'Assistant';
    return `## ${role}\n\n${m.content || ''}`;
  }).join('\n\n');
}

export async function sendMessage(text) {
  if (isRunning) return;
  isRunning = true;
  stopRequested = false;
  steps = [];

  messages = [...messages, { id: Date.now().toString(), role: 'user', content: text }];

  // Build user content blocks
  const tabs = await getTabContext();
  const activeTab = tabs.find(t => t.active) || tabs[0];
  const userContent = [
    { type: 'text', text },
    buildTabReminder(tabs),
  ];

  const selectionReminder = await getSelectionContext(activeTab?.tabId || activeTab?.id);
  if (selectionReminder) userContent.push(selectionReminder);

  // Add planning mode reminder on first message
  if (conversationHistory.length === 0) {
    userContent.push(PLANNING_MODE_REMINDER);
  }

  conversationHistory = [...conversationHistory, { role: 'user', content: userContent }];
  await persistSession();

  // Push initial "Working" step
  const workingStepId = stepTracker.pushStep('_working', {}, 'running');

  try {
    const settings = await getSettings();
    await runAgentLoop(buildAgentContext(), settings);
  } catch (error) {
    messages = [...messages, { id: Date.now().toString(), role: 'assistant', content: `Error: ${error.message}` }];
  }

  stepTracker.updateStep(workingStepId, 'done');

  // Freeze steps into a "timeline" message
  if (steps.length > 0) {
    const timelineMsg = {
      id: Date.now().toString(),
      role: 'timeline',
      content: steps.map(s => ({ ...s })),
    };
    const lastAssistantIndex = messages.map(m => m.role).lastIndexOf('assistant');
    if (lastAssistantIndex >= 0) {
      messages = [
        ...messages.slice(0, lastAssistantIndex),
        timelineMsg,
        ...messages.slice(lastAssistantIndex),
      ];
    } else {
      messages = [...messages, timelineMsg];
    }
  }

  isRunning = false;
  progress = null;
  steps = [];
  await persistSession();
}
