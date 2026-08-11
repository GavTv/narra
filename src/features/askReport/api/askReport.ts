import type { ChatAnswer, ChatTurn } from "@/entities/chat";
import type { DataSource } from "@/entities/report";
import { postJson } from "@/shared/lib/http";

export async function askReport(params: {
  source: DataSource;
  question: string;
  history: ChatTurn[];
}): Promise<ChatAnswer> {
  const body = await postJson<ChatAnswer>(
    "/api/chat",
    params,
    "Не удалось получить ответ.",
  );

  if (!body.answer) {
    throw new Error("Не удалось получить ответ.");
  }

  return {
    answer: body.answer,
    citations: body.citations ?? [],
  };
}
