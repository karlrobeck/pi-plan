# pi-plan

**Structured plan management for [Pi](https://pi.dev) — plan mode, plan CRUD tools, and session-tagged plan storage.**

pi-plan is a Pi extension that enforces a "think before you act" workflow. When plan mode is active, write tools (`edit`, `write`) are disabled and `bash` is restricted to read-only commands — helping you create a structured plan before making any changes.

## Features

- **Plan Mode** — Read-only mode that blocks destructive operations until you've written a plan
- **Plan CRUD Tools** — `write_plan`, `edit_plan`, `view_plan` for creating and managing plans
- **Session-Tagged Storage** — Plans are stored per session to avoid collisions
- **Markdown Templates** — Plans follow a consistent markdown template, customizable per project
- **Commands** — `/plan on|off|view|new|help` for quick plan mode management
- **Keyboard Shortcut** — `Ctrl+Alt+P` to toggle plan mode on/off

## Installation

### As a Pi Package (Recommended)

```bash
pi install https://github.com/karlrobeck/pi-plan@0.1.0
```

Pi will clone the repository and set up the extension automatically. After installation, restart Pi or reload extensions with `/reload`.

### Local Development

```bash
git clone https://github.com/karlrobeck/pi-plan.git
cd pi-plan
bun install
```

Then load it in Pi:

```bash
pi -e ./extensions/pi-plan/index.ts
```

## Usage

### Plan Mode

When you start a new Pi session, plan mode is automatically enabled. You'll see a reminder to:

1. **Analyze** the user's prompt
2. **Break down** into topics and actionable steps
3. **Use `write_plan`** to create a structured plan
4. **Use `view_plan`** to display the completed plan
5. **Ask clarifying questions** if anything is unclear

Once the plan is confirmed, plan mode can be disabled to begin work.

### Available Tools

| Tool | Description | Available in Plan Mode |
|------|-------------|----------------------|
| `write_plan` | Create a new plan document | ✅ |
| `edit_plan` | Modify sections of an existing plan | ✅ |
| `view_plan` | Read and display the current plan | ✅ |
| `read` | Read file contents | ✅ |
| `bash` | Execute shell commands (read-only in plan mode) | ✅ (restricted) |
| `write` | Create or overwrite files | ❌ (blocked in plan mode) |
| `edit` | Make precise file edits | ❌ (blocked in plan mode) |

### Commands

| Command | Description |
|---------|-------------|
| `/plan on` | Enable plan mode (read-only) |
| `/plan off` | Disable plan mode, restore full access |
| `/plan view` | Show the current plan |
| `/plan new` | Clear current plan and start fresh |
| `/plan help` | Show plan mode instructions |

### Keyboard Shortcut

| Shortcut | Action |
|----------|--------|
| `Ctrl+Alt+P` | Toggle plan mode on/off |

### Plan Structure

All plans follow this template:

```markdown
# Plan: <Title>

## Goals
- Clearly stated objectives

## Topics
1. Topic one — brief description
2. Topic two — brief description

## Steps
- [ ] Step one description
- [ ] Step two description

## Questions / Uncertainties
- What needs clarification?
```

You can customize the template by placing a `plan.md` template in `.pi/plans/template.md`.

## Development

### Prerequisites

- [Bun](https://bun.sh) (for development)
- [Pi](https://pi.dev) (for running the extension)

### Setup

```bash
git clone https://github.com/karlrobeck/pi-plan.git
cd pi-plan
bun install
```

### Project Structure

```
pi-plan/
├── LICENSE
├── README.md
├── package.json
├── tsconfig.json
├── plan.md                       # Architecture & implementation plan
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
        ├── commands.ts           # /plan command family
        └── types.ts              # Shared types
```

### Scripts

| Command | Description |
|---------|-------------|
| `bun install` | Install dependencies |
| `bun run index.ts` | Run the entry point directly |

## Dependencies

- **Runtime:** `@earendil-works/pi-coding-agent`, `@earendil-works/pi-ai`, `@earendil-works/pi-tui` (peer dependencies, provided by Pi)
- **Schema validation:** `typebox` (peer dependency)
- **Languages:** `typescript` (peer dependency)
- **Integration:** Compatible with [`@karlrobeck/pi-task`](https://github.com/karlrobeck/pi-task) for task tracking

## License

MIT © 2026 Karl Roebeck Alferez. See [LICENSE](LICENSE).
