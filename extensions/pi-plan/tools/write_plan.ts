/**
 * write_plan tool — Creates a new plan file from parameters using the template system.
 *
 * Creates `.pi/plans/<session-id>/` if it doesn't exist, renders the template,
 * writes to `plan.md`, and returns the path and a summary.
 */

import { Type } from "typebox";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { resolvePlanDir, writePlanFile, loadTemplate, planFileExists } from "../plan-store.ts";
import { renderTemplate } from "../template.ts";

export interface WritePlanInput {
  title: string;
  goals: string[];
  topics: { name: string; description: string }[];
  steps?: { description: string }[];
  questions?: string[];
}

/** The extension directory path — set at register time */
let extensionDir = "";

export function registerWritePlan(pi: ExtensionAPI, extDir: string) {
  extensionDir = extDir;

  pi.registerTool({
    name: "write_plan",
    label: "Write Plan",
    description:
      "Create a new plan document for the current session. Renders a markdown template with the " +
      "provided title, goals, topics, steps, and questions. Creates the plan directory if needed.",
    promptSnippet: "Create a structured plan document for the current session",
    promptGuidelines: [
      "Use write_plan to create a plan before starting any implementation work.",
      "Always include goals and topics; steps and questions are optional.",
      "After creating the plan, use view_plan to show it to the user and ask for confirmation.",
    ],
    parameters: Type.Object({
      title: Type.String({ description: "Plan title" }),
      goals: Type.Array(Type.String(), { description: "List of goals" }),
      topics: Type.Array(
        Type.Object({
          name: Type.String({ description: "Topic name" }),
          description: Type.String({ description: "Topic description" }),
        }),
        { description: "Topics breakdown" },
      ),
      steps: Type.Optional(
        Type.Array(
          Type.Object({
            description: Type.String({ description: "Step description" }),
          }),
          { description: "Step-by-step tasks" },
        ),
      ),
      questions: Type.Optional(
        Type.Array(Type.String(), { description: "Open questions or uncertainties" }),
      ),
    }),

    async execute(
      _toolCallId: string,
      params: WritePlanInput,
      _signal: AbortSignal | undefined,
      _onUpdate: unknown,
      ctx: ExtensionContext,
    ): Promise<{ content: { type: "text"; text: string }[]; details: Record<string, unknown> }> {
      const cwd = ctx.cwd;
      const sessionFile = ctx.sessionManager.getSessionFile();
      const planDir = resolvePlanDir(cwd, sessionFile);

      // Check if a plan already exists
      const exists = await planFileExists(planDir);
      if (exists) {
        return {
          content: [{ type: "text" as const, text: `A plan already exists for this session at ${planDir}. Use edit_plan to modify it.` }],
          details: { created: false, path: planDir, reason: "already_exists" },
        };
      }

      // Load and render the template
      const template = await loadTemplate(extensionDir, cwd);
      const rendered = renderTemplate(template, {
        title: params.title,
        goals: params.goals,
        topics: params.topics.map((t) => ({
          name: t.name,
          description: t.description,
        })),
        steps: (params.steps ?? []).map((s) => s.description),
        questions: params.questions ?? [],
      });

      // Write the plan file
      await writePlanFile(planDir, rendered);

      const stepCount = (params.steps ?? []).length;
      return {
        content: [{ type: "text" as const, text: `Plan created: "${params.title}" at ${planDir}\nTopics: ${params.topics.length}, Steps: ${stepCount}` }],
        details: { created: true, path: planDir, title: params.title, topicCount: params.topics.length, stepCount },
      };
    },
  });
}
