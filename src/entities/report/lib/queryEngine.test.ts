import { describe, expect, it } from "vitest";

import { answerDeterministically } from "@/entities/report";
import {
  hiringFixture,
  marketingFixture,
  multiMonthSalesFixture,
  salesFixture,
} from "@/test/fixtures";

describe("answerDeterministically", () => {
  it("calculates an exact sum for a matching numeric column", () => {
    const result = answerDeterministically(
      marketingFixture,
      "Сколько всего расходов?",
    );

    expect(result?.answer).toContain("210");
    expect(result?.answer).toContain("Расходы");
    expect(result?.citations).toEqual([
      { id: "row-2", label: "Строка 2" },
      { id: "row-3", label: "Строка 3" },
      { id: "row-4", label: "Строка 4" },
    ]);
  });

  it("groups values by a requested category", () => {
    const result = answerDeterministically(
      marketingFixture,
      "Какой канал имеет максимальное количество лидов?",
    );

    expect(result?.answer).toContain("Поиск");
    expect(result?.answer).toContain("200");
    expect(result?.citations[0]).toEqual({
      id: "row-2",
      label: "Строка 2",
    });
  });

  it("keeps the specialized sales calculation and evidence", () => {
    const result = answerDeterministically(
      salesFixture,
      "Какой товар имеет самую большую выручку?",
    );

    expect(result?.answer).toContain("Куртка Urban");
    expect(result?.answer).toContain("150");
    expect(result?.citations).toHaveLength(2);
  });

  it("ranks products that sold the least", () => {
    const least = answerDeterministically(
      salesFixture,
      "что продалось меньше всего?",
    );
    expect(least?.answer).toContain("Рюкзак Trek");
    expect(least?.answer).toContain("3");

    const topFour = answerDeterministically(
      salesFixture,
      "Какие 4 товара продались меньше всего?",
    );
    expect(topFour?.answer).toContain("Рюкзак Trek");
    expect(topFour?.answer).toContain("Кепка Street");
    expect(topFour?.answer).toContain("Куртка Urban");
  });

  it("sums total sales without calling the model", () => {
    const result = answerDeterministically(
      salesFixture,
      "Сколько всего продаж было?",
    );

    expect(result?.answer).toContain("27");
    expect(result?.answer).toContain("270");
  });

  it("describes the file from schema without hard-coded phrases per dataset", () => {
    const result = answerDeterministically(salesFixture, "Что это за файл?");

    expect(result?.answer).toContain("sales.csv");
    expect(result?.answer).toContain("Дата");
    expect(result?.answer).toContain("Товар");
    expect(result?.citations[0]?.id).toBe("schema");
  });

  it("finds the sales peak day from column structure", () => {
    const result = answerDeterministically(
      salesFixture,
      "Когда был пик продаж?",
    );

    expect(result?.answer).toMatch(/01\.07\.2026|2026-07-01/);
    expect(result?.answer).toContain("19");
  });

  it("finds the most and least profitable months by revenue", () => {
    const best = answerDeterministically(
      multiMonthSalesFixture,
      "какой месяц самый прибыльный был",
    );
    expect(best?.answer).toMatch(/июль 2026/i);
    expect(best?.answer).toContain("190");

    const worst = answerDeterministically(
      multiMonthSalesFixture,
      "а какой месяц самый не прибыльный был",
    );
    expect(worst?.answer).toMatch(/август 2026/i);
    expect(worst?.answer).toContain("30");
  });

  it("does not guess an ambiguous numeric column", () => {
    expect(
      answerDeterministically(marketingFixture, "Какой максимум?"),
    ).toBeNull();
  });

  it("leaves stage filters to the model instead of keyword matching", () => {
    expect(
      answerDeterministically(hiringFixture, "Сколько кандидатов проходит оффер"),
    ).toBeNull();
    expect(
      answerDeterministically(hiringFixture, "Сколько кандидатов получили отказ?"),
    ).toBeNull();
    expect(
      answerDeterministically(
        hiringFixture,
        "Сколько кандидатов прошли скриннинг",
      ),
    ).toBeNull();
  });

  it("counts total candidates as row count", () => {
    const result = answerDeterministically(
      hiringFixture,
      "Сколько всего кандидатов?",
    );

    expect(result?.answer).toMatch(/6/);
    expect(result?.answer).not.toMatch(/отказался|Отказ|Оффер/i);
  });
});
