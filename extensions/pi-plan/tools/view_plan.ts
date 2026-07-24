/**
 * view_plan tool — Reads and returns the current plan for the session.
 *
 * Looks for `.pi/plans/<session-id>/plan.md`. If found, returns the full content.
 * If not found, returns a clear message that no plan exists yet.
 */

import { Type } from "typebox";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { resolvePlanDir, readPlanFile, planFileExists } from "../plan-store.ts";

export function registerViewPlan(pi: ExtensionAPI) {
  pi.registerTool({
    name: "view_plan",
    label: "View Plan",
    description:
      "Read and return the current plan for the session. If no plan exists, " +
      "returns a message indicating that.",
    promptSnippet: "View the current session's plan document",
    promptGuidelines: [
      "Use view_plan to show the current plan to the user.",
      "Call view_plan after write_plan to display the completed plan.",
    ],
    parameters: Type.Object({}),

    async execute(
      _toolCallId: string,
      _params: Record<string, never>,
      _signal: AbortSignal | undefined,
      _onUpdate: unknown,
      ctx: ExtensionContext,
    ): Promise<{ content: { type: "text"; text: string }[]; details: Record<string, unknown> }> {
      const cwd = ctx.cwd;
      const sessionFile = ctx.sessionManager.getSessionFile();
      const planDir = resolvePlanDir(cwd, sessionFile);

      if (!(await planFileExists(planDir))) {
        return {
          content: [{ type: "text" as const, text: "No plan found. Use write_plan to create one." }],
          details: { exists: false },
        };
      }

      const content = await readPlanFile(planDir);

      return {
        content: [{ type: "text" as const, text: content }],
        details: {
          exists: true,
          path: planDir,
          title: content.split("\n")[0]?.replace("# Plan: ", "") ?? "",
        },
      };
    },
  });
}
