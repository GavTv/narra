import "server-only";

import type { ChatAnswer } from "@/entities/chat";
import {
  answerDeterministically,
  answerLocally,
  buildReportIndex,
} from "@/entities/report";
import { invokeReportRag } from "@/server/rag";
import { fail, ok, type AppResult } from "@/shared/lib/result";
import { chatRequestSchema } from "@/shared/lib/validation";

export type AskReportDto = ChatAnswer;

export async function askReport(
  payload: unknown,
): Promise<AppResult<AskReportDto>> {
  const parsed = chatRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return fail(400, "Задайте вопрос по загруженному отчёту.");
  }

  const { source, question, history } = parsed.data;

  try {
    const result = await invokeReportRag({
      source,
      index: buildReportIndex(source),
      question,
      history,
    });

    return ok({
      answer: result.answer,
      citations: result.citations,
    });
  } catch (error) {
    console.error("RAG graph failed, using local fallback:", error);

    const deterministic = answerDeterministically(source, question, history);
    if (deterministic) {
      return ok(deterministic);
    }

    return ok({
      answer: answerLocally(source, question),
      citations: [],
    });
  }
}
