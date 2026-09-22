import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Copy, Download, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { DocumentInput } from "@/components/viva/DocumentInput";
import { QuestionCard } from "@/components/viva/QuestionCard";
import { evaluateAnswer, generateViva } from "@/lib/viva.functions";
import {
  FOCUS_AREAS,
  LEVELS,
  type Evaluation,
  type FocusArea,
  type LoadedDocument,
  type VivaQuestion,
} from "@/lib/viva-types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Viva Simulator — Practice your project viva with AI" },
      {
        name: "description",
        content:
          "Upload your project documentation and practice progressively challenging viva questions with AI-generated scoring, feedback and follow-up questions.",
      },
      { property: "og:title", content: "Viva Simulator — Practice your project viva with AI" },
      {
        property: "og:description",
        content:
          "Beginner, intermediate and advanced viva questions generated from your own project report, with AI feedback on your answers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VivaSimulator,
});

function errorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : "";
  if (!raw) return "Something went wrong. Please try again.";
  if (/fetch|network|Failed to/i.test(raw))
    return "Network problem — could not reach the server. Please check your connection and retry.";
  // Server functions serialise validation errors; keep them readable.
  const match = raw.match(/"message"\s*:\s*"([^"]+)"/);
  return (match?.[1] ?? raw).slice(0, 300);
}

