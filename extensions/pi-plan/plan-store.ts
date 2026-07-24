/**
 * Plan file I/O, session path resolution, and template loading.
 *
 * Plans are stored at `.pi/plans/<session-id>/plan.md` where session-id
 * is derived from the session file's basename (without extension).
 *
 * The default template lives at `templates/plan.md` in the extension directory.
 * A custom template can override it at `.pi/plans/template.md` in the project root.
 */

import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { dirname, basename, extname, join, resolve } from "node:path";
import type { Plan } from "./types.ts";

/**
 * Resolve the session plan directory based on the session file path.
 * Returns the path to `.pi/plans/<session-id>/`.
 */
export function resolvePlanDir(cwd: string, sessionFile: string | undefined): string {
  if (!sessionFile) {
    // Fallback: use a default directory if no session file is available
    return join(cwd, ".pi", "plans", "default");
  }
  const sessionId = basename(sessionFile, extname(sessionFile));
  return join(cwd, ".pi", "plans", sessionId);
}

/**
 * Resolve the full path to the plan file for the current session.
 */
export function resolvePlanPath(planDir: string): string {
  return join(planDir, "plan.md");
}

/**
 * Resolve the default template path (bundled in the extension).
 */
export function resolveDefaultTemplatePath(extensionDir: string): string {
  return join(extensionDir, "templates", "plan.md");
}

/**
 * Resolve the custom template path in the project's .pi directory.
 */
export function resolveCustomTemplatePath(cwd: string): string {
  return join(cwd, ".pi", "plans", "template.md");
}

/**
 * Check if a file exists.
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load the plan template content.
 * Prefers the custom template at `.pi/plans/template.md` over the default bundled one.
 */
export async function loadTemplate(
  extensionDir: string,
  cwd: string,
): Promise<string> {
  const customPath = resolveCustomTemplatePath(cwd);
  if (await fileExists(customPath)) {
    return await readFile(customPath, "utf-8");
  }
  const defaultPath = resolveDefaultTemplatePath(extensionDir);
  return await readFile(defaultPath, "utf-8");
}

/**
 * Read and parse an existing plan file, returning the raw text.
 * Throws if the file does not exist.
 */
export async function readPlanFile(planDir: string): Promise<string> {
  const planPath = resolvePlanPath(planDir);
  await access(planPath);
  return await readFile(planPath, "utf-8");
}

/**
 * Write (or overwrite) a plan file. Creates the directory if needed.
 */
export async function writePlanFile(planDir: string, content: string): Promise<void> {
  const planPath = resolvePlanPath(planDir);
  await mkdir(dirname(planPath), { recursive: true });
  await writeFile(planPath, content, "utf-8");
}

/**
 * Check if a plan file exists.
 */
export async function planFileExists(planDir: string): Promise<boolean> {
  return fileExists(resolvePlanPath(planDir));
}

/**
 * Parse a plan markdown file into a Plan structure.
 * Returns the raw sections for editing.
 */
export function parsePlanSections(content: string): Plan {
  const lines = content.split("\n");
  const plan: Plan = {
    title: "",
    goals: [],
    topics: [],
    steps: [],
    questions: [],
  };

  let currentSection: keyof Plan | null = null;

  for (const line of lines) {
    const titleMatch = line.match(/^# Plan:\s+(.+)$/);
    if (titleMatch) {
      plan.title = titleMatch[1] ?? "";
      continue;
    }

    const sectionMatch = line.match(/^##\s+(.+)$/);
    if (sectionMatch) {
      const sectionName = sectionMatch[1]?.toLowerCase() ?? "";
      switch (sectionName) {
        case "goals":
          currentSection = "goals";
          break;
        case "topics":
          currentSection = "topics";
          break;
        case "steps":
          currentSection = "steps";
          break;
        case "questions / uncertainties":
        case "questions":
          currentSection = "questions";
          break;
        default:
          currentSection = null;
      }
      continue;
    }

    if (!currentSection) continue;

    const bulletMatch = line.match(/^\s*[-*]\s+(.+)$/);
    const numberedMatch = line.match(/^\s*\d+\.\s+(.+)$/);
    const itemMatch = bulletMatch?.[1] ?? numberedMatch?.[1];

    if (!itemMatch) continue;

    switch (currentSection) {
      case "goals":
        plan.goals.push(itemMatch);
        break;
      case "topics": {
        // Parse "Name — Description" format
        const topicMatch = itemMatch.match(/^(.+?)\s*—\s*(.+)$/);
        if (topicMatch) {
          plan.topics.push({
            name: topicMatch[1]?.trim() ?? itemMatch,
            description: topicMatch[2]?.trim() ?? "",
          });
        } else {
          plan.topics.push({ name: itemMatch, description: "" });
        }
        break;
      }
      case "steps":
        // Remove leading checkbox marker like "- [ ] " or "- [x] "
        const stepText = itemMatch.replace(/^\[.\]\s*/, "");
        plan.steps.push(stepText);
        break;
      case "questions":
        plan.questions.push(itemMatch);
        break;
    }
  }

  return plan;
}

/**
 * Serialize a Plan structure back to markdown.
 */
export function serializePlan(plan: Plan): string {
  const lines: string[] = [];

  lines.push(`# Plan: ${plan.title}`);
  lines.push("");

  // Goals
  lines.push("## Goals");
  for (const goal of plan.goals) {
    lines.push(`- ${goal}`);
  }
  lines.push("");

  // Topics
  lines.push("## Topics");
  plan.topics.forEach((topic, i) => {
    lines.push(`${i + 1}. ${topic.name} — ${topic.description}`);
  });
  lines.push("");

  // Steps
  if (plan.steps.length > 0) {
    lines.push("## Steps");
    for (const step of plan.steps) {
      lines.push(`- [ ] ${step}`);
    }
    lines.push("");
  }

  // Questions
  if (plan.questions.length > 0) {
    lines.push("## Questions / Uncertainties");
    for (const q of plan.questions) {
      lines.push(`- ${q}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
