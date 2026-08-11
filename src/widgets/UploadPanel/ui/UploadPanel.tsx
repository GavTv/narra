"use client";

import { useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  FileSpreadsheet,
  LoaderCircle,
  Sparkles,
  TextCursorInput,
  UploadCloud,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import type { DataSource } from "@/entities/report";
import {
  MAX_CONTEXT_LENGTH,
  parseFile,
  textToSource,
} from "@/features/parseUpload";
import { cn } from "@/shared/lib/cn";

type InputMode = "file" | "text";

interface UploadPanelProps {
  isLoading: boolean;
  onSubmit: (source: DataSource) => void;
  onUseSample: () => void;
}

export function UploadPanel({
  isLoading,
  onSubmit,
  onUseSample,
}: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<InputMode>("file");
  const [text, setText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");

  const handleFile = async (file?: File) => {
    if (!file || isLoading) return;

    setError("");
    setFileName(file.name);
    setIsParsing(true);

    try {
      onSubmit(await parseFile(file));
    } catch (caught) {
      setFileName("");
      setError(
        caught instanceof Error ? caught.message : "Не удалось прочитать файл.",
      );
    } finally {
      setIsParsing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleText = () => {
    try {
      setError("");
      onSubmit(textToSource(text));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Добавьте чуть больше данных — хотя бы одно полное предложение.",
      );
    }
  };

  const busy = isLoading || isParsing;

  return (
    <div className="panel-frame overflow-hidden rounded-2xl border border-white/70 bg-white/80 backdrop-blur-xl">
      <div className="flex">
        <div className="hidden w-1.5 shrink-0 bg-[var(--accent)] sm:block" />
        <div className="min-w-0 flex-1 p-5 sm:p-6">
          <div className="mb-5">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-[var(--steel)] uppercase">
              Начните с данных
            </p>
            <h2 className="font-display mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--ink)]">
              Загрузите отчёт
            </h2>

            <div className="mt-4 flex gap-6 border-b border-[var(--line)]">
              {(
                [
                  ["file", "Файл", FileSpreadsheet],
                  ["text", "Текст", TextCursorInput],
                ] as const
              ).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setMode(value);
                    setError("");
                  }}
                  className={cn(
                    "relative -mb-px flex items-center gap-1.5 pb-2.5 text-sm font-medium transition",
                    mode === value
                      ? "text-[var(--ink)]"
                      : "text-[var(--muted)] hover:text-[var(--ink)]",
                  )}
                >
                  <Icon className="size-3.5" />
                  {label}
                  {mode === value && (
                    <motion.span
                      layoutId="upload-tab"
                      className="absolute inset-x-0 -bottom-px h-0.5 bg-[var(--accent)]"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {mode === "file" ? (
              <motion.div
                key="file"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
              >
                <input
                  ref={inputRef}
                  className="hidden"
                  type="file"
                  accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(event) => void handleFile(event.target.files?.[0])}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => inputRef.current?.click()}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsDragging(false);
                    void handleFile(event.dataTransfer.files?.[0]);
                  }}
                  className={cn(
                    "group flex min-h-52 w-full flex-col items-center justify-center rounded-xl border border-dashed px-6 text-center transition-all duration-300",
                    isDragging
                      ? "scale-[0.99] border-[var(--accent)] bg-[var(--accent-soft)]/50"
                      : "border-[var(--line)] bg-[var(--card)] hover:border-[var(--steel)] hover:bg-white",
                  )}
                >
                  <span
                    className={cn(
                      "mb-4 grid size-12 place-items-center rounded-lg border transition duration-300",
                      isDragging
                        ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                        : "border-[var(--line)] bg-white text-[var(--steel)] group-hover:-translate-y-0.5",
                    )}
                  >
                    {isParsing ? (
                      <LoaderCircle className="size-5 animate-spin" />
                    ) : (
                      <UploadCloud className="size-5" />
                    )}
                  </span>
                  <span className="text-sm font-semibold text-[var(--ink)]">
                    {isParsing
                      ? `Читаем ${fileName}`
                      : "Перетащите CSV или Excel сюда"}
                  </span>
                  <span className="mt-1.5 text-xs text-[var(--muted)]">
                    или нажмите, чтобы выбрать файл · до 5 МБ
                  </span>
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="text"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
              >
                <div className="relative">
                  <textarea
                    value={text}
                    disabled={busy}
                    maxLength={MAX_CONTEXT_LENGTH}
                    onChange={(event) => setText(event.target.value)}
                    placeholder={
                      "Например: За неделю выручка выросла на 18%...\nБольше всего заказов пришло во вторник — 246."
                    }
                    className="min-h-52 w-full resize-none rounded-xl border border-[var(--line)] bg-[var(--card)] px-5 py-4 text-sm leading-6 text-[var(--ink)] outline-none transition placeholder:text-[#9aabba] focus:border-[var(--steel)] focus:bg-white focus:ring-4 focus:ring-[var(--steel)]/15"
                  />
                  <span className="absolute right-4 bottom-3 text-[10px] text-[var(--muted)]">
                    {text.length.toLocaleString("ru-RU")} знаков
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-3 flex items-start gap-2 rounded-lg border border-[#ffc4b0] bg-[#fff1ec] px-3.5 py-3 text-xs leading-5 text-[var(--warn)]"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {error}
            </motion.div>
          )}

          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row-reverse sm:items-center">
            {mode === "text" ? (
              <button
                type="button"
                disabled={busy}
                onClick={handleText}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-3.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none sm:min-w-48"
              >
                {isLoading ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Создать дашборд
              </button>
            ) : null}

            <button
              type="button"
              disabled={busy}
              onClick={onUseSample}
              className="group flex flex-1 items-center justify-center gap-2 rounded-lg border border-[var(--navy)]/20 bg-white px-4 py-3.5 text-sm font-semibold text-[var(--navy)] transition hover:border-[var(--navy)] hover:bg-[var(--navy)] hover:text-white disabled:opacity-50"
            >
              Демо-отчёт
              <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
            </button>

            {mode === "file" ? (
              <p className="text-center text-xs text-[var(--muted)] sm:mr-auto sm:text-left">
                Нет файла — откройте пример
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
