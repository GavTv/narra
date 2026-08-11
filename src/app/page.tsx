"use client";

import {
  AlertCircle,
  ArrowRight,
  Check,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import { motion } from "motion/react";

import { sampleData, type DataSource } from "@/entities/report";
import {
  LoadingDashboard,
  useAnalyzeSession,
} from "@/features/analyzeReport";
import { Dashboard } from "@/widgets/Dashboard";
import { Header } from "@/widgets/Header";
import { UploadPanel } from "@/widgets/UploadPanel";

function Landing({
  isLoading,
  error,
  onAnalyze,
}: {
  isLoading: boolean;
  error: string;
  onAnalyze: (source: DataSource) => void;
}) {
  return (
    <>
      <Header />
      <main className="mx-auto min-h-screen w-full max-w-[1440px] px-4 pt-28 pb-14 sm:px-6 lg:px-10 lg:pt-32">
        <section className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(440px,0.92fr)] lg:gap-14 xl:gap-20">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
          >
            <span className="inline-flex items-center gap-2 rounded-md border border-[var(--line)] bg-white/70 px-3 py-1.5 text-[10px] font-semibold tracking-[0.12em] text-[var(--steel)] uppercase backdrop-blur">
              <Sparkles className="size-3 text-[var(--accent)]" />
              AI data storyteller
            </span>
            <h1 className="font-display text-balance mt-6 max-w-3xl text-[clamp(2.6rem,5.8vw,5.6rem)] leading-[0.98] font-semibold tracking-[-0.04em] text-[var(--ink)]">
              Данные уже знают{" "}
              <span className="relative whitespace-nowrap">
                ответ.
                <motion.i
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.45, duration: 0.5 }}
                  className="absolute right-0 -bottom-1 left-0 -z-10 h-3 origin-left rounded-sm bg-[var(--accent)]/85 sm:h-4"
                />
              </span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-[var(--muted)] sm:text-lg sm:leading-8">
              Загрузите таблицу или вставьте сырой отчёт. Narra найдёт главный сигнал, подберёт графики и ответит на вопросы — без лишнего шума.
            </p>

            <div className="mt-8 flex flex-col gap-2.5 sm:max-w-md">
              {["CSV, Excel и текст", "Без регистрации", "Ответы только по данным"].map(
                (item) => (
                  <span
                    key={item}
                    className="flex items-center gap-2.5 text-sm font-medium text-[var(--ink)]/80"
                  >
                    <span className="grid size-5 place-items-center rounded-sm bg-[var(--navy)] text-white">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                    {item}
                  </span>
                ),
              )}
            </div>

            <div className="mt-12 hidden max-w-lg grid-cols-3 gap-4 border-t border-[var(--line)] pt-5 sm:grid">
              {[
                ["01", "Загрузите"],
                ["02", "Получите историю"],
                ["03", "Задайте вопрос"],
              ].map(([number, label]) => (
                <div key={number}>
                  <p className="font-display text-sm font-semibold text-[var(--accent)]">
                    {number}
                  </p>
                  <p className="mt-1 text-xs font-medium text-[var(--ink)]/70">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 22, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.12, duration: 0.6 }}
            className="relative"
          >
            <div className="absolute -inset-10 -z-10 rounded-full bg-[var(--steel)]/15 blur-3xl" />
            <UploadPanel
              isLoading={isLoading}
              onSubmit={onAnalyze}
              onUseSample={() => onAnalyze(sampleData)}
            />

            {error && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 flex items-start gap-2.5 rounded-xl border border-[#ffc4b0] bg-[#fff1ec] px-4 py-3.5 text-xs leading-5 text-[var(--warn)]"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>
                  <strong className="block font-semibold">Анализ не завершён</strong>
                  {error}
                </span>
              </motion.div>
            )}

            <div className="mt-5 flex items-center justify-center gap-2 text-[10px] text-[var(--muted)]">
              <LockKeyhole className="size-3" />
              Файл используется только для текущего анализа
            </div>
          </motion.div>
        </section>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-20 flex flex-col items-center justify-between gap-3 border-t border-[var(--line)] pt-5 text-[10px] text-[var(--muted)] sm:flex-row"
        >
          <span>© 2026 Narra</span>
          <span className="flex items-center gap-1.5">
            От сырого отчёта к решению
            <ArrowRight className="size-3" />
          </span>
        </motion.div>
      </main>
    </>
  );
}

export default function Home() {
  const { status, source, analysis, error, restored, analyze, reset } =
    useAnalyzeSession();

  if (!restored) {
    return (
      <>
        <Header />
        <main className="mx-auto min-h-screen w-full max-w-[1440px] px-4 pt-28" />
      </>
    );
  }

  if (status === "loading" && source) {
    return (
      <>
        <Header compact />
        <LoadingDashboard sourceName={source.name} />
      </>
    );
  }

  if (status === "ready" && source && analysis) {
    return (
      <>
        <Header compact />
        <Dashboard source={source} analysis={analysis} onReset={reset} />
      </>
    );
  }

  return (
    <Landing
      isLoading={status === "loading"}
      error={error}
      onAnalyze={(nextSource) => void analyze(nextSource)}
    />
  );
}
