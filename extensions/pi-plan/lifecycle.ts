/**
 * Lifecycle hooks for the pi-plan extension.
 *
 * Handles:
 * - `session_start` — enable plan mode on new sessions, restore on resume
 * - `before_agent_start` — inject workflow reminder when plan mode is active
 * - `tool_call` — intercept bash/tool calls in plan mode
 * - `agent_settled` — prompt user to create a plan if none exists
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  isPlanModeEnabled,
  enablePlanMode,
  restorePlanMode,
  isBashAllowed,
} from "./plan-mode.ts";
import { resolvePlanDir, planFileExists } from "./plan-store.ts";

/** The plan-mode workflow reminder message (injected before agent start) */
const PLAN_MODE_REMINDER = `[PLAN MODE ACTIVE — New Session Workflow]

You are in plan mode (read-only). You must follow these steps before making any changes:

1. **Analyze** the user's prompt — understand what they need.
2. **Break down** the prompt into topics and actionable steps.
3. **Use write_plan** to create a structured plan using the markdown template.
4. **Use view_plan** to show the completed plan to the user.
5. **Ask clarifying questions** if the plan is insufficient or ambiguous.

Only after the user confirms the plan should you ask if they want to:
- Execute the plan (disables plan mode, enables full tool access)
- Refine the plan further`;

export function registerLifecycleHooks(pi: ExtensionAPI) {
  // ── session_start ──────────────────────────────────────────────
  pi.on("session_start", async (event, ctx) => {
    switch (event.reason) {
      case "new": {
        // Check if a plan already exists for this session
        const sessionFile = ctx.sessionManager.getSessionFile();
        const planDir = resolvePlanDir(ctx.cwd, sessionFile);
        const exists = await planFileExists(planDir);

        if (!exists) {
          // No plan exists → enable plan mode automatically
          enablePlanMode(pi, ctx);
        }
        break;
      }
      case "resume":
      case "fork": {
        // Restore plan mode from persisted state
        restorePlanMode(pi, ctx);
        break;
      }
    }
  });

  // ── before_agent_start ─────────────────────────────────────────
  pi.on("before_agent_start", async (_event, ctx) => {
    if (isPlanModeEnabled(ctx)) {
      return {
        message: {
          customType: "pi-plan:reminder",
          content: PLAN_MODE_REMINDER,
          display: true,
        },
      };
    }
  });

  // ── tool_call ──────────────────────────────────────────────────
  pi.on("tool_call", async (event, ctx) => {
    if (!isPlanModeEnabled(ctx)) return;

    // Block edit and write tools
    if (event.toolName === "edit" || event.toolName === "write") {
      return {
        block: true,
        reason: `Plan mode is active — "${event.toolName}" is disabled. Use write_plan, edit_plan, and view_plan to work with plans.`,
      };
    }

    // Restrict bash commands to read-only allowlist
    if (event.toolName === "bash") {
      const input = event.input as { command: string; timeout?: number } | undefined;
      if (!input) return;

      if (!isBashAllowed(input.command)) {
        return {
          block: true,
          reason:
            "Plan mode is active — this bash command is not allowed. " +
            "Only read-only commands (ls, cat, grep, find, head, tail, etc.) are permitted. " +
            "Write commands (rm, mv, cp, mkdir, touch, nano, vim, sed -i, etc.) are blocked.",
        };
      }
    }
  });

  // ── agent_settled ──────────────────────────────────────────────
  pi.on("agent_settled", async (_event, ctx) => {
    if (!isPlanModeEnabled(ctx)) return;

    const sessionFile = ctx.sessionManager.getSessionFile();
    const planDir = resolvePlanDir(ctx.cwd, sessionFile);
    const exists = await planFileExists(planDir);

    if (!exists && ctx.hasUI) {
      ctx.ui.notify(
        "No plan exists yet. Use write_plan to create a structured plan.",
        "info",
      );
    }
  });
}
