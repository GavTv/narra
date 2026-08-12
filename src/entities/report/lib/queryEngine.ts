import type { ChatAnswer, ChatCitation, ChatTurn } from "@/entities/chat";
import { formatNumber, toNumber } from "@/shared/lib/format";

import { answerSalesQuestion } from "./localAnalysis";
import { inferBestCategoryIndex, inferDateColumnIndex } from "./schemaProfile";
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

function isNonMetricColumn(name: string) {
  return /кандидат|candidate|сотрудник|employee|клиент|customer|имя|фио|\bname\b|email|телефон|phone|\bid\b|uuid|user|год|year|выпуск|рейтинг|rating|площад|area|м²|м2|комнат|rooms?|этаж|floor|марка|модел|бренд|brand|статус|status|этап|stage/i.test(
    name,
  );
}

function numericColumns(source: DataSource): NumericColumn[] {
  return source.headers
    .map((name, index) => {
      if (isNonMetricColumn(name)) return null;

      const values = source.rows.flatMap((row, rowIndex) => {
        const value = toNumber(row[index]);
        return value === null ? [] : [{ rowIndex, value }];
      });

      if (!values.length || values.length < source.rows.length * 0.6) return null;

      const numbers = values.map((item) => item.value);
      const yearLike = numbers.filter((value) => value >= 1900 && value <= 2100);
      if (
        yearLike.length >= numbers.length * 0.8 &&
        Math.max(...yearLike) - Math.min(...yearLike) <= 120
      ) {
        return null;
      }

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
  if (
    /не\s*прибыльн|наименее\s+прибыльн|убыточн|худш|сам[а-яё]*\s+не\s*прибыльн|сам[а-яё]*\s+дешев|дешевле\s+всего/.test(
      normalized,
    )
  ) {
    return "min";
  }
  if (
    /максим|наибольш|больше\s+всего|сам[а-яё]*\s+(?:больш|высок|прибыльн|доходн|выгодн|дорог)|пик|пиков|прибыльн|доходн|выгодн|дорож|дорог|maximum|max\b|peak|expensive/.test(
      normalized,
    )
  ) {
    return "max";
  }
  if (
    /миним|наименьш|сам[а-яё]*\s+(?:мал|низк|дешев)|дешев|меньше\s+всего|реже\s+всего|minimum|min\b|cheap/.test(
      normalized,
    )
  ) {
    return "min";
  }
  if (/чаще\s+всего|наибольшее\s+число/.test(normalized)) {
    return "count";
  }
  if (/сумм|итог|total/.test(normalized)) return "sum";
  if (
    /всего/.test(normalized) &&
    !/(?:больше|меньше|чаще|реже)\s+всего/.test(normalized)
  ) {
    return "sum";
  }
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
    /когда|в\s+какой\s+день|по\s+дням|по\s+датам|за\s+какой\s+день|в\s+какую\s+дат|квартал|понедельник|вторник|среда|четверг|пятниц|суббот|воскресен/i.test(
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

function dateLikeColumnWithProfile(
  source: DataSource,
  categories: CategoryColumn[],
) {
  const inferred = inferDateColumnIndex(source);
  if (inferred >= 0) {
    const hit = categories.find((column) => column.index === inferred);
    if (hit) return hit;
  }
  return dateLikeColumn(categories);
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

function isTotalEntityCountQuestion(question: string) {
  return /^сколько\s+(?:всего\s+)?(?:кандидат|человек|заявок|отклик|строк|запис)[а-яё]*\s*\??$/i.test(
    question.trim(),
  );
}

function answerTotalEntityCount(
  source: DataSource,
  question: string,
): ChatAnswer | null {
  if (!isTotalEntityCountQuestion(question)) return null;
  if (!source.rows.length) return null;

  return {
    answer: `В отчёте ${formatNumber(source.stats.rows)} кандидат${source.stats.rows === 1 ? "" : source.stats.rows < 5 ? "а" : "ов"} (строк данных).`,
    citations: allRowsCitation(source),
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
  if (/цена|стоим|price|amount|дорог/i.test(normalized)) {
    aliases.push("цена", "стоимость", "price", "дорог", "дороже", "amount");
  }
  if (/баг|ошиб|дефект|issue|bug/i.test(normalized)) {
    aliases.push(
      "баг",
      "бага",
      "багов",
      "багу",
      "баги",
      "ошибка",
      "ошибки",
      "дефект",
      "issue",
      "bug",
    );
  }
  if (/закрыт|closed|done|resolved|выполн|исполн|complete/i.test(normalized)) {
    aliases.push(
      "закрыто",
      "закрытые",
      "выполнено",
      "выполненные",
      "исполнено",
      "исполненные",
      "исполнил",
      "завершено",
      "сделано",
      "готово",
      "resolved",
      "closed",
      "done",
      "completed",
      "задач",
      "задача",
      "task",
      "tasks",
    );
  }
  if (/создан|created|new|incoming/i.test(normalized)) {
    aliases.push(
      "создано",
      "созданные",
      "новые",
      "новых",
      "created",
      "new",
      "incoming",
      "задач",
      "задача",
      "task",
      "tasks",
    );
  }
  if (/ревью|review|qa|проверк/i.test(normalized)) {
    aliases.push(
      "на ревью",
      "ревью",
      "проверка",
      "review",
      "qa",
      "задач",
      "задача",
      "task",
      "tasks",
    );
  }
  if (/напит|drink|beverage/i.test(normalized)) {
    aliases.push("напиток", "напитки", "кофе", "чай", "drink", "beverage");
  }
  if (/марка|модел|бренд|brand|автомоб|машин|car|vehicle|авто\b/i.test(normalized)) {
    aliases.push(
      "машина",
      "машины",
      "машин",
      "авто",
      "автомобиль",
      "автомобили",
      "марка",
      "модель",
      "бренд",
      "car",
      "cars",
      "vehicle",
    );
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
  question?: string,
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

  const normalizedQuestion = (question ?? "")
    .toLowerCase()
    .replaceAll("ё", "е");
  const mentioned = aggregated.find((item) => {
    const normalizedLabel = item.label.toLowerCase().replaceAll("ё", "е");
    if (normalizedQuestion.includes(normalizedLabel)) return true;
    const labelTokens = normalizedLabel.match(/[a-zа-я0-9]{3,}/gi) ?? [];
    return labelTokens.some((token) => normalizedQuestion.includes(token));
  });

  if (mentioned && operation !== "max" && operation !== "min") {
    const opLabel =
      operation === "average"
        ? "Среднее"
        : operation === "count"
          ? "Количество значений"
          : "Сумма";
    return {
      answer: `${opLabel} «${numeric.name}» для «${category.name}: ${mentioned.label}» — ${formatNumber(mentioned.value)}.`,
      citations: rowCitations(mentioned.rowIndexes),
    };
  }

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

function parseQuestionAmounts(question: string) {
  const amounts: number[] = [];
  const spaced = question.match(/\d{1,3}(?:\s\d{3})+(?:[.,]\d+)?/g) ?? [];
  for (const raw of spaced) {
    const value = Number(raw.replace(/\s/g, "").replace(",", "."));
    if (Number.isFinite(value)) amounts.push(value);
  }
  const plain = question.match(/(?<![\d.,])\d{5,}(?![\d])/g) ?? [];
  for (const raw of plain) {
    const value = Number(raw);
    if (Number.isFinite(value)) amounts.push(value);
  }
  return [...new Set(amounts)].sort((a, b) => b - a);
}

function priceLikeColumn(numeric: NumericColumn[]) {
  return (
    numeric.find((column) =>
      /цена|стоим|price|amount|\bcost\b|value/i.test(column.name),
    ) ?? null
  );
}

function answerExtremeChallenge(
  source: DataSource,
  question: string,
): ChatAnswer | null {
  const isChallenge =
    /а\s+может|разве|не\s+(?:этот|он)|а\s+вот|сравни|или\s+вот/i.test(question);
  const isConfirm =
    /то\s+есть|значит|правильно|он\s+сам|это\s+сам|сам[а-яё]*\s+дорог/i.test(
      question,
    );
  if (!isChallenge && !isConfirm) return null;

  const numeric = numericColumns(source);
  const price =
    priceLikeColumn(numeric) ?? selectColumn(numeric, question) ?? null;
  if (!price?.values.length) return null;

  const max = Math.max(...price.values.map((item) => item.value));
  const maxRows = price.values.filter((item) => item.value === max);
  const maxContext = rowContext(source, maxRows[0].rowIndex, price.index);
  const amounts = parseQuestionAmounts(question);

  if (isConfirm && !isChallenge) {
    return {
      answer: `Да. Самый большой показатель «${price.name}» — ${formatNumber(max)} (${maxContext}).`,
      citations: rowCitations(maxRows.map((item) => item.rowIndex)),
    };
  }

  if (!amounts.length) {
    return {
      answer: `Самый большой «${price.name}» в отчёте — ${formatNumber(max)} (${maxContext}). Объект с меньшей суммой самым дорогим не является.`,
      citations: rowCitations(maxRows.map((item) => item.rowIndex)),
    };
  }

  const challenged = amounts[0];
  if (challenged >= max - 0.01) {
    return {
      answer: `Да, ${formatNumber(challenged)} — это максимум по «${price.name}» (${maxContext}).`,
      citations: rowCitations(maxRows.map((item) => item.rowIndex)),
    };
  }

  return {
    answer: `Нет. ${formatNumber(challenged)} меньше максимума: самый дорогой по «${price.name}» — ${formatNumber(max)} (${maxContext}). Разница — ${formatNumber(max - challenged)}.`,
    citations: rowCitations(maxRows.map((item) => item.rowIndex)),
  };
}

function answerWhereMostByCategory(
  source: DataSource,
  question: string,
): ChatAnswer | null {
  const normalizedQuestion = question.toLowerCase().replaceAll("ё", "е");
  const asksLeastPopularity =
    /непопулярн|не\s+популярн|наименее\s+популярн|сам[аыо]?я?\s+не\s+популярн/.test(
      normalizedQuestion,
    );
  const asksMost =
    !asksLeastPopularity &&
    /популярн|чаще\s+всего|больше\s+всего|самый\s+част|наибольшее\s+(?:число|количеств)|в\s+каком[\s\S]{0,48}(?:больше|чаще|наибольш)|(?:какой|какая)\s+(?:район|категор|клуб|день|дата)[\s\S]{0,24}(?:больше|чаще|наибольш)/i.test(
      question,
    );
  const asksLeast =
    asksLeastPopularity ||
    /меньше\s+всего|реже\s+всего|наименьш|самый\s+редк|в\s+каком[\s\S]{0,48}(?:меньше|реже|наимень)|(?:какой|какая)\s+(?:район|категор|клуб|день|дата)[\s\S]{0,24}(?:меньше|реже|наимень)/i.test(
      question,
    );

  if (!asksMost && !asksLeast) {
    return null;
  }
  if (!source.rows.length || !source.headers.length) return null;

  const numeric = numericColumns(source);
  // If question mentions a concrete measurable metric (e.g. "багов", "выручка"),
  // let deterministic numeric/grouped path handle it instead of row-count ranking.
  const questionTokens = tokenizeForSearch(question);
  const numericHint = selectColumn(numeric, question);
  const hasExplicitNumericMention = numeric.some(
    (column) => headerScore(column.name, questionTokens) > 0,
  );
  const asksEntityCount =
    /объект|запис|строк|кандидат|товар|машин|клуб/i.test(question);
  if (
    numericHint &&
    hasExplicitNumericMention &&
    !/тип/i.test(question) &&
    !asksEntityCount
  ) {
    return null;
  }

  const categories = categoryColumns(source, numeric);
  if (!categories.length) return null;

  const temporalQuestion =
    /в\s+какой\s+день|какой\s+день|по\s+дням|по\s+датам|дата|день|когда/i.test(
      question,
    );
  const temporalColumn = temporalQuestion
    ? categories.find((column) =>
        /дата|date|день|day|месяц|month|период|period|время|time|week/i.test(
          column.name,
        ),
      ) ?? null
    : null;

  const asksAboutEntity =
    /машин|авто|car|vehicle|товар|продукт|напит|drink|клуб|бренд|марк|модел/i.test(
      question,
    );
  const isStatusLike = (name: string) =>
    /статус|status|этап|stage|state|состоян/i.test(name);
  const isEntityLike = (name: string) =>
    /марка|модел|бренд|brand|авто|машин|car|товар|product|напит|drink|клуб|филиал|район|город|канал/i.test(
      name,
    );

  const selectedByQuestion = selectColumn(categories, question);
  const preferredEntity =
    asksAboutEntity
      ? categories.find((column) => isEntityLike(column.name)) ?? null
      : null;

  const groupColumn =
    temporalColumn ??
    (selectedByQuestion &&
    !(asksAboutEntity && isStatusLike(selectedByQuestion.name))
      ? selectedByQuestion
      : null) ??
    preferredEntity ??
    (() => {
      const inferred = inferBestCategoryIndex(source, {
        excludeIndexes: [
          ...numeric.map((column) => column.index),
          ...(asksAboutEntity
            ? categories
                .filter((column) => isStatusLike(column.name))
                .map((column) => column.index)
            : []),
        ],
        question,
      });
      return inferred >= 0
        ? categories.find((column) => column.index === inferred) ?? null
        : null;
    })() ??
    categories.find((column) =>
      /район|город|регион|канал|категор|сегмент|источник|source|марка|бренд|клуб|филиал|локац|площадк|тренер|gym|club|напит|drink|beverage/i.test(
        column.name,
      ),
    ) ??
    null;
  if (!groupColumn) return null;

  const typeColumn = categories.find(
    (column) =>
      column.index !== groupColumn.index &&
      /тип|вид|категор|статус|этап/i.test(column.name),
  );
  const countDistinctTypes =
    Boolean(typeColumn) &&
    /тип/i.test(question) &&
    !/объект|запис|строк|квартир|дом|авто|кандидат|товар|клуб|посещен/i.test(
      question,
    );

  const groups = new Map<
    string,
    { rowIndexes: number[]; distinct: Set<string>; metricValues: number[] }
  >();

  const popularityByMetric =
    /покуп|продаж|заказ|количеств|штук|чаш/i.test(question) ||
    /популярн|непопулярн|не\s+популярн/.test(normalizedQuestion);
  const selectedMetric =
    numeric.find((column) =>
      /колич|кол-?во|count|qty|quantity|продаж|sales|orders?/i.test(column.name),
    ) ??
    (popularityByMetric ? null : selectColumn(numeric, question)) ??
    null;

  for (let rowIndex = 0; rowIndex < source.rows.length; rowIndex += 1) {
    const label = formatCell(source.rows[rowIndex]?.[groupColumn.index]).trim();
    if (!label || label === "—") continue;
    const group = groups.get(label) ?? {
      rowIndexes: [],
      distinct: new Set<string>(),
      metricValues: [],
    };
    group.rowIndexes.push(rowIndex);
    if (selectedMetric) {
      const metricValue = toNumber(source.rows[rowIndex]?.[selectedMetric.index]);
      if (metricValue !== null) group.metricValues.push(metricValue);
    }
    if (typeColumn) {
      const typeValue = formatCell(
        source.rows[rowIndex]?.[typeColumn.index],
      ).trim();
      if (typeValue && typeValue !== "—") group.distinct.add(typeValue);
    }
    groups.set(label, group);
  }

  if (!groups.size) return null;

  const ranked = [...groups.entries()].map(([label, group]) => ({
    label,
    value: countDistinctTypes
      ? group.distinct.size
      : popularityByMetric && selectedMetric
        ? group.metricValues.reduce((sum, item) => sum + item, 0)
        : group.rowIndexes.length,
    rowIndexes: group.rowIndexes,
  }));
  const target = asksLeast
    ? Math.min(...ranked.map((item) => item.value))
    : Math.max(...ranked.map((item) => item.value));
  const winners = ranked.filter((item) => item.value === target);
  const unit = countDistinctTypes
    ? winners[0].value === 1
      ? "тип"
      : winners[0].value < 5
        ? "типа"
        : "типов"
    : winners[0].value === 1
      ? "запись"
      : winners[0].value < 5
        ? "записи"
        : "записей";
  const metricUnit =
    popularityByMetric && selectedMetric
      ? `по «${selectedMetric.name}»`
      : null;

  if (winners.length === 1) {
    return {
      answer: !asksLeast && /популярн/i.test(question)
        ? `Самый популярный «${groupColumn.name}» — «${winners[0].label}»: ${formatNumber(winners[0].value)} ${metricUnit ?? unit}.`
        : asksLeast
          ? `По «${groupColumn.name}» меньше всего у «${winners[0].label}»: ${formatNumber(winners[0].value)} ${metricUnit ?? unit}.`
        : `В «${groupColumn.name}» лидирует «${winners[0].label}»: ${formatNumber(winners[0].value)} ${metricUnit ?? unit}.`,
      citations: rowCitations(winners[0].rowIndexes),
    };
  }

  return {
    answer: `По «${groupColumn.name}» одинаковый ${asksLeast ? "минимум" : "максимум"} у нескольких значений (${formatNumber(target)} ${metricUnit ?? unit}):\n${winners
      .map((item) => `• «${item.label}»`)
      .join("\n")}`,
    citations: rowCitations(winners.flatMap((item) => item.rowIndexes)),
  };
}

function findCreatedClosedColumns(numeric: NumericColumn[]) {
  const created =
    numeric.find((column) =>
      /создан|created|new|incoming/i.test(column.name),
    ) ?? null;
  const closed =
    numeric.find((column) =>
      /закрыт|closed|done|resolved|выполн|исполн|complete/i.test(column.name),
    ) ?? null;
  return created && closed ? { created, closed } : null;
}

function answerPendingTasks(
  source: DataSource,
  question: string,
): ChatAnswer | null {
  const asksPending =
    /не\s+(?:было\s+)?(?:выполн|закрыт|заверш|сделан|готов)|неисполн|незакрыт|остал|pending|incomplete|open\s+task/i.test(
      question,
    );
  if (!asksPending) return null;

  const pair = findCreatedClosedColumns(numericColumns(source));
  if (!pair) return null;

  const createdSum = pair.created.values.reduce(
    (total, item) => total + item.value,
    0,
  );
  const closedSum = pair.closed.values.reduce(
    (total, item) => total + item.value,
    0,
  );
  const pending = Math.max(0, createdSum - closedSum);

  return {
    answer: `Не выполнено ${formatNumber(pending)} задач (создано ${formatNumber(createdSum)} − закрыто ${formatNumber(closedSum)}).`,
    citations: allRowsCitation(source),
  };
}

export function answerDeterministically(
  source: DataSource,
  question: string,
  history: ChatTurn[] = [],
): ChatAnswer | null {
  if (isStructureQuestion(question)) {
    return answerStructureQuestion(source);
  }

  const salesAnswer = answerSalesQuestion(source, question, history);
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

  const pendingTasks = answerPendingTasks(source, question);
  if (pendingTasks) return pendingTasks;

  const categoryCount = answerTotalEntityCount(source, question);
  if (categoryCount) return categoryCount;

  const extremeChallenge = answerExtremeChallenge(source, question);
  if (extremeChallenge) return extremeChallenge;

  const whereMost = answerWhereMostByCategory(source, question);
  if (whereMost) return whereMost;

  let operation = operationFromQuestion(question);
  if (!operation || !source.rows.length || !source.headers.length) return null;

  const numeric = numericColumns(source);
  let selectedNumeric = selectColumn(numeric, question);

  if (
    !selectedNumeric &&
    /дорог|дешев|цена|стоим|price|expensive|cheap/i.test(question)
  ) {
    selectedNumeric = priceLikeColumn(numeric);
    if (!operation) {
      operation = /дешев|cheap/i.test(question) ? "min" : "max";
    }
  }

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
    ? dateLikeColumnWithProfile(source, categories)
    : null;
  const selectedCategory =
    temporalCategory ?? selectColumn(categories, question);
  const mentionsConcreteTemporalValue =
    /понедельник|вторник|среда|четверг|пятниц|суббот|воскресен|январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр|\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?|\d{4}[./-]\d{1,2}(?:[./-]\d{1,2})?/i.test(
      question,
    );
  const asksForGrouping =
    Boolean(temporalCategory) ||
    monthQuestion ||
    mentionsConcreteTemporalValue ||
    /\bпо\b|в\s+каком|како[а-яё]*\s+(?:категор|товар|канал|день|месяц|дат|район|город)/i.test(
      question,
    );

  if (
    operation === "count" &&
    /сколько/i.test(question) &&
    !/сколько\s+(?:строк|запис|значени|раз|штук)/i.test(question)
  ) {
    operation = "sum";
  }

  if (selectedCategory && asksForGrouping) {
    const grouped = calculateGrouped(
      source,
      selectedNumeric,
      selectedCategory,
      operation,
      question,
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
  const isPrice =
    /цена|стоим|price|дорог/i.test(selectedNumeric.name) ||
    /дорог|дешев/i.test(question);
  const direction =
    operation === "max"
      ? isPrice
        ? "Самый дорогой объект"
        : "Максимум"
      : isPrice
        ? "Самый дешёвый объект"
        : "Минимум";

  return {
    answer:
      matches.length === 1
        ? `${direction} по «${selectedNumeric.name}» — ${formatNumber(target)} (${rowContext(source, matches[0].rowIndex, selectedNumeric.index)}).`
        : `${direction} по «${selectedNumeric.name}» — ${formatNumber(target)}; значение встречается в ${matches.length} строках.`,
    citations: rowCitations(matches.map((item) => item.rowIndex)),
  };
}
