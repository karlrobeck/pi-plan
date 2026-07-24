# pi-plan — Architecture & Implementation Plan

## Overview

`pi-plan` is a Pi extension that provides structured plan management via LLM-callable tools and a markdown template system. It integrates with `pi-task` for the `todo_write` workflow and enforces a **plan mode** (read-only) where file creation and modification are forbidden.

## Core Concepts

### Plan Mode (Read-Only)
- When plan mode is active, built-in write tools (`edit`, `write`) are disabled.
- `bash` is restricted to allowlisted read-only commands (e.g., `ls`, `cat`, `grep`, `find`, `rg`, `fd`).
- Only the plan management tools (`write_plan`, `edit_plan`, `view_plan`) remain enabled for interacting with the plan document.
- Plan mode is on by default when a session starts fresh (no prior plan), to enforce "think before you act."

### Session-Tagged Plan Storage
- Each plan is stored in `.pi/plans/<session-id>/` where `<session-id>` is the current Pi session's short ID.
- This keeps plans scoped to a session and avoids collisions across sessions.
- The directory path is derived from `ctx.sessionManager.getSessionFile()` — its basename (minus extension) becomes the directory name.

### Markdown Plan Template
All plans follow a consistent template:

```markdown
# Plan: <Title>

## Goals
- Clearly stated objectives

## Topics
1. Topic one — brief description
2. Topic two — brief description

## Steps
1. [ ] Step one description
2. [ ] Step two description

## Questions / Uncertainties
- What needs clarification?
```

The template lives in the extension directory and can be overridden per-project via `.pi/plans/template.md`.

## Tools

### `write_plan`
- **Action:** Creates a new plan file at `.pi/plans/<session-id>/plan.md`
- **Parameters:**
  - `title` (string, required) — Plan title
  - `goals` (string[], required) — List of goals
  - `topics` (array of `{name, description}`, required) — Topics breakdown
  - `steps` (array of `{description}`, optional) — Step-by-step tasks
  - `questions` (string[], optional) — Open questions/uncertainties
- **Behavior:**
  1. Creates `.pi/plans/<session-id>/` if it does not exist
  2. Renders the markdown template with provided parameters
  3. Writes to `plan.md`
  4. Returns the path and a summary to the LLM
- **Rendering:** Shows plan title, topic count, step count in compact view; full rendered markdown when expanded

### `edit_plan`
- **Action:** Modifies sections of the existing plan at `.pi/plans/<session-id>/plan.md`
- **Parameters:**
  - `section` (enum: `"goals"`, `"topics"`, `"steps"`, `"questions"`, `"title"`) — Which section to edit
  - `action` (enum: `"set"`, `"add"`, `"remove"`, `"reorder"`) — What to do
  - `value` (string or array, depends on section) — New content
  - `index` (integer, optional) — For single-item operations within an array
- **Behavior:**
  1. Reads the existing plan file
  2. Parses the markdown sections
  3. Applies the modification
  4. Writes the updated plan back
- **Rendering:** Shows diff-style update summary

### `view_plan`
- **Action:** Reads and returns the current plan for the session
- **Parameters:** (none required)
- **Behavior:**
  1. Looks for `.pi/plans/<session-id>/plan.md`
  2. If found, reads and returns the full content
  3. If not found, returns a clear message that no plan exists yet
- **Rendering:** Shows the plan in a formatted box; full markdown when expanded

## Plan Template System

### Default Template
Bundled in the extension at `templates/plan.md`:

```markdown
# Plan: {{title}}

## Goals
{{#each goals}}
- {{this}}
{{/each}}

## Topics
{{#each topics}}
{{#if @index}}1. {{name}} — {{description}}{{/if}}
{{/each}}

## Steps
{{#each steps}}
- [ ] {{this}}
{{/each}}

## Questions / Uncertainties
{{#each questions}}
- {{this}}
{{/each}}
```

### Custom Template
Users can place a custom template at `.pi/plans/template.md` (in project root). If present, it takes precedence over the default.

## Plan Mode Enforcement

### Tool Filtering
When plan mode is enabled, `pi.setActiveTools()` is called to restrict the tool set:

| Tool | Plan Mode | Normal Mode |
|------|-----------|-------------|
| `read` | ✅ Allowed | ✅ Allowed |
| `bash` | ✅ Restricted (read-only cmds) | ✅ Full |
| `grep` | ✅ Allowed | ✅ Allowed |
| `find` | ✅ Allowed | ✅ Allowed |
| `ls` | ✅ Allowed | ✅ Allowed |
| `write_plan` | ✅ Allowed | ✅ Allowed |
| `edit_plan` | ✅ Allowed | ✅ Allowed |
| `view_plan` | ✅ Allowed | ✅ Allowed |
| `write` | ❌ Blocked | ✅ Allowed |
| `edit` | ❌ Blocked | ✅ Allowed |

### Bash Restriction
In plan mode, `bash` commands are checked against an allowlist. Only read-only commands pass:
- `ls`, `cat`, `head`, `tail`, `less`, `more`
- `grep`, `rg`, `ag`, `ack`
- `find`, `fd`, `locate`
- `stat`, `wc`, `df`, `du`
- `echo`, `printf`, `which`, `type`, `command`
- `pwd`, `realpath`, `readlink`, `basename`, `dirname`
- `date`, `env`, `printenv`
- `piped` combinations of the above (e.g., `ls | grep foo`)

All other commands (including `rm`, `mv`, `cp`, `mkdir`, `touch`, `nano`, `vim`, `sed -i`) are blocked with a descriptive message.

### Persistence
Plan mode state is persisted via `pi.appendEntry("plan-mode", { enabled, ... })` so it survives session resume.

