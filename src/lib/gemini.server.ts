/**
 * Server-only AI service.
 *
 * Two providers are supported and chosen automatically:
 *  1. GEMINI_API_KEY is set  -> Google Generative Language API (direct Gemini).
 *  2. Otherwise              -> Lovable AI Gateway (LOVABLE_API_KEY), which
 *                               serves Google Gemini models as well.
 *
 * The API key never leaves the server. It is never logged and never returned
 * to the browser.
 */

export class AiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const DIRECT_MODEL = () => process.env["GEMINI_MODEL"] ?? "gemini-2.5-flash";
const GATEWAY_MODEL = () => process.env["GEMINI_MODEL"] ?? "google/gemini-3.8-flash";

function mapStatus(status: number): AiError {
  if (status === 401 || status === 403)
    return new AiError(
      "auth",
      "The AI service rejected the server's credentials. Please check the API key configuration.",
    );
  if (status === 402)
    return new AiError(
      "credits",
      "The AI service is out of credits. Please top up the workspace AI credits and try again.",
    );
  if (status === 429)
    return new AiError(
      "rate_limit",
      "The AI service is rate limited right now. Please wait a moment and try again.",
    );
  if (status === 404)
    return new AiError(
      "model",
      "The configured AI model is not available. Set a different model in GEMINI_MODEL.",
    );
  return new AiError("unavailable", "The AI service is temporarily unavailable. Please try again.");
}

export function extractJson<T>(raw: string): T {
  const text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced?.[1]?.trim() ?? text;
  const start = body.search(/[[{]/);
  const end = Math.max(body.lastIndexOf("}"), body.lastIndexOf("]"));
  if (start === -1 || end === -1 || end <= start) {
    throw new AiError("bad_json", "The AI returned an unreadable response. Please try again.");
  }
  try {
    return JSON.parse(body.slice(start, end + 1)) as T;
  } catch {
    throw new AiError("bad_json", "The AI returned an unreadable response. Please try again.");
  }
}

/** Sends a prompt to Gemini and returns the raw text answer (JSON expected). */
export async function askGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  const directKey = process.env["GEMINI_API_KEY"];
  if (directKey) return askGoogleDirect(directKey, systemPrompt, userPrompt);

  const gatewayKey = process.env["LOVABLE_API_KEY"];
  if (!gatewayKey)
    throw new AiError("auth", "The AI service is not configured on the server (missing API key).");
  return askGateway(gatewayKey, systemPrompt, userPrompt);
}

async function askGoogleDirect(key: string, system: string, user: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${DIRECT_MODEL()}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
        }),
      },
    );
  } catch {
    throw new AiError("network", "Could not reach the AI service. Please check your connection.");
  }
  if (!res.ok) throw mapStatus(res.status);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text.trim()) throw new AiError("empty", "The AI returned an empty response. Please retry.");
  return text;
}

async function askGateway(key: string, system: string, user: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: GATEWAY_MODEL(),
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });
  } catch {
    throw new AiError("network", "Could not reach the AI service. Please check your connection.");
  }
  if (!res.ok) throw mapStatus(res.status);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) throw new AiError("empty", "The AI returned an empty response. Please retry.");
  return text;
}
