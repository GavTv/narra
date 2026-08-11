"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, ScanSearch } from "lucide-react";
import { motion } from "motion/react";

const stages = [
  "Читаем структуру данных",
  "Ищем связи и аномалии",
  "Подбираем визуализации",
  "Собираем историю",
];

export function LoadingDashboard({ sourceName }: { sourceName: string }) {
  const [progress, setProgress] = useState(14);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setProgress((current) =>
        Math.min(92, current + Math.max(2, (94 - current) * 0.14)),
      );
    }, 420);

    return () => window.clearInterval(timer);
  }, []);

  const activeStage = Math.min(
    stages.length - 1,
    Math.floor(progress / (100 / stages.length)),
  );

  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 pt-24 pb-16 sm:px-6 lg:px-10">
      <div className="soft-shadow relative overflow-hidden rounded-3xl border border-white/70 bg-white/80 p-6 backdrop-blur sm:p-8">
        <div className="absolute -top-16 -right-10 size-56 rounded-full bg-[var(--accent)]/12 blur-3xl" />
        <div className="absolute -bottom-20 left-10 size-48 rounded-full bg-[var(--steel)]/15 blur-3xl" />

        <div className="relative">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--muted)]">
            <LoaderCircle className="size-3.5 animate-spin text-[var(--accent)]" />
            <span className="rounded-full bg-[var(--accent)]/10 px-2.5 py-1 font-semibold tracking-[0.12em] text-[var(--accent)] uppercase">
              AI-анализ
            </span>
            <span className="truncate">{sourceName}</span>
          </div>

          <motion.div
            key={activeStage}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 flex items-center gap-2 text-[var(--ink)]"
          >
            <ScanSearch className="size-5 text-[var(--steel)]" />
            <p className="font-display text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
              {stages[activeStage]}
            </p>
          </motion.div>

          <div className="mt-8 h-2 overflow-hidden rounded-full bg-[var(--line)]/70">
            <motion.div
              className="h-full rounded-full bg-[var(--accent)]"
              animate={{ width: `${progress}%` }}
              transition={{ ease: "easeOut", duration: 0.4 }}
            />
          </div>
          <div className="mt-3 flex justify-between text-[11px] text-[var(--muted)]">
            <span>Ничего не придумываем</span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="soft-shadow rounded-2xl border border-white/80 bg-white/80 p-4 sm:p-5"
          >
            <div className="shimmer h-3 w-24 rounded-full bg-[var(--line)]/70" />
            <div className="shimmer mt-3 h-8 w-32 rounded-xl bg-[var(--line)]/70" />
            <div className="shimmer mt-2 h-3 w-40 rounded-full bg-[var(--line)]/50" />
          </div>
        ))}
      </div>

      <div className="soft-shadow mt-5 rounded-2xl border border-white/80 bg-white/80 p-5">
        <div className="shimmer h-4 w-40 rounded-full bg-[var(--line)]/70" />
        <div className="shimmer mt-3 h-8 w-72 max-w-full rounded-xl bg-[var(--line)]/70" />
        <div className="shimmer mt-6 h-64 w-full rounded-2xl bg-[var(--line)]/35" />
      </div>
    </main>
  );
}
