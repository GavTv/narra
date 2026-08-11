import type { ChartSpec, DashboardAnalysis, Metric } from "@/entities/analysis";
import { formatNumber, toNumber } from "@/shared/lib/format";

import type { DataSource } from "../model/types";

type NumericColumn = {
  index: number;
  name: string;
  values: Array<{ value: number; rowIndex: number }>;
  sum: number;
  average: number;
  min: number;
  max: number;
};

const riskPattern =
  /review|ревью|bug|баг|error|ошиб|backlog|проср|отказ|задерж|cycle|churn|возврат/i;

function getNumericColumns(source: DataSource): NumericColumn[] {
  return source.headers
    .map((name, index) => {
      const values = source.rows.flatMap((row, rowIndex) => {
        const value = toNumber(row[index]);
        return value === null ? [] : [{ value, rowIndex }];
      });

      if (!values.length || values.length < source.rows.length * 0.6) return null;

      const numbers = values.map((item) => item.value);
      const sum = numbers.reduce((total, value) => total + value, 0);

      return {
        index,
        name: name || `Колонка ${index + 1}`,
        values,
        sum,
        average: sum / numbers.length,
        min: Math.min(...numbers),
        max: Math.max(...numbers),
      };
    })
    .filter((column): column is NumericColumn => column !== null);
}

function getLabels(source: DataSource, numericColumns: NumericColumn[]) {
  const numericIndexes = new Set(numericColumns.map((column) => column.index));
  const labelIndex = source.headers.findIndex(
    (_, index) => !numericIndexes.has(index),
  );

  return source.rows.map((row, index) => {
    const raw = labelIndex >= 0 ? row[labelIndex] : null;
    const label = raw === null || raw === undefined ? `Строка ${index + 1}` : String(raw);
    return label.length > 22 ? `${label.slice(0, 21)}…` : label;
  });
}

function trendDetail(column: NumericColumn) {
  const first = column.values.at(0)?.value;
  const last = column.values.at(-1)?.value;

  if (first === undefined || last === undefined || first === 0) {
    return "по всему набору";
  }

  const change = ((last - first) / Math.abs(first)) * 100;
  const prefix = change > 0 ? "+" : "";
  return `${prefix}${formatNumber(change)}% от первой точки`;
}

