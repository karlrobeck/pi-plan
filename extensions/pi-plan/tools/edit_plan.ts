/**
 * edit_plan tool — Modifies sections of the existing plan at `.pi/plans/<session-id>/plan.md`.
 *
 * Supports: set, add, remove, reorder operations on goals, topics, steps, questions, or title.
 */

import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  resolvePlanDir,
  readPlanFile,
  writePlanFile,
  planFileExists,
  parsePlanSections,
  serializePlan,
} from "../plan-store.ts";
import type { Plan, PlanSection, EditAction } from "../types.ts";

interface EditPlanInput {
  section: PlanSection;
  action: EditAction;
  value: string | string[] | { name: string; description: string };
  index?: number;
}

export function registerEditPlan(pi: ExtensionAPI) {
  pi.registerTool({
    name: "edit_plan",
    label: "Edit Plan",
    description:
      "Modify sections of the existing plan for the current session. Supports set, add, remove, " +
      "and reorder actions on goals, topics, steps, questions, or title.",
    promptSnippet: "Modify the current session's plan document",
    promptGuidelines: [
      "Use edit_plan to modify an existing plan created with write_plan.",
      "Use section='title' with action='set' and value as a string to change the title.",
      "For topics, value is an object with 'name' and 'description' properties.",
      "For other sections, value is a string (single item) or array of strings (multiple items).",
    ],
    parameters: Type.Object({
      section: StringEnum(["goals", "topics", "steps", "questions", "title"] as const),
      action: StringEnum(["set", "add", "remove", "reorder"] as const),
      value: Type.Union([
        Type.String(),
        Type.Array(Type.String()),
        Type.Object({
          name: Type.String(),
          description: Type.String(),
        }),
      ]),
      index: Type.Optional(
        Type.Integer({ description: "Index for single-item operations within an array" }),
      ),
    }),

    async execute(
      _toolCallId: string,
      params: EditPlanInput,
      _signal: AbortSignal | undefined,
      _onUpdate: unknown,
      ctx: ExtensionContext,
    ): Promise<{ content: { type: "text"; text: string }[]; details: Record<string, unknown> }> {
      const cwd = ctx.cwd;
      const sessionFile = ctx.sessionManager.getSessionFile();
      const planDir = resolvePlanDir(cwd, sessionFile);

      // Check if a plan exists
      if (!(await planFileExists(planDir))) {
        return {
          content: [{ type: "text" as const, text: "No plan to edit. Use write_plan first." }],
          details: { error: "no_plan" },
        };
      }

      // Read and parse the existing plan
      const content = await readPlanFile(planDir);
      const plan = parsePlanSections(content);

      // Apply the edit
      applyEdit(plan, params);

      // Serialize and write back
      const updated = serializePlan(plan);
      await writePlanFile(planDir, updated);

      return {
        content: [
          { type: "text" as const, text: `Updated plan section "${params.section}" with action "${params.action}".\nPlan path: ${planDir}/plan.md` },
        ],
        details: { section: params.section, action: params.action },
      };
    },
  });
}

function applyEdit(plan: Plan, params: EditPlanInput): void {
  const { section, action, value, index } = params;

  switch (section) {
    case "title": {
      if (action === "set" && typeof value === "string") {
        plan.title = value;
      }
      break;
    }

    case "goals": {
      editStringArray(plan.goals, action, value, index);
      break;
    }

    case "topics": {
      editTopics(plan.topics, action, value, index);
      break;
    }

    case "steps": {
      editStringArray(plan.steps, action, value, index);
      break;
    }

    case "questions": {
      editStringArray(plan.questions, action, value, index);
      break;
    }
  }
}

function editStringArray(
  arr: string[],
  action: EditAction,
  value: string | string[] | { name: string; description: string },
  index?: number,
): void {
  switch (action) {
    case "set": {
      if (typeof value === "string") {
        // Set specific index, or replace entire array
        if (index !== undefined && index >= 0 && index < arr.length) {
          arr[index] = value;
        } else {
          arr.length = 0;
          arr.push(value);
        }
      } else if (Array.isArray(value)) {
        arr.length = 0;
        arr.push(...value);
      }
      break;
    }
    case "add": {
      if (typeof value === "string") {
        if (index !== undefined && index >= 0 && index <= arr.length) {
          arr.splice(index, 0, value);
        } else {
          arr.push(value);
        }
      } else if (Array.isArray(value)) {
        arr.push(...value);
      }
      break;
    }
    case "remove": {
      if (index !== undefined && index >= 0 && index < arr.length) {
        arr.splice(index, 1);
      } else if (typeof value === "string") {
        const idx = arr.indexOf(value);
        if (idx !== -1) arr.splice(idx, 1);
      }
      break;
    }
    case "reorder": {
      if (index !== undefined && index >= 0 && index < arr.length) {
        const item = arr.splice(index, 1);
        const newIndex = typeof value === "string" ? parseInt(value, 10) : -1;
        if (newIndex >= 0 && newIndex <= arr.length) {
          arr.splice(newIndex, 0, item[0] ?? "");
        } else {
          arr.splice(index, 0, item[0] ?? "");
        }
      }
      break;
    }
  }
}

function editTopics(
  topics: { name: string; description: string }[],
  action: EditAction,
  value: string | string[] | { name: string; description: string },
  index?: number,
): void {
  switch (action) {
    case "set": {
      if (typeof value === "object" && !Array.isArray(value)) {
        if (index !== undefined && index >= 0 && index < topics.length) {
          topics[index] = { ...value };
        } else {
          topics.length = 0;
          topics.push({ ...value });
        }
      } else if (Array.isArray(value)) {
        topics.length = 0;
        for (const v of value) {
          const existing = topics.find((t) => t.name === v);
          topics.push(existing ?? { name: v, description: "" });
        }
      }
      break;
    }
    case "add": {
      if (typeof value === "object" && !Array.isArray(value)) {
        if (index !== undefined && index >= 0 && index <= topics.length) {
          topics.splice(index, 0, { ...value });
        } else {
          topics.push({ ...value });
        }
      }
      break;
    }
    case "remove": {
      if (index !== undefined && index >= 0 && index < topics.length) {
        topics.splice(index, 1);
      }
      break;
    }
    case "reorder": {
      if (index !== undefined && index >= 0 && index < topics.length) {
        const item = topics.splice(index, 1);
        const newIndex = typeof value === "string" ? parseInt(value, 10) : -1;
        if (newIndex >= 0 && newIndex <= topics.length) {
          topics.splice(newIndex, 0, item[0] ?? { name: "", description: "" });
        } else {
          topics.splice(index, 0, item[0] ?? { name: "", description: "" });
        }
      }
      break;
    }
  }
}
