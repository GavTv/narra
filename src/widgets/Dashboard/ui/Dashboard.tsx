"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  FileSpreadsheet,
  Minus,
  RotateCcw,
  Rows3,
  Sparkles,
} from "lucide-react";
import { motion } from "motion/react";

import type { DashboardAnalysis, Metric } from "@/entities/analysis";
import type { DataSource } from "@/entities/report";
import { sourceKindLabel } from "@/entities/report";
import { ReportChat } from "@/widgets/ReportChat";

import { ChartCard } from "./ChartCard";

interface DashboardProps {
  source: DataSource;
  analysis: DashboardAnalysis;
  onReset: () => void;
}

const toneMeta: Record<
  Metric["tone"],
  { icon: typeof ArrowUpRight; className: string }
> = {
  positive: {
    icon: ArrowUpRight,
    className: "bg-[#e3f9eb] text-[#397054]",
  },
  warning: {
    icon: ArrowDownRight,
    className: "bg-[#fff0e9] text-[#a64e2d]",
  },
  neutral: {
    icon: Minus,
    className: "bg-[#eef0eb] text-[#69716b]",
  },
};

export function Dashboard({ source, analysis, onReset }: DashboardProps) {
  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 pt-24 pb-16 sm:px-6 lg:px-10">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#d9dcd5] bg-white/70">
            <FileSpreadsheet className="size-4.5 text-[#3d4842]" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-[#27312c]">
                {source.name}
              </p>
              <span className="rounded-full bg-[#e8ebe4] px-2 py-0.5 text-[9px] font-semibold tracking-[0.08em] text-[#737b75] uppercase">
                {sourceKindLabel(source.kind)}
              </span>
            </div>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#868e88]">
              <Rows3 className="size-3" />
              {source.stats.rows} строк
              {source.stats.columns > 0 && ` · ${source.stats.columns} колонок`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="flex w-fit items-center gap-2 rounded-xl border border-[#d5d8d1] bg-white/60 px-3.5 py-2.5 text-xs font-medium text-[#525c56] transition hover:border-[#b9beb6] hover:bg-white"
        >
          <RotateCcw className="size-3.5" />
          Другой отчёт
        </button>
      </motion.div>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(260px,0.55fr)]">
        <motion.article
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="fine-grid relative overflow-hidden rounded-[24px] bg-[#17201c] p-5 text-white sm:p-7 lg:p-8"
        >
          <div className="absolute -top-24 -right-16 size-80 rounded-full bg-[#d7ff64]/18 blur-[75px]" />
          <div className="absolute right-1/4 -bottom-28 size-72 rounded-full bg-[#7de0ae]/12 blur-[80px]" />

          <div className="relative flex flex-col">
            <div className="mb-8 flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[10px] font-semibold tracking-[0.13em] text-white/72 uppercase backdrop-blur">
                <Sparkles className="size-3 text-[#d7ff64]" />
                {analysis.eyebrow}
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-white/42">
                <CheckCircle2 className="size-3 text-[#a9f7d1]" />
                Только факты отчёта
              </span>
            </div>

            <div className="max-w-3xl">
              <h1 className="text-balance text-[clamp(1.75rem,3.6vw,3.25rem)] leading-[1.05] font-semibold tracking-[-0.05em]">
                {analysis.title}
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/60">
                {analysis.summary}
              </p>
            </div>
          </div>
        </motion.article>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          {analysis.metrics.map((metric, index) => {
            const meta = toneMeta[metric.tone];
            const Icon = meta.icon;

            return (
              <motion.article
                key={`${metric.label}-${index}`}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + index * 0.08, duration: 0.4 }}
                className="soft-shadow flex flex-col justify-between rounded-[20px] border border-white/85 bg-[#fbfbf8]/92 p-4 backdrop-blur"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[10px] font-semibold tracking-[0.1em] text-[#7e867f] uppercase">
                    {metric.label}
                  </p>
                  <span className={`grid size-7 shrink-0 place-items-center rounded-full ${meta.className}`}>
                    <Icon className="size-3.5" />
                  </span>
                </div>
                <div className="mt-3">
                  <p className="truncate text-2xl font-semibold tracking-[-0.05em] text-[#1b2520] sm:text-3xl">
                    {metric.value}
                  </p>
                  <p className="mt-1 truncate text-[11px] text-[#838b85]">
                    {metric.detail}
                  </p>
                </div>
              </motion.article>
            );
          })}
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-4">
          <p className="text-[10px] font-semibold tracking-[0.14em] text-[#828a84] uppercase">
            Графики
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.04em] text-[#1b2520]">
            Динамика и структура
          </h2>
        </div>

        <div
          className={`grid gap-3 ${
            analysis.charts.length === 1
              ? "grid-cols-1"
              : analysis.charts.length === 2
                ? "grid-cols-1 md:grid-cols-2"
                : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
          }`}
        >
          {analysis.charts.map((chart, index) => (
            <ChartCard
              key={chart.id}
              chart={chart}
              index={index}
              wide={analysis.charts.length === 1}
            />
          ))}
        </div>
      </section>

      <div className="mt-8">
        <ReportChat
          key={`${source.name}-${source.stats.characters}`}
          source={source}
          suggestions={analysis.suggestedQuestions}
        />
      </div>
    </main>
  );
}
