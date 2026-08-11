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
      <main className="mx-auto min-h-screen w-full max-w-[1440px] px-4 pt-28 pb-14 sm:px-6 lg:px-10 lg:pt-36">
        <section className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(480px,0.8fr)] lg:gap-16 xl:gap-24">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-[#d8dbd3] bg-white/55 px-3 py-1.5 text-[10px] font-semibold tracking-[0.12em] text-[#69726c] uppercase backdrop-blur">
              <Sparkles className="size-3 text-[#6f8d32]" />
              AI data storyteller
            </span>
            <h1 className="text-balance mt-6 max-w-3xl text-[clamp(3rem,6.4vw,6.7rem)] leading-[0.95] font-semibold tracking-[-0.07em] text-[#17201c]">
              Данные уже знают{" "}
              <span className="relative whitespace-nowrap">
                ответ.
                <motion.i
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.45, duration: 0.5 }}
                  className="absolute right-0 -bottom-1 left-0 -z-10 h-4 origin-left rounded-full bg-[#d7ff64] sm:h-6"
                />
              </span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-[#68716b] sm:text-lg sm:leading-8">
              Загрузите таблицу или вставьте сырой отчёт. Narra найдёт главный сигнал, подберёт графики и ответит на вопросы — без лишнего шума.
            </p>

            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2.5">
              {["CSV, Excel и текст", "Без регистрации", "Ответы только по данным"].map(
                (item) => (
                  <span
                    key={item}
                    className="flex items-center gap-1.5 text-xs font-medium text-[#59635d]"
                  >
                    <span className="grid size-4 place-items-center rounded-full bg-[#dfeeb4]">
                      <Check className="size-2.5 text-[#527023]" strokeWidth={3} />
                    </span>
                    {item}
                  </span>
                ),
              )}
            </div>

            <div className="mt-12 hidden max-w-lg grid-cols-3 border-t border-[#d8dad4] pt-5 sm:grid">
              {[
                ["01", "Загрузите"],
                ["02", "Получите историю"],
                ["03", "Задайте вопрос"],
              ].map(([number, label]) => (
                <div key={number}>
                  <p className="text-[10px] font-semibold text-[#9aa19b]">{number}</p>
                  <p className="mt-1 text-xs font-medium text-[#4f5953]">{label}</p>
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
            <div className="absolute -inset-8 -z-10 rounded-full bg-[#a9f7d1]/20 blur-3xl" />
            <UploadPanel
              isLoading={isLoading}
              onSubmit={onAnalyze}
              onUseSample={() => onAnalyze(sampleData)}
            />

            {error && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 flex items-start gap-2.5 rounded-2xl border border-[#ffc9b7] bg-[#fff1eb] px-4 py-3.5 text-xs leading-5 text-[#8c4028]"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>
                  <strong className="block font-semibold">Анализ не завершён</strong>
                  {error}
                </span>
              </motion.div>
            )}

            <div className="mt-5 flex items-center justify-center gap-2 text-[10px] text-[#8c948e]">
              <LockKeyhole className="size-3" />
              Файл используется только для текущего анализа
            </div>
          </motion.div>
        </section>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-20 flex flex-col items-center justify-between gap-3 border-t border-[#d9dbd5] pt-5 text-[10px] text-[#969d97] sm:flex-row"
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
  const { status, source, analysis, error, analyze, reset } = useAnalyzeSession();

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
