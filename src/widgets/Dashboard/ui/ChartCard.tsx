"use client";

import { BarChart3, ChartPie, LineChart as LineChartIcon } from "lucide-react";
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
import { formatChartLabel, formatNumber } from "@/shared/lib/format";

const colors = ["#0f2744", "#ff4d2e", "#1f5f8b", "#c45c2a", "#5b8fb8", "#f3c95f"];

function ChartTooltip({
  active,
  payload,
  label,
}: Partial<TooltipContentProps<number, string>>) {
  if (!active || !payload?.length) return null;

  const resolvedLabel =
    label ?? (payload[0]?.payload as { label?: string } | undefined)?.label;

  return (
    <div className="min-w-32 rounded-lg border border-white/60 bg-[var(--navy)]/95 px-3 py-2.5 text-white shadow-xl backdrop-blur-md">
      <p className="mb-1.5 text-[10px] font-medium text-white/50">
        {formatChartLabel(resolvedLabel, 24) || resolvedLabel}
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

function compactTick(value: number) {
  return formatNumber(value, true);
}

function axisLabel(value: string) {
  return formatChartLabel(value);
}

function withShortLabels(chart: ChartSpec) {
  return chart.data.map((item) => ({
    ...item,
    label: formatChartLabel(item.label, 12) || item.label,
  }));
}

function ChartVisual({ chart }: { chart: ChartSpec }) {
  const data = withShortLabels(chart);
  const hasSecondary = data.some((item) => item.secondary !== undefined);

  if (chart.type === "pie") {
    const pieData = data.filter((item) => item.value > 0);

    return (
      <div className="grid h-full grid-cols-[minmax(0,1fr)_100px] items-center gap-1">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="82%"
              paddingAngle={3}
              stroke="transparent"
              isAnimationActive={false}
            >
              {pieData.map((item, index) => (
                <Cell key={`${item.label}-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-2">
          {pieData.slice(0, 4).map((item, index) => (
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
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <LineChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#e5e7e1" strokeDasharray="3 5" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#8a918b", fontSize: 10 }}
            dy={6}
            minTickGap={28}
            tickFormatter={axisLabel}
          />
          <YAxis
            width={40}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#a0a6a1", fontSize: 10 }}
            tickFormatter={compactTick}
          />
          <Tooltip cursor={{ stroke: "#8aa0b5", strokeDasharray: "3 3" }} content={<ChartTooltip />} />
          <Line
            type="monotone"
            dataKey="value"
            name={chart.valueLabel}
            stroke="#0f2744"
            strokeWidth={2.25}
            isAnimationActive={false}
            dot={{ r: 2.5, fill: "#f6f8fb", stroke: "#0f2744", strokeWidth: 1.5 }}
            activeDot={{ r: 4.5, fill: "#ff4d2e", stroke: "#0f2744", strokeWidth: 2 }}
          />
          {hasSecondary && (
            <Line
              type="monotone"
              dataKey="secondary"
              name={chart.secondaryLabel ?? "Сравнение"}
              stroke="#1f5f8b"
              strokeWidth={2}
              strokeDasharray="5 4"
              isAnimationActive={false}
              dot={false}
              activeDot={{ r: 4, fill: "#1f5f8b", stroke: "#fff", strokeWidth: 2 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#e5e7e1" strokeDasharray="3 5" />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#8a918b", fontSize: 10 }}
          dy={6}
          minTickGap={28}
          tickFormatter={axisLabel}
        />
        <YAxis
          width={40}
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#a0a6a1", fontSize: 10 }}
          tickFormatter={compactTick}
        />
        <Tooltip cursor={{ fill: "#eef0e9" }} content={<ChartTooltip />} />
        <Bar
          dataKey="value"
          name={chart.valueLabel}
          fill="#0f2744"
          radius={[6, 6, 2, 2]}
          maxBarSize={28}
          isAnimationActive={false}
        />
        {hasSecondary && (
          <Bar
            dataKey="secondary"
            name={chart.secondaryLabel ?? "Сравнение"}
            fill="#1f5f8b"
            radius={[6, 6, 2, 2]}
            maxBarSize={28}
            isAnimationActive={false}
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
  wide = false,
}: {
  chart: ChartSpec;
  index: number;
  wide?: boolean;
}) {
  const { icon: Icon, label } = typeMeta[chart.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06 * index, duration: 0.4, ease: "easeOut" }}
      className="soft-shadow overflow-hidden rounded-2xl border border-white/80 bg-white/90 p-4 sm:p-5"
    >
      <div className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.12em] text-[var(--steel)] uppercase">
        <span className="grid size-6 place-items-center rounded-lg bg-[var(--card)] text-[var(--navy)]">
          <Icon className="size-3" />
        </span>
        {label}
      </div>
      <div className={wide ? "h-[280px]" : "h-[220px]"}>
        <ChartVisual chart={chart} />
      </div>
    </motion.div>
  );
}
