import type { DataSource, ReportChunk, ReportIndex } from "../model/types";

const TEXT_CHUNK_SIZE = 800;
const TEXT_CHUNK_OVERLAP = 120;

function cellText(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value).replace(/\s+/g, " ").trim();
}

function isLikelyMetricColumn(source: DataSource, columnIndex: number) {
  const numericCount = source.rows.reduce((total, row) => {
    const raw = row[columnIndex];
    if (typeof raw === "number" && Number.isFinite(raw)) return total + 1;
    if (typeof raw !== "string") return total;
    const trimmed = raw.trim();
    if (!trimmed || /[a-zа-яё]/i.test(trimmed)) return total;
    return /^-?\d+(?:[.,]\d+)?$/.test(trimmed.replace(/\s/g, ""))
      ? total + 1
      : total;
  }, 0);

  return numericCount >= source.rows.length * 0.6;
}

function categoricalDistributions(source: DataSource) {
  if (!source.headers.length || !source.rows.length) return [];

  const blocks: string[] = [];

  for (let columnIndex = 0; columnIndex < source.headers.length; columnIndex += 1) {
    const header = source.headers[columnIndex];
    if (
      /кандидат|candidate|сотрудник|имя|фио|\bname\b|email|телефон|phone|\bid\b/i.test(
        header,
      )
    ) {
      continue;
    }
    if (isLikelyMetricColumn(source, columnIndex)) continue;

    const counts = new Map<string, number>();
    for (const row of source.rows) {
      const label = cellText(row[columnIndex]);
      if (!label || label === "—") continue;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }

    if (counts.size < 2 || counts.size > 80) continue;

    const ranked = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ru"))
      .slice(0, 40)
      .map(([value, count]) => `${value} — ${count}`)
      .join("; ");

    blocks.push(`${header} (все ${source.rows.length} строк): ${ranked}`);
  }

  return blocks;
}

function toNumericCell(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || /[a-zа-яё]/i.test(trimmed)) return null;
  const normalized = trimmed.replace(/\s/g, "").replace(",", ".");
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function numericTotals(source: DataSource) {
  if (!source.headers.length || !source.rows.length) return [];

  const lines: string[] = [];
  for (let columnIndex = 0; columnIndex < source.headers.length; columnIndex += 1) {
    if (!isLikelyMetricColumn(source, columnIndex)) continue;
    const header = source.headers[columnIndex];
    if (/год|year|выпуск|рейтинг|rating|id\b/i.test(header)) continue;

    const values = source.rows
      .map((row) => toNumericCell(row[columnIndex]))
      .filter((value): value is number => value !== null);
    if (values.length < source.rows.length * 0.6) continue;

    const sum = values.reduce((total, value) => total + value, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    lines.push(
      `${header}: сумма ${sum}, среднее ${Number(avg.toFixed(2))}, мин ${min}, макс ${max} (по ${values.length} значениям)`,
    );
  }
  return lines;
}

function schemaText(source: DataSource) {
  if (!source.headers.length) {
    return [
      `Источник: ${source.name}`,
      "Тип: неструктурированный текст",
      `Фрагментов: ${source.stats.rows}`,
      `Символов: ${source.stats.characters}`,
    ].join("\n");
  }

  const lines = [
    `Источник: ${source.name}`,
    `Строк данных: ${source.stats.rows}`,
    `Колонок: ${source.stats.columns}`,
    `Колонки: ${source.headers.join(", ")}`,
  ];

  const totals = numericTotals(source);
  if (totals.length) {
    lines.push("Итоги по числовым колонкам (полный файл, уже посчитано):");
    lines.push(...totals);
  }

  const distributions = categoricalDistributions(source);
  if (distributions.length) {
    lines.push("Распределения по категориям (полный файл):");
    lines.push(...distributions);
  }

  return lines.join("\n");
}

function tableChunks(source: DataSource): ReportChunk[] {
  return source.rows.map((row, index) => {
    const rowNumber = index + 2;
    const text = source.headers
      .map((header, columnIndex) => `${header}: ${cellText(row[columnIndex])}`)
      .join(" | ");

    return {
      id: `row-${rowNumber}`,
      kind: "row",
      text: `Строка ${rowNumber}. ${text}`,
      meta: {
        label: `Строка ${rowNumber}`,
        rowStart: rowNumber,
        rowEnd: rowNumber,
      },
    };
  });
}

function lineAt(content: string, offset: number) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (content[index] === "\n") line += 1;
  }
  return line;
}

function preferredBreak(content: string, start: number, tentativeEnd: number) {
  if (tentativeEnd >= content.length) return content.length;

  const minimumEnd = start + Math.floor(TEXT_CHUNK_SIZE * 0.6);
  const searchArea = content.slice(minimumEnd, tentativeEnd);
  const paragraphBreak = searchArea.lastIndexOf("\n\n");
  const lineBreak = searchArea.lastIndexOf("\n");
  const sentenceBreak = searchArea.lastIndexOf(". ");
  const bestBreak = Math.max(paragraphBreak, lineBreak, sentenceBreak);

  return bestBreak >= 0 ? minimumEnd + bestBreak + 1 : tentativeEnd;
}

function textChunks(source: DataSource): ReportChunk[] {
  const content = source.content.trim();
  const chunks: ReportChunk[] = [];
  let start = 0;

  while (start < content.length) {
    const tentativeEnd = Math.min(start + TEXT_CHUNK_SIZE, content.length);
    const end = preferredBreak(content, start, tentativeEnd);
    const text = content.slice(start, end).trim();

    if (text) {
      const lineStart = lineAt(content, start);
      const lineEnd = lineAt(content, end);
      const sequence = chunks.length + 1;
      const lineLabel =
        lineStart === lineEnd
          ? `строка ${lineStart}`
          : `строки ${lineStart}–${lineEnd}`;

      chunks.push({
        id: `text-${sequence}`,
        kind: "text",
        text,
        meta: {
          label: `Фрагмент ${sequence} · ${lineLabel}`,
          lineStart,
          lineEnd,
        },
      });
    }

    if (end >= content.length) break;
    start = Math.max(start + 1, end - TEXT_CHUNK_OVERLAP);
  }

  return chunks;
}

export function buildReportIndex(source: DataSource): ReportIndex {
  const schema = schemaText(source);
  const schemaChunk: ReportChunk = {
    id: "schema",
    kind: "schema",
    text: schema,
    meta: { label: "Структура отчёта" },
  };

  return {
    sourceName: source.name,
    schema,
    chunks: [
      schemaChunk,
      ...(source.headers.length && source.rows.length
        ? tableChunks(source)
        : textChunks(source)),
    ],
  };
}
