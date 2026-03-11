/**
 * Agent step tracking — maps tool calls to human-readable UI steps.
 * Pure functions for description; stateful helpers accept callbacks
 * so they can update Svelte $state without owning it.
 */

/** Map tool name + input to a human-readable label and icon type */
export function describeToolStep(name, input) {
  switch (name) {
    case 'read_page':
      return { label: 'Read page', icon: 'eye' };
    case 'find':
      return { label: `Find: "${input?.description || input?.text || '...'}"`, icon: 'search' };
    case 'computer': {
      const action = input?.action;
      if (action === 'click' || action === 'doubleClick' || action === 'tripleClick')
        return { label: 'Click', icon: 'click' };
      if (action === 'type')
        return { label: `Type: "${(input?.text || '').slice(0, 40)}"`, icon: 'keyboard' };
      if (action === 'key')
        return { label: `Press key: ${input?.key || ''}`, icon: 'keyboard' };
      if (action === 'screenshot')
        return { label: 'Take screenshot', icon: 'camera' };
      if (action === 'scroll')
        return { label: 'Scroll', icon: 'scroll' };
      if (action === 'hover')
        return { label: 'Hover', icon: 'click' };
      return { label: `Computer: ${action || 'action'}`, icon: 'click' };
    }
    case 'form_input':
      return { label: `Form input: "${(input?.value || '').slice(0, 30)}"`, icon: 'keyboard' };
    case 'navigate':
      return { label: `Navigate: ${(input?.url || '').slice(0, 40)}`, icon: 'navigate' };
    case 'update_plan':
      return { label: 'Created a plan', icon: 'plan' };
    case 'turn_answer_start':
      return { label: 'Composing response', icon: 'text' };
    case 'javascript_tool':
      return { label: 'Run JavaScript', icon: 'code' };
    case 'read_console_messages':
      return { label: 'Read console', icon: 'code' };
    case 'read_network_requests':
      return { label: 'Read network', icon: 'network' };
    case 'get_page_text':
      return { label: 'Get page text', icon: 'text' };
    case 'extract_links':
      return { label: 'Extract links', icon: 'search' };
    case 'page_snapshot':
      return { label: 'Page snapshot', icon: 'camera' };
    case 'upload_image':
      return { label: 'Upload image', icon: 'camera' };
    case 'file_upload':
      return { label: 'Upload file', icon: 'navigate' };
    case 'gif_creator': {
      const gifAction = input?.action;
      if (gifAction === 'start_recording') return { label: 'Start GIF recording', icon: 'camera' };
      if (gifAction === 'stop_recording') return { label: 'Stop GIF recording', icon: 'camera' };
      if (gifAction === 'export') return { label: 'Export GIF', icon: 'camera' };
      return { label: 'GIF creator', icon: 'camera' };
    }
    default: {
      const pretty = name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      return { label: pretty, icon: 'cog' };
    }
  }
}

/**
 * Creates a step tracker that manages step state via callbacks.
 * @param {object} opts
 * @param {() => Array} opts.getSteps - getter for current steps array
 * @param {(steps: Array) => void} opts.setSteps - setter to update steps array
 * @returns {{ pushStep, updateStep }}
 */
export function createStepTracker({ getSteps, setSteps }) {
  let stepIdCounter = 0;

  function pushStep(name, input, status = 'running') {
    const { label, icon } = describeToolStep(name, input);
    const step = { id: `step_${++stepIdCounter}`, name, label, icon, status };
    setSteps([...getSteps(), step]);
    return step.id;
  }

  function updateStep(id, status) {
    setSteps(getSteps().map(s => s.id === id ? { ...s, status } : s));
  }

  function reset() {
    stepIdCounter = 0;
  }

  return { pushStep, updateStep, reset };
}