function VivaSimulator() {
  const [doc, setDoc] = useState<LoadedDocument | null>(null);
  const [perLevel, setPerLevel] = useState(5);
  const [focus, setFocus] = useState<FocusArea[]>([...FOCUS_AREAS]);
  const [questions, setQuestions] = useState<VivaQuestion[]>([]);
  const [evaluations, setEvaluations] = useState<Record<string, Evaluation>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = useServerFn(generateViva);
  const evaluate = useServerFn(evaluateAnswer);

  const answered = Object.keys(evaluations).length;
  const average = useMemo(() => {
    const scores = Object.values(evaluations).map((e) => e.score);
    if (!scores.length) return null;
    return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
  }, [evaluations]);

  function toggleFocus(area: FocusArea) {
    setFocus((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area],
    );
  }

  async function onGenerate() {
    setError(null);
    if (!doc) {
      setError("Please upload or paste your project documentation first.");
      return;
    }
    if (focus.length === 0) {
      setError("Please select at least one focus area.");
      return;
    }
    setLoading(true);
    try {
      const result = await generate({
        data: { documentText: doc.text, fileName: doc.fileName, perLevel, focusAreas: focus },
      });
      setQuestions(result.questions);
      setEvaluations({});
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function onCheck(q: VivaQuestion, answer: string) {
    if (!doc) throw new Error("Your project documentation is no longer loaded.");
    try {
      const result = await evaluate({
        data: {
          documentText: doc.text,
          question: q.question,
          level: q.level,
          focusArea: q.focusArea,
          answerPoints: q.answerPoints,
          answer,
        },
      });
      setEvaluations((prev) => ({ ...prev, [q.id]: result }));
    } catch (e) {
      throw new Error(errorMessage(e));
    }
  }

  function questionsAsText() {
    const lines = ["Project Viva Questions", "======================", ""];
    if (doc) lines.push(`Source: ${doc.fileName}`, "");
    lines.push(`Focus areas: ${focus.join(", ")}`, "");
    let n = 0;
    for (const level of LEVELS) {
      lines.push(`--- ${level} ---`, "");
      for (const q of questions.filter((x) => x.level === level)) {
        n += 1;
        lines.push(`Q${n} [${q.focusArea}] ${q.question}`);
        for (const p of q.answerPoints) lines.push(`   - ${p}`);
        lines.push("");
      }
    }
    lines.push("Generated with Viva Simulator. AI-generated — for practice purposes only.");
    return lines.join("\n");
  }

  async function copyQuestions() {
    try {
      await navigator.clipboard.writeText(questionsAsText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard. Please use Download Questions instead.");
    }
  }

  function downloadQuestions() {
    const blob = new Blob([questionsAsText()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "viva-questions.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  const progressPct = questions.length ? (answered / questions.length) * 100 : 0;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Viva Simulator
        </p>
        <h1 className="mt-3 text-4xl leading-tight sm:text-5xl">
          Get questioned on your project before your examiner does.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground">
          Upload your project documentation and practice progressively challenging viva questions
          with AI-generated feedback.
        </p>
      </header>

      <div className="mt-10 space-y-6">
        <DocumentInput
          doc={doc}
          onLoad={setDoc}
          onClear={() => {
            setDoc(null);
            setQuestions([]);
            setEvaluations({});
          }}
        />

        <section className="viva-card p-5 sm:p-6" aria-labelledby="settings-heading">
          <h2 id="settings-heading" className="text-2xl">
            Viva Settings
          </h2>

          <div className="mt-4">
            <label htmlFor="per-level" className="text-sm font-medium">
              Questions per level
            </label>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <select
                id="per-level"
                className="viva-field max-w-28"
                value={perLevel}
                onChange={(e) => setPerLevel(Number(e.target.value))}
              >
                {[3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span className="text-sm text-muted-foreground">
                {perLevel * 3} questions in total (Beginner, Intermediate, Advanced)
              </span>
            </div>
          </div>

          <fieldset className="mt-6">
            <legend className="text-sm font-medium">Question focus areas</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {FOCUS_AREAS.map((area) => (
                <button
                  key={area}
                  type="button"
                  className="viva-chip"
                  data-selected={focus.includes(area)}
                  aria-pressed={focus.includes(area)}
                  onClick={() => toggleFocus(area)}
                >
                  {area}
                </button>
              ))}
            </div>
            {focus.length === 0 && (
              <p className="mt-2 text-sm text-destructive">Select at least one focus area.</p>
            )}
          </fieldset>
        </section>

        <section className="viva-card p-5 sm:p-6" aria-labelledby="generate-heading">
          <h2 id="generate-heading" className="text-2xl">
            Generate Viva
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The AI reads your documentation and writes questions grounded in your own project.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="viva-btn viva-btn-primary"
              onClick={onGenerate}
              disabled={loading || !doc || focus.length === 0}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="h-4 w-4" aria-hidden />
              )}
              {loading ? "Generating your viva…" : "Generate Viva Questions"}
            </button>
            {questions.length > 0 && (
              <button
                className="viva-btn viva-btn-ghost"
                onClick={() => {
                  setQuestions([]);
                  setEvaluations({});
                  setError(null);
                }}
              >
                <RotateCcw className="h-4 w-4" aria-hidden /> Clear Questions
              </button>
            )}
          </div>
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
        </section>

        {questions.length > 0 && (
          <>
            <section className="viva-card p-5 sm:p-6" aria-labelledby="progress-heading">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="progress-heading" className="text-2xl">
                  Viva Progress
                </h2>
                <p className="text-sm text-muted-foreground">
                  Answered: {answered} / {questions.length}
                  {average ? ` · Average Score: ${average} / 10` : ""}
                </p>
              </div>
              <div
                className="mt-3 h-3 w-full overflow-hidden rounded-full bg-secondary"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={questions.length}
                aria-valuenow={answered}
                aria-label="Viva progress"
              >
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="viva-btn viva-btn-ghost text-xs" onClick={copyQuestions}>
                  <Copy className="h-3.5 w-3.5" aria-hidden /> {copied ? "Copied!" : "Copy Questions"}
                </button>
                <button className="viva-btn viva-btn-ghost text-xs" onClick={downloadQuestions}>
                  <Download className="h-3.5 w-3.5" aria-hidden /> Download Questions
                </button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Scores and feedback are AI-generated and intended for practice purposes only.
              </p>
            </section>

            {LEVELS.map((level) => {
              const group = questions.filter((q) => q.level === level);
              if (!group.length) return null;
              return (
                <section key={level} aria-labelledby={`level-${level}`} className="space-y-4">
                  <h2 id={`level-${level}`} className="text-2xl">
                    {level} Questions
                  </h2>
                  {group.map((q) => (
                    <QuestionCard
                      key={q.id}
                      question={q}
                      number={questions.indexOf(q) + 1}
                      evaluation={evaluations[q.id]}
                      onCheck={(answer) => onCheck(q, answer)}
                    />
                  ))}
                </section>
              );
            })}
          </>
        )}
      </div>

      <footer className="mt-12 text-center text-xs text-muted-foreground">
        Viva Simulator · Questions and feedback are AI-generated practice material, not an official
        examination score.
      </footer>
    </main>
  );
}
