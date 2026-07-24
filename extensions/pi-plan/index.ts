/**
 * pi-plan — Pi extension for structured plan management.
 *
 * Provides plan mode (read-only), plan CRUD tools, and session-tagged plan storage.
 *
 * Tools:
 * - write_plan  — Create a new plan document
 * - edit_plan   — Modify sections of an existing plan
 * - view_plan   - Read and display the current plan
 *
 * Commands:
 * - /plan on|off|view|new|help — Plan mode management
 *
 * Lifecycle:
 * - Enables plan mode on new sessions (no plan yet)
 * - Injects workflow reminder to LLM context
 * - Restricts bash and blocks write tools in plan mode
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerWritePlan } from "./tools/write_plan.ts";
import { registerEditPlan } from "./tools/edit_plan.ts";
import { registerViewPlan } from "./tools/view_plan.ts";
import { registerLifecycleHooks } from "./lifecycle.ts";
import { registerCommands } from "./commands.ts";
import { isPlanModeEnabled, enablePlanMode, disablePlanMode } from "./plan-mode.ts";

// Cache for the extension directory path (resolved at load time)
const EXTENSION_DIR = new URL(".", import.meta.url).pathname;

export default function (pi: ExtensionAPI) {
  // ── Register Tools ─────────────────────────────────────────────
  registerWritePlan(pi, EXTENSION_DIR);
  registerEditPlan(pi);
  registerViewPlan(pi);

  // ── Register Lifecycle Hooks ───────────────────────────────────
  registerLifecycleHooks(pi);

  // ── Register Commands ──────────────────────────────────────────
  registerCommands(pi);

  // ── Register Keybinding ────────────────────────────────────────
  pi.registerShortcut("ctrl+alt+p", {
    description: "Toggle plan mode on/off",
    handler: async (ctx) => {
      if (isPlanModeEnabled(ctx)) {
        disablePlanMode(pi, ctx);
        ctx.ui.notify("Plan mode disabled. Full tool access restored.", "info");
      } else {
        enablePlanMode(pi, ctx);
        ctx.ui.notify(
          "Plan mode enabled (read-only). Use /plan off to disable.",
          "info",
        );
      }
    },
  });
}
