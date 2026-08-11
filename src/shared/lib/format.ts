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
  return new Intl.NumberFormat("ru-RU", {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: Number.isInteger(value) ? 0 : 1,
  }).format(value);
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function makeId(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
