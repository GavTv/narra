import "server-only";

import { ChatOpenAI } from "@langchain/openai";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

type AltProviderId = "openai" | "openrouter" | "groq";

type CompatibleProvider = {
  id: AltProviderId;
  label: string;
  hasKey: () => boolean;
  model: () => string;
  baseURL: string;
  extraHeaders?: () => Record<string, string>;
};

export function hasGeminiKey() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

function hasOpenAIKey() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function hasGroqKey() {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

function hasOpenRouterKey() {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

export function hasAltLlmKey() {
  return hasOpenAIKey() || hasOpenRouterKey() || hasGroqKey();
}

const PROVIDERS: CompatibleProvider[] = [
  {
    id: "openai",
    label: "OpenAI",
    hasKey: hasOpenAIKey,
    model: () => process.env.OPENAI_MODEL || "gpt-4o-mini",
    baseURL: "https://api.openai.com/v1",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    hasKey: hasOpenRouterKey,
    model: () => process.env.OPENROUTER_MODEL || "openai/gpt-4o",
    baseURL: "https://openrouter.ai/api/v1",
    extraHeaders: () => ({
      "HTTP-Referer":
        process.env.OPENROUTER_SITE_URL || "http://localhost:3000",
      "X-Title": process.env.OPENROUTER_APP_NAME || "Narra",
    }),
  },
  {
    id: "groq",
    label: "Groq",
    hasKey: hasGroqKey,
    model: () => process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    baseURL: "https://api.groq.com/openai/v1",
  },
];

function providerKey(id: AltProviderId) {
  if (id === "openai") return process.env.OPENAI_API_KEY?.trim();
  if (id === "openrouter") return process.env.OPENROUTER_API_KEY?.trim();
  return process.env.GROQ_API_KEY?.trim();
}

export function altProvidersInOrder(): CompatibleProvider[] {
  const preferred = (process.env.AI_PROVIDER || "").toLowerCase();
  const available = PROVIDERS.filter((provider) => provider.hasKey());
  if (!available.length) return [];

  if (
    preferred === "openai" ||
    preferred === "openrouter" ||
    preferred === "groq"
  ) {
    return [
      ...available.filter((provider) => provider.id === preferred),
      ...available.filter((provider) => provider.id !== preferred),
    ];
  }

  return available;
}

export function preferAltFirst() {
  const provider = (process.env.AI_PROVIDER || "").toLowerCase();
  return (
    provider === "openai" ||
    provider === "openrouter" ||
    provider === "groq"
  );
}

type CompatibleRequest = {
  prompt: string;
  temperature: number;
  maxOutputTokens: number;
  json?: boolean;
};

interface ChatCompletionResponse {
  choices?: Array<{
    message?: { content?: string | null };
  }>;
  error?: { message?: string };
}

async function generateWithCompatible(
  provider: CompatibleProvider,
  { prompt, temperature, maxOutputTokens, json = false }: CompatibleRequest,
) {
  const apiKey = providerKey(provider.id);
  if (!apiKey) return null;

  const response = await fetch(`${provider.baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(provider.extraHeaders?.() ?? {}),
    },
    body: JSON.stringify({
      model: provider.model(),
      temperature,
      max_tokens: maxOutputTokens,
      messages: [{ role: "user", content: prompt }],
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });

  const body = (await response.json()) as ChatCompletionResponse;

  if (!response.ok) {
    throw new Error(
      `${provider.label} API: ${body.error?.message || `HTTP ${response.status}`}`,
    );
  }

  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error(`${provider.label} не вернул результат`);
  }

  return text;
}

export async function generateWithAltLlms(request: CompatibleRequest) {
  let lastError: unknown;

  for (const provider of altProvidersInOrder()) {
    try {
      const text = await generateWithCompatible(provider, request);
      if (text) return text;
    } catch (error) {
      lastError = error;
      console.error(`${provider.label} generation failed:`, error);
    }
  }

  if (lastError) throw lastError;
  return null;
}

export function createCompatibleChatModel(
  provider: CompatibleProvider,
  options?: { temperature?: number; maxTokens?: number },
): BaseChatModel | null {
  const apiKey = providerKey(provider.id);
  if (!apiKey) return null;

  return new ChatOpenAI({
    apiKey,
    model: provider.model(),
    temperature: options?.temperature ?? 0.15,
    maxTokens: options?.maxTokens ?? 1_600,
    configuration: {
      baseURL: provider.baseURL,
      defaultHeaders: provider.extraHeaders?.(),
    },
  });
}

export function createAltChatModels(options?: {
  temperature?: number;
  maxTokens?: number;
}): BaseChatModel[] {
  return altProvidersInOrder().flatMap((provider) => {
    const model = createCompatibleChatModel(provider, options);
    return model ? [model] : [];
  });
}
