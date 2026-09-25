import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "zod";

// Flash-Lite is multimodal and supports structured output, while being aimed
// at high-throughput document work. Starting here makes paper marking much
// less likely to consume a student's limited free-tier allowance.
const MODELS = ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash"] as const;
let preferredModel: string = MODELS[0];
const keyAls = new AsyncLocalStorage<string>();

export const NEED_AI_KEY =
  "Add your Gemini API key before using AI marking. Open Settings, paste a key from Google AI Studio, and save — the app checks it is real first.";

export type ChatContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: ChatContent;
};

function normalizeKey(raw: string | undefined | null): string {
  return (raw ?? "")
    .trim()
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .replace(/\s+/g, "");
}

export function looksLikeGeminiKey(raw: string): boolean {
  const key = normalizeKey(raw);
  return /^(AIza[0-9A-Za-z_-]{20,}|AQ\.[A-Za-z0-9._-]{20,})$/.test(key);
}

export function runWithGeminiKey<T>(key: string, fn: () => T): T {
  return keyAls.run(normalizeKey(key), fn);
}

export function getGeminiApiKey(): string {
  return normalizeKey(keyAls.getStore() ?? "");
}

export function aiAvailable(): boolean {
  return Boolean(getGeminiApiKey());
}

export function geminiKeyHint(key = getGeminiApiKey()): { configured: boolean; suffix: string } {
  const k = normalizeKey(key);
  return { configured: Boolean(k), suffix: k ? k.slice(-4) : "" };
}

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

function partsFromContent(content: ChatContent): GeminiPart[] {
  if (typeof content === "string") return [{ text: content }];
  return content.map((part) => {
    if (part.type === "text") return { text: part.text };
    const match = /^data:([^;]+);base64,(.*)$/s.exec(part.image_url.url);
    if (!match) return { text: "" };
    return { inlineData: { mimeType: match[1], data: match[2] } };
  });
}

function toGeminiRequest(messages: ChatMessage[]) {
  const systemParts: GeminiPart[] = [];
  const contents: { role: "user" | "model"; parts: GeminiPart[] }[] = [];
  for (const m of messages) {
    if (m.role === "system") {
      systemParts.push(...partsFromContent(m.content));
      continue;
    }
    contents.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: partsFromContent(m.content),
    });
  }
  return {
    contents,
    systemInstruction: systemParts.length ? { parts: systemParts } : undefined,
  };
}

function extractText(json: {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}): string {
  const blocked = json.promptFeedback?.blockReason;
  if (blocked && blocked !== "BLOCK_REASON_UNSPECIFIED") return "";
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("")
    .trim();
}

function authErrorMessage(status: number): string | null {
  if (status !== 401 && status !== 403) return null;
  return "This API key is fake, revoked, or incomplete. Create a new key in Google AI Studio and paste the whole key (starts with AQ. or AIza).";
}

async function postGemini(
  apiKey: string,
  model: string,
  body: unknown,
): Promise<{ status: number; json: unknown; text: string }> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
    },
  );
  const text = await res.text().catch(() => "");
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