function makeTableAnalysis(source: DataSource): DashboardAnalysis {
  const columns = getNumericColumns(source);
  const labels = getLabels(source, columns);
  const primary = columns[0];
  const secondary = columns[1];
  const risk = columns.find((column) => riskPattern.test(column.name)) ?? primary;

  if (!primary) return makeTextAnalysis(source);

  const peak = risk.values.reduce((best, item) =>
    item.value > best.value ? item : best,
  );
  const peakLabel = labels[peak.rowIndex] ?? `строке ${peak.rowIndex + 1}`;
  const lastPrimary = primary.values.at(-1)?.value ?? primary.average;
  const firstPrimary = primary.values.at(0)?.value ?? primary.average;
  const primaryDelta =
    firstPrimary === 0 ? 0 : ((lastPrimary - firstPrimary) / Math.abs(firstPrimary)) * 100;

  const metrics: Metric[] = [
    {
      label: `Всего · ${primary.name}`,
      value: formatNumber(primary.sum, true),
      detail: `${primary.values.length} точек данных`,
      tone: "neutral",
    },
    {
      label: `Пик · ${risk.name}`,
      value: formatNumber(risk.max, true),
      detail: peakLabel,
      tone: riskPattern.test(risk.name) ? "warning" : "positive",
    },
    {
      label: `Среднее · ${(secondary ?? primary).name}`,
      value: formatNumber((secondary ?? primary).average, true),
      detail: trendDetail(secondary ?? primary),
      tone: "neutral",
    },
  ];

  const charts: ChartSpec[] = [];
  const timelineData = primary.values.slice(0, 12).map((item) => {
    const secondaryValue = secondary?.values.find(
      (candidate) => candidate.rowIndex === item.rowIndex,
    )?.value;

    return {
      label: labels[item.rowIndex],
      value: item.value,
      ...(secondaryValue === undefined ? {} : { secondary: secondaryValue }),
    };
  });

  charts.push({
    id: "trend",
    type: timelineData.length >= 4 ? "line" : "bar",
    title: secondary ? `${primary.name} и ${secondary.name}` : primary.name,
    subtitle: "Динамика по ключевому измерению",
    valueLabel: primary.name,
    secondaryLabel: secondary?.name,
    insight: `${primary.name}: от ${formatNumber(firstPrimary)} до ${formatNumber(lastPrimary)} (${primaryDelta > 0 ? "+" : ""}${formatNumber(primaryDelta)}%).`,
    data: timelineData,
  });

  if (risk.index !== primary.index || columns.length > 2) {
    const compared = columns.find(
      (column) => column.index !== risk.index && column.index !== primary.index,
    );

    charts.push({
      id: "risk",
      type: "bar",
      title: risk.name,
      subtitle: `Максимум — ${peakLabel}`,
      valueLabel: risk.name,
      secondaryLabel: compared?.name,
      insight: `${formatNumber(risk.max)} — пик показателя; среднее значение составляет ${formatNumber(risk.average)}.`,
      data: risk.values.slice(0, 10).map((item) => {
        const comparedValue = compared?.values.find(
          (candidate) => candidate.rowIndex === item.rowIndex,
        )?.value;

        return {
          label: labels[item.rowIndex],
          value: item.value,
          ...(comparedValue === undefined ? {} : { secondary: comparedValue }),
        };
      }),
    });
  }

  const distribution = [...columns]
    .reverse()
    .find((column) => column.values.every((item) => item.value >= 0));

  if (distribution && labels.length <= 8 && charts.length < 3) {
    const distributionPeak = distribution.values.reduce((best, item) =>
      item.value > best.value ? item : best,
    );
    const distributionPeakLabel = labels[distributionPeak.rowIndex];

    charts.push({
      id: "distribution",
      type: "pie",
      title: `Структура · ${distribution.name}`,
      subtitle: "Доля каждой категории",
      valueLabel: distribution.name,
      insight: `${distributionPeakLabel} — крупнейший сегмент: ${formatNumber(distributionPeak.value)}.`,
      data: distribution.values.map((item) => ({
        label: labels[item.rowIndex],
        value: item.value,
      })),
    });
  }

  const riskTitle = riskPattern.test(risk.name)
    ? `${risk.name}: пик приходится на ${peakLabel}`
    : `${primary.name} достигает пика в категории «${labels[
        primary.values.find((item) => item.value === primary.max)?.rowIndex ?? 0
      ]}»`;

  return {
    eyebrow: "Главный сигнал",
    title: riskTitle,
    summary: `В наборе ${source.stats.rows} строк и ${source.stats.columns} колонок. Показатель «${risk.name}» достигает ${formatNumber(risk.max)}, при среднем ${formatNumber(risk.average)}. Самая заметная точка — ${peakLabel}; её стоит проверить в первую очередь.`,
    metrics,
    charts: charts.slice(0, 3),
    suggestedQuestions: [
      `Где максимум по показателю «${risk.name}»?`,
      `Как менялся показатель «${primary.name}»?`,
      "Каких данных не хватает для вывода о причинах?",
    ],
    generatedBy: "local",
  };
}

function topTerms(text: string) {
  const stopWords = new Set([
    "это",
    "как",
    "для",
    "что",
    "или",
    "при",
    "был",
    "была",
    "были",
    "the",
    "and",
    "with",
    "from",
    "this",
    "that",
  ]);

  const counts = new Map<string, number>();
  for (const word of text.toLowerCase().match(/[a-zа-яё]{4,}/gi) ?? []) {
    if (!stopWords.has(word)) counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value]) => ({ label, value }));
}

