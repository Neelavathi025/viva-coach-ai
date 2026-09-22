// Shared types between the browser UI and the server functions.

export const FOCUS_AREAS = [
  "Architecture",
  "Implementation choices",
  "Technologies used",
  "Limitations",
  "Testing",
  "Future improvements",
] as const;

export type FocusArea = (typeof FOCUS_AREAS)[number];

export const LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;
export type Level = (typeof LEVELS)[number];

export interface VivaQuestion {
  id: string;
  level: Level;
  focusArea: string;
  question: string;
  answerPoints: string[];
}

export interface Evaluation {
  score: number;
  verdict: string;
  covered: string[];
  missed: string[];
  followUp: string;
}

export interface LoadedDocument {
  fileName: string;
  text: string;
}

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_DOC_CHARS = 60000;
export const MIN_ANSWER_CHARS = 15;
