"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";

import type { ChatMessage } from "@/entities/chat";
import type { DataSource } from "@/entities/report";
import { makeId } from "@/shared/lib/format";
import {
  getChatRuntimeEpoch,
  readChatMessages,
  sourceStorageKey,
  writeChatMessages,
} from "@/shared/lib/sessionStorage";

import { askReport } from "../api/askReport";

type ChatSnapshot = {
  messages: ChatMessage[];
  question: string;
  isThinking: boolean;
};

const listeners = new Set<() => void>();
const memory = new Map<string, ChatSnapshot>();
const cached = new Map<string, ChatSnapshot & { epoch: number }>();
const serverCache = new Map<string, ChatSnapshot>();
let epoch = 0;
let seenRuntimeEpoch = getChatRuntimeEpoch();

function welcomeMessage(source: DataSource): ChatMessage {
  return {
    id: "welcome",
    role: "assistant",
    content:
      source.kind === "text"
        ? "Отчёт прочитан. Спросите о фактах, числах или темах из текста."
        : `Вижу ${source.stats.rows} строк и ${source.stats.columns} колонок. Что хотите проверить?`,
  };
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const candidate = value as ChatMessage;
  return (
    typeof candidate.id === "string" &&
    (candidate.role === "user" || candidate.role === "assistant") &&
    typeof candidate.content === "string"
  );
}

function defaultSnapshot(source: DataSource): ChatSnapshot {
  return {
    messages: [welcomeMessage(source)],
    question: "",
    isThinking: false,
  };
}

function loadSnapshot(source: DataSource, key: string): ChatSnapshot {
  const saved = readChatMessages<ChatMessage>(key)?.filter(isChatMessage);
  if (saved?.length) {
    return {
      messages: saved,
      question: "",
      isThinking: false,
    };
  }
  return defaultSnapshot(source);
}

function syncRuntimeEpoch() {
  const runtimeEpoch = getChatRuntimeEpoch();
  if (runtimeEpoch === seenRuntimeEpoch) return;
  seenRuntimeEpoch = runtimeEpoch;
  memory.clear();
  cached.clear();
  epoch += 1;
}

function notify() {
  epoch += 1;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshotFor(source: DataSource, key: string) {
  syncRuntimeEpoch();

  if (!memory.has(key) && typeof window !== "undefined") {
    memory.set(key, loadSnapshot(source, key));
  }

  const current = memory.get(key) ?? defaultSnapshot(source);
  const previous = cached.get(key);
  if (
    previous &&
    previous.epoch === epoch &&
    previous.messages === current.messages &&
    previous.question === current.question &&
    previous.isThinking === current.isThinking
  ) {
    return previous;
  }

  const next = { ...current, epoch };
  cached.set(key, next);
  return next;
}

function getServerSnapshotFor(source: DataSource, key: string) {
  const existing = serverCache.get(key);
  if (existing) return existing;
  const next = defaultSnapshot(source);
  serverCache.set(key, next);
  return next;
}

function setSnapshot(key: string, next: ChatSnapshot) {
  memory.set(key, next);
  writeChatMessages(key, next.messages);
  notify();
}

export function useReportChat(source: DataSource) {
  const storageKey = sourceStorageKey(source);

  const snapshot = useSyncExternalStore(
    subscribe,
    () => getSnapshotFor(source, storageKey),
    () => getServerSnapshotFor(source, storageKey),
  );

  const endRef = useRef<HTMLDivElement>(null);

  const setQuestion = useCallback(
    (value: string) => {
      const current = memory.get(storageKey) ?? loadSnapshot(source, storageKey);
      setSnapshot(storageKey, { ...current, question: value });
    },
    [source, storageKey],
  );

  const ask = useCallback(
    async (value: string) => {
      const clean = value.trim();
      const current = memory.get(storageKey) ?? loadSnapshot(source, storageKey);
      if (!clean || current.isThinking) return;

      const history = current.messages
        .filter(
          (message) =>
            message.id !== "welcome" && !message.id.startsWith("error-"),
        )
        .slice(-10)
        .map(({ role, content }) => ({
          role,
          content: content.slice(0, 2_000),
        }));

      const withQuestion: ChatSnapshot = {
        question: "",
        isThinking: true,
        messages: [
          ...current.messages,
          { id: makeId("question"), role: "user", content: clean },
        ],
      };
      setSnapshot(storageKey, withQuestion);

      try {
        const result = await askReport({
          source,
          question: clean,
          history,
        });
        const latest = memory.get(storageKey) ?? withQuestion;
        setSnapshot(storageKey, {
          ...latest,
          isThinking: false,
          messages: [
            ...latest.messages,
            {
              id: makeId("answer"),
              role: "assistant",
              content: result.answer,
              citations: result.citations,
            },
          ],
        });
      } catch (caught) {
        const latest = memory.get(storageKey) ?? withQuestion;
        setSnapshot(storageKey, {
          ...latest,
          isThinking: false,
          messages: [
            ...latest.messages,
            {
              id: makeId("error"),
              role: "assistant",
              content:
                caught instanceof Error
                  ? caught.message
                  : "Не удалось получить ответ. Попробуйте ещё раз.",
            },
          ],
        });
      }

      requestAnimationFrame(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    },
    [source, storageKey],
  );

  return {
    question: snapshot.question,
    setQuestion,
    messages: snapshot.messages,
    isThinking: snapshot.isThinking,
    endRef,
    ask,
  };
}
