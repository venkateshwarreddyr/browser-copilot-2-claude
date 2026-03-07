In the video you shared (**“Let Nexus handle work in your browser”**), the **Teach feature** is essentially a **demonstration-based automation system**. Instead of writing scripts, the user **shows the AI how to perform a task once**, and the system records and converts those actions into a reusable workflow.

Below is the **requirement-style explanation of how the Teach feature works**.

---

# Teach Feature – Functional Description

## 1. Overview

The **Teach feature** allows users to demonstrate a workflow manually in the browser while the system records their actions. The system converts the recorded actions into a structured workflow that the AI agent can replay or modify later.

This enables users to create browser automations without writing code.

---

# 2. Teach Mode Workflow

## Step 1 — Start Teaching Mode

The user activates **Teach Mode** from the extension UI.

System behavior:

* Begin recording browser events.
* Track user actions on the current tab.
* Capture context from the web page.

Recorded data includes:

* DOM elements interacted with
* user inputs
* navigation events
* extracted content

---

## Step 2 — User Demonstrates the Task

The user performs the workflow manually.

Example:

1. Open analytics dashboard
2. Click “Weekly Metrics”
3. Copy revenue value
4. Open Google Docs
5. Paste value into report

During this process, the system records every step.

---

## Step 3 — Action Capture

The system records the following types of events:

### Navigation Events

```text
open_url
navigate_page
switch_tab
```

---

### Interaction Events

```text
click_element
type_text
select_dropdown
scroll_page
```

---

### Data Extraction Events

```text
copy_text
read_element
extract_table
```

---

### Context Capture

For each action, the system captures:

* element selector
* element text
* DOM hierarchy
* page URL
* timestamp

Example recorded step:

```json
{
  "action": "click",
  "selector": "#weekly-metrics",
  "text": "Weekly Metrics",
  "url": "analytics.company.com"
}
```

---

# 3. Workflow Generation

After recording is completed, the system converts actions into a workflow.

Example:

```
Step 1: Open analytics dashboard
Step 2: Click Weekly Metrics tab
Step 3: Extract revenue value
Step 4: Open report document
Step 5: Insert revenue value
```

This workflow is stored as a reusable automation.

---

# 4. AI Generalization

The LLM analyzes the recorded workflow and converts it into a **generalizable task**.

Example transformation:

Recorded action:

```
Click element "#weekly-metrics"
```

Generalized step:

```
Open the weekly metrics section of the dashboard
```

This allows the workflow to work even if:

* UI elements change slightly
* layout changes
* page structure shifts

---

# 5. Workflow Storage

Recorded workflows are stored as structured automation scripts.

Example schema:

```json
{
  "workflow_id": "weekly_metrics_report",
  "steps": [
    {
      "action": "open_url",
      "url": "analytics.company.com"
    },
    {
      "action": "click",
      "selector": "#weekly-metrics"
    },
    {
      "action": "extract",
      "selector": ".revenue"
    }
  ]
}
```

---

# 6. Running a Taught Workflow

After teaching is complete, the workflow becomes reusable.

User command example:

```
Run the weekly report workflow.
```

Execution process:

```
User Request
↓
Load stored workflow
↓
Agent executes steps
↓
Browser performs actions
↓
Results returned
```

---

# 7. Error Handling

During replay, the system handles failures.

Possible issues:

* selector changed
* element not found
* page layout changed

Recovery strategies:

1. AI re-identifies element based on text.
2. Try alternative selectors.
3. Use visual element matching.

---

# 8. Teach Feature Functional Requirements

### Recording

FR-T1
The system shall record browser interactions during Teach Mode.

FR-T2
The system shall capture DOM metadata for each action.

FR-T3
The system shall capture navigation events.

---

### Workflow Creation

FR-T4
The system shall convert recorded actions into workflow steps.

FR-T5
The system shall allow users to review recorded workflows.

FR-T6
The system shall store workflows for reuse.

---

### Execution

FR-T7
The system shall allow users to trigger stored workflows.

FR-T8
The system shall execute workflow steps sequentially.

FR-T9
The system shall handle execution errors.

---

# 9. Non-Functional Requirements

### Performance

Workflow replay latency:

```
<2 seconds per step
```

---

### Reliability

Workflow success rate target:

```
>85%
```

---

### Security

* Automation limited to permitted domains.
* Sensitive inputs require confirmation.

---

# 10. Example Use Case

### Task

Generate weekly report.

---

### Teach Workflow

User demonstrates:

1. open analytics dashboard
2. click weekly metrics
3. copy revenue
4. open report
5. paste value

---

### Stored Workflow

```
open_dashboard
extract_metrics
update_report
```

---

# 11. Benefits of Teach Feature

* No coding required
* Faster workflow creation
* Reusable automation
* Adaptable via AI reasoning

---

If you're building something similar (which seems likely from your earlier questions), the **real challenge is not recording actions but making them reliable**.

The systems in **Nexus Computer Use / Operator / Browser Use** use a **hybrid approach** combining:

* DOM selectors
* semantic element understanding
* screenshot vision models

If you'd like, I can also explain the **actual architecture used by those systems for Teach Mode**, which is **much more advanced than simple action recording**.
