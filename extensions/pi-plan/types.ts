/**
 * Shared types for the pi-plan extension.
 */

/** A single topic entry in a plan */
export interface PlanTopic {
  name: string;
  description: string;
}

/** A single step in a plan */
export interface PlanStep {
  description: string;
}

/** The full plan data structure */
export interface Plan {
  title: string;
  goals: string[];
  topics: PlanTopic[];
  steps: string[];
  questions: string[];
}

/** Sections that can be edited via edit_plan */
export type PlanSection = "goals" | "topics" | "steps" | "questions" | "title";

/** Actions that can be performed on a section */
export type EditAction = "set" | "add" | "remove" | "reorder";

/** Parameters for write_plan tool */
export interface WritePlanParams {
  title: string;
  goals: string[];
  topics: { name: string; description: string }[];
  steps?: { description: string }[];
  questions?: string[];
}

/** Parameters for edit_plan tool */
export interface EditPlanParams {
  section: PlanSection;
  action: EditAction;
  value: string | string[] | { name: string; description: string };
  index?: number;
}

/** Plan mode state persisted across sessions */
export interface PlanModeState {
  enabled: boolean;
}
