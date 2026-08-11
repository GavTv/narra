"use client";

import { BarChart3, ChartPie, LineChart as LineChartIcon, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";

import type { ChartSpec } from "@/entities/analysis";
import { formatNumber } from "@/shared/lib/format";

const colors = ["#17201c", "#d7ff64", "#78cda4", "#ff8b5c", "#9aa5ff", "#f3c95f"];

function ChartTooltip({
  active,
  payload,
  label,
}: Partial<TooltipContentProps<number, string>>) {
  if (!active || !payload?.length) return null;

  const resolvedLabel =
    label ?? (payload[0]?.payload as { label?: string } | undefined)?.label;

  return (
    <div className="min-w-32 rounded-xl border border-white/60 bg-[#17201c]/94 px-3 py-2.5 text-white shadow-xl backdrop-blur-md">
      <p className="mb-1.5 text-[10px] font-medium text-white/50">
        {resolvedLabel}
      </p>
      {payload.map((item) => (
        <div
          key={String(item.dataKey)}
          className="flex items-center justify-between gap-5 text-xs"
        >
          <span className="flex items-center gap-1.5 text-white/65">
            <i
              className="size-1.5 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {item.name}
          </span>
          <strong className="font-semibold">
            {formatNumber(Number(item.value))}
          </strong>
        </div>
      ))}
    </div>
  );
}

function ChartVisual({ chart }: { chart: ChartSpec }) {
  const hasSecondary = chart.data.some((item) => item.secondary !== undefined);

  if (chart.type === "pie") {
    const data = chart.data.filter((item) => item.value > 0);

    return (
      <div className="grid h-full grid-cols-[minmax(0,1fr)_112px] items-center gap-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius="57%"
              outerRadius="83%"
              paddingAngle={3}
              stroke="transparent"
            >
              {data.map((item, index) => (
                <Cell key={`${item.label}-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-2.5">
          {data.slice(0, 5).map((item, index) => (
            <div key={`${item.label}-legend`} className="min-w-0">
              <div className="flex items-center gap-1.5">
                <i
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ background: colors[index % colors.length] }}
                />
                <span className="truncate text-[10px] text-[#7a827c]">
                  {item.label}
                </span>
              </div>
              <p className="mt-0.5 pl-3 text-xs font-semibold text-[#26302b]">
                {formatNumber(item.value)}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (chart.type === "line") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chart.data} margin={{ top: 10, right: 8, left: -24, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#e5e7e1" strokeDasharray="3 5" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#8a918b", fontSize: 10 }}
            dy={8}
            interval="preserveStartEnd"
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#a0a6a1", fontSize: 10 }}
            tickFormatter={(value: number) => formatNumber(value, true)}
          />
          <Tooltip cursor={{ stroke: "#9da49e", strokeDasharray: "3 3" }} content={<ChartTooltip />} />
          <Line
            type="monotone"
            dataKey="value"
            name={chart.valueLabel}
            stroke="#17201c"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "#f8f8f4", stroke: "#17201c", strokeWidth: 2 }}
            activeDot={{ r: 5, fill: "#d7ff64", stroke: "#17201c", strokeWidth: 2 }}
          />
          {hasSecondary && (
            <Line
              type="monotone"
              dataKey="secondary"
              name={chart.secondaryLabel ?? "Сравнение"}
              stroke="#78cda4"
              strokeWidth={2.5}
              strokeDasharray="5 4"
              dot={false}
              activeDot={{ r: 4, fill: "#78cda4", stroke: "#fff", strokeWidth: 2 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chart.data} margin={{ top: 10, right: 8, left: -24, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#e5e7e1" strokeDasharray="3 5" />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#8a918b", fontSize: 10 }}
          dy={8}
          interval="preserveStartEnd"
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#a0a6a1", fontSize: 10 }}
          tickFormatter={(value: number) => formatNumber(value, true)}
        />
        <Tooltip cursor={{ fill: "#eef0e9" }} content={<ChartTooltip />} />
        <Bar
          dataKey="value"
          name={chart.valueLabel}
          fill="#17201c"
          radius={[7, 7, 2, 2]}
          maxBarSize={32}
        />
        {hasSecondary && (
          <Bar
            dataKey="secondary"
            name={chart.secondaryLabel ?? "Сравнение"}
            fill="#a9f7d1"
            radius={[7, 7, 2, 2]}
            maxBarSize={32}
          />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}

const typeMeta = {
  bar: { icon: BarChart3, label: "Сравнение" },
  line: { icon: LineChartIcon, label: "Динамика" },
  pie: { icon: ChartPie, label: "Структура" },
} as const;

export function ChartCard({
  chart,
  index,
}: {
  chart: ChartSpec;
  index: number;
}) {
  const { icon: Icon, label } = typeMeta[chart.type];

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 * index, duration: 0.45, ease: "easeOut" }}
      className="soft-shadow flex min-h-[430px] flex-col rounded-[24px] border border-white/85 bg-[#fbfbf8]/90 p-5 backdrop-blur sm:p-6"
    >
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] text-[#89908a] uppercase">
            <Icon className="size-3" />
            {label}
          </div>
          <h3 className="truncate text-lg font-semibold tracking-[-0.025em] text-[#1b2520]">
            {chart.title}
          </h3>
          <p className="mt-1 text-xs text-[#7d847e]">{chart.subtitle}</p>
        </div>
        <span className="grid size-8 shrink-0 place-items-center rounded-full border border-[#e0e3dc] bg-white text-[#56605a]">
          <span className="text-[10px] font-semibold">0{index + 1}</span>
        </span>
      </header>

      <div className="mt-5 h-[245px] min-h-0">
        <ChartVisual chart={chart} />
      </div>

      <footer className="mt-auto flex items-start gap-2.5 border-t border-[#e7e8e3] pt-4">
        <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-[#efffd0]">
          <Sparkles className="size-3 text-[#5f7d24]" />
        </span>
        <p className="text-xs leading-5 text-[#68716b]">{chart.insight}</p>
      </footer>
    </motion.article>
  );
}
