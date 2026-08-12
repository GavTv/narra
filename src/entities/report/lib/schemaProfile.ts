import { toNumber } from "@/shared/lib/format";

import type { DataSource } from "../model/types";

function isDateHeader(name: string) {
  return /дата|date|день|day|месяц|month|период|period|время|time|week/i.test(
    name,
  );
}

function isDateLikeValue(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return false;
  return (
    /^\d{4}[-/.]\d{1,2}(?:[-/.]\d{1,2})?$/.test(raw) ||
    /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(raw) ||
    /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(raw)
  );
}

function idLikeHeader(name: string) {
  return /\bid\b|uuid|guid|инн|phone|телефон|email|e-mail|клиент|client|фио|name/i.test(
    name,
  );
}

function questionTokens(question: string) {
  return new Set(
    (question.toLowerCase().match(/[a-zа-яё0-9]{3,}/gi) ?? []).filter(
      (token) => !["какой", "какая", "где", "когда", "всего", "больше"].includes(token),
    ),
  );
}

export function inferDateColumnIndex(source: DataSource) {
  if (!source.headers.length || !source.rows.length) return -1;

  const byHeader = source.headers.findIndex((header) => isDateHeader(header));
  if (byHeader >= 0) return byHeader;

  let bestIndex = -1;
  let bestScore = 0;
  for (let index = 0; index < source.headers.length; index += 1) {
    const matches = source.rows.reduce(
      (acc, row) => acc + Number(isDateLikeValue(row[index])),
      0,
    );
    const score = matches / source.rows.length;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  return bestScore >= 0.6 ? bestIndex : -1;
}

export function inferBestCategoryIndex(
  source: DataSource,
  options: {
    excludeIndexes?: number[];
    question?: string;
  } = {},
) {
  if (!source.headers.length || !source.rows.length) return -1;
  const excluded = new Set(options.excludeIndexes ?? []);
  const tokens = options.question ? questionTokens(options.question) : null;

  let bestIndex = -1;
  let bestScore = -Infinity;

  for (let index = 0; index < source.headers.length; index += 1) {
    if (excluded.has(index)) continue;

    const header = source.headers[index] || `Колонка ${index + 1}`;
    if (idLikeHeader(header)) continue;

    let numericCount = 0;
    const distinct = new Set<string>();
    for (const row of source.rows) {
      const raw = row[index];
      if (toNumber(raw) !== null) numericCount += 1;
      const label = String(raw ?? "").trim();
      if (label) distinct.add(label);
    }

    const numericRatio = numericCount / source.rows.length;
    if (numericRatio > 0.75) continue;

    const distinctRatio = distinct.size / source.rows.length;
    if (distinctRatio > 0.95) continue;

    let score = 0;
    if (isDateHeader(header)) score += 12;
    if (
      /товар|product|item|категор|region|регион|район|город|канал|source|бренд|марка|клуб|филиал|тип|статус|этап/i.test(
        header,
      )
    ) {
      score += 8;
    }
    if (distinct.size >= 2 && distinct.size <= 20) score += 6;
    if (distinct.size > 20 && distinct.size <= 80) score += 2;

    if (tokens) {
      const headerTokens = header.toLowerCase().match(/[a-zа-яё0-9]{3,}/gi) ?? [];
      score += headerTokens.reduce((acc, token) => acc + Number(tokens.has(token)) * 5, 0);
    }

    score -= distinctRatio * 3;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  return bestIndex;
}
