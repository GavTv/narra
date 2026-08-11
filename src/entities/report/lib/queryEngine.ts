import type { ChatAnswer, ChatCitation } from "@/entities/chat";
import { formatNumber, toNumber } from "@/shared/lib/format";

import { answerSalesQuestion } from "./localAnalysis";
import { tokenizeForSearch } from "./retrieve";
import type { DataSource } from "../model/types";

type Operation = "sum" | "average" | "min" | "max" | "count";

type NumericColumn = {
  index: number;
  name: string;
  values: Array<{ rowIndex: number; value: number }>;
};

type CategoryColumn = {
  index: number;
  name: string;
};

function numericColumns(source: DataSource): NumericColumn[] {
  return source.headers
    .map((name, index) => {
      const values = source.rows.flatMap((row, rowIndex) => {
        const value = toNumber(row[index]);
        return value === null ? [] : [{ rowIndex, value }];
      });

      if (!values.length || values.length < source.rows.length * 0.6) return null;
      return { index, name, values };
    })
    .filter((column): column is NumericColumn => column !== null);
}

function categoryColumns(
  source: DataSource,
  numeric: NumericColumn[],
): CategoryColumn[] {
  const numericIndexes = new Set(numeric.map((column) => column.index));

  return source.headers
    .map((name, index) => ({ index, name }))
    .filter((column) => !numericIndexes.has(column.index));
}

function operationFromQuestion(question: string): Operation | null {
  const normalized = question.toLowerCase();

  if (/средн|average|mean/.test(normalized)) return "average";
  // «неприбыльный / убыточный» раньше «прибыльный»
  if (
    /не\s*прибыльн|наименее\s+прибыльн|убыточн|худш|сам[а-яё]*\s+не\s*прибыльн/.test(
      normalized,
    )
  ) {
    return "min";
  }
  if (
    /максим|наибольш|сам[а-яё]*\s+(?:больш|высок|прибыльн|доходн|выгодн)|пик|пиков|прибыльн|доходн|выгодн|maximum|max\b|peak/.test(
      normalized,
    )
  ) {
    return "max";
  }
  if (/миним|наименьш|сам[а-яё]*\s+(?:мал|низк)|minimum|min\b/.test(normalized)) {
    return "min";
  }
  if (/сумм|итог|всего|total/.test(normalized)) return "sum";
  if (/сколько|количеств|count/.test(normalized)) return "count";

  return null;
}

function isStructureQuestion(question: string) {
  return /что\s+(?:это|за)|что\s+за\s+(?:файл|отч|таблиц)|какой\s+(?:это\s+)?файл|о\s+ч[её]м\s+(?:этот\s+)?(?:файл|отч)|структур|какие\s+колон|какие\s+столб|опиши\s+(?:файл|отч|таблиц)|что\s+внутри|из\s+чего\s+состоит/i.test(
    question,
  );
}

function isMonthQuestion(question: string) {
  return /месяц|помесяч|по\s+месяц/i.test(question);
}

function isTemporalQuestion(question: string) {
  return (
    isMonthQuestion(question) ||
    /когда|в\s+какой\s+день|по\s+дням|по\s+датам|за\s+какой\s+день|в\s+какую\s+дат|квартал/i.test(
      question,
    )
  );
}

function dateLikeColumn(categories: CategoryColumn[]) {
  return (
    categories.find((column) =>
      /дата|date|день|day|месяц|month|период|period|время|time|week/i.test(
        column.name,
      ),
    ) ?? null
  );
}

const MONTHS_RU = [
  "январь",
  "февраль",
  "март",
  "апрель",
  "май",
  "июнь",
  "июль",
  "август",
  "сентябрь",
  "октябрь",
  "ноябрь",
  "декабрь",
] as const;

