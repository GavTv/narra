import type { ChartSpec, DashboardAnalysis, Metric } from "@/entities/analysis";
import type { ChatTurn } from "@/entities/chat";
import { NO_DATA_STUB } from "@/shared/consts/messages";
import {
  formatNumber,
  mergeChartPointsByDate,
  toNumber,
} from "@/shared/lib/format";

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

function looksLikeYearValues(values: number[]) {
  if (!values.length) return false;
  const yearLike = values.filter((value) => value >= 1900 && value <= 2100);
  if (yearLike.length < values.length * 0.8) return false;
  const min = Math.min(...yearLike);
  const max = Math.max(...yearLike);
  return max - min <= 120;
}

function isNonMetricColumn(name: string, values: number[] = []) {
  if (
    /год|year|выпуск|model.?year|рожден|birth|\bid\b|uuid|индекс|index|рейтинг|rating|zip|инн|телефон|phone|кандидат|candidate|имя|фио|\bname\b|площад|area|м²|м2|комнат|rooms?|этаж|floor/i.test(
      name,
    )
  ) {
    return true;
  }
  return looksLikeYearValues(values);
}

function isMoneyColumn(name: string) {
  return /цена|стоим|выруч|revenue|price|amount|продаж|sales|сумм|прибыл|profit/i.test(
    name,
  );
}

function metricPriority(name: string) {
  if (isMoneyColumn(name)) return 0;
  if (
    /пробег|mileage|заказ|order|лид|lead|расход|cost|количеств|count|шт/i.test(
      name,
    )
  ) {
    return 10;
  }
  if (/год|year|выпуск|\bid\b|рейтинг|rating|площад|area|комнат/i.test(name)) {
    return 100;
  }
  return 40;
}