function makeTextAnalysis(source: DataSource): DashboardAnalysis {
  const lines = source.content
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const allNumbers = (source.content.match(/-?\d+(?:[.,]\d+)?/g) ?? [])
    .map((value) => toNumber(value))
    .filter((value): value is number => value !== null);
  const numbers = allNumbers.slice(0, 10);
  const words = source.content.match(/[a-zа-яё0-9]+/gi) ?? [];
  const terms = topTerms(source.content);
  const opening = lines[0]?.replace(/^[-#*\s]+/, "").slice(0, 90);

  const charts: ChartSpec[] = [
    {
      id: "paragraphs",
      type: "bar",
      title: "Плотность отчёта",
      subtitle: "Количество слов по фрагментам",
      valueLabel: "Слова",
      insight: "Более длинные фрагменты обычно содержат больше контекста для проверки.",
      data: lines.slice(0, 8).map((line, index) => ({
        label: `Фрагмент ${index + 1}`,
        value: line.split(/\s+/).length,
      })),
    },
  ];

  if (numbers.length > 1) {
    charts.unshift({
      id: "numbers",
      type: "line",
      title: "Числа в отчёте",
      subtitle: "В порядке появления в тексте",
      valueLabel: "Значение",
      insight: "Это извлечённые значения без домыслов; подписи стоит сверить с исходным текстом.",
      data: numbers.map((value, index) => ({
        label: `№ ${index + 1}`,
        value,
      })),
    });
  }

  if (terms.length > 1) {
    charts.push({
      id: "terms",
      type: "pie",
      title: "Темы отчёта",
      subtitle: "Частотность ключевых слов",
      valueLabel: "Упоминания",
      insight: `Чаще всего встречается тема «${terms[0].label}».`,
      data: terms,
    });
  }

  return {
    eyebrow: "Кратко по тексту",
    title: opening || "Отчёт готов к исследованию",
    summary: `В тексте ${formatNumber(words.length)} слов и ${formatNumber(allNumbers.length)} числовых упоминаний. Без модели вывод ограничен фактами из текста: графики показывают структуру и найденные значения, не приписывая им отсутствующий смысл.`,
    metrics: [
      {
        label: "Слов",
        value: formatNumber(words.length, true),
        detail: `${lines.length} фрагментов`,
        tone: "neutral",
      },
      {
        label: "Числовых значений",
        value: formatNumber(allNumbers.length),
        detail: "найдено в тексте",
        tone: allNumbers.length ? "positive" : "neutral",
      },
      {
        label: "Основная тема",
        value: terms[0]?.label ?? "—",
        detail: terms[0] ? `${terms[0].value} упоминаний` : "не определена",
        tone: "neutral",
      },
    ],
    charts: charts.slice(0, 3),
    suggestedQuestions: [
      "Какие числа упомянуты в отчёте?",
      "Какая тема встречается чаще всего?",
      "Есть ли в отчёте причины изменений?",
    ],
    generatedBy: "local",
  };
}

export function analyzeLocally(source: DataSource): DashboardAnalysis {
  return source.rows.length && source.headers.length
    ? makeTableAnalysis(source)
    : makeTextAnalysis(source);
}

type SalesRecord = {
  date: string;
  timestamp: number;
  product: string;
  revenue: number;
  orders: number;
};

function formatSalesDate(value: unknown) {
  const raw = String(value ?? "").trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return {
      text: `${iso[3]}.${iso[2]}.${iso[1]}`,
      timestamp: Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])),
    };
  }

  const ru = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (ru) {
    return {
      text: raw,
      timestamp: Date.UTC(Number(ru[3]), Number(ru[2]) - 1, Number(ru[1])),
    };
  }

  return null;
}

function getSalesRecords(source: DataSource): SalesRecord[] | undefined {
  const findColumn = (pattern: RegExp) =>
    source.headers.findIndex((header) => pattern.test(header.toLowerCase()));
  const dateIndex = findColumn(/дата|date/);
  const productIndex = findColumn(/товар|product|item/);
  const revenueIndex = findColumn(/выруч|revenue|sales/);
  const ordersIndex = findColumn(/заказ|orders?/);

  if ([dateIndex, productIndex, revenueIndex, ordersIndex].some((index) => index < 0)) {
    return undefined;
  }

  return source.rows.flatMap((row) => {
    const date = formatSalesDate(row[dateIndex]);
    const product = String(row[productIndex] ?? "").trim();
    const revenue = toNumber(row[revenueIndex]);
    const orders = toNumber(row[ordersIndex]);

    if (!date || !product || revenue === null || orders === null) return [];

    return [
      {
        date: date.text,
        timestamp: date.timestamp,
        product,
        revenue,
        orders,
      },
    ];
  });
}

