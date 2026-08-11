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
    <div className="w-full">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex gap-1 rounded-2xl bg-[var(--navy)] p-1">
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
                "flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
                mode === value
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : "text-white/70 hover:text-white",
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={onUseSample}
          className="group flex items-center justify-center gap-2 self-start text-sm font-semibold text-[var(--navy)] underline decoration-[var(--accent)] decoration-2 underline-offset-4 transition hover:text-[var(--accent)] disabled:opacity-50 sm:self-auto"
        >
          Открыть демо-отчёт
          <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
        </button>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {mode === "file" ? (
          <motion.div
            key="file"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
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
                "group flex min-h-[260px] w-full flex-col items-start justify-between rounded-2xl border-2 border-dashed px-6 py-6 text-left transition-all duration-300 sm:min-h-[300px] sm:px-10 sm:py-10",
                isDragging
                  ? "border-[var(--accent)] bg-[var(--accent)]/10"
                  : "border-[var(--navy)]/20 bg-white/60 hover:border-[var(--navy)]/45 hover:bg-white/85",
              )}
            >
              <span
                className={cn(
                  "grid size-14 place-items-center rounded-2xl transition duration-300",
                  isDragging
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--navy)] text-[var(--accent)]",
                )}
              >
                {isParsing ? (
                  <LoaderCircle className="size-6 animate-spin" />
                ) : (
                  <UploadCloud className="size-6" />
                )}
              </span>
              <div>
                <span className="font-display block text-2xl font-semibold tracking-[-0.03em] text-[var(--ink)] sm:text-3xl">
                  {isParsing
                    ? `Читаем ${fileName}`
                    : "Перетащите CSV или Excel"}
                </span>
                <span className="mt-2 block text-sm text-[var(--muted)]">
                  или нажмите, чтобы выбрать файл · до 5 МБ
                </span>
              </div>
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="text"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <div className="relative overflow-hidden rounded-2xl border border-[var(--navy)]/15 bg-white/70">
              <textarea
                value={text}
                disabled={busy}
                maxLength={MAX_CONTEXT_LENGTH}
                onChange={(event) => setText(event.target.value)}
                placeholder={
                  "Можно вставить текст или таблицу, например:\nДата;Товар;Регион;Выручка;Заказы\n2026-08-01;Куртка;Москва;120000;12"
                }
                className="min-h-[260px] w-full resize-none bg-transparent px-6 py-5 text-sm leading-6 text-[var(--ink)] outline-none placeholder:text-[#9aabba] sm:min-h-[300px] sm:px-10 sm:py-8 sm:text-base"
              />
              <span className="absolute right-4 bottom-3 text-[10px] text-[var(--muted)]">
                {text.length.toLocaleString("ru-RU")} знаков
              </span>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={handleText}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-6 py-4 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-56"
            >
              {isLoading ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Разобрать текст
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-4 flex items-start gap-2 border border-[#ffc4b0] bg-[#fff1ec] px-3.5 py-3 text-xs leading-5 text-[var(--warn)]"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </motion.div>
      )}
    </div>
  );
}