function getNumericColumns(source: DataSource): NumericColumn[] {
  return source.headers
    .map((name, index) => {
      const values = source.rows.flatMap((row, rowIndex) => {
        const value = toNumber(row[index]);
        return value === null ? [] : [{ value, rowIndex }];
      });

      if (!values.length || values.length < source.rows.length * 0.6) return null;

      const numbers = values.map((item) => item.value);
      if (isNonMetricColumn(name, numbers)) return null;

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
    .filter((column): column is NumericColumn => column !== null)
    .sort(
      (a, b) =>
        metricPriority(a.name) - metricPriority(b.name) || a.index - b.index,
    );
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
  return `по ${column.values.length} значениям`;
}

function entityCountMetric(source: DataSource): Metric {
  const context = `${source.headers.join(" ")} ${source.name}`.toLowerCase();
  const count = source.rows.length;

  if (/кандидат|ваканси|отклик|hiring|resume|резюме/.test(context)) {
    return {
      label: "Всего кандидатов",
      value: formatNumber(count),
      detail: "записей в таблице",
      tone: "neutral",
    };
  }

  if (/авто|машин|car|пробег|mileage|выпуск|vin/.test(context)) {
    return {
      label: "Всего авто",
      value: formatNumber(count),
      detail: "записей в таблице",
      tone: "neutral",
    };
  }

  if (/квартир|дом|недвиж|риелт|realty|площад|район/.test(context)) {
    return {
      label: "Всего объектов",
      value: formatNumber(count),
      detail: "записей в таблице",
      tone: "neutral",
    };
  }

  return {
    label: "Всего записей",
    value: formatNumber(count),
    detail: "строк в отчёте",
    tone: "neutral",
  };
}

function yearsFromSource(source: DataSource) {
  const dateIndex = source.headers.findIndex((header) =>
    /дата|date|period|период/i.test(header),
  );
  if (dateIndex < 0) return [];

  const years = new Set<number>();
  for (const row of source.rows) {
    const raw = String(row[dateIndex] ?? "").trim();
    const iso = raw.match(/^(\d{4})[-/.]/);
    const ru = raw.match(/^\d{2}\.\d{2}\.(\d{4})$/);
    const year = Number(iso?.[1] ?? ru?.[1]);
    if (Number.isFinite(year) && year >= 1990 && year <= 2100) {
      years.add(year);
    }
  }

  return [...years].sort((a, b) => a - b);
}

function reportTopic(source: DataSource) {
  const headers = source.headers.join(" ").toLowerCase();
  const name = source.name.toLowerCase();
  const body =
    source.headers.length > 0
      ? ""
      : source.content.slice(0, 2_500).toLowerCase();
  const blob = `${headers} ${name} ${body}`;

  if (/выруч|заказ|товар|продаж|sales|revenue|order|product/.test(blob)) {
    return "продажам";
  }
  if (/авто|машин|car|пробег|mileage|выпуск/.test(blob)) {
    return "авто";
  }
  if (/квартир|дом|недвиж|риелт|realty|площад/.test(blob)) {
    return "недвижимости";
  }
  if (/лид|канал|расход|конверс|маркетинг|lead|campaign|cost/.test(blob)) {
    return "маркетингу";
  }
  if (/баг|ошиб|ticket|jira|issue|support|обращен|спринт|cycle/.test(blob)) {
    return "операциям";
  }
  if (/кандидат|вакан|найм|hiring|оффер|скрининг/.test(blob)) {
    return "найму";
  }

  const stem = source.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  if (stem && !/^вставленный|текстовый|отчёт$/i.test(stem)) {
    return `«${stem}»`;
  }
  return "данным";
}

function fileStem(name: string) {
  return name.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim() || "отчёт";
}

function joinRu(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} и ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} и ${items.at(-1)}`;
}

function softenMetricName(name: string) {
  const trimmed = name.replace(/\s+/g, " ").trim();
  if (!trimmed || /^[A-Za-z]/.test(trimmed)) return trimmed;
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

function byDimension(header: string) {
  const key = header.trim().toLowerCase();
  if (/^(день|day)$/.test(key)) return "по дням";
  if (/^(дата|date)$/.test(key)) return "по датам";
  if (/товар|product|item/.test(key)) return "по товарам";
  if (/категор|category/.test(key)) return "по категориям";
  if (/город|city/.test(key)) return "по городам";
  if (/район|district/.test(key)) return "по районам";
  if (/канал|channel/.test(key)) return "по каналам";
  if (/этап|статус|stage|status/.test(key)) return `по полю «${header.trim()}»`;
  return `по «${header.trim()}»`;
}

function contentSummary(source: DataSource) {
  const stem = fileStem(source.name);

  if (!source.headers.length) {
    const topic = reportTopic(source);
    return topic.startsWith("«")
      ? `В тексте — материал по теме ${topic}.`
      : `В тексте — материал по ${topic}.`;
  }

  const numeric = getNumericColumns(source);
  const metricIndexes = new Set(numeric.map((column) => column.index));
  const dimensions = source.headers.filter(
    (header, index) =>
      !metricIndexes.has(index) &&
      !/кандидат|candidate|сотрудник|имя|фио|\bname\b|email|телефон|phone|\bid\b/i.test(
        header,
      ),
  );

  const metrics = numeric
    .slice(0, 5)
    .map((column) => softenMetricName(column.name));
  const metricsText =
    metrics.length > 0
      ? joinRu(metrics) + (numeric.length > 5 ? " и др." : "")
      : joinRu(source.headers.slice(0, 5).map(softenMetricName));

  if (dimensions.length > 0 && metrics.length > 0) {
    return `В файле «${stem}»: показатели ${byDimension(dimensions[0])} — ${metricsText}.`;
  }

  if (metrics.length > 0) {
    return `В файле «${stem}»: ${source.stats.rows} записей, показатели — ${metricsText}.`;
  }

  return `В файле «${stem}»: ${source.stats.rows} записей, поля — ${joinRu(
    source.headers.slice(0, 6),
  )}.`;
}

export function reportOverview(source: DataSource) {
  const years = yearsFromSource(source);
  const topic = reportTopic(source);
  const period =
    years.length === 0
      ? null
      : years.length === 1
        ? String(years[0])
        : `${years[0]}–${years.at(-1)}`;

  const title = period
    ? `Отчёт за ${period} по ${topic}`
    : `Отчёт по ${topic}`;

  return { title, summary: contentSummary(source), eyebrow: "Обзор отчёта" };
}

export function withReportOverview(
  source: DataSource,
  analysis: DashboardAnalysis,
): DashboardAnalysis {
  const overview = reportOverview(source);
  const local = analyzeLocally(source);
  const hasTable = source.headers.length > 0 && source.rows.length > 0;

  if (!hasTable) {
    return {
      ...local,
      eyebrow: local.eyebrow || overview.eyebrow,
      title: local.title || overview.title,
      summary: local.summary,
      charts: [],
    };
  }

  const useLocalVisuals = local.charts.length > 0;

  const charts = (useLocalVisuals ? local.charts : analysis.charts).map(
    (chart) => {
      if (chart.type !== "line") return chart;
      return {
        ...chart,
        data: mergeChartPointsByDate(chart.data),
      };
    },
  );

  return {
    ...analysis,
    eyebrow: overview.eyebrow,
    title: overview.title,
    summary: overview.summary,
    metrics: useLocalVisuals ? local.metrics : analysis.metrics,
    charts,
    suggestedQuestions: useLocalVisuals
      ? local.suggestedQuestions
      : analysis.suggestedQuestions,
  };
}

function makeTableAnalysis(source: DataSource): DashboardAnalysis {
  const columns = getNumericColumns(source);
  const labels = getLabels(source, columns);
  const primary =
    columns.find((column) => isMoneyColumn(column.name)) ?? columns[0];
  const risk =
    columns.find(
      (column) =>
        riskPattern.test(column.name) && column.index !== primary?.index,
    ) ?? primary;
  const overview = reportOverview(source);

  if (!primary) return makeTextAnalysis(source);

  const peak = primary.values.reduce((best, item) =>
    item.value > best.value ? item : best,
  );
  const peakLabel = labels[peak.rowIndex] ?? `строке ${peak.rowIndex + 1}`;

  const metrics: Metric[] = [
    entityCountMetric(source),
    {
      label: `Пик · ${primary.name}`,
      value: formatNumber(primary.max, true),
      detail: peakLabel,
      tone: "positive",
    },
    {
      label: `Среднее · ${primary.name}`,
      value: formatNumber(primary.average, true),
      detail: trendDetail(primary),
      tone: "neutral",
    },
  ];

  const charts: ChartSpec[] = [];
  const dateIndex = source.headers.findIndex((header) =>
    /дата|date|period|период/i.test(header),
  );
  const moneyMode = isMoneyColumn(primary.name) && dateIndex >= 0;

  const timelineSource = primary.values.map((item) => {
    const rawLabel =
      dateIndex >= 0
        ? String(source.rows[item.rowIndex]?.[dateIndex] ?? "")
        : labels[item.rowIndex];

    return {
      label: rawLabel || labels[item.rowIndex],
      value: item.value,
    };
  });
  const timelineData = mergeChartPointsByDate(timelineSource, 14);
  const dailyPeak = timelineData.reduce(
    (best, item) => (item.value > best.value ? item : best),
    timelineData[0] ?? { label: "", value: 0 },
  );

  charts.push({
    id: "trend",
    type: timelineData.length >= 4 ? "line" : "bar",
    title: moneyMode ? "Сумма продаж по дням" : primary.name,
    subtitle: moneyMode ? "Сумма за день" : "По дням",
    valueLabel: moneyMode ? "Сумма продаж" : primary.name,
    insight: moneyMode
      ? `Пик дня — ${dailyPeak.label}: ${formatNumber(dailyPeak.value)}.`
      : `Динамика «${primary.name}».`,
    data: timelineData,
  });

  const categoryIndex = source.headers.findIndex(
    (header, index) =>
      index !== dateIndex &&
      !columns.some((column) => column.index === index) &&
      /тип|категор|район|город|регион|товар|product|канал|source|марка|бренд|segment/i.test(
        header,
      ),
  );

  if (moneyMode && categoryIndex >= 0 && charts.length < 2) {
    const groups = new Map<string, number>();
    for (const item of primary.values) {
      const raw = String(source.rows[item.rowIndex]?.[categoryIndex] ?? "").trim();
      if (!raw || raw === "—") continue;
      groups.set(raw, (groups.get(raw) ?? 0) + item.value);
    }
    const ranked = [...groups.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    if (ranked.length >= 2) {
      charts.push({
        id: "by-category",
        type: "bar",
        title: `Продажи по «${source.headers[categoryIndex]}»`,
        subtitle: "Сумма",
        valueLabel: "Сумма продаж",
        insight: `Лидер — «${ranked[0][0]}»: ${formatNumber(ranked[0][1])}.`,
        data: ranked.map(([label, value]) => ({ label, value })),
      });
    }
  } else if (
    risk &&
    risk.index !== primary.index &&
    !isMoneyColumn(risk.name) &&
    charts.length < 2
  ) {
    charts.push({
      id: "risk",
      type: "bar",
      title: risk.name,
      subtitle: `Максимум — ${peakLabel}`,
      valueLabel: risk.name,
      insight: `${formatNumber(risk.max)} — пик показателя; среднее — ${formatNumber(risk.average)}.`,
      data: risk.values.slice(0, 10).map((item) => ({
        label: labels[item.rowIndex],
        value: item.value,
      })),
    });
  }

  return {
    eyebrow: overview.eyebrow,
    title: overview.title,
    summary: overview.summary,
    metrics,
    charts: charts.slice(0, 2),
    suggestedQuestions: [
      `Какой день был с наибольшей суммой по «${primary.name}»?`,
      `Где максимум по показателю «${primary.name}»?`,
      "Каких данных не хватает для вывода о причинах?",
    ],
    generatedBy: "local",
  };
}

function makeTextAnalysis(source: DataSource): DashboardAnalysis {
  const lines = source.content
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const allNumbers = (source.content.match(/-?\d+(?:[.,]\d+)?/g) ?? [])
    .map((value) => toNumber(value))
    .filter((value): value is number => value !== null);
  const words = source.content.match(/[a-zа-яё0-9]+/gi) ?? [];
  const overview = reportOverview(source);

  return {
    eyebrow: "Текст",
    title: overview.title,
    summary: `${overview.summary} Спрашивайте факты в чате; графики — из таблиц.`,
    metrics: [
      {
        label: "Символов",
        value: formatNumber(source.stats.characters, true),
        detail: "объём текста",
        tone: "neutral",
      },
      {
        label: "Фрагментов",
        value: formatNumber(lines.length, true),
        detail: "абзацев и строк",
        tone: "neutral",
      },
      {
        label: "Чисел в тексте",
        value: formatNumber(allNumbers.length),
        detail: words.length
          ? `${formatNumber(words.length, true)} слов`
          : "можно уточнить в чате",
        tone: allNumbers.length ? "positive" : "neutral",
      },
    ],
    charts: [],
    suggestedQuestions: [],
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

/** 1-based place: «на втором месте», «а третий?», «кто следующий». */
function requestedRankPlace(question: string): number | null {
  const q = question.toLowerCase().replace(/ё/g, "е");

  if (
    /(?:кто|что)?\s*(?:же\s+)?(?:тогда\s+)?(?:следующ|дальше)\b|после\s+(?:него|нее|этого)|еще\s+один\b/i.test(
      q,
    )
  ) {
    return 2;
  }

  const patterns: Array<[RegExp, number]> = [
    [/(?:на\s+)?перв(?:ом|ое|ый|ая)\s+мест|1[-.]?\s*мест|\bтоп\s*1\b/, 1],
    [
      /(?:на\s+)?втор(?:ом|ое|ой|ая)\s+мест|2[-.]?\s*мест|(?:^|\s)(?:а\s+)?(?:что|кто|какой)?\s*(?:же\s+)?втор(?:ой|ое|ом|ая)(?:\?|$|\s)/,
      2,
    ],
    [
      /(?:на\s+)?треть(?:ем|е|ий|я)\s+мест|3[-.]?\s*мест|(?:^|\s)(?:а\s+)?(?:что|кто|какой)?\s*(?:же\s+)?треть(?:ий|е|ем|я)(?:\?|$|\s)/,
      3,
    ],
    [/(?:на\s+)?четверт(?:ом|ое|ый|ая)\s+мест|4[-.]?\s*мест/, 4],
    [/(?:на\s+)?пят(?:ом|ое|ый|ая)\s+мест|5[-.]?\s*мест/, 5],
  ];

  for (const [pattern, place] of patterns) {
    if (pattern.test(q)) return place;
  }

  const numbered = q.match(
    /(?:на\s+)?(\d{1,2})(?:[-.]?[мoe]?)?\s*(?:м\s+)?мест/,
  );
  if (numbered) {
    const value = Number(numbered[1]);
    if (Number.isFinite(value) && value >= 1 && value <= 20) return value;
  }

  return null;
}

function inferSalesRankContext(history: ChatTurn[] | undefined): {
  metric: "orders" | "revenue";
  direction: "min" | "max";
} | null {
  if (!history?.length) return null;

  const recent = history
    .slice(-6)
    .map((turn) => turn.content.toLowerCase().replace(/ё/g, "е"))
    .join("\n");

  const metric: "orders" | "revenue" =
    /заказ/.test(recent) && !/выруч/.test(recent) ? "orders" : "revenue";

  const direction: "min" | "max" =
    /наименьш|меньше всего|сам[а-я]*\s+(?:мал|низк)|миним/.test(recent) &&
    !/наибольш|больше всего|сам[а-я]*\s+(?:больш|высок)|максим/.test(recent)
      ? "min"
      : "max";

  if (
    /выруч|заказ|товар|продаж|наибольш|наименьш|максим|миним|больше всего|меньше всего/.test(
      recent,
    )
  ) {
    return { metric, direction };
  }

  return null;
}

function placeLabel(place: number) {
  const special: Record<number, string> = {
    1: "первом",
    2: "втором",
    3: "третьем",
    4: "четвёртом",
    5: "пятом",
  };
  return special[place] ?? `${place}-м`;
}

function rankedPlaceAnswer(
  records: SalesRecord[],
  direction: "min" | "max",
  metric: "orders" | "revenue",
  place: number,
) {
  const totals = aggregateSales(records).sort((a, b) =>
    direction === "min" ? a[metric] - b[metric] : b[metric] - a[metric],
  );
  if (!totals.length) return null;

  if (place > totals.length) {
    return `В рейтинге только ${totals.length} товар${totals.length === 1 ? "" : totals.length < 5 ? "а" : "ов"} — ${place}-го места нет.`;
  }

  const item = totals[place - 1];
  const period = salesPeriod(records);
  const metricLabel = metric === "orders" ? "по заказам" : "по выручке";

  return `На ${placeLabel(place)} месте ${metricLabel} — «${item.product}»: выручка — ${formatNumber(item.revenue)} ₽, ${formatNumber(item.orders)} ${ordersLabel(item.orders)} за период ${period}.`;
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
  history: ChatTurn[] = [],
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
  const place = requestedRankPlace(question);

  if (place !== null) {
    const inferred = inferSalesRankContext(history);
    const metric: "orders" | "revenue" =
      asksOrders && !asksRevenue
        ? "orders"
        : asksRevenue && !asksOrders
          ? "revenue"
          : (inferred?.metric ?? "revenue");
    const direction: "min" | "max" = asksMin
      ? "min"
      : asksMax
        ? "max"
        : (inferred?.direction ?? "max");
    return rankedPlaceAnswer(records, direction, metric, place);
  }

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

  if (
    /что\s+(?:это|за)|что\s+за\s+(?:файл|отч|таблиц)|какой\s+(?:это\s+)?файл|о\s+ч[её]м\s+(?:этот\s+)?(?:файл|отч)|структур|какие\s+колон|опиши\s+(?:файл|отч)/i.test(
      question,
    )
  ) {
    if (!source.headers.length) {
      return `Это текстовый файл «${source.name}»: около ${source.stats.rows} фрагментов. Можно спросить о фактах из текста.`;
    }
    return `Это табличный отчёт «${source.name}»: ${source.stats.rows} строк, колонки — ${source.headers.join(", ")}.`;
  }

  const salesAnswer = answerSalesQuestion(source, question);
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
    (/сколько|сумм|всего|итог|максим|средн|миниму|пик/i.test(normalized) &&
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
    if (!source.headers.length) {
      return `В отчёте найден связанный фрагмент: «${matchingLine.line.slice(0, 240)}». Более точного вывода без дополнительных данных сделать нельзя.`;
    }
    return `Не удалось однозначно посчитать ответ. Уточните показатель или категорию (колонки: ${source.headers.slice(0, 6).join(", ")}).`;
  }

  return NO_DATA_STUB;
}
