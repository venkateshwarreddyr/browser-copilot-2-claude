# Browser Copilot 2

Svelte Chrome extension + streaming Node/AWS backend for AI browser workflows. Uses `openai` npm package — works with any OpenAI-compatible provider (HuggingFace, xAI, OpenRouter, etc.).

## What this build includes

- Streaming chat loop between extension and backend (tool calls + tool results)
- Planning gate via `update_plan` approval before tool execution
- Browser automation tools: read page tree, find elements, form input, computer controls, navigation
- Debug tools: console logs + network request capture
- Session persistence and restore
- Stop current run
- One-click quick workflow prompts
- Transcript export (Markdown copy + JSON download)
- Extra settings: system prompt, auto-approve plans, persist session toggle
- Tools: `extract_links`, `get_selected_text`, `page_snapshot`, `tabs_activate`, `tabs_close`
- Improved `find` tool with scoring + visibility/interactive filtering

## 10-Step Implementation Plan

### Step 1: Upgrade system prompt in chat.svelte.js
- Replace minimal system prompt with comprehensive prompt from ccc.json
- Includes safety rules, injection defense, tool usage requirements, copyright protection
- Adds browser tab usage guide, turn_answer_start instructions
- Platform-specific modifier key instructions (cmd on Mac)

### Step 2: Update tool definitions in tools.js to match ccc.json
- Enrich all existing tool descriptions with detailed documentation from ccc.json
- Add full action descriptions for `computer` tool (click, type, screenshot, scroll, zoom, etc.)
- Add detailed parameter docs for `read_page`, `find`, `form_input`, `navigate`, etc.

### Step 3: Add upload_image tool definition and service worker handler
- New tool to upload screenshots or user images to file inputs or drag-and-drop targets
- Supports ref-based targeting for hidden file inputs
- Supports coordinate-based drag-and-drop

### Step 4: Add file_upload tool definition and service worker handler
- New tool to upload local files to file input elements on pages
- Accepts absolute file paths and element ref
- Bypasses native file picker dialog

### Step 5: Add gif_creator tool definition and service worker handler
- Record browser actions, export as animated GIF
- Actions: start_recording, stop_recording, export, clear
- Visual overlays: click indicators, action labels, progress bar, watermark

### Step 6: Improve turn_answer_start handling
- Ensure it signals end of tool calls before final text response
- No more tools allowed after calling turn_answer_start

### Step 7: Update agent.js to support image content in tool results
- Handle base64 image content blocks in tool results
- Pass image data through to LLM API (vision-capable models)
- Support screenshot results flowing back into conversation

### Step 8: Update SettingsPanel and storage defaults
- Update model placeholder text
- Ensure settings UI matches current capabilities

### Step 9: Update serverless.yml and package.json metadata
- Rename package to `browser-copilot-2-backend`
- Update serverless service name

### Step 10: Build extension and verify end-to-end
- Build extension: `cd extension && npm run build`
- Start backend: `cd backend && npm run dev`
- Verify streaming, tool execution, plan approval flow

## Project layout

- `extension/` - Chrome extension (Svelte + Vite, MV3)
- `backend/` - local server + Serverless Lambda streaming endpoint
- `ccc.json` - Reference API trace showing full request/response format

## Backend setup

1. Install dependencies

```bash
cd backend
npm install
```

2. Create env file

```bash
cp .env.example .env
```

Set:

- `LLM_API_KEY` or `HF_API_KEY` (required) - your API key for any OpenAI-compatible provider
- `LLM_BASE_URL` (optional, defaults to `https://router.huggingface.co/v1`)
- `LLM_MODEL` (optional, default model name)
- `PORT` (optional, default `3001`)

3. Start local backend

```bash
npm run dev
```

## Extension setup

1. Install dependencies

```bash
cd extension
npm install
```

2. Build extension

```bash
npm run build
```

3. Load in Chrome

- Open `chrome://extensions`
- Enable Developer mode
- Click **Load unpacked**
- Select `extension/dist`

## Using the copilot

1. Open extension side panel from toolbar icon
2. Configure backend URL in Settings (default: `http://localhost:3001`)
3. Send a task (or click a quick workflow prompt)
4. Approve plan when shown (unless auto-approve is enabled)
5. Agent executes tools and streams responses in real time

## Deploy backend to AWS (optional)

```bash
cd backend
npm run deploy
```

Update extension `Backend URL` setting to your API Gateway/Function URL endpoint.