function ordersLabel(value: number) {
  const integer = Math.abs(Math.trunc(value));
  const lastTwo = integer % 100;
  const last = integer % 10;

  if (lastTwo >= 11 && lastTwo <= 14) return "заказов";
  if (last === 1) return "заказ";
  if (last >= 2 && last <= 4) return "заказа";
  return "заказов";
}

function salesRow(record: SalesRecord) {
  return `товар «${record.product}» ${record.date}: выручка — ${formatNumber(record.revenue)} ₽, ${formatNumber(record.orders)} ${ordersLabel(record.orders)}`;
}

function salesPeriod(records: SalesRecord[]) {
  const sorted = [...records].sort((a, b) => a.timestamp - b.timestamp);
  const first = sorted[0]?.date;
  const last = sorted.at(-1)?.date;
  return first === last ? first : `${first}–${last}`;
}

function aggregateSales(records: SalesRecord[]) {
  const totals = new Map<string, { revenue: number; orders: number }>();

  for (const record of records) {
    const current = totals.get(record.product) ?? { revenue: 0, orders: 0 };
    current.revenue += record.revenue;
    current.orders += record.orders;
    totals.set(record.product, current);
  }

  return [...totals.entries()].map(([product, values]) => ({
    product,
    ...values,
  }));
}

function extremeRows(
  records: SalesRecord[],
  key: "revenue" | "orders",
  direction: "min" | "max",
) {
  const target =
    direction === "max"
      ? Math.max(...records.map((record) => record[key]))
      : Math.min(...records.map((record) => record[key]));
  return records.filter((record) => record[key] === target);
}

function rowAnswer(prefix: string, records: SalesRecord[]) {
  if (records.length === 1) return `${prefix} ${salesRow(records[0])}.`;

  return `${prefix}\n${records.map((record) => `• ${salesRow(record)}.`).join("\n")}`;
}

function requestedTopCount(question: string) {
  const match = question.match(
    /(?:какие|какой|топ|top)\s+(\d{1,2})|(?:(\d{1,2})\s+(?:товар|продукт))/i,
  );
  if (!match) return null;

  const value = Number(match[1] ?? match[2]);
  return Number.isFinite(value) && value > 0 ? Math.min(value, 20) : null;
}

function rankedProductAnswer(
  records: SalesRecord[],
  direction: "min" | "max",
  metric: "orders" | "revenue",
  limit: number | null,
) {
  const totals = aggregateSales(records).sort((a, b) =>
    direction === "min" ? a[metric] - b[metric] : b[metric] - a[metric],
  );
  if (!totals.length) return null;

  const period = salesPeriod(records);
  const count = Math.min(limit ?? 1, totals.length);
  const selected = totals.slice(0, count);
  const metricLabel = metric === "orders" ? "по заказам" : "по выручке";
  const directionLabel =
    direction === "min" ? "Меньше всего продались" : "Больше всего продались";

  if (count === 1) {
    const item = selected[0];
    const singular =
      direction === "min"
        ? "Меньше всего продался"
        : "Больше всего продался";
    return `${singular} товар «${item.product}» ${metricLabel}: выручка — ${formatNumber(item.revenue)} ₽, ${formatNumber(item.orders)} ${ordersLabel(item.orders)} за период ${period}.`;
  }

  return `${directionLabel} ${count} товар${count >= 5 ? "ов" : "а"} ${metricLabel} за период ${period}:\n${selected
    .map(
      (item, index) =>
        `${index + 1}. «${item.product}» — выручка ${formatNumber(item.revenue)} ₽, ${formatNumber(item.orders)} ${ordersLabel(item.orders)}.`,
    )
    .join("\n")}`;
}

