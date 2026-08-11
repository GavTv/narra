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

function inferReportName(blob: string): string {
  const text = blob.toLowerCase();
  if (/выруч|заказ|товар|продаж|sales|revenue|order|product/.test(text)) {
    return "Продажи";
  }
  if (/авто|машин|car|пробег|mileage|выпуск/.test(text)) return "Авто";
  if (/квартир|дом|недвиж|риелт|realty|площад/.test(text)) {
    return "Недвижимость";
  }
  if (/лид|канал|расход|конверс|маркетинг|lead|campaign/.test(text)) {
    return "Маркетинг";
  }
  if (/баг|ошиб|ticket|jira|issue|спринт|cycle/.test(text)) return "Операции";
  if (/кандидат|вакан|найм|hiring|оффер|скрининг/.test(text)) return "Найм";
  return "Отчёт";
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

  const inferred = inferReportName(`${name} ${headers.join(" ")}`);
  const displayName =
    name === "Вставленный отчёт" || name === "Отчёт" || !name.trim()
      ? inferred
      : name;

  return {
    name: displayName,
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

function splitRow(line: string, delimiter: string) {
  if (delimiter === " ") {
    return line.trim().split(/\s+/).filter(Boolean);
  }
  if (delimiter === "  ") {
    return line
      .trim()
      .split(/\s{2,}/)
      .map((cell) => cell.trim())
      .filter((cell, index, arr) => cell || index < arr.length - 1);
  }
  if (delimiter === ",") {
    return Papa.parse<string[]>(line, { delimiter: "," }).data[0] ?? [];
  }
  return line.split(delimiter).map((cell) => cell.trim());
}

function detectDelimiter(lines: string[]): string | null {
  const sample = lines.slice(0, Math.min(6, lines.length));
  const candidates = ["\t", ";", ",", "  ", " "] as const;

  for (const delimiter of candidates) {
    const counts = sample.map((line) => splitRow(line, delimiter).length);
    const width = counts[0] ?? 0;
    if (width < 2) continue;
    if (counts.every((count) => count === width)) return delimiter;
    // allow ±1 for ragged last cells on space/csv
    if (
      delimiter !== " " &&
      counts.every((count) => Math.abs(count - width) <= 1 && count >= width - 1)
    ) {
      return delimiter;
    }
  }

  return null;
}

function looksLikeHeader(cells: string[]) {
  const headerLike = cells.filter((cell) =>
    /[a-zа-яё]/i.test(cell) && !/^-?\d+(?:[.,]\d+)?$/.test(cell),
  ).length;
  return headerLike >= Math.ceil(cells.length * 0.5);
}

/** Detect pasted TSV/CSV/spaced tables inside free text. */
export function tryParseTextTable(text: string): unknown[][] | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return null;

  const delimiter = detectDelimiter(lines);
  if (!delimiter) return null;

  const matrix = lines.map((line) => splitRow(line, delimiter));
  const width = matrix[0]?.length ?? 0;
  if (width < 2) return null;
  if (!looksLikeHeader(matrix[0].map(String))) return null;

  const aligned = matrix.filter((row) => row.length === width).length;
  if (aligned < 2 || aligned < matrix.length * 0.7) return null;

  const dataRows = matrix.slice(1);
  const numericHits = dataRows.reduce((total, row) => {
    return (
      total +
      row.filter((cell) => /^-?\d+(?:[.,]\d+)?$/.test(String(cell).replace(/\s/g, ""))).length
    );
  }, 0);

  // Need at least some numeric cells so prose paragraphs don't become "tables".
  if (numericHits < Math.max(1, dataRows.length)) return null;

  return matrix.filter((row) => row.length === width);
}

function inferTextTitle(text: string): string {
  const fromTopic = inferReportName(text);
  if (fromTopic !== "Отчёт") return fromTopic;

  const line = text
    .split(/\r?\n/)
    .map((item) => item.trim().replace(/^#+\s*/, ""))
    .find(
      (item) =>
        item.length >= 8 &&
        /[a-zа-яё]/i.test(item) &&
        !/^(дата|date)\b/i.test(item),
    );

  return line?.slice(0, 72) || "Текстовый отчёт";
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

  const matrix = tryParseTextTable(clean);
  if (matrix) {
    return tableToSource(matrix, inferReportName(matrix[0].join(" ")), "csv");
  }

  const content = clean.slice(0, MAX_CONTEXT_LENGTH);
  return {
    name: inferTextTitle(content),
    kind: "text",
    content,
    headers: [],
    rows: [],
    stats: {
      rows: content.split(/\n+/).filter(Boolean).length,
      columns: 0,
      characters: content.length,
    },
  };
}
