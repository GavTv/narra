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
    /максим|наибольш|больше\s+всего|большого\s+всего|сам[а-яё]*\s+(?:больш|высок|прибыльн|доходн|выгодн|дорог)|пик|пиков|прибыльн|доходн|выгодн|дорож|дорог|maximum|max\b|peak|expensive/.test(
      normalized,
    )
  ) {
    return "max";
  }
  if (
    /миним|наименьш|сам[а-яё]*\s+(?:мал|низк|дешев)|дешев|меньше\s+всего|меньшего\s+всего|реже\s+всего|minimum|min\b|cheap/.test(
      normalized,
    )
  ) {
    return "min";
  }
  if (/чаще\s+всего|наибольшее\s+число/.test(normalized)) {
    return "count";
  }
  if (/сумм|итог|total|общ(?:ая|ий|ее|ую|ие)/.test(normalized)) return "sum";
  if (
    /(?:^|[^\p{L}\d])продаж(?:и|а|ам|ами)?(?=[^\p{L}\d]|$)/iu.test(normalized) &&
    (questionDayMonthKeys(normalized).size > 0 ||
      /август|январ|феврал|март|апрел|ма[йя]|июн|июл|сентябр|октябр|ноябр|декабр/i.test(
        normalized,
      ))
  ) {
    return "sum";
  }
  if (
    /всего/.test(normalized) &&
    !/(?:больше|большег|меньше|меньшег|чаще|реже)\w*\s+всего/.test(normalized)
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

const WEEKDAY_NAMES = [
  "понедельник",
  "вторник",
  "среда",
  "четверг",
  "пятница",
  "суббота",
  "воскресенье",
] as const;

function editDistance(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = Array.from({ length: b.length + 1 }, (_, index) => index);
  const curr = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j];
  }

  return prev[b.length];
}

/** Fixes common weekday typos like «всторник» → «вторник». */
function normalizeWeekdayTypos(question: string) {
  return question.replace(/[а-яёa-z]+/gi, (token) => {
    const lower = token.toLowerCase().replaceAll("ё", "е");
    if ((WEEKDAY_NAMES as readonly string[]).includes(lower)) return token;

    let best: string | null = null;
    let bestDist = Infinity;
    for (const day of WEEKDAY_NAMES) {
      if (Math.abs(day.length - lower.length) > 2) continue;
      const distance = editDistance(lower, day);
      if (distance < bestDist) {
        bestDist = distance;
        best = day;
      }
    }

    const maxDist = lower.length <= 4 ? 1 : 2;
    if (best && bestDist > 0 && bestDist <= maxDist) return best;
    return token;
  });
}