export function answerSalesQuestion(
  source: DataSource,
  question: string,
): string | null | undefined {
  const records = getSalesRecords(source);
  if (!records) return undefined;
  if (!records.length) return null;

  const normalized = question.toLowerCase();
  const asksMax =
    /сам[а-яё]*\s+(?:больш|высок)|максим|наибольш|больше всего/i.test(
      normalized,
    );
  const asksMin =
    /сам[а-яё]*\s+(?:мал|низк)|миним|наименьш|меньше всего/i.test(normalized);
  const asksRevenue = /выруч/i.test(normalized);
  const asksOrders = /заказ|прода[лж]|реализац/i.test(normalized);
  const asksProduct =
    /товар|продукт|како[а-яё]*\s+прода|что\s+прода/i.test(normalized);
  const topCount = requestedTopCount(question);

  if (asksProduct && (asksMax || asksMin)) {
    const metric = asksRevenue && !asksOrders ? "revenue" : "orders";
    const direction = asksMax ? "max" : "min";
    return rankedProductAnswer(records, direction, metric, topCount);
  }

  if (asksRevenue && (asksMax || asksMin)) {
    const totals = aggregateSales(records);
    const target = (asksMax ? Math.max : Math.min)(
      ...totals.map((item) => item.revenue),
    );
    const matches = totals.filter((item) => item.revenue === target);
    const label = asksMax
      ? "Наибольшая суммарная выручка"
      : "Наименьшая суммарная выручка";
    const period = salesPeriod(records);

    if (matches.length === 1) {
      const item = matches[0];
      return `${label} у товара «${item.product}» — ${formatNumber(item.revenue)} ₽, ${formatNumber(item.orders)} ${ordersLabel(item.orders)} за период ${period}.`;
    }

    return `${label} одинаковая у нескольких товаров за период ${period}:\n${matches
      .map(
        (item) =>
          `• «${item.product}» — ${formatNumber(item.revenue)} ₽, ${formatNumber(item.orders)} ${ordersLabel(item.orders)}.`,
      )
      .join("\n")}`;
  }

  if (
    /меньше всего продал|миним[а-яё]*\s+(?:заказ|продаж)/i.test(normalized)
  ) {
    return rankedProductAnswer(records, "min", "orders", topCount);
  }

  if (
    /больше всего продал|максим[а-яё]*\s+(?:заказ|продаж)/i.test(normalized)
  ) {
    return rankedProductAnswer(records, "max", "orders", topCount);
  }

  if (asksRevenue && asksMax) {
    return rowAnswer(
      "Самая высокая выручка:",
      extremeRows(records, "revenue", "max"),
    );
  }

  if (asksRevenue && asksMin) {
    return rowAnswer(
      "Самая низкая выручка:",
      extremeRows(records, "revenue", "min"),
    );
  }

  const mentionedProduct = [
    ...new Set(records.map((record) => record.product)),
  ].find((product) =>
    product
      .toLowerCase()
      .split(/\s+/)
      .some(
        (token) => token.length >= 4 && normalized.includes(token.slice(0, 4)),
      ),
  );

  if (
    mentionedProduct &&
    /(?:сколько|всего|итог).*(?:заказ|выруч|продаж)|(?:заказ|выруч|продаж).*(?:всего|итог|сколько)/i.test(
      normalized,
    )
  ) {
    const matches = records.filter(
      (record) => record.product === mentionedProduct,
    );
    const revenue = matches.reduce((sum, record) => sum + record.revenue, 0);
    const orders = matches.reduce((sum, record) => sum + record.orders, 0);
    return `У товара «${mentionedProduct}» за период ${salesPeriod(matches)}: выручка — ${formatNumber(revenue)} ₽, всего ${formatNumber(orders)} ${ordersLabel(orders)}.`;
  }

  if (
    /(?:сколько|всего|итог).*(?:продаж|заказ|выруч)|(?:продаж|заказ|выруч).*(?:сколько|всего|итог)/i.test(
      normalized,
    )
  ) {
    const revenue = records.reduce((sum, record) => sum + record.revenue, 0);
    const orders = records.reduce((sum, record) => sum + record.orders, 0);
    const period = salesPeriod(records);
    const asksSalesWord = /продаж/i.test(normalized);

    if (asksRevenue && !asksOrders && !asksSalesWord) {
      return `За период ${period} суммарная выручка — ${formatNumber(revenue)} ₽.`;
    }

    if (asksOrders && !asksRevenue && !asksSalesWord) {
      return `За период ${period} всего ${formatNumber(orders)} ${ordersLabel(orders)}.`;
    }

    return `За период ${period}: всего ${formatNumber(orders)} ${ordersLabel(orders)}, суммарная выручка — ${formatNumber(revenue)} ₽.`;
  }

  return null;
}

