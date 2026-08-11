import Papa from "papaparse";

import type { CellValue, DataSource } from "@/entities/report";
import { formatFileSize } from "@/shared/lib/format";

import {
  MAX_CONTEXT_LENGTH,
  MAX_FILE_SIZE,
  MAX_TABLE_COLUMNS,
  MAX_TABLE_ROWS,
} from "../model/limits";

function normalizeCell(value: unknown): CellValue {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return value;
  }
  return value === undefined ? null : String(value);
}

function uniqueHeaders(row: CellValue[]) {
  const seen = new Map<string, number>();

  return row.slice(0, MAX_TABLE_COLUMNS).map((value, index) => {
    const base = String(value ?? "").trim() || `Колонка ${index + 1}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base} ${count}`;
  });
}

function tableToSource(
  matrix: unknown[][],
  name: string,
  kind: "csv" | "xlsx",
): DataSource {
  const normalized = matrix
    .filter((row) => row.some((cell) => String(cell ?? "").trim()))
    .map((row) => row.slice(0, MAX_TABLE_COLUMNS).map(normalizeCell));

  if (normalized.length < 2) {
    throw new Error("В таблице нужна строка заголовков и хотя бы одна строка данных.");
  }

  const headers = uniqueHeaders(normalized[0]);
  const allRows = normalized.slice(1);
  const rows = allRows.slice(0, MAX_TABLE_ROWS).map((row) =>
    headers.map((_, index) => row[index] ?? null),
  );
  const content = [
    headers.join("\t"),
    ...rows.map((row) => row.map((cell) => String(cell ?? "")).join("\t")),
  ]
    .join("\n")
    .slice(0, MAX_CONTEXT_LENGTH);

  return {
    name,
    kind,
    content,
    headers,
    rows,
    stats: {
      rows: rows.length,
      columns: headers.length,
      characters: content.length,
    },
  };
}

export async function parseFile(file: File): Promise<DataSource> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`Файл весит ${formatFileSize(file.size)}. Максимум — 5 МБ.`);
  }

  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "csv") {
    const text = await file.text();
    const result = Papa.parse<string[]>(text, {
      skipEmptyLines: "greedy",
    });

    if (!result.data.length) throw new Error("CSV-файл пуст.");
    return tableToSource(result.data, file.name, "csv");
  }

  if (extension === "xlsx") {
    const { readSheet } = await import("read-excel-file/browser");
    const rows = await readSheet(file);
    return tableToSource(rows, file.name, "xlsx");
  }

  throw new Error("Поддерживаются файлы CSV и XLSX.");
}

export function textToSource(text: string): DataSource {
  const clean = text.trim();
  if (clean.length < 20) {
    throw new Error("Добавьте чуть больше данных — хотя бы одно полное предложение.");
  }

  return {
    name: "Вставленный отчёт",
    kind: "text",
    content: clean.slice(0, MAX_CONTEXT_LENGTH),
    headers: [],
    rows: [],
    stats: {
      rows: clean.split(/\n+/).filter(Boolean).length,
      columns: 0,
      characters: clean.length,
    },
  };
}