async function callGemini(
  messages: ChatMessage[],
  opts?: { maxTokens?: number; temperature?: number; json?: boolean; quality?: boolean },
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return { ok: false, error: NEED_AI_KEY };
  const { contents, systemInstruction } = toGeminiRequest(messages);
  const maxTokens = Math.max(opts?.maxTokens ?? 1800, opts?.json ? 4096 : 1200);
  const models = opts?.quality
    ? ["gemini-3.5-flash", "gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"]
    : [preferredModel, ...MODELS.filter((m) => m !== preferredModel)];
  let lastError = "AI request failed.";
  let quotaError = "";

  for (const model of models) {
    // For handwritten-paper marking, let the model reason before it answers.
    // The faster no-thinking pass is retained only as a compatibility fallback.
    for (const disableThinking of opts?.quality ? [false, true] : [true, false]) {
      const body = {
        contents,
        systemInstruction,
        generationConfig: {
          temperature: opts?.temperature ?? 0.2,
          maxOutputTokens: maxTokens,
          ...(opts?.json ? { responseMimeType: "application/json" } : {}),
          ...(disableThinking
            ? { thinkingConfig: { thinkingBudget: 0 } }
            : opts?.quality
              ? { thinkingConfig: { thinkingLevel: "LOW" } }
              : {}),
        },
      };
      try {
        let result = await postGemini(apiKey, model, body);
        const auth = authErrorMessage(result.status);
        if (auth) return { ok: false, error: auth };
        if (result.status === 404) {
          lastError = `Model ${model} is not available.`;
          break;
        }
        if (result.status === 400 && disableThinking) {
          continue;
        }
        if (result.status === 429) {
          quotaError = "Google's free Gemini quota is currently exhausted for this key. Waiting a minute only helps with a short rate limit; if it happens again, wait for Google's quota reset before trying another mark.";
          break;
        }
        if (result.status === 503) {
          await new Promise((r) => setTimeout(r, 700));
          result = await postGemini(apiKey, model, body);
        }
        if (result.status >= 400) {
          lastError = `AI request failed (${result.status}). ${result.text.slice(0, 180)}`;
          continue;
        }
        const content = extractText(
          (result.json ?? {}) as {
            candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
            promptFeedback?: { blockReason?: string };
          },
        );
        if (!content) {
          lastError = "The AI returned an empty response. Please retry.";
          continue;
        }
        preferredModel = model;
        return { ok: true, text: content };
      } catch (err) {
        lastError = err instanceof Error ? err.message : "Network error talking to AI.";
      }
    }
  }
  return { ok: false, error: quotaError || lastError };
}

export async function probeGeminiKey(
  key: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = normalizeKey(key);
  if (!apiKey) return { ok: false, error: "Paste a Gemini API key first." };
  if (!looksLikeGeminiKey(apiKey)) {
    return {
      ok: false,
      error:
        "That does not look like a real Gemini key. It should start with AQ. or AIza and be the full string from Google AI Studio — no quotes, no extra words.",
    };
  }
  const models = [...MODELS];
  let last = "Could not reach Gemini to check this key.";
  for (const model of models) {
    const result = await postGemini(apiKey, model, {
      contents: [{ role: "user", parts: [{ text: "Reply with the single word OK." }] }],
      generationConfig: { maxOutputTokens: 16, temperature: 0, thinkingConfig: { thinkingBudget: 0 } },
    });
    const auth = authErrorMessage(result.status);
    if (auth) return { ok: false, error: auth };
    if (result.status === 404) {
      last = `Model ${model} is not available.`;
      continue;
    }
    if (result.status === 429) return { ok: true };
    if (result.status >= 400) {
      last = `Could not verify this key (${result.status}).`;
      continue;
    }
    preferredModel = model;
    return { ok: true };
  }
  return { ok: false, error: last };
}

export async function chatJson<T>(
  schema: z.ZodType<T>,
  messages: ChatMessage[],
  opts?: { maxTokens?: number; temperature?: number; quality?: boolean },
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const first = await callGemini(messages, { ...opts, json: true });
  if (first.ok) {
    const parsed = extractJson(first.text);
    const data = schema.safeParse(parsed);
    if (data.success) return { ok: true, data: data.data };
  }
  const retry = await callGemini(
    [
      ...messages,
      {
        role: "user",
        content: "Return ONLY valid JSON that matches the requested schema. No markdown.",
      },
    ],
    { ...opts, json: true, temperature: 0 },
  );
  if (!retry.ok) return first.ok ? { ok: false, error: "The AI response could not be validated. Please retry." } : retry;
  const parsed = extractJson(retry.text);
  const data = schema.safeParse(parsed);
  if (!data.success) {
    return { ok: false, error: "The AI response could not be validated. Please retry." };
  }
  return { ok: true, data: data.data };
}

export async function chatText(
  messages: ChatMessage[],
  opts?: { maxTokens?: number },
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const result = await callGemini(messages, {
    maxTokens: opts?.maxTokens ?? 900,
    temperature: 0.35,
  });
  if (!result.ok) return result;
  return { ok: true, text: result.text };
}

function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function dataUrlFromBase64(mime: string, b64: string): string {
  if (b64.startsWith("data:")) return b64;
  return `data:${mime};base64,${b64}`;
}

export function imageParts(
  images: Array<{ mime: string; base64: string }>,
): Array<{ type: "image_url"; image_url: { url: string } }> {
  return images.map((img) => ({
    type: "image_url" as const,
    image_url: { url: dataUrlFromBase64(img.mime, img.base64) },
  }));
}
