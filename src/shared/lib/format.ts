import type { CellValue } from "@/shared/types";

export function toNumber(value: CellValue): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") return null;

  const raw = value.trim();
  if (
    !raw ||
    /^(?:n\/a|na|null|none|нет|—|-)$/i.test(raw) ||
    /^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}$/.test(raw)
  ) {
    return null;
  }

  const normalized = raw
    .replace(/\s|\u00a0/g, "")
    .replace(/,(?=.*[.,])/g, "")
    .replace(",", ".")
    .replace(/[^0-9.+-]/g, "");

  if (!normalized || !/[0-9]/.test(normalized)) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatNumber(value: number, compact = false) {
  if (compact) {
    const absolute = Math.abs(value);
    if (absolute >= 1_000_000) {
      return `${trimFloat(value / 1_000_000)} млн`;
    }
    if (absolute >= 1_000) {
      return `${trimFloat(value / 1_000)} тыс`;
    }
  }

  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 1,
  }).format(value);
}

function trimFloat(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: Math.abs(value) >= 10 ? 0 : 1,
  }).format(value);
}

export function formatChartLabel(value: unknown, max = 10) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}.${iso[2]}`;

  const ru = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (ru) return `${ru[1]}.${ru[2]}`;

  return raw.length > max ? `${raw.slice(0, max - 1)}…` : raw;
}

export function chartDateKey(value: unknown) {
  const raw = String(value ?? "").trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const ru = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (ru) return `${ru[3]}-${ru[2]}-${ru[1]}`;

  return raw;
}

export function chartDateSortValue(value: unknown) {
  const key = chartDateKey(value);
  const match = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return Number.POSITIVE_INFINITY;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

type ChartPoint = {
  label: string;
  value: number;
  secondary?: number;
};

export function mergeChartPointsByDate(points: ChartPoint[], limit = 14) {
  const groups = new Map<
    string,
    { label: string; value: number; secondary?: number; sort: number }
  >();

  for (const point of points) {
    const key = chartDateKey(point.label) || point.label;
    const current = groups.get(key);
    if (!current) {
      groups.set(key, {
        label: formatChartLabel(point.label) || point.label,
        value: point.value,
        secondary: point.secondary,
        sort: chartDateSortValue(point.label),
      });
      continue;
    }

    current.value += point.value;
    if (point.secondary !== undefined) {
      current.secondary = (current.secondary ?? 0) + point.secondary;
    }
  }

  return [...groups.values()]
    .sort((a, b) => a.sort - b.sort)
    .slice(-limit)
    .map(({ label, value, secondary }) =>
      secondary === undefined ? { label, value } : { label, value, secondary },
    );
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function makeId(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
