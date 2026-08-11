"use client";

import { useEffect, useState } from "react";
import { Check, LoaderCircle, ScanSearch, Sparkles } from "lucide-react";
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
      setProgress((current) => Math.min(92, current + Math.max(2, (94 - current) * 0.14)));
    }, 420);

    return () => window.clearInterval(timer);
  }, []);

  const activeStage = Math.min(
    stages.length - 1,
    Math.floor(progress / (100 / stages.length)),
  );

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 pt-24 pb-16 sm:px-6 lg:px-10">
      <section className="mb-6 overflow-hidden rounded-[28px] bg-[#17201c] text-white">
        <div className="fine-grid relative min-h-[340px] p-6 sm:p-10">
          <div className="absolute -top-24 -right-16 size-72 rounded-full bg-[#d7ff64]/16 blur-3xl" />
          <div className="absolute -bottom-20 left-1/3 size-56 rounded-full bg-[#a9f7d1]/12 blur-3xl" />

          <div className="relative flex h-full min-h-[280px] flex-col justify-between">
            <div className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[11px] font-medium text-white/72">
                <LoaderCircle className="size-3.5 animate-spin text-[#d7ff64]" />
                AI-анализ
              </span>
              <span className="max-w-56 truncate text-xs text-white/45">
                {sourceName}
              </span>
            </div>

            <div className="max-w-2xl">
              <motion.div
                key={activeStage}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 flex items-center gap-2 text-sm text-[#d7ff64]"
              >
                <ScanSearch className="size-4" />
                {stages[activeStage]}
              </motion.div>
              <div className="shimmer h-10 w-[88%] rounded-xl bg-white/9" />
              <div className="shimmer mt-3 h-10 w-[62%] rounded-xl bg-white/9" />
              <div className="mt-8 h-2 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full bg-[#d7ff64]"
                  animate={{ width: `${progress}%` }}
                  transition={{ ease: "easeOut", duration: 0.4 }}
                />
              </div>
              <div className="mt-3 flex justify-between text-[11px] text-white/42">
                <span>Ничего не придумываем</span>
                <span>{Math.round(progress)}%</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {stages.slice(0, 3).map((stage, index) => (
          <div
            key={stage}
            className="rounded-[22px] border border-[#dedfd8] bg-white/60 p-5"
          >
            <div className="mb-8 flex items-center justify-between">
              <span className="text-xs font-medium text-[#7a827c]">{stage}</span>
              <span className="grid size-7 place-items-center rounded-full bg-[#edf0e9]">
                {index < activeStage ? (
                  <Check className="size-3.5 text-[#3d6f53]" />
                ) : (
                  <Sparkles className="size-3.5 text-[#8d958f]" />
                )}
              </span>
            </div>
            <div className="shimmer h-36 rounded-2xl bg-[#e9ebe5]" />
          </div>
        ))}
      </section>
    </main>
  );
}
