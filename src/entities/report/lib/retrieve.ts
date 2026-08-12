import type { ReportChunk, ReportIndex } from "../model/types";

const STOP_WORDS = new Set([
  "а",
  "без",
  "был",
  "была",
  "были",
  "в",
  "во",
  "вот",
  "все",
  "где",
  "для",
  "его",
  "ее",
  "если",
  "есть",
  "же",
  "за",
  "и",
  "из",
  "или",
  "как",
  "какая",
  "какой",
  "кто",
  "ли",
  "мне",
  "на",
  "не",
  "но",
  "о",
  "об",
  "он",
  "она",
  "по",
  "про",
  "с",
  "со",
  "так",
  "то",
  "у",
  "что",
  "это",
  "the",
  "and",
  "for",
  "from",
  "how",
  "what",
  "with",
]);

const CANONICAL_PREFIXES: Array<[string, string]> = [
  ["выруч", "выручка"],
  ["заказ", "заказ"],
  ["продаж", "продажа"],
  ["товар", "товар"],
  ["продукт", "товар"],
  ["исполн", "выполн"],
  ["выполн", "выполн"],
  ["напит", "напиток"],
  ["drink", "напиток"],
  ["beverage", "напиток"],
  ["машин", "машина"],
  ["автомоб", "машина"],
  ["car", "машина"],
  ["vehicle", "машина"],
  ["марк", "марка"],
  ["модел", "модель"],
  ["дат", "дата"],
  ["прибыл", "выручка"],
  ["доход", "выручка"],
  ["расход", "расход"],
  ["сумм", "сумма"],
  ["средн", "среднее"],
  ["пик", "максимум"],
  ["пиков", "максимум"],
  ["peak", "максимум"],
  ["файл", "отчёт"],
  ["отчёт", "отчёт"],
  ["таблиц", "отчёт"],
  ["колон", "колонка"],
  ["столб", "колонка"],
  ["структур", "структура"],
  ["месяц", "месяц"],
  ["помесяч", "месяц"],
  ["количеств", "количество"],
  ["конвер", "конверсия"],
  ["обращен", "обращение"],
  ["лид", "лид"],
  ["revenue", "выручка"],
  ["sales", "продажа"],
  ["orders", "заказ"],
  ["order", "заказ"],
  ["product", "товар"],
  ["date", "дата"],
  ["average", "среднее"],
  ["maximum", "максимум"],
  ["minimum", "минимум"],
  ["total", "сумма"],
];

const RUSSIAN_ENDINGS = [
  "иями",
  "ями",
  "ами",
  "ого",
  "ему",
  "ыми",
  "ими",
  "ов",
  "ев",
  "ой",
  "ей",
  "ах",
  "ях",
  "ам",
  "ям",
  "ую",
  "юю",
  "ая",
  "яя",
  "ое",
  "ее",
  "ый",
  "ий",
  "ы",
  "и",
  "а",
  "я",
  "у",
  "ю",
  "е",
  "о",
];

function normalizeSearchToken(token: string) {
  const normalized = token.toLowerCase().replaceAll("ё", "е");

  for (const [prefix, canonical] of CANONICAL_PREFIXES) {
    if (normalized.startsWith(prefix)) return canonical;
  }

  if (/^\d+(?:[.,]\d+)?$/.test(normalized)) {
    return normalized.replace(",", ".");
  }

  if (/^[а-я]+$/.test(normalized) && normalized.length > 4) {
    const ending = RUSSIAN_ENDINGS.find(
      (candidate) =>
        normalized.endsWith(candidate) &&
        normalized.length - candidate.length >= 4,
    );
    if (ending) return normalized.slice(0, -ending.length);
  }

  if (/^[a-z]+$/.test(normalized) && normalized.length > 4) {
    return normalized.replace(/(?:ing|ed|es|s)$/, "");
  }

  return normalized;
}

export function tokenizeForSearch(text: string) {
  return (text.toLowerCase().match(/[a-zа-яё0-9]+(?:[.,]\d+)?/gi) ?? [])
    .map(normalizeSearchToken)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

type RankedChunk = {
  chunk: ReportChunk;
  score: number;
};

export function rankChunks(index: ReportIndex, question: string): RankedChunk[] {
  const queryTokens = tokenizeForSearch(question);
  if (!queryTokens.length) return [];

  const documents = index.chunks
    .filter((chunk) => chunk.kind !== "schema")
    .map((chunk) => ({ chunk, tokens: tokenizeForSearch(chunk.text) }));
  if (!documents.length) return [];

  const documentFrequency = new Map<string, number>();
  for (const { tokens } of documents) {
    for (const token of new Set(tokens)) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }

  const averageLength =
    documents.reduce((sum, document) => sum + document.tokens.length, 0) /
    documents.length;
  const queryPhrase = question.toLowerCase().replace(/\s+/g, " ").trim();
  const queryNumbers = queryTokens.filter((token) => /^\d/.test(token));

  return documents
    .map(({ chunk, tokens }) => {
      const frequencies = new Map<string, number>();
      for (const token of tokens) {
        frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
      }

      let score = 0;
      for (const token of queryTokens) {
        const frequency = frequencies.get(token) ?? 0;
        if (!frequency) continue;

        const frequencyInDocuments = documentFrequency.get(token) ?? 0;
        const inverseDocumentFrequency = Math.log(
          1 +
            (documents.length - frequencyInDocuments + 0.5) /
              (frequencyInDocuments + 0.5),
        );
        const normalizedFrequency =
          (frequency * 2.2) /
          (frequency +
            1.2 *
              (0.25 +
                0.75 * (tokens.length / Math.max(averageLength, 1))));
        score += inverseDocumentFrequency * normalizedFrequency;
      }

      const normalizedText = chunk.text.toLowerCase().replace(/\s+/g, " ");
      if (queryPhrase.length > 5 && normalizedText.includes(queryPhrase)) {
        score += 4;
      }
      score += queryNumbers.reduce(
        (boost, number) =>
          boost + (tokenizeForSearch(chunk.text).includes(number) ? 1.5 : 0),
        0,
      );

      return { chunk, score };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score);
}

export function retrieveChunks(
  index: ReportIndex,
  question: string,
  limit = 6,
) {
  const schema = index.chunks.find((chunk) => chunk.kind === "schema");
  const bodyChunks = index.chunks.filter((chunk) => chunk.kind !== "schema");
  const ranked = rankChunks(index, question)
    .slice(0, Math.max(1, limit - Number(Boolean(schema))))
    .map((result) => result.chunk);

  const evidence =
    ranked.length > 0
      ? ranked
      : bodyChunks.slice(0, Math.max(1, limit - Number(Boolean(schema))));

  return schema ? [schema, ...evidence] : evidence;
}