function isTemporalQuestion(question: string) {
  return (
    isMonthQuestion(question) ||
    /когда|в\s+какой\s+день|по\s+дням|по\s+датам|за\s+какой\s+день|в\s+какую\s+дат|квартал|понедельник|вторник|среда|четверг|пятниц|суббот|воскресен|\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?|\d{1,2}\s+(?:январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)/i.test(
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

const MONTH_NAME_TO_NUMBER: Record<string, number> = {
  январ: 1,
  феврал: 2,
  март: 3,
  апрел: 4,
  май: 5,
  мая: 5,
  июн: 6,
  июл: 7,
  август: 8,
  сентябр: 9,
  октябр: 10,
  ноябр: 11,
  декабр: 12,
};

function dayMonthKey(value: string): string | null {
  const raw = value.toLowerCase().replaceAll("ё", "е").trim();

  const iso = raw.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (iso) return `${Number(iso[3])}.${Number(iso[2])}`;

  const ru = raw.match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?$/);
  if (ru) return `${Number(ru[1])}.${Number(ru[2])}`;

  const named = raw.match(
    /^(\d{1,2})\s+(январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)/i,
  );
  if (named) {
    const month =
      MONTH_NAME_TO_NUMBER[named[2].toLowerCase().slice(0, 3)] ??
      MONTH_NAME_TO_NUMBER[named[2].toLowerCase()];
    if (month) return `${Number(named[1])}.${month}`;
  }

  return null;
}

function questionDayMonthKeys(question: string) {
  const normalized = question.toLowerCase().replaceAll("ё", "е");
  const keys = new Set<string>();

  for (const match of normalized.matchAll(
    /(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?/g,
  )) {
    keys.add(`${Number(match[1])}.${Number(match[2])}`);
  }

  for (const match of normalized.matchAll(
    /(\d{1,2})\s+(январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)/g,
  )) {
    const month =
      MONTH_NAME_TO_NUMBER[match[2].toLowerCase().slice(0, 3)] ??
      MONTH_NAME_TO_NUMBER[match[2].toLowerCase()];
    if (month) keys.add(`${Number(match[1])}.${month}`);
  }

  return keys;
}

function russianCaseStem(value: string) {
  const raw = value.toLowerCase().replaceAll("ё", "е").trim();
  const withoutSoft = raw.replace(/ь$/u, "");
  const endings = [
    "ями",
    "ами",
    "ого",
    "ему",
    "ыми",
    "ими",
    "ой",
    "ей",
    "ом",
    "ем",
    "ах",
    "ях",
    "ов",
    "ев",
    "ую",
    "юю",
    "ая",
    "яя",
    "ые",
    "ие",
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
  for (const ending of endings) {
    if (
      withoutSoft.endsWith(ending) &&
      withoutSoft.length - ending.length >= 4
    ) {
      return withoutSoft.slice(0, -ending.length);
    }
  }
  return withoutSoft.length >= 4 ? withoutSoft : raw;
}

function labelMatchesQuestion(label: string, question: string) {
  const normalizedQuestion = question.toLowerCase().replaceAll("ё", "е");
  const normalizedLabel = label.toLowerCase().replaceAll("ё", "е");
  if (normalizedQuestion.includes(normalizedLabel)) return true;

  const labelDayMonth = dayMonthKey(normalizedLabel);
  if (labelDayMonth) {
    // Date-like labels: only day+month (and full string), never bare year tokens.
    return questionDayMonthKeys(question).has(labelDayMonth);
  }

  const labelStem = russianCaseStem(normalizedLabel);
  if (labelStem.length >= 4) {
    const questionTokens = normalizedQuestion.match(/[a-zа-я0-9]{3,}/gi) ?? [];
    if (
      questionTokens.some((token) => {
        const tokenStem = russianCaseStem(token);
        return (
          tokenStem === labelStem ||
          (tokenStem.length >= 4 &&
            (tokenStem.startsWith(labelStem) || labelStem.startsWith(tokenStem)))
        );
      })
    ) {
      return true;
    }
  }

  const labelTokens = normalizedLabel.match(/[a-zа-я0-9]{3,}/gi) ?? [];
  return labelTokens.some(
    (token) =>
      !/^\d{4}$/.test(token) && normalizedQuestion.includes(token),
  );
}

function isSoldStatusLabel(label: string) {
  return /^(?:продан[аоы]?|sold|реализован[аоы]?)$/i.test(label.trim());
}

function isStatusLikeColumn(name: string) {
  return /статус|status|этап|stage|state|состоян/i.test(name);
}

function isEntityCategoryName(name: string) {
  return /марка|модел|бренд|brand|товар|product|напит|drink|авто|машин|car/i.test(
    name,
  );
}

/** Category whose cell values are mentioned in the question (e.g. «в Казани»). */
function findCategoryWithMentionedValue(
  source: DataSource,
  categories: CategoryColumn[],
  question: string,
): CategoryColumn | null {
  const normalizedQuestion = question.toLowerCase().replaceAll("ё", "е");
  const soldVerb = /прода[нл]|sold/i.test(normalizedQuestion);
  let best: { column: CategoryColumn; score: number } | null = null;

  for (const category of categories) {
    const labels = new Set<string>();
    for (const row of source.rows) {
      const label = formatCell(row[category.index])?.trim();
      if (label && label !== "—") labels.add(label);
    }

    let bestLabelLength = 0;
    for (const label of labels) {
      if (!labelMatchesQuestion(label, normalizedQuestion)) continue;
      // «продан Geely» must not treat verb «продан» as Статус value mention.
      if (
        soldVerb &&
        isStatusLikeColumn(category.name) &&
        isSoldStatusLabel(label)
      ) {
        continue;
      }
      bestLabelLength = Math.max(bestLabelLength, label.length);
    }
    if (!bestLabelLength) continue;

    const locationBonus = /город|city|регион|район|филиал|локац|площадк/i.test(
      category.name,
    )
      ? 20
      : 0;
    const entityBonus = isEntityCategoryName(category.name) ? 30 : 0;
    const score = bestLabelLength + locationBonus + entityBonus;
    if (!best || score > best.score) {
      best = { column: category, score };
    }
  }

  return best?.column ?? null;
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
  options?: { bucketByMonth?: boolean; soldOnly?: boolean },
): ChatAnswer | null {
  const groups = new Map<
    string,
    { values: number[]; rowIndexes: number[] }
  >();
  const bucketByMonth = Boolean(options?.bucketByMonth);
  const soldOnly = Boolean(options?.soldOnly);
  const statusIndex = soldOnly
    ? source.headers.findIndex((header) => isStatusLikeColumn(header))
    : -1;

  for (const item of numeric.values) {
    if (statusIndex >= 0) {
      const status = formatCell(source.rows[item.rowIndex]?.[statusIndex]).trim();
      if (!isSoldStatusLabel(status)) continue;
    }
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
  const mentioned = aggregated.find((item) =>
    labelMatchesQuestion(item.label, normalizedQuestion),
  );

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

  // Concrete day/date was asked, but no matching rows after flexible date match.
  if (
    question &&
    questionDayMonthKeys(question).size > 0 &&
    /дата|date|день|day/i.test(category.name)
  ) {
    const asked = [...questionDayMonthKeys(question)][0];
    const [day, month] = asked.split(".");
    const pretty = `${day.padStart(2, "0")}.${month.padStart(2, "0")}`;
    return {
      answer: `За дату ${pretty} в отчёте нет строк с значениями по «${numeric.name}».`,
      citations: [{ id: "schema", label: "Структура отчёта" }],
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

function quantityLikeColumn(numeric: NumericColumn[]) {
  return (
    numeric.find((column) =>
      /колич|кол-?во|count|qty|quantity|штук/i.test(column.name),
    ) ?? null
  );
}

function unitPriceLikeColumn(numeric: NumericColumn[]) {
  return (
    numeric.find((column) => /цена|стоим|\bprice\b/i.test(column.name)) ?? null
  );
}

/** «сколько машин/штук продано» — units, not money. */
function asksSoldUnitCount(question: string) {
  return /машин|автомоб|\bавто\b|\bcars?\b|vehicle|штук|единиц|порци|чаш|сколько\s+раз|раз\s+был[аи]?\s+продан/i.test(
    question,
  );
}

/** Sold / sales wording, including «продано» (not only «продаж»). */
function mentionsSalesOrSold(question: string) {
  return /прода[нлж]|выруч|заказ|прибыл|доход|sales|revenue|orders?|profit/i.test(
    question,
  );
}

/** One row = one sold unit when the report has no quantity column. */
function rowUnitCountColumn(source: DataSource): NumericColumn {
  return {
    index: -1,
    name: "Количество",
    values: source.rows.map((_, rowIndex) => ({ rowIndex, value: 1 })),
  };
}

/** When report has qty + unit price, «продажи» = кол-во × цена (same as dashboard). */
function salesAmountColumn(
  source: DataSource,
  numeric: NumericColumn[],
): NumericColumn | null {
  const qty = quantityLikeColumn(numeric);
  const unitPrice = unitPriceLikeColumn(numeric);
  if (qty && unitPrice) {
    const values = source.rows.flatMap((row, rowIndex) => {
      const quantity = toNumber(row[qty.index]);
      const price = toNumber(row[unitPrice.index]);
      if (quantity === null || price === null) return [];
      return [{ rowIndex, value: quantity * price }];
    });
    if (!values.length) return null;
    return { index: unitPrice.index, name: "Сумма продаж", values };
  }

  return (
    numeric.find((column) =>
      /выруч|revenue|продаж|sales|сумм|прибыл|profit|amount/i.test(column.name),
    ) ??
    unitPriceLikeColumn(numeric) ??
    null
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
    /популярн|лидир|чаще\s+всего|больше\s+всего|большого\s+всего|самый\s+част|наибольшее\s+(?:число|количеств)|в\s+каком[\s\S]{0,48}(?:больше|чаще|наибольш|лидир)|(?:какой|какая|какую|какое)\s+(?:район|категор|клуб|день|дата|модел|марк|бренд|товар|продукт|напит)[\s\S]{0,48}(?:больше|большег|чаще|наибольш|лидир)|что\s+(?:берут|покупают|продают|продавали)/i.test(
      question,
    );
  const asksLeast =
    asksLeastPopularity ||
    /меньше\s+всего|меньшего\s+всего|реже\s+всего|наименьш|сам[аяоые]+\s+редк|в\s+каком[\s\S]{0,48}(?:меньше|меньшег|реже|наимень)|(?:какой|какая|какую|какое)\s+(?:район|категор|клуб|день|дата|модел|марк|бренд|товар|продукт|напит)[\s\S]{0,48}(?:меньше|меньшег|реже|наимень|редк)/i.test(
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

  const asksLocation =
    /(?:^|[^\p{L}\d])где(?=[^\p{L}\d]|$)|в\s+каком\s+(?:город|район|регион|филиал|месте)|каком\s+город|в\s+каком\s+месте/iu.test(
      question,
    );
  const isLocationLike = (name: string) =>
    /город|city|регион|район|филиал|локац|площадк|место|location|адрес/i.test(
      name,
    );
  const preferredLocation = asksLocation
    ? categories.find((column) => isLocationLike(column.name)) ?? null
    : null;

  const asksAboutEntity =
    /машин|авто|car|vehicle|товар|продукт|напит|drink|клуб|бренд|марк|модел|что\s+(?:берут|покупают)/i.test(
      question,
    );
  const isStatusLike = (name: string) =>
    /статус|status|этап|stage|state|состоян/i.test(name);
  const isEntityLike = (name: string) =>
    /марка|модел|бренд|brand|авто|машин|car|товар|product|напит|drink|клуб|канал/i.test(
      name,
    );
  const isDateLike = (name: string) =>
    /дата|date|день|day|месяц|month|период|period|время|time|week/i.test(name);

  const selectedByQuestion = selectColumn(categories, question);
  const preferredEntity =
    asksAboutEntity && !asksLocation
      ? (/модел/i.test(question)
          ? categories.find((column) => /модел/i.test(column.name))
          : null) ??
        (/марк|бренд|brand/i.test(question)
          ? categories.find((column) => /марка|бренд|brand/i.test(column.name))
          : null) ??
        categories.find((column) => isEntityLike(column.name)) ??
        null
      : null;

  // «Что берут больше всего?» — prefer product/drink over date.
  const preferredCatalog =
    !asksLocation &&
    !temporalQuestion &&
    (asksMost || asksLeast) &&
    !/день|дат|когда|месяц/i.test(question)
      ? categories.find((column) =>
          /напит|drink|товар|product|марка|модел|бренд|клуб/i.test(column.name),
        ) ?? null
      : null;

  const groupColumn =
    temporalColumn ??
    preferredLocation ??
    (selectedByQuestion &&
    !(asksAboutEntity && isStatusLike(selectedByQuestion.name)) &&
    !(asksLocation && !isLocationLike(selectedByQuestion.name)) &&
    !(preferredCatalog && isDateLike(selectedByQuestion.name))
      ? selectedByQuestion
      : null) ??
    preferredEntity ??
    preferredCatalog ??
    (() => {
      const inferred = inferBestCategoryIndex(source, {
        excludeIndexes: [
          ...numeric.map((column) => column.index),
          ...(asksAboutEntity || preferredCatalog
            ? categories
                .filter(
                  (column) =>
                    isStatusLike(column.name) ||
                    (preferredCatalog ? isDateLike(column.name) : false),
                )
                .map((column) => column.index)
            : []),
          ...(asksLocation
            ? categories
                .filter((column) => !isLocationLike(column.name))
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
      asksLocation
        ? isLocationLike(column.name)
        : /район|город|регион|канал|категор|сегмент|источник|source|марка|бренд|клуб|филиал|локац|площадк|тренер|gym|club|напит|drink|beverage|товар|модел/i.test(
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

  const asksSalesVolume = /прода[нлж]|заказ|покуп/i.test(question);
  const popularityByMetric =
    asksSalesVolume ||
    /количеств|штук|чаш/i.test(question) ||
    /популярн|непопулярн|не\s+популярн/.test(normalizedQuestion);

  // Day/region «больше всего продаж» must use sales volume, not raw row count.
  // Brand/model popularity with «продали» still ranks by count, not by price sum.
  const wantsMoneyMetric =
    /выруч|сумм|цена|стоим|прибыл|доход|amount|revenue/i.test(question);
  const selectedMetric =
    numeric.find((column) =>
      /заказ|order|колич|кол-?во|count|qty|quantity/i.test(column.name),
    ) ??
    (asksSalesVolume && asksSoldUnitCount(question)
      ? rowUnitCountColumn(source)
      : null) ??
    (asksSalesVolume &&
    (Boolean(temporalColumn) || asksLocation || wantsMoneyMetric)
      ? numeric.find((column) =>
          /выруч|revenue|продаж|sales|сумм|amount/i.test(column.name),
        ) ??
        salesAmountColumn(source, numeric) ??
        (temporalColumn || asksLocation
          ? rowUnitCountColumn(source)
          : null)
      : null) ??
    (popularityByMetric ? null : selectColumn(numeric, question)) ??
    null;

  const statusIndex = source.headers.findIndex((header) =>
    isStatusLikeColumn(header),
  );
  const soldOnly =
    asksSalesVolume &&
    statusIndex >= 0 &&
    !isStatusLike(groupColumn.name);

  for (let rowIndex = 0; rowIndex < source.rows.length; rowIndex += 1) {
    if (soldOnly) {
      const status = formatCell(source.rows[rowIndex]?.[statusIndex]).trim();
      if (!isSoldStatusLabel(status)) continue;
    }
    const label = formatCell(source.rows[rowIndex]?.[groupColumn.index]).trim();
    if (!label || label === "—") continue;
    const group = groups.get(label) ?? {
      rowIndexes: [],
      distinct: new Set<string>(),
      metricValues: [],
    };
    group.rowIndexes.push(rowIndex);
    if (selectedMetric) {
      const metricValue =
        selectedMetric.index < 0
          ? (selectedMetric.values.find((item) => item.rowIndex === rowIndex)
              ?.value ?? 1)
          : toNumber(source.rows[rowIndex]?.[selectedMetric.index]);
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

  const useMetricSum = Boolean(popularityByMetric && selectedMetric);
  const ranked = [...groups.entries()].map(([label, group]) => ({
    label,
    value: countDistinctTypes
      ? group.distinct.size
      : useMetricSum
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
    : useMetricSum && selectedMetric
      ? ""
      : winners[0].value === 1
        ? "запись"
        : winners[0].value < 5
          ? "записи"
          : "записей";
  const metricUnit =
    useMetricSum && selectedMetric
      ? `по «${selectedMetric.name}»`
      : null;

  if (winners.length === 1) {
    return {
      answer: !asksLeast && /популярн/i.test(question)
        ? `Самый популярный «${groupColumn.name}» — «${winners[0].label}»: ${formatNumber(winners[0].value)} ${metricUnit ?? unit}.`.trim()
        : asksLeast
          ? `По «${groupColumn.name}» меньше всего у «${winners[0].label}»: ${formatNumber(winners[0].value)} ${metricUnit ?? unit}.`.trim()
        : `В «${groupColumn.name}» лидирует «${winners[0].label}»: ${formatNumber(winners[0].value)} ${metricUnit ?? unit}.`.trim(),
      citations: rowCitations(winners[0].rowIndexes),
    };
  }

  return {
    answer: `По «${groupColumn.name}» одинаковый ${asksLeast ? "минимум" : "максимум"} у нескольких значений (${formatNumber(target)} ${metricUnit ?? unit}):\n${winners
      .map((item) => `• «${item.label}»`)
      .join("\n")}`.replace(/\s+:/, ":"),
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

/** «Какие машины были проданы 13.07?» — list entities for a concrete day. */
function answerListedEntitiesForDate(
  source: DataSource,
  question: string,
): ChatAnswer | null {
  const asksList =
    /каки[ех]\s+(?:машин|авто|модел|марк|товар|напит|бренд)|что\s+(?:за\s+)?(?:машин|авто)\s+был|какая\s+машин[аы]\s+был/i.test(
      question,
    );
  if (!asksList) return null;

  const dayKeys = questionDayMonthKeys(question);
  if (!dayKeys.size) return null;
  if (!source.rows.length || !source.headers.length) return null;

  const numeric = numericColumns(source);
  const categories = categoryColumns(source, numeric);
  const dateCol = dateLikeColumnWithProfile(source, categories);
  if (!dateCol) return null;

  const brandCol =
    categories.find((column) => /марка|бренд|brand/i.test(column.name)) ?? null;
  const modelCol =
    categories.find((column) => /модел/i.test(column.name)) ?? null;
  const productCol =
    categories.find((column) =>
      /товар|продукт|напит|product|drink/i.test(column.name),
    ) ?? null;
  if (!brandCol && !modelCol && !productCol) return null;

  const statusIndex = source.headers.findIndex((header) =>
    isStatusLikeColumn(header),
  );
  const soldOnly =
    mentionsSalesOrSold(question) &&
    statusIndex >= 0 &&
    !/в\s+наличи|резерв|возврат/i.test(question);

  const matches: Array<{ rowIndex: number; label: string }> = [];
  for (let rowIndex = 0; rowIndex < source.rows.length; rowIndex += 1) {
    const rawDate = source.rows[rowIndex]?.[dateCol.index];
    const dateLabel = formatCell(rawDate).trim();
    const key =
      dayMonthKey(dateLabel) ?? dayMonthKey(String(rawDate ?? "").trim());
    if (!key || !dayKeys.has(key)) continue;

    if (soldOnly) {
      const status = formatCell(source.rows[rowIndex]?.[statusIndex]).trim();
      if (!isSoldStatusLabel(status)) continue;
    }

    const brand = brandCol
      ? formatCell(source.rows[rowIndex]?.[brandCol.index]).trim()
      : "";
    const model = modelCol
      ? formatCell(source.rows[rowIndex]?.[modelCol.index]).trim()
      : "";
    const product = productCol
      ? formatCell(source.rows[rowIndex]?.[productCol.index]).trim()
      : "";
    const label =
      [brand, model].filter((part) => part && part !== "—").join(" ") ||
      (product && product !== "—" ? product : "");
    if (!label) continue;
    matches.push({ rowIndex, label });
  }

  const asked = [...dayKeys][0];
  if (!matches.length) {
    return {
      answer: soldOnly
        ? `За ${asked} в отчёте нет проданных позиций.`
        : `За ${asked} в отчёте нет подходящих строк.`,
      citations: [{ id: "schema", label: "Структура отчёта" }],
    };
  }

  const unique = [...new Set(matches.map((item) => item.label))];
  const noun = /напит/i.test(question)
    ? "напитки"
    : /товар|продукт/i.test(question)
      ? "товары"
      : "машины";

  return {
    answer: `${soldOnly ? "Проданы" : "В отчёте"} за ${asked}: ${unique
      .map((item) => `«${item}»`)
      .join(", ")} (${unique.length} ${noun}).`,
    citations: rowCitations(matches.map((item) => item.rowIndex)),
  };
}

export function answerDeterministically(
  source: DataSource,
  question: string,
  history: ChatTurn[] = [],
): ChatAnswer | null {
  question = normalizeWeekdayTypos(question);
  question = question
    .replace(/меньшего\s+всего/gi, "меньше всего")
    .replace(/большого\s+всего/gi, "больше всего");

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

  const listedForDate = answerListedEntitiesForDate(source, question);
  if (listedForDate) return listedForDate;

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

  if (!selectedNumeric && mentionsSalesOrSold(question)) {
    const asksOrders =
      /заказ|order/i.test(question) &&
      !/прода[нлж]|выруч|revenue|profit/i.test(question);
    const asksQtyExplicitly =
      /штук|чаш|порци|количеств|кол-?во|\bqty\b|quantity/i.test(question);
    const prefersUnits = asksQtyExplicitly || asksSoldUnitCount(question);
    const prefersRevenue =
      /прибыл|доход|выруч|revenue|profit/i.test(question) &&
      !asksOrders &&
      !prefersUnits;

    if (prefersUnits || asksOrders) {
      selectedNumeric =
        selectColumn(
          numeric.filter((column) =>
            /заказ|order|колич|кол-?во|count|qty|quantity|продаж|sales/i.test(
              column.name,
            ),
          ),
          question,
        ) ??
        numeric.find((column) =>
          /заказ|order|колич|кол-?во|count|qty|quantity/i.test(column.name),
        ) ??
        (prefersUnits ? rowUnitCountColumn(source) : null);
    } else {
      selectedNumeric =
        salesAmountColumn(source, numeric) ??
        selectColumn(
          numeric.filter((column) =>
            /заказ|order|продаж|sales|выруч|revenue|прибыл|доход/i.test(
              column.name,
            ),
          ),
          question,
        ) ??
        (prefersRevenue
          ? numeric.find((column) =>
              /выруч|revenue|прибыл|доход/i.test(column.name),
            )
          : undefined) ??
        numeric.find((column) =>
          /заказ|order|продаж|sales/i.test(column.name),
        ) ??
        numeric.find((column) =>
          /выруч|revenue|сумм|amount/i.test(column.name),
        ) ??
        quantityLikeColumn(numeric) ??
        null;
    }
  }

  if (!selectedNumeric) return null;

  // «Сколько продаж» with qty+price → money (кол-во × цена), not raw quantity.
  // Keep units for «сколько машин/штук продано».
  if (
    selectedNumeric &&
    /продаж|sales|выруч|revenue|прибыл|доход/i.test(question) &&
    !asksSoldUnitCount(question) &&
    !/штук|чаш|порци|количеств|кол-?во|\bqty\b|quantity|заказ|order/i.test(
      question,
    ) &&
    /колич|кол-?во|count|qty|quantity/i.test(selectedNumeric.name)
  ) {
    selectedNumeric = salesAmountColumn(source, numeric) ?? selectedNumeric;
  }

  // «Сколько машин продано» → units (qty or row count), never unit price / revenue.
  if (mentionsSalesOrSold(question) && asksSoldUnitCount(question)) {
    const qty = quantityLikeColumn(numeric);
    const unitPrice = unitPriceLikeColumn(numeric);
    if (qty) {
      selectedNumeric = qty;
    } else if (
      !selectedNumeric ||
      selectedNumeric.index === unitPrice?.index ||
      /цена|стоим|price|сумма продаж|выруч|revenue|amount/i.test(
        selectedNumeric.name,
      )
    ) {
      selectedNumeric = rowUnitCountColumn(source);
    }
  }

  const categories = categoryColumns(source, numeric);
  const monthQuestion = isMonthQuestion(question);
  const mentionsConcreteTemporalValue =
    /понедельник|вторник|среда|четверг|пятниц|суббот|воскресен|январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр|\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?|\d{4}[./-]\d{1,2}(?:[./-]\d{1,2})?|\d{1,2}\s+(?:январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)/i.test(
      question,
    );
  const temporalCategory =
    isTemporalQuestion(question) || mentionsConcreteTemporalValue
      ? dateLikeColumnWithProfile(source, categories)
      : null;
  const valueMentionCategory = findCategoryWithMentionedValue(
    source,
    categories,
    question,
  );
  const selectedByHeader = selectColumn(categories, question);
  // Prefer concrete cell values (Geely) over header keywords; never let status beat a brand mention.
  const selectedCategory =
    temporalCategory ??
    (valueMentionCategory &&
    (!selectedByHeader ||
      isEntityCategoryName(valueMentionCategory.name) ||
      isStatusLikeColumn(selectedByHeader.name))
      ? valueMentionCategory
      : null) ??
    selectedByHeader ??
    valueMentionCategory;

  // «Сколько Geely продали / продаж у Geely» → count of units, not price sum.
  if (
    valueMentionCategory &&
    isEntityCategoryName(valueMentionCategory.name) &&
    mentionsSalesOrSold(question) &&
    !/выруч|прибыл|доход|цена|стоим|сумм(?:а|у|ы)?\s+продаж|на\s+сумм/i.test(
      question,
    )
  ) {
    selectedNumeric =
      quantityLikeColumn(numeric) ?? rowUnitCountColumn(source);
  }

  const asksForGrouping =
    Boolean(temporalCategory) ||
    Boolean(valueMentionCategory) ||
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
    const soldOnly =
      mentionsSalesOrSold(question) &&
      !isStatusLikeColumn(selectedCategory.name) &&
      source.headers.some((header) => isStatusLikeColumn(header));
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
        soldOnly,
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
