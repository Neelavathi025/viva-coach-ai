import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  FOCUS_AREAS,
  LEVELS,
  MAX_DOC_CHARS,
  MIN_ANSWER_CHARS,
  type Evaluation,
  type Level,
  type VivaQuestion,
} from "./viva-types";

const focusEnum = z.enum(FOCUS_AREAS);

const GenerateInput = z.object({
  documentText: z.string().min(50, "The project documentation is too short to build a viva from."),
  fileName: z.string().max(200).optional(),
  perLevel: z.number().int().min(3).max(6),
  focusAreas: z.array(focusEnum).min(1, "Select at least one focus area."),
});

const EvaluateInput = z.object({
  documentText: z.string().min(50),
  question: z.string().min(1),
  level: z.enum(LEVELS),
  focusArea: z.string().min(1),
  answerPoints: z.array(z.string()),
  answer: z.string().min(MIN_ANSWER_CHARS, "Please provide a more complete answer."),
});

const rawQuestion = z.object({
  level: z.string(),
  focusArea: z.string(),
  question: z.string().min(5),
  answerPoints: z.array(z.string()).default([]),
});

function normaliseLevel(value: string): Level | null {
  const v = value.trim().toLowerCase();
  if (v.startsWith("beg")) return "Beginner";
  if (v.startsWith("int")) return "Intermediate";
  if (v.startsWith("adv")) return "Advanced";
  return null;
}

const SYSTEM = `You are a strict but fair university viva examiner for engineering final-year and mini projects.
You only ask questions grounded in the student's own project documentation.
You never invent technologies, modules or results that are not mentioned in the documentation.
If testing, limitations or future improvements are missing from the documentation, you may ask questions that probe those gaps directly.
You always reply with valid JSON only - no prose, no markdown fences.`;

function buildGenerationPrompt(
  doc: string,
  perLevel: number,
  focusAreas: string[],
  missingLevels?: { level: Level; count: number }[],
) {
  const target = missingLevels
    ? missingLevels.map((m) => `${m.count} ${m.level}`).join(", ")
    : `${perLevel} Beginner, ${perLevel} Intermediate and ${perLevel} Advanced`;

  return `PROJECT DOCUMENTATION (verbatim, may be truncated):
"""
${doc}
"""

TASK
Generate exactly ${target} viva questions about THIS project.

FOCUS AREAS to cover (spread questions across them): ${focusAreas.join(", ")}.

DIFFICULTY RULES
- Beginner: what the project does, its purpose, basic terminology, main technologies, main features, high-level architecture. Keep them straightforward.
- Intermediate: how the system works, data flow, architecture details, implementation, why a technology was chosen over an alternative, testing, integration.
- Advanced: design decisions, trade-offs, limitations, failure cases, security, scalability, performance, reliability, future improvements. These must require reasoning, not recall.

For every question also give 2-4 short "answerPoints" describing what a strong answer must contain.

Return JSON in exactly this shape and nothing else:
{"questions":[{"level":"Beginner","focusArea":"Architecture","question":"...","answerPoints":["...","..."]}]}
"level" must be exactly "Beginner", "Intermediate" or "Advanced".
"focusArea" must be one of the focus areas listed above.`;
}

export const generateViva = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => GenerateInput.parse(input))
  .handler(async ({ data }): Promise<{ questions: VivaQuestion[] }> => {
    const { askGemini, extractJson, AiError } = await import("./gemini.server");
    const doc = data.documentText.slice(0, MAX_DOC_CHARS);

    const collected: Record<Level, VivaQuestion[]> = {
      Beginner: [],
      Intermediate: [],
      Advanced: [],
    };

    const run = async (missing?: { level: Level; count: number }[]) => {
      const raw = await askGemini(
        SYSTEM,
        buildGenerationPrompt(doc, data.perLevel, data.focusAreas, missing),
      );
      const parsed = extractJson<{ questions?: unknown }>(raw);
      const list = z.array(rawQuestion).safeParse(parsed.questions);
      if (!list.success) {
        throw new AiError(
          "bad_json",
          "The AI response did not contain a usable set of questions. Please try again.",
        );
      }
      for (const q of list.data) {
        const level = normaliseLevel(q.level);
        if (!level) continue;
        if (collected[level].length >= data.perLevel) continue;
        collected[level].push({
          id: `${level}-${collected[level].length}-${Math.random().toString(36).slice(2, 8)}`,
          level,
          focusArea: q.focusArea.slice(0, 60),
          question: q.question.trim(),
          answerPoints: q.answerPoints.slice(0, 4).map((p) => p.trim()),
        });
      }
    };

    await run();

    // Strict validation: retry once for whatever the model under-delivered.
    const missing = LEVELS.map((level) => ({
      level,
      count: data.perLevel - collected[level].length,
    })).filter((m) => m.count > 0);

    if (missing.length > 0) await run(missing);

    const stillMissing = LEVELS.filter((l) => collected[l].length !== data.perLevel);
    if (stillMissing.length > 0) {
      throw new AiError(
        "incomplete",
        `The AI did not generate the required ${data.perLevel} questions for every level (${stillMissing.join(", ")}). Please try generating again.`,
      );
    }

    return {
      questions: [...collected.Beginner, ...collected.Intermediate, ...collected.Advanced],
    };
  });

export const evaluateAnswer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => EvaluateInput.parse(input))
  .handler(async ({ data }): Promise<Evaluation> => {
    const { askGemini, extractJson } = await import("./gemini.server");
    const doc = data.documentText.slice(0, MAX_DOC_CHARS);

    const prompt = `PROJECT DOCUMENTATION (verbatim, may be truncated):
"""
${doc}
"""

VIVA QUESTION (${data.level} / ${data.focusArea}):
${data.question}

EXPECTED ANSWER POINTS:
${data.answerPoints.map((p) => `- ${p}`).join("\n") || "- (none provided)"}

STUDENT ANSWER:
"""
${data.answer.slice(0, 8000)}
"""

EVALUATION RULES
- Compare the answer against the project documentation.
- Reward technically correct explanations, even if phrased differently.
- Do NOT penalise correct extra information just because the report does not mention it.
- Call out any statement that contradicts the documentation.
- Do NOT give a high score merely because keywords match.
- Feedback must be useful to a college student: say what was covered and what was missing.
- Finish with one examiner-style follow-up question based on what the student actually said.

Return JSON only:
{"score":0,"verdict":"...","covered":["..."],"missed":["..."],"followUp":"..."}
"score" is an integer from 0 to 10.`;

    const raw = await askGemini(SYSTEM, prompt);
    const parsed = extractJson<Record<string, unknown>>(raw);

    const shape = z.object({
      score: z.coerce.number(),
      verdict: z.string().default(""),
      covered: z.array(z.string()).default([]),
      missed: z.array(z.string()).default([]),
      followUp: z.string().default(""),
    });
    const result = shape.safeParse(parsed);
    if (!result.success) {
      const { AiError } = await import("./gemini.server");
      throw new AiError(
        "bad_json",
        "The AI feedback could not be read. Please check this answer again.",
      );
    }

    return {
      score: Math.max(0, Math.min(10, Math.round(result.data.score))),
      verdict: result.data.verdict,
      covered: result.data.covered.slice(0, 6),
      missed: result.data.missed.slice(0, 6),
      followUp: result.data.followUp,
    };
  });
