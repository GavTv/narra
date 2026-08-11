"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
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
  { icon: typeof ArrowUpRight; className: string; glow: string }
> = {
  positive: {
    icon: ArrowUpRight,
    className: "bg-[#e4f7ee] text-[var(--ok)]",
    glow: "from-[#e4f7ee]/80",
  },
  warning: {
    icon: ArrowDownRight,
    className: "bg-[#ffe8df] text-[var(--warn)]",
    glow: "from-[#ffe8df]/80",
  },
  neutral: {
    icon: Minus,
    className: "bg-[#e7eef6] text-[var(--steel)]",
    glow: "from-[#e7eef6]/80",
  },
};

export function Dashboard({ source, analysis }: DashboardProps) {
  const [primaryChart, ...otherCharts] = analysis.charts;

  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 pt-24 pb-16 sm:px-6 lg:px-10">
      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="soft-shadow relative overflow-hidden rounded-3xl border border-white/70 bg-white/75 p-6 backdrop-blur sm:p-8"
      >
        <div className="absolute -top-16 -right-10 size-56 rounded-full bg-[var(--accent)]/12 blur-3xl" />
        <div className="absolute -bottom-20 left-10 size-48 rounded-full bg-[var(--steel)]/15 blur-3xl" />

        <div className="relative">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--muted)]">
            <span className="rounded-full bg-[var(--accent)]/10 px-2.5 py-1 font-semibold tracking-[0.12em] text-[var(--accent)] uppercase">
              {analysis.eyebrow}
            </span>
            <span className="truncate">{source.name}</span>
            <span aria-hidden>·</span>
            <span className="uppercase tracking-[0.08em]">
              {sourceKindLabel(source.kind)}
            </span>
            <span aria-hidden>·</span>
            <span>
              {source.stats.rows} строк
              {source.stats.columns > 0 ? ` · ${source.stats.columns} кол.` : ""}
            </span>
          </div>

          <h1 className="font-display mt-4 max-w-4xl text-[clamp(1.85rem,4vw,3.1rem)] leading-[1.1] font-semibold tracking-[-0.035em] text-[var(--ink)]">
            {analysis.title}
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--muted)]">
            {analysis.summary}
          </p>
        </div>
      </motion.header>

      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="mt-5 grid gap-3 sm:grid-cols-3"
      >
        {analysis.metrics.map((metric, index) => {
          const meta = toneMeta[metric.tone];
          const Icon = meta.icon;

          return (
            <motion.div
              key={`${metric.label}-${index}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.06 }}
              className={`soft-shadow relative overflow-hidden rounded-2xl border border-white/80 bg-gradient-to-br ${meta.glow} to-white/90 p-4 sm:p-5`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-[10px] font-semibold tracking-[0.1em] text-[var(--muted)] uppercase">
                  {metric.label}
                </p>
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-full ${meta.className}`}
                >
                  <Icon className="size-3.5" />
                </span>
              </div>
              <p className="font-display mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
                {metric.value}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">{metric.detail}</p>
            </motion.div>
          );
        })}
      </motion.section>

      {primaryChart ? (
        <section className="mt-8">
          <div className="mb-4 flex items-end justify-between gap-4 px-1">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--steel)] uppercase">
                Главный график
              </p>
              <h2 className="font-display mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--ink)]">
                {primaryChart.title}
              </h2>
            </div>
            <span className="hidden rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-semibold tracking-[0.1em] text-[var(--muted)] uppercase sm:block">
              01 / {String(analysis.charts.length).padStart(2, "0")}
            </span>
          </div>
          <ChartCard chart={primaryChart} index={0} wide />
        </section>
      ) : (
        <section className="mt-8 rounded-2xl border border-dashed border-[var(--line)] bg-white/50 px-5 py-4 text-sm leading-6 text-[var(--muted)]">
          Для текста графики не строим — без таблицы это получается шум. Ниже
          можно спросить про факты, цифры и формулировки из отчёта.
        </section>
      )}

      {otherCharts.length > 0 && (
        <section className="mt-6 grid gap-4 md:grid-cols-2">
          {otherCharts.map((chart, index) => (
            <div key={chart.id}>
              <div className="mb-3 flex items-end justify-between gap-3 px-1">
                <h3 className="font-display text-lg font-semibold tracking-[-0.02em] text-[var(--ink)]">
                  {chart.title}
                </h3>
                <span className="rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-semibold tracking-[0.1em] text-[var(--muted)] uppercase">
                  {String(index + 2).padStart(2, "0")}
                </span>
              </div>
              <ChartCard chart={chart} index={index + 1} />
            </div>
          ))}
        </section>
      )}

      <div className="mt-10">
        <ReportChat
          key={`${source.name}-${source.stats.characters}`}
          source={source}
        />
      </div>
    </main>
  );
}
