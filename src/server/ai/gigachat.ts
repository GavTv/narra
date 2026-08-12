import "server-only";

import { Agent } from "node:https";
import { HumanMessage } from "@langchain/core/messages";
import { GigaChat } from "langchain-gigachat";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

const httpsAgent = new Agent({
  rejectUnauthorized: false,
});

export function hasGigaChatKey() {
  return Boolean(process.env.GIGACHAT_CREDENTIALS?.trim());
}

export function createGigaChatModel(options?: {
  temperature?: number;
  maxTokens?: number;
}): BaseChatModel | null {
  const credentials = process.env.GIGACHAT_CREDENTIALS?.trim();
  if (!credentials) return null;

  return new GigaChat({
    credentials,
    scope: process.env.GIGACHAT_SCOPE?.trim() || "GIGACHAT_API_PERS",
    model: process.env.GIGACHAT_MODEL?.trim() || "GigaChat",
    temperature: options?.temperature ?? 0.15,
    maxTokens: options?.maxTokens ?? 1_024,
    timeout: 60,
    httpsAgent,
  });
}

export async function generateWithGigaChat(request: {
  prompt: string;
  temperature: number;
  maxOutputTokens: number;
}) {
  const model = createGigaChatModel({
    temperature: request.temperature,
    maxTokens: request.maxOutputTokens,
  });
  if (!model) return null;

  const response = await model.invoke([new HumanMessage(request.prompt)]);
  const text =
    typeof response.content === "string"
      ? response.content
      : Array.isArray(response.content)
        ? response.content
            .map((part) =>
              typeof part === "string"
                ? part
                : part && typeof part === "object" && "text" in part
                  ? String((part as { text?: string }).text ?? "")
                  : "",
            )
            .join("")
        : String(response.content ?? "");

  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("GigaChat не вернул результат");
  }
  return trimmed;
}
