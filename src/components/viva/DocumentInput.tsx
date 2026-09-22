import { useRef, useState } from "react";
import { FileText, Upload, X, ShieldAlert, CheckCircle2 } from "lucide-react";
import { extractTextFromFile, DocumentError } from "@/lib/document-text";
import type { LoadedDocument } from "@/lib/viva-types";

interface Props {
  doc: LoadedDocument | null;
  onLoad: (doc: LoadedDocument) => void;
  onClear: () => void;
}

export function DocumentInput({ doc, onLoad, onClear }: Props) {
  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const text = await extractTextFromFile(file);
      if (text.replace(/\s/g, "").length < 40) {
        setError(
          "No readable text was found. If this is a scanned PDF, please paste the project text manually.",
        );
        return;
      }
      onLoad({ fileName: file.name, text });
    } catch (e) {
      setError(
        e instanceof DocumentError
          ? e.message
          : "This document could not be read. Please paste the project text manually.",
      );
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function usePasted() {
    setError(null);
    if (pasted.trim().length < 50) {
      setError("Please paste a bit more of your project text (at least a few sentences).");
      return;
    }
    onLoad({ fileName: "Pasted project text", text: pasted.trim() });
  }

  return (
    <section className="viva-card p-5 sm:p-6" aria-labelledby="doc-heading">
      <h2 id="doc-heading" className="text-2xl">
        Project Documentation
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Upload your report (PDF, DOCX, TXT, MD — max 10 MB) or paste the text yourself.
      </p>

      <div className="mt-4 flex gap-2" role="tablist">
        {(["upload", "paste"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            className="viva-chip"
            data-selected={mode === m}
            onClick={() => setMode(m)}
          >
            {m === "upload" ? "Upload a file" : "Paste project text"}
          </button>
        ))}
      </div>

      {mode === "upload" ? (
        <div className="mt-4">
          <label
            htmlFor="viva-file"
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-secondary/50 px-4 py-10 text-center transition-colors hover:bg-secondary"
          >
            <Upload className="h-6 w-6 text-muted-foreground" aria-hidden />
            <span className="text-sm font-medium">Choose your project document</span>
            <span className="text-xs text-muted-foreground">PDF, DOCX, TXT or MD · up to 10 MB</span>
          </label>
          <input
            id="viva-file"
            ref={inputRef}
            type="file"
            className="sr-only"
            accept=".pdf,.docx,.txt,.md,.markdown"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
          {busy && <p className="mt-3 text-sm text-muted-foreground">Reading your document…</p>}
        </div>
      ) : (
        <div className="mt-4">
          <textarea
            className="viva-field min-h-56"
            placeholder="Paste your abstract, introduction, architecture, technologies, implementation, testing, results, limitations and future scope…"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
          />
          <button className="viva-btn viva-btn-primary mt-3" onClick={usePasted}>
            Use this text
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {doc && (
        <div className="mt-5 rounded-xl border border-border bg-secondary/60 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />
              <div className="min-w-0">
                <p className="font-medium">Document successfully loaded</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" aria-hidden />
                  <span className="break-all">{doc.fileName}</span>
                  <span>· ~{doc.text.length.toLocaleString()} characters</span>
                </p>
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                  {doc.text.slice(0, 320)}
                  {doc.text.length > 320 ? "…" : ""}
                </p>
              </div>
            </div>
            <button
              className="viva-btn viva-btn-ghost shrink-0 px-3 py-1.5 text-xs"
              onClick={onClear}
            >
              <X className="h-3.5 w-3.5" aria-hidden /> Remove
            </button>
          </div>
        </div>
      )}

      <p className="mt-5 flex items-start gap-2 rounded-md bg-accent/15 p-3 text-xs leading-relaxed text-accent-foreground">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          Your project documentation is sent to Google Gemini to generate and evaluate viva
          questions. Do not upload confidential, private, or sensitive information. Documents are
          processed in memory and are not stored.
        </span>
      </p>
    </section>
  );
}
