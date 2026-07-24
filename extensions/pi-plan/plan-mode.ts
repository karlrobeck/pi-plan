/**
 * Plan mode state management, tool filtering, and bash allowlist.
 *
 * When plan mode is active:
 * - Built-in write tools (`edit`, `write`) are disabled via `pi.setActiveTools()`
 * - `bash` commands are checked against a read-only allowlist
 * - Plan mode state is persisted via `pi.appendEntry()` so it survives session resume
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { PlanModeState } from "./types.ts";

/** Read-only commands allowed in plan mode */
const READONLY_COMMANDS = new Set([
  "ls",
  "cat",
  "head",
  "tail",
  "less",
  "more",
  "grep",
  "rg",
  "ag",
  "ack",
  "find",
  "fd",
  "locate",
  "stat",
  "wc",
  "df",
  "du",
  "echo",
  "printf",
  "which",
  "type",
  "command",
  "pwd",
  "realpath",
  "readlink",
  "basename",
  "dirname",
  "date",
  "env",
  "printenv",
  "bat",
  "tree",
]);

/** Tools that remain active in plan mode */
const PLAN_MODE_TOOLS = new Set([
  "read",
  "bash",
  "grep",
  "find",
  "ls",
  "write_plan",
  "edit_plan",
  "view_plan",
]);

/** Plan mode entry type for session persistence */
const PLAN_MODE_ENTRY_TYPE = "pi-plan:plan-mode";

/**
 * Check if a bash command is allowed in plan mode.
 * Allows read-only commands and piped combinations of them.
 */
export function isBashAllowed(command: string): boolean {
  const trimmed = command.trim();

  // Empty command
  if (!trimmed) return true;

  // Split by pipes to check piped combinations
  const segments = trimmed.split(/\s*\|\s*/);

  // Each segment's first word must be a read-only command
  for (const segment of segments) {
    const firstWord = segment.split(/\s+/)[0];
    if (!firstWord) continue;

    // Check if this is a read-only command
    if (!READONLY_COMMANDS.has(firstWord)) {
      return false;
    }
  }

  // Ensure no write commands are hidden in the pipeline
  // Check for common dangerous patterns
  const lower = trimmed.toLowerCase();
  const bannedPatterns = [
    "rm ", "mv ", "cp ", "mkdi", "touch", "nano", "vim", "sed -i",
    "> ", ">> ", "|>",
  ];

  for (const pattern of bannedPatterns) {
    if (lower.includes(pattern)) return false;
  }

  return true;
}

/**
 * Get the set of tool names that should be active in plan mode.
 * This removes `edit` and `write`, keeping all other tools.
 */
export function getPlanModeActiveTools(currentTools: string[]): string[] {
  return currentTools.filter((name) => PLAN_MODE_TOOLS.has(name));
}

/**
 * Enable plan mode.
 * - Filters active tools to only allow read + plan tools
 * - Persists the state
 */
export function enablePlanMode(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): void {
  const currentTools = pi.getActiveTools();
  const planTools = getPlanModeActiveTools(currentTools);
  pi.setActiveTools(planTools);

  // Persist state
  pi.appendEntry(PLAN_MODE_ENTRY_TYPE, { enabled: true });
}

/**
 * Disable plan mode, restoring full tool access.
 * - Restores all tools that were active before plan mode
 * - Clears the persisted state
 */
export function disablePlanMode(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): void {
  // Get all available tools and restore them
  const allTools = pi.getAllTools().map((t) => t.name);
  pi.setActiveTools(allTools);

  // Clear persisted state by not appending — or append disabled state
  pi.appendEntry(PLAN_MODE_ENTRY_TYPE, { enabled: false });
}

/**
 * Check if plan mode is enabled by examining persisted session entries.
 */
export function isPlanModeEnabled(ctx: ExtensionContext): boolean {
  for (const entry of ctx.sessionManager.getEntries()) {
    if (
      entry.type === "custom" &&
      entry.customType === PLAN_MODE_ENTRY_TYPE
    ) {
      const data = entry.data as PlanModeState | undefined;
      if (data?.enabled === true) return true;
    }
  }
  return false;
}

/**
 * Reconstruct plan mode state from session entries.
 * Call this in `session_start` to restore plan mode on session resume.
 */
export function restorePlanMode(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): boolean {
  if (isPlanModeEnabled(ctx)) {
    const currentTools = pi.getActiveTools();
    const planTools = getPlanModeActiveTools(currentTools);
    pi.setActiveTools(planTools);
    return true;
  }
  return false;
}
