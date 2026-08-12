"use client";

import { FormEvent } from "react";
import {
  ArrowUp,
  FileSearch2,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import type { DataSource } from "@/entities/report";
import { useReportChat } from "@/features/askReport";
import { cn } from "@/shared/lib/cn";

interface ReportChatProps {
  source: DataSource;
}

export function ReportChat({ source }: ReportChatProps) {
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
      transition={{ delay: 0.15, duration: 0.45 }}
      className="soft-shadow overflow-hidden rounded-3xl border border-white/80 bg-white/80 backdrop-blur"
    >
      <div className="border-b border-[var(--line)]/80 bg-gradient-to-br from-[var(--card)] to-white px-5 py-6 sm:px-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.15em] text-[var(--accent)] uppercase">
              Ask the data
            </p>
            <h2 className="font-display mt-1 text-2xl font-semibold tracking-[-0.03em] text-[var(--ink)]">
              Спросите данные напрямую
            </h2>
            <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">
              Ответ только по «{source.name}». Если факта нет — скажем честно.
            </p>
          </div>
          <span className="flex w-fit items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-2.5 py-1.5 text-[10px] font-medium text-[var(--muted)]">
            <ShieldCheck className="size-3 text-[var(--ok)]" />
            Только отчёт
          </span>
        </div>
      </div>

      <div className="min-h-[400px]">
        <div
          className="max-h-[380px] space-y-4 overflow-y-auto px-4 py-5 sm:px-6"
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
                  <span className="mt-1 grid size-7 shrink-0 place-items-center rounded-full bg-[var(--navy)]">
                    <Sparkles className="size-3 text-[var(--accent)]" />
                  </span>
                )}
                <div className="max-w-[85%]">
                  <p
                    className={cn(
                      "whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6",
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
                        {message.citations?.map((citation) => {
                          const id = String(citation.id ?? "");
                          const raw = String(citation.label ?? "");
                          const label = /^(?:schema|row-\d+|text-\d+)$/i.test(
                            raw.trim(),
                          )
                            ? /^schema$/i.test(raw.trim())
                              ? "Структура отчёта"
                              : raw.replace(/^row-/i, "Строка ")
                            : raw ||
                              (/^schema$/i.test(id)
                                ? "Структура отчёта"
                                : id.replace(/^row-/i, "Строка "));
                          return (
                            <span
                              key={id || label}
                              className="rounded-full border border-[var(--line)] bg-white/80 px-2 py-1 text-[9px] font-medium text-[var(--steel)]"
                            >
                              {label}
                            </span>
                          );
                        })}
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
              <span className="grid size-7 place-items-center rounded-full bg-[var(--navy)]">
                <Sparkles className="size-3 text-[var(--accent)]" />
              </span>
              <span className="flex items-center gap-2 rounded-2xl rounded-tl-md bg-[var(--card)] px-4 py-3 text-xs text-[var(--muted)]">
                <LoaderCircle className="size-3.5 animate-spin" />
                Ищу только в отчёте
              </span>
            </motion.div>
          )}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={submit}
          className="border-t border-[var(--line)]/80 bg-white/90 p-3 sm:p-4"
        >
          <div className="flex items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-2 pl-4 transition focus-within:border-[var(--steel)] focus-within:ring-4 focus-within:ring-[var(--steel)]/10">
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
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent)] text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-[var(--line)] disabled:text-[var(--muted)]"
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
    </motion.section>
  );
}
