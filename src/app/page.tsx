"use client";

import {
  AlertCircle,
  ArrowRight,
  LockKeyhole,
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
      <main className="relative min-h-screen w-full overflow-hidden pt-16">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute top-0 left-0 h-[55vh] w-full bg-[var(--navy)]" />
          <div className="absolute top-[42vh] right-0 h-72 w-72 rounded-full bg-[var(--accent)]/30 blur-3xl" />
        </div>

        <section className="mx-auto w-full max-w-[1100px] px-4 pt-10 pb-8 sm:px-6 lg:px-10 lg:pt-14">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl text-white"
          >
            <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--accent)] uppercase">
              narra · AI data storyteller
            </p>
            <h1 className="font-display mt-4 text-[clamp(2.4rem,6vw,4.8rem)] leading-[1.02] font-semibold tracking-[-0.04em]">
              Данные уже знают ответ.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/65 sm:text-lg">
              Загрузите таблицу или вставьте отчёт — получите историю, графики и чат только по фактам файла.
            </p>
          </motion.div>
        </section>

        <section className="mx-auto w-full max-w-[1100px] px-4 pb-16 sm:px-6 lg:px-10">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.55 }}
            className="rounded-3xl border border-white/70 bg-[var(--paper)]/95 p-5 shadow-[0_24px_60px_rgb(11_21_36/16%)] backdrop-blur sm:p-8"
          >
            <UploadPanel
              isLoading={isLoading}
              onSubmit={onAnalyze}
              onUseSample={() => onAnalyze(sampleData)}
            />

            {error && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 flex items-start gap-2.5 border border-[#ffc4b0] bg-[#fff1ec] px-4 py-3.5 text-xs leading-5 text-[var(--warn)]"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>
                  <strong className="block font-semibold">Анализ не завершён</strong>
                  {error}
                </span>
              </motion.div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4 text-[11px] text-[var(--muted)]">
              <span className="flex items-center gap-1.5">
                <LockKeyhole className="size-3" />
                Файл только для текущего анализа · без регистрации
              </span>
              <span className="flex items-center gap-1.5">
                CSV · Excel · текст
                <ArrowRight className="size-3" />
              </span>
            </div>
          </motion.div>
        </section>
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
        <main className="min-h-screen w-full pt-16" />
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
        <Header compact onReset={reset} />
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
