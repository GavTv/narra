import type { DataSource, ReportChunk, ReportIndex } from "../model/types";

const TEXT_CHUNK_SIZE = 800;
const TEXT_CHUNK_OVERLAP = 120;

function cellText(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value).replace(/\s+/g, " ").trim();
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

  return [
    `Источник: ${source.name}`,
    `Строк данных: ${source.stats.rows}`,
    `Колонок: ${source.stats.columns}`,
    `Колонки: ${source.headers.join(", ")}`,
  ].join("\n");
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
