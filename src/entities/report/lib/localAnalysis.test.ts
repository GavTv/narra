import { describe, expect, it } from "vitest";

import { analyzeLocally, withReportOverview } from "@/entities/report";
import { carSalesFixture, realtyFixture, salesFixture } from "@/test/fixtures";

describe("analyzeLocally metrics", () => {
  it("does not treat manufacture year as a summable metric", () => {
    const analysis = analyzeLocally(carSalesFixture);
    const blob = JSON.stringify(analysis);

    expect(blob).not.toMatch(/Год выпуска/i);
    expect(analysis.metrics[0]?.label).toBe("Всего авто");
    expect(analysis.metrics[0]?.value).toBe("5");
    expect(analysis.charts[0]?.valueLabel).not.toMatch(/год|выпуск/i);
  });

  it("keeps normal sales metrics with row count first", () => {
    const analysis = analyzeLocally(salesFixture);
    expect(analysis.metrics[0]?.label).toBe("Всего записей");
    expect(analysis.metrics[0]?.value).toBe("4");
  });

  it("charts daily sales sum without area for realty", () => {
    const analysis = analyzeLocally(realtyFixture);
    const blob = JSON.stringify(analysis);

    expect(analysis.metrics[0]?.label).toBe("Всего объектов");
    expect(analysis.charts[0]?.title).toMatch(/Сумма продаж по дням/i);
    expect(analysis.charts[0]?.valueLabel).toMatch(/Сумма продаж/i);
    expect(blob).not.toMatch(/Площад/i);
    expect(analysis.charts.some((chart) => chart.title === "Цена")).toBe(false);
  });

  it("replaces AI year charts when sanitizing overview", () => {
    const dirty = {
      ...analyzeLocally(salesFixture),
      metrics: [
        {
          label: "Всего · Год выпуска",
          value: "607 тыс",
          detail: "300 точек",
          tone: "neutral" as const,
        },
        {
          label: "Пик · Год выпуска",
          value: "2 тыс",
          detail: "x",
          tone: "positive" as const,
        },
        {
          label: "Среднее · Пробег",
          value: "83 тыс",
          detail: "x",
          tone: "neutral" as const,
        },
      ],
      charts: [
        {
          id: "bad",
          type: "line" as const,
          title: "Год выпуска и Пробег, км",
          subtitle: "bad",
          valueLabel: "Год выпуска",
          secondaryLabel: "Пробег, км",
          insight: "bad",
          data: [
            { label: "2026-07-31", value: 4039, secondary: 77_000 },
            { label: "2026-07-31", value: 4048, secondary: 132_003 },
          ],
        },
      ],
    };

    const cleaned = withReportOverview(carSalesFixture, dirty);
    expect(JSON.stringify(cleaned)).not.toMatch(/Всего · Год выпуска/);
    expect(cleaned.charts[0]?.valueLabel).not.toMatch(/год|выпуск/i);
    expect(cleaned.metrics.some((metric) => /от первой точки/.test(metric.detail))).toBe(
      false,
    );
  });
});