function questionTokens(question: string) {
  return (question.toLowerCase().match(/[a-zа-яё0-9]{3,}/gi) ?? []).filter(
    (word) =>
      !["как", "что", "где", "какой", "какая", "есть", "про", "это"].includes(word),
  );
}

function localConversationAnswer(question: string) {
  if (
    /^(?:привет|здравствуй|добрый\s+(?:день|вечер|утро)|хай)(?:[!,.?\s]|$)/i.test(
      question,
    )
  ) {
    return "Привет! Я помогу разобраться с отчётом — можно спросить о продажах, динамике или конкретных показателях.";
  }

  if (/(?:спасибо|благодарю|понял|ясно)[!.?\s]*$/i.test(question)) {
    return "Пожалуйста! Если хотите, можем проверить ещё один показатель отчёта.";
  }

  if (/(?:что ты умеешь|чем можешь помочь|как дела)/i.test(question)) {
    return "Всё хорошо, спасибо! Я могу находить минимумы и максимумы, считать итоги, сравнивать категории и объяснять показатели текущего отчёта.";
  }

  return null;
}

export function answerLocally(source: DataSource, question: string) {
  const conversationalAnswer = localConversationAnswer(question);
  if (conversationalAnswer) return conversationalAnswer;

  const salesAnswer = answerSalesQuestion(source, question);
  // undefined = not a sales dataset; null = sales dataset but no specialized match
  if (typeof salesAnswer === "string") return salesAnswer;

  const normalized = question.toLowerCase();
  const columns = getNumericColumns(source);
  const requestedColumn =
    columns.find((column) =>
      column.name
        .toLowerCase()
        .split(/[^a-zа-яё0-9]+/i)
        .some((token) => token.length >= 3 && normalized.includes(token)),
    ) ??
    (/(?:продаж|заказ|sales|orders?)/i.test(normalized)
      ? columns.find((column) => /заказ|order|продаж|sales/i.test(column.name))
      : undefined) ??
    (/(?:выруч|revenue)/i.test(normalized)
      ? columns.find((column) => /выруч|revenue|sales/i.test(column.name))
      : undefined) ??
    (/сколько|сумм|всего|итог|максим|средн|миниму/i.test(normalized) &&
    columns.length === 1
      ? columns[0]
      : undefined);

  if (/сколько\s+(строк|запис)/i.test(question)) {
    return `В отчёте ${source.stats.rows} строк данных и ${source.stats.columns} колонок.`;
  }

  if (requestedColumn && /(максим|пик|больше всего)/i.test(question)) {
    const labels = getLabels(source, columns);
    const peak = requestedColumn.values.reduce((best, item) =>
      item.value > best.value ? item : best,
    );
    return `Максимум по показателю «${requestedColumn.name}» — ${formatNumber(peak.value)} (${labels[peak.rowIndex]}).`;
  }

  if (requestedColumn && /(средн|average)/i.test(question)) {
    return `Среднее значение «${requestedColumn.name}» — ${formatNumber(requestedColumn.average)}.`;
  }

  if (requestedColumn && /(сумм|всего|итог)/i.test(question)) {
    return `Сумма по показателю «${requestedColumn.name}» — ${formatNumber(requestedColumn.sum)}.`;
  }

  if (/(причин|почему|из-за чего)/i.test(question)) {
    return "В этом отчёте нет информации о причинах. Здесь видны значения и динамика, но для причинного вывода нужен дополнительный контекст.";
  }

  const tokens = questionTokens(question);
  const matchingLine = source.content
    .split(/\n+/)
    .map((line) => ({
      line: line.trim(),
      score: tokens.reduce(
        (score, token) => score + Number(line.toLowerCase().includes(token)),
        0,
      ),
    }))
    .filter((item) => item.line)
    .sort((a, b) => b.score - a.score)[0];

  if (matchingLine?.score) {
    return `В отчёте найден связанный фрагмент: «${matchingLine.line.slice(0, 240)}». Более точного вывода без дополнительных данных сделать нельзя.`;
  }

  return "В этом отчёте нет такой информации.";
}