function monthLabelFromCell(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const iso = raw.match(/^(\d{4})-(\d{2})(?:-\d{2})?/);
  if (iso) {
    const month = Number(iso[2]);
    if (month >= 1 && month <= 12) {
      return `${MONTHS_RU[month - 1]} ${iso[1]}`;
    }
  }

  const ru = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (ru) {
    const month = Number(ru[2]);
    if (month >= 1 && month <= 12) {
      return `${MONTHS_RU[month - 1]} ${ru[3]}`;
    }
  }

  const named = raw.match(
    /^(январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)[а-яё]*\s+(\d{4})$/i,
  );
  if (named) {
    const index = MONTHS_RU.findIndex((month) =>
      month.startsWith(named[1].toLowerCase().slice(0, 3)),
    );
    if (index >= 0) return `${MONTHS_RU[index]} ${named[2]}`;
  }

  return null;
}

function answerStructureQuestion(source: DataSource): ChatAnswer {
  if (!source.headers.length) {
    return {
      answer: `Это текстовый файл «${source.name}»: около ${source.stats.rows} фрагментов, ${formatNumber(source.stats.characters)} символов. Можно спросить о фактах и формулировках из текста.`,
      citations: [{ id: "schema", label: "Структура отчёта" }],
    };
  }

  const preview = source.headers.join(", ");
  return {
    answer: `Это табличный отчёт «${source.name}»: ${source.stats.rows} строк данных и ${source.stats.columns} колонок (${preview}). Могу посчитать итоги, пики, сравнения по этим полям.`,
    citations: [{ id: "schema", label: "Структура отчёта" }],
  };
}

function headerScore(header: string, questionTokens: string[]) {
  const headerTokens = tokenizeForSearch(header);
  const aliases = headerAliases(header);
  const searchable = [...new Set([...headerTokens, ...aliases])];
  return searchable.reduce(
    (score, token) => score + Number(questionTokens.includes(token)),
    0,
  );
}

function headerAliases(header: string) {
  const normalized = header.toLowerCase();
  const aliases: string[] = [];

  if (/заказ|order|продаж|sales/i.test(normalized)) {
    aliases.push("продаж", "продажа", "продаж", "заказ", "заказы", "sales");
  }
  if (/выруч|revenue|sales/i.test(normalized)) {
    aliases.push(
      "выручка",
      "выруч",
      "продаж",
      "продажа",
      "прибыль",
      "прибыльн",
      "доход",
      "revenue",
      "sales",
    );
  }
  if (/прибыл|доход|profit/i.test(normalized)) {
    aliases.push("выручка", "прибыль", "доход", "profit", "revenue");
  }
  if (/расход|cost|spend/i.test(normalized)) {
    aliases.push("расход", "расходы", "cost");
  }

  return aliases.flatMap((alias) => tokenizeForSearch(alias));
}