## New Session Workflow

### Session Start Hook
On `session_start` with `reason: "new"`:

1. Extension checks if a plan already exists for the session.
2. If no plan exists, plan mode is enabled automatically.
3. A custom message is injected (not displayed to user, but sent to LLM context) reminding the agent:

```
[PLAN MODE ACTIVE — New Session Workflow]

You are in plan mode (read-only). You must follow these steps before making any changes:

1. **Analyze** the user's prompt — understand what they need.
2. **Break down** the prompt into topics and actionable steps.
3. **Use write_plan** to create a structured plan using the markdown template.
4. **Use view_plan** to show the completed plan to the user.
5. **Ask clarifying questions** if the plan is insufficient or ambiguous.

Only after the user confirms the plan should you ask if they want to:
- Execute the plan (disables plan mode, enables full tool access)
- Refine the plan further
```

### Integration with pi-task
The system prompt reminds the agent to use `todo_write` from pi-task for granular task tracking within the plan's steps. The workflow is:

1. Agent analyzes prompt → breaks into topics → calls `write_plan` → calls `view_plan`
2. Agent asks user if plan looks good
3. On confirmation, agent uses pi-task's `todo_write` to create individual tasks for each step
4. Plan mode is disabled and execution begins

## Extension Structure

```
pi-plan/
├── plan.md                       # This document
├── package.json                  # Pi package manifest
├── tsconfig.json
├── README.md
└── extensions/
    └── pi-plan/
        ├── index.ts              # Entry point — registers tools, commands, lifecycle
        ├── tools/
        │   ├── write_plan.ts     # write_plan tool implementation
        │   ├── edit_plan.ts      # edit_plan tool implementation
        │   └── view_plan.ts      # view_plan tool implementation
        ├── template.ts           # Template rendering logic
        ├── plan-store.ts         # Plan file I/O, session path resolution
        ├── plan-mode.ts          # Plan mode toggle, tool filtering, bash allowlist
        ├── lifecycle.ts          # session_start hook, agent prompts
        ├── commands.ts           # /plan, /plan-execute commands
        └── types.ts              # Shared types
```

## Commands

| Command | Description |
|---------|-------------|
| `/plan on` | Enable plan mode (read-only) |
| `/plan off` | Disable plan mode, restore full access |
| `/plan view` | Show the current plan (same as view_plan tool) |
| `/plan new` | Clear current plan and start fresh |
| `/plan help` | Show plan mode instructions |

## Keybinding

| Shortcut | Action |
|----------|--------|
| `Ctrl+Alt+P` | Toggle plan mode |

## Lifecycle Events

### `session_start` (reason: "new")
- Enable plan mode if no plan exists
- Inject workflow reminder into LLM context via `before_agent_start`

### `before_agent_start`
- If plan mode is active: prepend plan-mode reminder message
- If executing a plan: prepend execution context with remaining steps

### `tool_call`
- If plan mode is active and tool is `bash`: check command against allowlist → block if not safe
- If plan mode is active and tool is `edit`/`write`: block with reason

### `agent_settled`
- If plan mode is active and no plan exists: prompt user to create a plan via notification

## Implementation Steps

### Phase 1: Foundation
1. Set up extension directory structure within `extensions/pi-plan/`
2. Implement `plan-store.ts` — path resolution, read/write plan files, template loading
3. Implement `template.ts` — minimal template engine (simple `{{var}}` replacement, no Handlebars dep)
4. Implement `types.ts` — shared interfaces

### Phase 2: Core Tools
5. Implement `tools/write_plan.ts` — parameter schema, template rendering, file writing
6. Implement `tools/edit_plan.ts` — section parsing, modification logic, write-back
7. Implement `tools/view_plan.ts` — file reading, return content

### Phase 3: Plan Mode & Lifecycle
8. Implement `plan-mode.ts` — tool filtering, bash allowlist, state persistence
9. Implement `lifecycle.ts` — session start hook, before_agent_start reminder
10. Implement `commands.ts` — `/plan` command family

### Phase 4: Integration & Polish
11. Wire everything together in `index.ts`
12. Custom TUI rendering for plan display
13. Package as a pi package (`package.json` with `pi.extensions` manifest)
14. Write tests for each tool

## Dependencies

- **Runtime:** `@earendil-works/pi-coding-agent` (peer, provided by pi)
- **Runtime:** `@earendil-works/pi-ai` (StringEnum for parameter schemas, peer)
- **Runtime:** `@earendil-works/pi-tui` (Text component for rendering, peer)
- **Schema:** `typebox` (peer)
- **Integration:** `@karlrobeck/pi-task` (recommended companion, for `todo_write` task tracking)

## Edge Cases & Considerations

### Session Without a Plan
- `view_plan` returns `"No plan found. Use write_plan to create one."`
- `edit_plan` returns `"No plan to edit. Use write_plan first."`
- Plan mode stays active until a plan is confirmed.

### Plan Mode Resume
- On session resume (`session_start` with `reason: "resume"`), the persisted plan mode state is restored.
- If the session had plan mode enabled, it stays enabled after resume.
- If it was executing a plan, execution mode is restored and remaining steps are recalculated from the plan file.

### Plan Corruption
- If the plan file can't be parsed, tools return a clear error with the raw content.
- `write_plan` always overwrites cleanly — it never attempts an incremental update on a corrupted file.

### Concurrent Sessions
- Each session gets its own `.pi/plans/<session-id>/` namespace.
- `write_plan` never touches another session's plan.

### Template Variables
- Simple `{{variable}}` replacement for safety (no eval, no template injection).
- Section-level blocks use `{{#each ...}}...{{/each}}` iteration.
- Escape `{{` as `\{{` in literal template content.
