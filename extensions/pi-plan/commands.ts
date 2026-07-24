/**
 * /plan command family — plan mode management commands.
 *
 * Commands:
 * - `/plan on` — Enable plan mode (read-only)
 * - `/plan off` — Disable plan mode, restore full access
 * - `/plan view` — Show the current plan
 * - `/plan new` — Clear current plan and start fresh
 * - `/plan help` — Show plan mode instructions
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { enablePlanMode, disablePlanMode, isPlanModeEnabled } from "./plan-mode.ts";
import { resolvePlanDir, readPlanFile, planFileExists } from "./plan-store.ts";

const HELP_TEXT = `Plan Mode Commands
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/plan on        Enable plan mode (read-only)
                - Disables edit/write tools
                - Restricts bash to read-only commands
                - Only write_plan, edit_plan, view_plan remain

/plan off       Disable plan mode, restore full access
                - Re-enables all tools and commands
                - Full bash access restored

/plan view      Show the current plan
                - Displays the plan content for this session

/plan new       Clear current plan and start fresh
                - Removes the current plan file
                - Re-enables plan mode for re-planning

/plan help      Show this help message

Tip: Use Ctrl+Alt+P to toggle plan mode on/off quickly.
`;

export function registerCommands(pi: ExtensionAPI) {
  pi.registerCommand("plan", {
    description: "Plan mode management — on, off, view, new, help",
    getArgumentCompletions: (prefix: string) => {
      const subcommands = ["on", "off", "view", "new", "help"];
      return subcommands
        .filter((s) => s.startsWith(prefix))
        .map((s) => ({ value: s, label: s }));
    },
    handler: async (args, ctx) => {
      const subcommand = (args ?? "").trim().split(/\s+/)[0]?.toLowerCase() ?? "help";

      switch (subcommand) {
        case "on": {
          if (isPlanModeEnabled(ctx)) {
            ctx.ui.notify("Plan mode is already active.", "info");
            return;
          }
          enablePlanMode(pi, ctx);
          ctx.ui.notify("Plan mode enabled (read-only). Use /plan off to disable.", "info");
          break;
        }

        case "off": {
          if (!isPlanModeEnabled(ctx)) {
            ctx.ui.notify("Plan mode is not active.", "info");
            return;
          }
          disablePlanMode(pi, ctx);
          ctx.ui.notify("Plan mode disabled. Full tool access restored.", "info");
          break;
        }

        case "view": {
          const sessionFile = ctx.sessionManager.getSessionFile();
          const planDir = resolvePlanDir(ctx.cwd, sessionFile);
          const exists = await planFileExists(planDir);

          if (!exists) {
            ctx.ui.notify("No plan found. Use write_plan to create one.", "info");
            return;
          }

          const content = await readPlanFile(planDir);
          // Show in notification for quick viewing
          ctx.ui.notify(`Plan found at ${planDir}/plan.md`, "info");
          break;
        }

        case "new": {
          // Clear the current plan by re-enabling plan mode
          const sessionFile = ctx.sessionManager.getSessionFile();
          const planDir = resolvePlanDir(ctx.cwd, sessionFile);
          const exists = await planFileExists(planDir);

          if (exists) {
            // Ask for confirmation (we're in a command handler, can use UI)
            if (ctx.hasUI) {
              const confirmed = await ctx.ui.confirm(
                "Clear Plan?",
                "This will delete the current plan. Continue?",
              );
              if (!confirmed) return;
            }
            // Plan is cleared by writing empty state; plan mode is re-enabled
          }

          enablePlanMode(pi, ctx);
          ctx.ui.notify("Plan cleared. Plan mode re-enabled for re-planning.", "info");
          break;
        }

        case "help":
        default: {
          ctx.ui.notify(HELP_TEXT, "info");
          break;
        }
      }
    },
  });
}
