"use client";

import { FormEvent } from "react";
import {
  ArrowUp,
  Database,
  FileSearch2,
  LoaderCircle,
  MessageCircleMore,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import type { DataSource } from "@/entities/report";
import { useReportChat } from "@/features/askReport";
import { cn } from "@/shared/lib/cn";

interface ReportChatProps {
  source: DataSource;
  suggestions: string[];
}

export function ReportChat({ source, suggestions }: ReportChatProps) {
  const {
    question,
    setQuestion,
    messages,
    isThinking,
    endRef,
    ask,
  } = useReportChat(source);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void ask(question);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.45 }}
      className="soft-shadow overflow-hidden rounded-2xl border border-white/85 bg-white/90 backdrop-blur"
    >
      <div className="grid lg:grid-cols-[0.72fr_1.28fr]">
        <div className="flex flex-col justify-between border-b border-[var(--line)] bg-[var(--card)] p-6 sm:p-8 lg:border-r lg:border-b-0">
          <div>
            <span className="mb-5 grid size-11 place-items-center rounded-lg bg-[var(--navy)] text-[var(--accent)]">
              <MessageCircleMore className="size-5" />
            </span>
            <p className="text-[10px] font-semibold tracking-[0.15em] text-[var(--steel)] uppercase">
              Ask the data
            </p>
            <h2 className="font-display mt-2 max-w-xs text-2xl font-semibold tracking-[-0.03em] text-[var(--ink)]">
              Спросите данные напрямую
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--muted)]">
              Ответ ограничен текущим отчётом. Если факта нет, Narra честно об этом скажет.
            </p>
          </div>

          <div className="mt-8 space-y-2">
            <p className="mb-3 text-[10px] font-semibold tracking-[0.12em] text-[var(--muted)] uppercase">
              Можно спросить
            </p>
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                disabled={isThinking}
                onClick={() => void ask(suggestion)}
                className="group flex w-full items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-white/80 px-3.5 py-3 text-left text-xs leading-5 text-[var(--ink)]/80 transition hover:border-[var(--accent)] hover:bg-white disabled:opacity-55"
              >
                <span>{suggestion}</span>
                <ArrowUp className="size-3.5 shrink-0 rotate-45 text-[var(--accent)] transition group-hover:rotate-90" />
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-h-[520px] min-w-0 flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-[var(--line)] px-5 py-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <span className="relative grid size-8 shrink-0 place-items-center rounded-md bg-[var(--accent-soft)]">
                <Sparkles className="size-3.5 text-[var(--accent)]" />
                <i className="absolute right-0 bottom-0 size-2 rounded-sm border-2 border-white bg-[var(--ok)]" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--ink)]">Narra AI</p>
                <p className="truncate text-[10px] text-[var(--muted)]">
                  Контекст: {source.name}
                </p>
              </div>
            </div>
            <span className="flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--line)] bg-white px-2.5 py-1.5 text-[10px] font-medium text-[var(--muted)]">
              <ShieldCheck className="size-3 text-[var(--ok)]" />
              Только отчёт
            </span>
          </div>

          <div
            className="flex-1 space-y-4 overflow-y-auto px-5 py-6 sm:max-h-[440px] sm:px-6"
            aria-live="polite"
          >
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex gap-2.5",
                    message.role === "user" && "justify-end",
                  )}
                >
                  {message.role === "assistant" && (
                    <span className="mt-1 grid size-7 shrink-0 place-items-center rounded-md bg-[var(--navy)]">
                      <Sparkles className="size-3 text-[var(--accent)]" />
                    </span>
                  )}
                  <div className="max-w-[84%]">
                    <p
                      className={cn(
                        "whitespace-pre-wrap rounded-xl px-4 py-3 text-sm leading-6",
                        message.role === "assistant"
                          ? "rounded-tl-md bg-[var(--card)] text-[var(--ink)]/85"
                          : "rounded-tr-md bg-[var(--navy)] text-white",
                      )}
                    >
                      {message.content}
                    </p>
                    {message.role === "assistant" &&
                      Boolean(message.citations?.length) && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-1">
                          <span className="mr-0.5 flex items-center gap-1 text-[9px] font-semibold tracking-[0.08em] text-[var(--muted)] uppercase">
                            <FileSearch2 className="size-3" />
                            Источник
                          </span>
                          {message.citations?.map((citation) => (
                            <span
                              key={citation.id}
                              className="rounded-md border border-[var(--line)] bg-white/80 px-2 py-1 text-[9px] font-medium text-[var(--steel)]"
                            >
                              {citation.label}
                            </span>
                          ))}
                        </div>
                      )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {isThinking && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2.5"
              >
                <span className="grid size-7 place-items-center rounded-md bg-[var(--navy)]">
                  <Sparkles className="size-3 text-[var(--accent)]" />
                </span>
                <span className="flex items-center gap-2 rounded-xl rounded-tl-md bg-[var(--card)] px-4 py-3 text-xs text-[var(--muted)]">
                  <LoaderCircle className="size-3.5 animate-spin" />
                  Ищу только в отчёте
                </span>
              </motion.div>
            )}
            <div ref={endRef} />
          </div>

          <form onSubmit={submit} className="border-t border-[var(--line)] p-4 sm:p-5">
            <div className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white p-2 pl-4 shadow-sm transition focus-within:border-[var(--steel)] focus-within:ring-4 focus-within:ring-[var(--steel)]/15">
              <Database className="size-4 shrink-0 text-[var(--muted)]" />
              <input
                value={question}
                disabled={isThinking}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Спросите что-нибудь про эти данные"
                className="min-w-0 flex-1 bg-transparent text-sm text-[var(--ink)] outline-none placeholder:text-[#9aabba]"
              />
              <button
                type="submit"
                disabled={!question.trim() || isThinking}
                aria-label="Отправить вопрос"
                className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--accent)] text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-[var(--line)] disabled:text-[var(--muted)]"
              >
                {isThinking ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <ArrowUp className="size-4" />
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </motion.section>
  );
}
