import { describe, expect, it } from "vitest";

import { inferBestCategoryIndex, inferDateColumnIndex } from "./schemaProfile";
import { carSalesFixture, salesFixture } from "@/test/fixtures";

describe("schemaProfile", () => {
  it("detects date column by header", () => {
    expect(inferDateColumnIndex(salesFixture)).toBe(0);
  });

  it("prefers semantic category for sales table", () => {
    const index = inferBestCategoryIndex(salesFixture, {
      excludeIndexes: [0, 2, 3],
      question: "Какой товар самый популярный?",
    });
    expect(index).toBe(1);
  });

  it("finds day/date grouping on car dataset", () => {
    const dateIndex = inferDateColumnIndex(carSalesFixture);
    expect(dateIndex).toBe(0);
  });
});
