"use client";

import { useRef, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
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
    <div className="soft-shadow overflow-hidden rounded-[28px] border border-white/80 bg-white/72 p-2 backdrop-blur-xl">
      <div className="rounded-[22px] border border-[#dfe1da] bg-[#fbfbf8] p-4 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.16em] text-[#798079] uppercase">
              Начните с данных
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[#19221e]">
              Загрузите отчёт
            </h2>
          </div>

          <div className="flex rounded-full border border-[#dcdfd8] bg-[#f0f1ec] p-1">
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
                  "flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition",
                  mode === value
                    ? "bg-white text-[#17201c] shadow-sm"
                    : "text-[#747b75] hover:text-[#17201c]",
                )}
              >
                <Icon className="size-3.5" />
                {label}
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
                  "group flex min-h-56 w-full flex-col items-center justify-center rounded-[20px] border border-dashed px-6 text-center transition-all duration-300",
                  isDragging
                    ? "scale-[0.99] border-[#7da638] bg-[#f0ffd0]"
                    : "border-[#cfd3cb] bg-[#f5f5f1] hover:border-[#9da59d] hover:bg-[#f8f8f4]",
                )}
              >
                <span
                  className={cn(
                    "mb-4 grid size-14 place-items-center rounded-2xl border transition duration-300",
                    isDragging
                      ? "rotate-3 border-[#badf57] bg-[#d7ff64]"
                      : "border-[#d9ddd5] bg-white group-hover:-translate-y-1",
                  )}
                >
                  {isParsing ? (
                    <LoaderCircle className="size-6 animate-spin" />
                  ) : (
                    <UploadCloud className="size-6" />
                  )}
                </span>
                <span className="text-sm font-semibold text-[#222c27]">
                  {isParsing
                    ? `Читаем ${fileName}`
                    : "Перетащите CSV или Excel сюда"}
                </span>
                <span className="mt-1.5 text-xs text-[#788079]">
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
                  placeholder={"Например: За неделю выручка выросла на 18%...\nБольше всего заказов пришло во вторник — 246."}
                  className="min-h-56 w-full resize-none rounded-[20px] border border-[#d9ddd5] bg-[#f5f5f1] px-5 py-4 text-sm leading-6 text-[#222c27] outline-none transition placeholder:text-[#a1a8a2] focus:border-[#94a06e] focus:bg-white focus:ring-4 focus:ring-[#d7ff64]/25"
                />
                <span className="absolute right-4 bottom-3 text-[10px] text-[#979e98]">
                  {text.length.toLocaleString("ru-RU")} знаков
                </span>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={handleText}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#17201c] px-5 py-3.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#26332d] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4 text-[#d7ff64]" />
                )}
                Создать дашборд
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-3 flex items-start gap-2 rounded-xl border border-[#ffd0c0] bg-[#fff2ed] px-3.5 py-3 text-xs leading-5 text-[#8a3d25]"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </motion.div>
        )}

        <div className="mt-4 flex items-center justify-between gap-4 border-t border-[#e3e5df] pt-4">
          <p className="text-xs text-[#8b928c]">
            Нет файла? Откройте готовый пример.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={onUseSample}
            className="group flex shrink-0 items-center gap-1.5 text-xs font-semibold text-[#35403a] transition hover:text-black disabled:opacity-50"
          >
            Демо-отчёт
            <ArrowUpRight className="size-3.5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
