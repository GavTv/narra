"use client";

import { useEffect, useRef, useState } from "react";

import type { ChatMessage } from "@/entities/chat";
import type { DataSource } from "@/entities/report";
import { makeId } from "@/shared/lib/format";

import { askReport } from "../api/askReport";

export function useReportChat(source: DataSource) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        source.kind === "text"
          ? "Отчёт прочитан. Спросите о фактах, числах или темах из текста."
          : `Вижу ${source.stats.rows} строк и ${source.stats.columns} колонок. Что хотите проверить?`,
    },
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, isThinking]);

  const ask = async (value: string) => {
    const clean = value.trim();
    if (!clean || isThinking) return;

    const history = messages
      .filter(
        (message) =>
          message.id !== "welcome" && !message.id.startsWith("error-"),
      )
      .slice(-10)
      .map(({ role, content }) => ({
        role,
        content: content.slice(0, 2_000),
      }));

    setQuestion("");
    setMessages((current) => [
      ...current,
      { id: makeId("question"), role: "user", content: clean },
    ]);
    setIsThinking(true);

    try {
      const result = await askReport({ source, question: clean, history });
      setMessages((current) => [
        ...current,
        {
          id: makeId("answer"),
          role: "assistant",
          content: result.answer,
          citations: result.citations,
        },
      ]);
    } catch (caught) {
      setMessages((current) => [
        ...current,
        {
          id: makeId("error"),
          role: "assistant",
          content:
            caught instanceof Error
              ? caught.message
              : "Не удалось получить ответ. Попробуйте ещё раз.",
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  return {
    question,
    setQuestion,
    messages,
    isThinking,
    endRef,
    ask,
  };
}
