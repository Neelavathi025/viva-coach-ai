# Viva Simulator

## Project Description

Upload student project documentation. The application generates progressively challenging viva
questions about architecture, implementation choices, technologies, limitations, testing, and future
improvements.

The student uploads (or pastes) their project report, chooses how many questions they want per
difficulty level and which focus areas to cover. The AI reads the actual documentation and produces
Beginner, Intermediate and Advanced viva questions. The student answers any question and the AI
returns a score out of 10, feedback on what was covered and what was missing, and an examiner-style
follow-up question.

## Features

- Project document upload (PDF, DOCX, TXT, MD — max 10 MB) or paste-your-own-text
- AI-powered viva question generation grounded in the uploaded documentation
- Beginner / Intermediate / Advanced progressive difficulty
- Six focus areas: Architecture, Implementation choices, Technologies used, Limitations, Testing,
  Future improvements
- Key points per question, hidden by default so the student can attempt it independently
- AI answer evaluation with an integer score (0–10), covered/missed feedback and a follow-up question
- Progress dashboard (answered count, average score, progress bar)
- Copy questions to clipboard and download `viva-questions.txt`
- Clear Questions reset that keeps the loaded document

## Technology Stack

- **Frontend:** React 19 + TypeScript, TanStack Router, Tailwind CSS v4 (semantic design tokens)
- **Backend:** TanStack Start server functions (typed RPC, runs server-side only)
- **AI:** Google Gemini — either directly via the Google Generative Language API, or through the
  Lovable AI Gateway which serves Gemini models
- **Document processing:** `pdfjs-dist` (PDF) and `mammoth` (DOCX); plain reads for TXT/MD
- **Data format:** JSON for all frontend ↔ backend communication

## System Architecture

```text
Student
  ↓  (uploads/pastes project documentation; text extracted in the browser)
Frontend (React)
  ↓  JSON over typed server functions
Backend (server-only handlers, holds the API key)
  ↓  HTTPS
Gemini API
  ↓  structured JSON
Questions / Evaluation
  ↓
Frontend (rendered as question cards, scores and feedback)
```

## Setup

1. Add your Gemini key as a secret / environment variable named `GEMINI_API_KEY`
   (on Replit: Tools → Secrets; elsewhere: an environment variable on the server).
2. Optionally set `GEMINI_MODEL` to change the model without touching the code
   (default `gemini-2.5-flash` for direct Google access).
3. Start the app — the key is read with `process.env.GEMINI_API_KEY` inside the server handler only.

Never commit a real API key. The key is never sent to the browser, never stored in
localStorage/sessionStorage/cookies, and there is no API-key input field in the UI.

If `GEMINI_API_KEY` is not set, the app falls back to the hosting platform's AI gateway
(`LOVABLE_API_KEY`, also server-only), which serves Google Gemini models. Model selection there is
also controlled by `GEMINI_MODEL` (default `google/gemini-3.8-flash`).

## Implementation notes / deviations

- The project runs on a TanStack Start full-stack React app rather than a separate Express server.
  Server functions (`src/lib/viva.functions.ts`, `src/lib/gemini.server.ts`) are the backend and
  never reach the browser bundle, so the API key stays server-side.
- PDF/DOCX text extraction happens in the browser, so only the extracted plain text — not the raw
  file — is transmitted. The server runs on an edge runtime where native PDF parsers are not
  available, and this also keeps documents out of server storage entirely.
- Question counts are validated on the server. If the model returns fewer questions than requested,
  the backend asks it to fill the gap once, and shows a clear error if it still falls short. An
  incomplete viva paper is never displayed as complete.

## Limitations

- AI-generated questions and feedback may not always be perfect.
- Scanned PDFs without extractable text require manual text input (no OCR).
- Gemini API availability and rate limits affect the application.
- AI scores are practice estimates, not official examiner scores.
- Very long reports are truncated before being sent to the model.
