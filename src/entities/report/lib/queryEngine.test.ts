import { describe, expect, it } from "vitest";

import { answerDeterministically } from "@/entities/report";
import { marketingFixture, salesFixture } from "@/test/fixtures";

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

  it("does not guess an ambiguous numeric column", () => {
    expect(
      answerDeterministically(marketingFixture, "Какой максимум?"),
    ).toBeNull();
  });
});