function selectColumn<T extends { name: string }>(
  columns: T[],
  question: string,
) {
  const questionTokens = tokenizeForSearch(question);
  const ranked = columns
    .map((column) => ({
      column,
      score: headerScore(column.name, questionTokens),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length && ranked[0].score > (ranked[1]?.score ?? 0)) {
    return ranked[0].column;
  }
  if (ranked.length === 1) return ranked[0].column;
  if (!ranked.length && columns.length === 1) return columns[0];
  return null;
}

function rowCitations(rowIndexes: number[]): ChatCitation[] {
  const unique = [...new Set(rowIndexes)].sort((a, b) => a - b);
  if (!unique.length) return [];

  if (unique.length <= 4) {
    return unique.map((rowIndex) => ({
      id: `row-${rowIndex + 2}`,
      label: `Строка ${rowIndex + 2}`,
    }));
  }

  return [
    {
      id: `rows-${unique[0] + 2}-${unique.at(-1)! + 2}`,
      label: `${unique.length} строк отчёта`,
    },
  ];
}

function allRowsCitation(source: DataSource) {
  if (!source.rows.length) return [];
  return rowCitations(source.rows.map((_, index) => index));
}

function salesCitations(source: DataSource, answer: string) {
  const matchingRows = source.rows.flatMap((row, rowIndex) => {
    const product = row.find(
      (cell) => typeof cell === "string" && answer.includes(`«${cell}»`),
    );
    return product ? [rowIndex] : [];
  });

  return matchingRows.length
    ? rowCitations(matchingRows)
    : allRowsCitation(source);
}

function formatCell(value: unknown) {
  const raw = String(value ?? "").trim();
  const isoDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return isoDate ? `${isoDate[3]}.${isoDate[2]}.${isoDate[1]}` : raw;
}

function rowContext(
  source: DataSource,
  rowIndex: number,
  numericIndex: number,
) {
  const details = source.headers.flatMap((header, index) => {
    if (index === numericIndex) return [];
    const value = source.rows[rowIndex]?.[index];
    return value === null || value === undefined || value === ""
      ? []
      : [`${header}: ${formatCell(value)}`];
  });

  return details.slice(0, 3).join(", ");
}

function calculateGrouped(
  source: DataSource,
  numeric: NumericColumn,
  category: CategoryColumn,
  operation: Operation,
  options?: { bucketByMonth?: boolean },
): ChatAnswer | null {
  const groups = new Map<
    string,
    { values: number[]; rowIndexes: number[] }
  >();
  const bucketByMonth = Boolean(options?.bucketByMonth);

  for (const item of numeric.values) {
    const raw = source.rows[item.rowIndex]?.[category.index];
    const label = (
      bucketByMonth ? monthLabelFromCell(raw) : formatCell(raw)
    )?.trim();
    if (!label || label === "—") continue;
    const group = groups.get(label) ?? { values: [], rowIndexes: [] };
    group.values.push(item.value);
    group.rowIndexes.push(item.rowIndex);
    groups.set(label, group);
  }

  if (!groups.size) return null;

  const aggregated = [...groups.entries()].map(([label, group]) => {
    const sum = group.values.reduce((total, value) => total + value, 0);
    const value =
      operation === "average"
        ? sum / group.values.length
        : operation === "count"
          ? group.values.length
          : sum;
    return { label, value, rowIndexes: group.rowIndexes };
  });

  if (operation === "max" || operation === "min") {
    const target =
      operation === "max"
        ? Math.max(...aggregated.map((item) => item.value))
        : Math.min(...aggregated.map((item) => item.value));
    const matches = aggregated.filter((item) => item.value === target);
    const isDateCategory =
      bucketByMonth || /дата|date|день|day|месяц|month/i.test(category.name);
    const direction = operation === "max" ? "Наибольшее" : "Наименьшее";
    const answer =
      matches.length === 1
        ? bucketByMonth
          ? `${operation === "max" ? "Самый прибыльный" : "Самый неприбыльный"} месяц по «${numeric.name}» — ${matches[0].label} (${formatNumber(matches[0].value)}).`
          : isDateCategory
            ? `${operation === "max" ? "Пик" : "Минимум"} «${numeric.name}» — ${formatNumber(matches[0].value)} (${category.name}: ${matches[0].label}).`
            : `${direction} суммарное значение «${numeric.name}» у категории «${matches[0].label}» — ${formatNumber(matches[0].value)}.`
        : `${direction} суммарное значение «${numeric.name}» одинаково у нескольких ${bucketByMonth ? "месяцев" : "категорий"}:\n${matches
            .map((item) => `• «${item.label}» — ${formatNumber(item.value)}.`)
            .join("\n")}`;

    return {
      answer,
      citations: rowCitations(matches.flatMap((item) => item.rowIndexes)),
    };
  }

  const label =
    operation === "average"
      ? "Среднее"
      : operation === "count"
        ? "Количество значений"
        : "Сумма";
  const sorted = [...aggregated].sort((a, b) => b.value - a.value).slice(0, 8);

  return {
    answer: `${label} «${numeric.name}» ${bucketByMonth ? "по месяцам" : `по «${category.name}»`}:\n${sorted
      .map((item) => `• «${item.label}» — ${formatNumber(item.value)}.`)
      .join("\n")}`,
    citations: rowCitations(sorted.flatMap((item) => item.rowIndexes)),
  };
}

export function answerDeterministically(
  source: DataSource,
  question: string,
): ChatAnswer | null {
  if (isStructureQuestion(question)) {
    return answerStructureQuestion(source);
  }

  const salesAnswer = answerSalesQuestion(source, question);
  if (salesAnswer) {
    return {
      answer: salesAnswer,
      citations: salesCitations(source, salesAnswer),
    };
  }

  if (/сколько\s+(?:строк|запис)/i.test(question)) {
    return {
      answer: `В отчёте ${source.stats.rows} строк данных и ${source.stats.columns} колонок.`,
      citations: [{ id: "schema", label: "Структура отчёта" }],
    };
  }

  const operation = operationFromQuestion(question);
  if (!operation || !source.rows.length || !source.headers.length) return null;

  const numeric = numericColumns(source);
  let selectedNumeric = selectColumn(numeric, question);

  // «продажи / выручка / прибыль / заказы» без точного имени колонки.
  if (
    !selectedNumeric &&
    /продаж|выруч|заказ|прибыл|доход|sales|revenue|orders?|profit/i.test(
      question,
    )
  ) {
    const prefersRevenue =
      /прибыл|доход|выруч|revenue|profit/i.test(question) &&
      !/заказ|order/i.test(question);
    selectedNumeric =
      selectColumn(
        numeric.filter((column) =>
          /заказ|order|продаж|sales|выруч|revenue|прибыл|доход/i.test(
            column.name,
          ),
        ),
        question,
      ) ??
      (prefersRevenue
        ? numeric.find((column) => /выруч|revenue|прибыл|доход/i.test(column.name))
        : undefined) ??
      numeric.find((column) =>
        /заказ|order|продаж|sales/i.test(column.name),
      ) ??
      numeric.find((column) => /выруч|revenue/i.test(column.name)) ??
      null;
  }

  if (!selectedNumeric) return null;

  const categories = categoryColumns(source, numeric);
  const monthQuestion = isMonthQuestion(question);
  const temporalCategory = isTemporalQuestion(question)
    ? dateLikeColumn(categories)
    : null;
  const selectedCategory =
    temporalCategory ?? selectColumn(categories, question);
  const asksForGrouping =
    Boolean(temporalCategory) ||
    monthQuestion ||
    /\bпо\b|како[а-яё]*\s+(?:категор|товар|канал|день|месяц|дат)/i.test(
      question,
    );

  if (selectedCategory && asksForGrouping) {
    const grouped = calculateGrouped(
      source,
      selectedNumeric,
      selectedCategory,
      operation,
      {
        bucketByMonth:
          monthQuestion &&
          /дата|date|день|day|месяц|month/i.test(selectedCategory.name),
      },
    );
    if (grouped) return grouped;
  }

  const values = selectedNumeric.values;
  if (!values.length) return null;

  if (operation === "sum") {
    const sum = values.reduce((total, item) => total + item.value, 0);
    return {
      answer: `Сумма по показателю «${selectedNumeric.name}» — ${formatNumber(sum)}.`,
      citations: allRowsCitation(source),
    };
  }

  if (operation === "average") {
    const sum = values.reduce((total, item) => total + item.value, 0);
    return {
      answer: `Среднее значение «${selectedNumeric.name}» — ${formatNumber(sum / values.length)}.`,
      citations: allRowsCitation(source),
    };
  }

  if (operation === "count") {
    return {
      answer: `Для показателя «${selectedNumeric.name}» найдено ${values.length} числовых значений.`,
      citations: allRowsCitation(source),
    };
  }

  const target =
    operation === "max"
      ? Math.max(...values.map((item) => item.value))
      : Math.min(...values.map((item) => item.value));
  const matches = values.filter((item) => item.value === target);
  const direction = operation === "max" ? "Максимум" : "Минимум";

  return {
    answer:
      matches.length === 1
        ? `${direction} по показателю «${selectedNumeric.name}» — ${formatNumber(target)} (${rowContext(source, matches[0].rowIndex, selectedNumeric.index)}).`
        : `${direction} по показателю «${selectedNumeric.name}» — ${formatNumber(target)}; значение встречается в ${matches.length} строках.`,
    citations: rowCitations(matches.map((item) => item.rowIndex)),
  };
}
