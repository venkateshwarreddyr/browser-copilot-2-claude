> ## Documentation Index
> Fetch the complete documentation index at: https://code.nexus.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Use Nexus Code with Chrome (beta)

> Connect Nexus Code to your Chrome browser to test web apps, debug with console logs, automate form filling, and extract data from web pages.

Nexus Code integrates with the Nexus in Chrome browser extension to give you browser automation capabilities from the CLI or the [VS Code extension](/en/vs-code#automate-browser-tasks-with-chrome). Build your code, then test and debug in the browser without switching contexts.

Nexus opens new tabs for browser tasks and shares your browser's login state, so it can access any site you're already signed into. Browser actions run in a visible Chrome window in real time. When Nexus encounters a login page or CAPTCHA, it pauses and asks you to handle it manually.

<Note>
  Chrome integration is in beta and currently works with Google Chrome and Microsoft Edge. It is not yet supported on Brave, Arc, or other Chromium-based browsers. WSL (Windows Subsystem for Linux) is also not supported.
</Note>

## Capabilities

With Chrome connected, you can chain browser actions with coding tasks in a single workflow:

* **Live debugging**: read console errors and DOM state directly, then fix the code that caused them
* **Design verification**: build a UI from a Figma mock, then open it in the browser to verify it matches
* **Web app testing**: test form validation, check for visual regressions, or verify user flows
* **Authenticated web apps**: interact with Google Docs, Gmail, Notion, or any app you're logged into without API connectors
* **Data extraction**: pull structured information from web pages and save it locally
* **Task automation**: automate repetitive browser tasks like data entry, form filling, or multi-site workflows
* **Session recording**: record browser interactions as GIFs to document or share what happened

## Prerequisites

Before using Nexus Code with Chrome, you need:

* [Google Chrome](https://www.google.com/chrome/) or [Microsoft Edge](https://www.microsoft.com/edge) browser
* [Nexus in Chrome extension](https://chromewebstore.google.com/detail/nexus/fcoeoabgfenejglbffodgkkbkcdhcgfn) version 1.0.36 or higher, available in the Chrome Web Store for both browsers
* [Nexus Code](/en/quickstart#step-1-install-nexus-code) version 2.0.73 or higher
* A direct Anthropic plan (Pro, Max, Teams, or Enterprise)

<Note>
  Chrome integration is not available through third-party providers like Amazon Bedrock, Google Cloud Vertex AI, or Microsoft Foundry. If you access Nexus exclusively through a third-party provider, you need a separate nexus.ai account to use this feature.
</Note>

## Get started in the CLI

<Steps>
  <Step title="Launch Nexus Code with Chrome">
    Start Nexus Code with the `--chrome` flag:

    ```bash  theme={null}
    nexus --chrome
    ```

    You can also enable Chrome from within an existing session by running `/chrome`.
  </Step>

  <Step title="Ask Nexus to use the browser">
    This example navigates to a page, interacts with it, and reports what it finds, all from your terminal or editor:

    ```text  theme={null}
    Go to code.nexus.com/docs, click on the search box,
    type "hooks", and tell me what results appear
    ```
  </Step>
</Steps>

Run `/chrome` at any time to check the connection status, manage permissions, or reconnect the extension.

For VS Code, see [browser automation in VS Code](/en/vs-code#automate-browser-tasks-with-chrome).

### Enable Chrome by default

To avoid passing `--chrome` each session, run `/chrome` and select "Enabled by default".

In the [VS Code extension](/en/vs-code#automate-browser-tasks-with-chrome), Chrome is available whenever the Chrome extension is installed. No additional flag is needed.

<Note>
  Enabling Chrome by default in the CLI increases context usage since browser tools are always loaded. If you notice increased context consumption, disable this setting and use `--chrome` only when needed.
</Note>

### Manage site permissions

Site-level permissions are inherited from the Chrome extension. Manage permissions in the Chrome extension settings to control which sites Nexus can browse, click, and type on.

## Example workflows

These examples show common ways to combine browser actions with coding tasks. Run `/mcp` and select `nexus-in-chrome` to see the full list of available browser tools.

### Test a local web application

When developing a web app, ask Nexus to verify your changes work correctly:

```text  theme={null}
I just updated the login form validation. Can you open localhost:3000,
try submitting the form with invalid data, and check if the error
messages appear correctly?
```

Nexus navigates to your local server, interacts with the form, and reports what it observes.

### Debug with console logs

Nexus can read console output to help diagnose problems. Tell Nexus what patterns to look for rather than asking for all console output, since logs can be verbose:

```text  theme={null}
Open the dashboard page and check the console for any errors when
the page loads.
```

Nexus reads the console messages and can filter for specific patterns or error types.

### Automate form filling

Speed up repetitive data entry tasks:

```text  theme={null}
I have a spreadsheet of customer contacts in contacts.csv. For each row,
go to the CRM at crm.example.com, click "Add Contact", and fill in the
name, email, and phone fields.
```

Nexus reads your local file, navigates the web interface, and enters the data for each record.

### Draft content in Google Docs

Use Nexus to write directly in your documents without API setup:

```text  theme={null}
Draft a project update based on the recent commits and add it to my
Google Doc at docs.google.com/document/d/abc123
```

Nexus opens the document, clicks into the editor, and types the content. This works with any web app you're logged into: Gmail, Notion, Sheets, and more.

### Extract data from web pages

Pull structured information from websites:

```text  theme={null}
Go to the product listings page and extract the name, price, and
availability for each item. Save the results as a CSV file.
```

Nexus navigates to the page, reads the content, and compiles the data into a structured format.

### Run multi-site workflows

Coordinate tasks across multiple websites:

```text  theme={null}
Check my calendar for meetings tomorrow, then for each meeting with
an external attendee, look up their company website and add a note
about what they do.
```

Nexus works across tabs to gather information and complete the workflow.

### Record a demo GIF

Create shareable recordings of browser interactions:

```text  theme={null}
Record a GIF showing how to complete the checkout flow, from adding
an item to the cart through to the confirmation page.
```

Nexus records the interaction sequence and saves it as a GIF file.

## Troubleshooting

### Extension not detected

If Nexus Code shows "Chrome extension not detected":

1. Verify the Chrome extension is installed and enabled in `chrome://extensions`
2. Verify Nexus Code is up to date by running `nexus --version`
3. Check that Chrome is running
4. Run `/chrome` and select "Reconnect extension" to re-establish the connection
5. If the issue persists, restart both Nexus Code and Chrome

The first time you enable Chrome integration, Nexus Code installs a native messaging host configuration file. Chrome reads this file on startup, so if the extension isn't detected on your first attempt, restart Chrome to pick up the new configuration.

If the connection still fails, verify the host configuration file exists at:

For Chrome:

* **macOS**: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.anthropic.claude_code_browser_extension.json`
* **Linux**: `~/.config/google-chrome/NativeMessagingHosts/com.anthropic.claude_code_browser_extension.json`
* **Windows**: check `HKCU\Software\Google\Chrome\NativeMessagingHosts\` in the Windows Registry

For Edge:

* **macOS**: `~/Library/Application Support/Microsoft Edge/NativeMessagingHosts/com.anthropic.claude_code_browser_extension.json`
* **Linux**: `~/.config/microsoft-edge/NativeMessagingHosts/com.anthropic.claude_code_browser_extension.json`
* **Windows**: check `HKCU\Software\Microsoft\Edge\NativeMessagingHosts\` in the Windows Registry

### Browser not responding

If Nexus's browser commands stop working:

1. Check if a modal dialog (alert, confirm, prompt) is blocking the page. JavaScript dialogs block browser events and prevent Nexus from receiving commands. Dismiss the dialog manually, then tell Nexus to continue.
2. Ask Nexus to create a new tab and try again
3. Restart the Chrome extension by disabling and re-enabling it in `chrome://extensions`

### Connection drops during long sessions

The Chrome extension's service worker can go idle during extended sessions, which breaks the connection. If browser tools stop working after a period of inactivity, run `/chrome` and select "Reconnect extension".

### Windows-specific issues

On Windows, you may encounter:

* **Named pipe conflicts (EADDRINUSE)**: if another process is using the same named pipe, restart Nexus Code. Close any other Nexus Code sessions that might be using Chrome.
* **Native messaging host errors**: if the native messaging host crashes on startup, try reinstalling Nexus Code to regenerate the host configuration.

### Common error messages

These are the most frequently encountered errors and how to resolve them:

| Error                                | Cause                                            | Fix                                                             |
| ------------------------------------ | ------------------------------------------------ | --------------------------------------------------------------- |
| "Browser extension is not connected" | Native messaging host cannot reach the extension | Restart Chrome and Nexus Code, then run `/chrome` to reconnect |
| "Extension not detected"             | Chrome extension is not installed or is disabled | Install or enable the extension in `chrome://extensions`        |
| "No tab available"                   | Nexus tried to act before a tab was ready       | Ask Nexus to create a new tab and retry                        |
| "Receiving end does not exist"       | Extension service worker went idle               | Run `/chrome` and select "Reconnect extension"                  |

## See also

* [Use Nexus Code in VS Code](/en/vs-code#automate-browser-tasks-with-chrome): browser automation in the VS Code extension
* [CLI reference](/en/cli-reference): command-line flags including `--chrome`
* [Common workflows](/en/common-workflows): more ways to use Nexus Code
* [Data and privacy](/en/data-usage): how Nexus Code handles your data
* [Getting started with Nexus in Chrome](https://support.nexus.com/en/articles/12012173-getting-started-with-nexus-in-chrome): full documentation for the Chrome extension, including shortcuts, scheduling, and permissions


Below is a **detailed Software Requirement Specification (SRS)** style document for the **AI Browser Agent** application derived from the workflow shown in the video. This is written in a **formal requirement document format** similar to what engineering teams use before implementation.

---

# Software Requirement Specification (SRS)

# AI Browser Automation Agent

Version: 1.0
Date: March 2026

---

# 1. Introduction

## 1.1 Purpose

This document defines the requirements for the **AI Browser Automation Agent**, a system that allows users to automate tasks across websites using natural language commands. The system enables an AI agent to interact with web interfaces similarly to a human user by performing actions such as clicking, typing, extracting data, and navigating between pages.

The goal is to reduce repetitive manual work by allowing the AI agent to execute browser-based workflows autonomously.

---

# 1.2 Scope

The AI Browser Automation Agent will:

* Accept natural language instructions from users.
* Interpret the instruction using a Large Language Model (LLM).
* Convert instructions into executable browser actions.
* Interact with websites via a browser extension.
* Extract and structure information from web pages.
* Complete multi-step workflows across different web applications.

The system will support automation for workflows such as:

* data extraction from dashboards
* form filling
* report generation
* responding to document comments
* workflow automation across SaaS tools

---

# 1.3 Definitions

| Term             | Definition                                          |
| ---------------- | --------------------------------------------------- |
| Agent            | AI system that performs browser tasks               |
| Workflow         | Sequence of steps required to complete a task       |
| Tool             | Executable function available to the agent          |
| Planner          | LLM component that converts instructions into steps |
| Browser Executor | Component that performs actions in the browser      |

---

# 2. Overall Description

---

# 2.1 Product Perspective

The product consists of three major components:

1. **Browser Extension**
2. **Agent Runtime**
3. **LLM Planning Engine**

The browser extension interacts with web pages and executes commands from the agent runtime.

The LLM planning engine converts user instructions into executable tasks.

---

# 2.2 Product Functions

The system will provide the following functions:

* Accept user instructions in natural language
* Break tasks into step-by-step actions
* Interact with browser elements
* Extract information from web pages
* Automate workflows across multiple websites
* Provide execution logs and results

---

# 2.3 User Classes

### End Users

Knowledge workers who want to automate tasks in web applications.

Examples:

* analysts
* marketers
* operations staff

---

### Developers

Developers using the agent to:

* test web applications
* debug workflows
* automate repetitive actions

---

# 2.4 Operating Environment

Supported platforms:

* Google Chrome
* Microsoft Edge

Operating systems:

* macOS
* Windows
* Linux

Backend services run on cloud infrastructure.

---

# 3. System Features

---

# 3.1 Natural Language Task Input

### Description

Users can provide task instructions using natural language.

Example:

```
Collect weekly metrics from the analytics dashboard and add them to the report.
```

---

### Functional Requirements

FR-1
The system shall allow users to enter tasks in natural language.

FR-2
The system shall send user instructions to the LLM planner.

FR-3
The system shall convert instructions into structured workflow steps.

---

# 3.2 Task Planning

### Description

The system generates an action plan from the user request.

Example plan:

```
1. Open analytics dashboard
2. Extract weekly metrics
3. Open report document
4. Insert metrics into report
```

---

### Functional Requirements

FR-4
The system shall break user instructions into multiple steps.

FR-5
The system shall map each step to a tool or browser action.

FR-6
The system shall validate generated steps before execution.

---

# 3.3 Browser Interaction

### Description

The agent performs actions within the browser.

Supported actions include:

* clicking elements
* typing input
* scrolling
* navigating pages

---

### Functional Requirements

FR-7
The system shall allow the agent to click DOM elements.

FR-8
The system shall allow the agent to type text into input fields.

FR-9
The system shall allow the agent to scroll web pages.

FR-10
The system shall allow the agent to open URLs.

FR-11
The system shall allow the agent to switch browser tabs.

---

# 3.4 Data Extraction

### Description

The system extracts structured information from web pages.

Examples:

* table data
* dashboard metrics
* lists
* product details

---

### Functional Requirements

FR-12
The system shall extract text content from DOM elements.

FR-13
The system shall convert extracted data into structured formats.

FR-14
The system shall support output formats including JSON and CSV.

---

# 3.5 Document Editing

### Description

The system can edit content within web-based documents.

Example:

* respond to comments
* update reports
* insert summaries

---

### Functional Requirements

FR-15
The system shall allow the agent to modify text content within documents.

FR-16
The system shall allow insertion of generated summaries.

---

# 3.6 Workflow Automation

### Description

The agent can perform multi-step tasks across multiple websites.

Example workflow:

1. open dashboard
2. collect metrics
3. open Google Docs
4. insert summary

---

### Functional Requirements

FR-17
The system shall support multi-step workflows.

FR-18
The system shall allow workflows across multiple domains.

FR-19
The system shall maintain task context across steps.

---

# 3.7 Error Handling

### Description

The system must handle failures during execution.

Possible failures:

* element not found
* page load failure
* authentication issues

---

### Functional Requirements

FR-20
The system shall retry failed actions up to three times.

FR-21
The system shall provide error messages to the user.

FR-22
The system shall allow manual user intervention.

---

# 4. External Interface Requirements

---

# 4.1 User Interface

The application interface includes:

* task input field
* execution status display
* action logs
* result preview

---

# 4.2 Browser Interface

The system interacts with web pages through:

* DOM access
* browser APIs
* content scripts

---

# 4.3 API Interface

Backend communicates with:

* LLM providers
* task storage systems
* workflow engine

---

# 5. Non-Functional Requirements

---

# 5.1 Performance

NFR-1
Each browser action should execute within 3 seconds.

NFR-2
End-to-end workflows should complete within 60 seconds for typical tasks.

---

# 5.2 Security

NFR-3
The system shall restrict browser access to permitted websites.

NFR-4
The system shall require user permission for sensitive actions.

---

# 5.3 Privacy

NFR-5
Sensitive user data shall not be stored permanently.

NFR-6
All data processing must comply with privacy policies.

---

# 5.4 Reliability

NFR-7
The system shall retry failed actions automatically.

NFR-8
The system shall log all executed actions.

---

# 6. System Architecture

---

### Core Components

1. Browser Extension
2. Agent Runtime
3. LLM Planner
4. Tool Execution Engine
5. Storage Layer

---

### Architecture Flow

```
User Input
     ↓
LLM Planner
     ↓
Workflow Steps
     ↓
Tool Executor
     ↓
Browser Extension
     ↓
Website Interaction
     ↓
Results
```

---

# 7. Data Requirements

The system stores:

* task requests
* execution logs
* extracted data
* workflow states

Example data format:

```
task_id
user_id
steps
execution_status
results
```

---

# 8. Assumptions and Constraints

Assumptions:

* users are logged into required web services
* websites allow DOM interaction

Constraints:

* dynamic web pages may change structure
* certain websites may block automation

---

# 9. Future Enhancements

Potential improvements include:

* scheduled workflows
* autonomous agents
* visual UI understanding
* learning from user behavior

---

# 10. Acceptance Criteria

The system will be considered complete when:

* users can execute browser workflows via natural language
* the agent can interact with web pages successfully
* workflows execute reliably across multiple sites
* extracted data can be structured and reused

---

If you want, I can also give you a **much stronger document used in AI startups**, including:

* **Agent tool specification**
* **LLM prompt architecture**
* **exact browser agent loop**
* **frontend context building design (very important)**

That document is what teams use when building systems like **Nexus Computer Use / OpenAI Operator**.
