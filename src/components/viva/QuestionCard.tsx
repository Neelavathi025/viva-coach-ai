import { useState } from "react";
import { ChevronDown, Lightbulb, Loader2, MessageCircleQuestion } from "lucide-react";
import type { Evaluation, VivaQuestion } from "@/lib/viva-types";
import { MIN_ANSWER_CHARS } from "@/lib/viva-types";

interface Props {
  question: VivaQuestion;
  number: number;
  evaluation: Evaluation | undefined;
  onCheck: (answer: string) => Promise<void>;
}

const levelClass: Record<string, string> = {
  Beginner: "bg-beginner/15 text-beginner",
  Intermediate: "bg-intermediate/15 text-intermediate",
  Advanced: "bg-advanced/15 text-advanced",
};

export function QuestionCard({ question, number, evaluation, onCheck }: Props) {
  const [showPoints, setShowPoints] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function check() {
    setError(null);
    if (answer.trim().length < MIN_ANSWER_CHARS) {
      setError("Please provide a more complete answer before checking it.");
      return;
    }
    setBusy(true);
    try {
      await onCheck(answer.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Your answer could not be checked. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="viva-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold">Q{number}</span>
        <span
          className={`rounded-full px-2.5 py-1 font-medium ${levelClass[question.level] ?? "bg-muted"}`}
        >
          {question.level}
        </span>
        <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
          {question.focusArea}
        </span>
        {evaluation && (
          <span className="ml-auto rounded-full bg-success/15 px-2.5 py-1 font-semibold text-success">
            {evaluation.score}/10
          </span>
        )}
      </div>

      <p className="mt-3 text-base leading-relaxed">{question.question}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="viva-btn viva-btn-ghost px-3 py-1.5 text-xs"
          onClick={() => setShowPoints((v) => !v)}
          aria-expanded={showPoints}
        >
          <Lightbulb className="h-3.5 w-3.5" aria-hidden />
          {showPoints ? "Hide Key Points" : "Show Key Points"}
        </button>
        {!answering && (
          <button
            className="viva-btn viva-btn-primary px-3 py-1.5 text-xs"
            onClick={() => setAnswering(true)}
          >
            <MessageCircleQuestion className="h-3.5 w-3.5" aria-hidden />
            Answer This Question
          </button>
        )}
      </div>

      {showPoints && (
        <ul className="mt-3 list-disc space-y-1 rounded-lg bg-secondary/70 p-4 pl-8 text-sm text-muted-foreground">
          {question.answerPoints.length ? (
            question.answerPoints.map((p, i) => <li key={i}>{p}</li>)
          ) : (
            <li>No key points were provided for this question.</li>
          )}
        </ul>
      )}

      {answering && (
        <div className="mt-4">
          <label htmlFor={`ans-${question.id}`} className="text-sm font-medium">
            Your answer
          </label>
          <textarea
            id={`ans-${question.id}`}
            className="viva-field mt-2 min-h-32"
            placeholder="Answer the way you would explain it to your examiner."
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button className="viva-btn viva-btn-accent px-3 py-1.5 text-xs" onClick={check} disabled={busy}>
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              {busy ? "Checking…" : "Check Answer"}
            </button>
            <button
              className="viva-btn viva-btn-ghost px-3 py-1.5 text-xs"
              onClick={() => setAnswering(false)}
            >
              <ChevronDown className="h-3.5 w-3.5" aria-hidden /> Hide
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      )}

      {evaluation && (
        <div className="mt-4 space-y-3 rounded-xl border border-border bg-secondary/50 p-4 text-sm">
          <p className="leading-relaxed">{evaluation.verdict}</p>
          {evaluation.covered.length > 0 && (
            <div>
              <p className="font-medium text-success">What you covered</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
                {evaluation.covered.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          {evaluation.missed.length > 0 && (
            <div>
              <p className="font-medium text-advanced">What was missing</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
                {evaluation.missed.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          {evaluation.followUp && (
            <div className="rounded-lg bg-accent/15 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide">Examiner's Follow-up</p>
              <p className="mt-1">{evaluation.followUp}</p>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
