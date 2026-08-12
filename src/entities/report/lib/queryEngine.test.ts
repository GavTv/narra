import { describe, expect, it } from "vitest";

import { answerDeterministically } from "@/entities/report";
import {
  carSalesFixture,
  hiringFixture,
  marketingFixture,
  multiMonthSalesFixture,
  realtyFixture,
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

  it("answers second place in the revenue ranking", () => {
    const first = answerDeterministically(
      salesFixture,
      "Где самая большая выручка?",
    );
    expect(first?.answer).toContain("Куртка Urban");

    const second = answerDeterministically(
      salesFixture,
      "Что на втором месте?",
      [
        { role: "user", content: "Где самая большая выручка?" },
        { role: "assistant", content: first!.answer },
      ],
    );

    expect(second?.answer).toContain("Кепка Street");
    expect(second?.answer).toMatch(/90/);
    expect(second?.answer).not.toMatch(/Информация отсутствует|пустота/i);
  });

  it("answers third place without history on sales data", () => {
    const third = answerDeterministically(
      salesFixture,
      "Кто на третьем месте по выручке?",
    );
    expect(third?.answer).toContain("Рюкзак Trek");
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

  it("finds the most expensive realty object", () => {
    const result = answerDeterministically(
      realtyFixture,
      "Какой объект самый дорогой?",
    );

    expect(result?.answer).toMatch(/30[\s]?268[\s]?565|30 268 565/);
    expect(result?.answer).toMatch(/Центр|2026-05-06|Квартира/);
  });

  it("rejects a cheaper object as the most expensive", () => {
    const result = answerDeterministically(
      realtyFixture,
      "а может этот - 2026-05-20 Дом Новый район 27 570 185",
    );

    expect(result?.answer).toMatch(/^Нет/);
    expect(result?.answer).toMatch(/30/);
    expect(result?.answer).not.toMatch(/^Да/);
  });

  it("confirms the current maximum when asked", () => {
    const result = answerDeterministically(
      realtyFixture,
      "То есть он самый дорогой?",
    );

    expect(result?.answer).toMatch(/^Да/);
    expect(result?.answer).toMatch(/30/);
  });

  it("finds the most popular club by row count", () => {
    const gymFixture = {
      name: "gym.csv",
      kind: "csv" as const,
      content: "x",
      headers: [
        "Дата покупки",
        "Клиент",
        "Абонемент",
        "Клуб",
        "Тренер",
        "Стоимость",
        "Посещений за месяц",
        "Продление",
      ],
      rows: [
        ["2026-01-01", "1", "Год", "Central Fit", "Юлия", 1200, 1, "Нет"],
        ["2026-01-02", "2", "Месяц", "Central Fit", "Юлия", 1200, 2, "Да"],
        ["2026-01-03", "3", "Год", "North Gym", "Иван", 900, 1, "Нет"],
        ["2026-01-04", "4", "Месяц", "Central Fit", "Юлия", 1200, 3, "Да"],
        ["2026-01-05", "5", "Год", "South Club", "Оля", 800, 1, "Нет"],
      ],
      stats: { rows: 5, columns: 8, characters: 1 },
    };

    const result = answerDeterministically(
      gymFixture,
      "Какой клуб самый популярный?",
    );

    expect(result?.answer).toContain("Central Fit");
    expect(result?.answer).toMatch(/3/);
    expect(result?.answer).not.toMatch(/связанный фрагмент|пустота/i);
  });

  it("finds the district with the most objects", () => {
    const result = answerDeterministically(
      realtyFixture,
      "В каком Районе больше всего объектов?",
    );

    expect(result?.answer).toMatch(/Центр/);
    expect(result?.answer).toMatch(/3/);
    expect(result?.answer).not.toMatch(/Сумма по показателю/);
  });

  it("finds the district with the most property types", () => {
    const result = answerDeterministically(
      realtyFixture,
      "В каком Районе больше всего типов",
    );

    expect(result?.answer).toMatch(/Центр/);
    expect(result?.answer).toMatch(/тип/i);
    expect(result?.answer).not.toMatch(/Сумма по показателю/);
  });

  it("answers day with most and least sold cars", () => {
    const most = answerDeterministically(
      carSalesFixture,
      "В какой день было продано больше всего машин?",
    );
    expect(most?.answer).toMatch(/Дата|день/i);
    expect(most?.answer).toMatch(/2026-07-01|01\.07\.2026/);
    expect(most?.answer).toMatch(/2/);

    const least = answerDeterministically(
      carSalesFixture,
      "В какой день было продано меньше всего машин?",
    );
    expect(least?.answer).toMatch(/Дата|день/i);
    expect(least?.answer).toMatch(/2026-07-15|2026-07-31|15\.07\.2026|31\.07\.2026/);
    expect(least?.answer).toMatch(/1/);
    expect(least?.answer).not.toMatch(/Информация отсутствует/i);
  });

  it("answers min/max by day using metric values, not row count", () => {
    const bugsFixture = {
      name: "bugs.csv",
      kind: "csv" as const,
      content: "x",
      headers: ["День", "Баги"],
      rows: [
        ["Понедельник", 4],
        ["Вторник", 9],
        ["Среда", 6],
        ["Четверг", 3],
        ["Пятница", 2],
      ],
      stats: { rows: 5, columns: 2, characters: 1 },
    };

    const min = answerDeterministically(
      bugsFixture,
      "В какой из дней меньше всего было багов?",
    );
    expect(min?.answer).toMatch(/Пятниц/);
    expect(min?.answer).toMatch(/2/);
    expect(min?.answer).not.toMatch(/одинаковый минимум/i);

    const max = answerDeterministically(
      bugsFixture,
      "А в какой из дней было больше всего багов?",
    );
    expect(max?.answer).toMatch(/Вторник/);
    expect(max?.answer).toMatch(/9/);
    expect(max?.answer).not.toMatch(/одинаковый максимум/i);
  });

  it("answers metric sum for concrete day phrasing", () => {
    const bugsFixture = {
      name: "bugs.csv",
      kind: "csv" as const,
      content: "x",
      headers: ["День", "Создано", "Баги"],
      rows: [
        ["Понедельник", 24, 4],
        ["Вторник", 32, 9],
        ["Среда", 27, 6],
      ],
      stats: { rows: 3, columns: 3, characters: 1 },
    };

    const result = answerDeterministically(
      bugsFixture,
      "Сколько багов во вторник?",
    );
    expect(result?.answer).toMatch(/9/);
    expect(result?.answer).toMatch(/вторник/i);
    expect(result?.answer).not.toMatch(/уточните показатель|Информация отсутствует/i);
  });

  it("prefers drink category over date for popularity questions", () => {
    const drinksFixture = {
      name: "drinks.csv",
      kind: "csv" as const,
      content: "x",
      headers: ["Дата", "Напиток", "Количество"],
      rows: [
        ["06.08.2026", "Капучино", 2],
        ["06.08.2026", "Эспрессо", 1],
        ["08.08.2026", "Капучино", 3],
        ["09.08.2026", "Латте", 2],
        ["13.08.2026", "Капучино", 1],
      ],
      stats: { rows: 5, columns: 3, characters: 1 },
    };

    const result = answerDeterministically(
      drinksFixture,
      "Какие напитки покупают чаще всего?",
    );
    expect(result?.answer).toMatch(/Напиток/);
    expect(result?.answer).toMatch(/Капучино/);
    expect(result?.answer).not.toMatch(/Дата/);
  });

  it("treats 'непопулярный напиток' as least popular", () => {
    const drinksFixture = {
      name: "drinks.csv",
      kind: "csv" as const,
      content: "x",
      headers: ["Дата", "Напиток", "Количество"],
      rows: [
        ["06.08.2026", "Капучино", 2],
        ["06.08.2026", "Эспрессо", 1],
        ["08.08.2026", "Капучино", 3],
        ["09.08.2026", "Латте", 2],
        ["13.08.2026", "Капучино", 1],
      ],
      stats: { rows: 5, columns: 3, characters: 1 },
    };

    const result = answerDeterministically(
      drinksFixture,
      "Какой непопулярный напиток?",
    );
    expect(result?.answer).toMatch(/меньше всего/i);
    expect(result?.answer).toMatch(/Эспрессо/);
    expect(result?.answer).toMatch(/Количество/);
    expect(result?.answer).not.toMatch(/Самый популярный/i);
  });

  it("treats 'не популярный напиток' as least popular", () => {
    const drinksFixture = {
      name: "drinks.csv",
      kind: "csv" as const,
      content: "x",
      headers: ["Дата", "Напиток", "Количество"],
      rows: [
        ["06.08.2026", "Капучино", 2],
        ["06.08.2026", "Эспрессо", 1],
        ["08.08.2026", "Капучино", 3],
        ["09.08.2026", "Латте", 2],
        ["13.08.2026", "Капучино", 1],
      ],
      stats: { rows: 5, columns: 3, characters: 1 },
    };

    const result = answerDeterministically(
      drinksFixture,
      "какой напиток не популярный?",
    );
    expect(result?.answer).toMatch(/меньше всего/i);
    expect(result?.answer).toMatch(/Эспрессо/);
    expect(result?.answer).not.toMatch(/Самый популярный/i);
  });

  it("maps completed tasks question to 'Закрыто' in Jira-like report", () => {
    const jiraFixture = {
      name: "jira-week-32.csv",
      kind: "csv" as const,
      content: "x",
      headers: ["День", "Создано", "Закрыто", "На ревью", "Cycle time, ч", "Баги"],
      rows: [
        ["Понедельник", 24, 18, 8, 31, 4],
        ["Вторник", 32, 17, 19, 46, 9],
        ["Среда", 27, 23, 15, 39, 6],
        ["Четверг", 21, 25, 9, 29, 3],
        ["Пятница", 18, 22, 7, 27, 2],
      ],
      stats: { rows: 5, columns: 6, characters: 1 },
    };

    const result = answerDeterministically(
      jiraFixture,
      "Сколько задач выполнено?",
    );
    expect(result?.answer).toMatch(/Закрыто/);
    expect(result?.answer).toMatch(/105/);
    expect(result?.answer).not.toMatch(/Информация отсутствует|Не удалось однозначно/i);
  });

  it("maps 'исполнено' the same way as 'выполнено' for closed tasks", () => {
    const jiraFixture = {
      name: "jira-week-32.csv",
      kind: "csv" as const,
      content: "x",
      headers: ["День", "Создано", "Закрыто", "На ревью", "Cycle time, ч", "Баги"],
      rows: [
        ["Понедельник", 24, 18, 8, 31, 4],
        ["Вторник", 32, 17, 19, 46, 9],
        ["Среда", 27, 23, 15, 39, 6],
      ],
      stats: { rows: 3, columns: 6, characters: 1 },
    };

    const result = answerDeterministically(
      jiraFixture,
      "Сколько задач исполнено?",
    );
    expect(result?.answer).toMatch(/Закрыто/);
    expect(result?.answer).toMatch(/58/);
  });

  it("answers pending tasks as created minus closed", () => {
    const jiraFixture = {
      name: "jira-week-32.csv",
      kind: "csv" as const,
      content: "x",
      headers: ["День", "Создано", "Закрыто", "На ревью", "Cycle time, ч", "Баги"],
      rows: [
        ["Понедельник", 24, 18, 8, 31, 4],
        ["Вторник", 32, 17, 19, 46, 9],
        ["Среда", 27, 23, 15, 39, 6],
        ["Четверг", 21, 25, 9, 29, 3],
        ["Пятница", 18, 22, 7, 27, 2],
      ],
      stats: { rows: 5, columns: 6, characters: 1 },
    };

    const pending = answerDeterministically(
      jiraFixture,
      "сколько задач не выполнено?",
    );
    expect(pending?.answer).toMatch(/Не выполнено/);
    expect(pending?.answer).toMatch(/17/);
    expect(pending?.answer).not.toMatch(/Сумма по показателю «Закрыто»/);

    const notClosed = answerDeterministically(
      jiraFixture,
      "Сколько задач не закрыто?",
    );
    expect(notClosed?.answer).toMatch(/17/);
    expect(notClosed?.answer).not.toMatch(/Сумма по показателю «Закрыто» — 105/);
  });

  it("ranks popular cars by brand, not by status", () => {
    const carsFixture = {
      name: "cars.csv",
      kind: "csv" as const,
      content: "x",
      headers: ["Дата", "Марка", "Модель", "Статус", "Цена", "Пробег", "Год", "Город"],
      rows: [
        ["2026-01-01", "Toyota", "Camry", "Продан", 1_200_000, 40_000, 2018, "Москва"],
        ["2026-01-02", "Toyota", "RAV4", "Продан", 1_500_000, 30_000, 2019, "Москва"],
        ["2026-01-03", "BMW", "X5", "Продан", 3_000_000, 20_000, 2020, "СПб"],
        ["2026-01-04", "Toyota", "Camry", "В наличии", 1_100_000, 50_000, 2017, "Казань"],
        ["2026-01-05", "Audi", "A6", "Возврат", 2_200_000, 60_000, 2016, "Москва"],
        ["2026-01-06", "BMW", "X3", "Продан", 2_500_000, 25_000, 2021, "Москва"],
      ],
      stats: { rows: 6, columns: 8, characters: 1 },
    };

    const most = answerDeterministically(
      carsFixture,
      "Какая машина самая популярная?",
    );
    expect(most?.answer).toMatch(/Марка|Модель/);
    expect(most?.answer).toMatch(/Toyota/);
    expect(most?.answer).not.toMatch(/Статус|Продан/);

    const least = answerDeterministically(
      carsFixture,
      "Какая машина самая не популярная?",
    );
    expect(least?.answer).toMatch(/Марка|Модель/);
    expect(least?.answer).toMatch(/Audi/);
    expect(least?.answer).not.toMatch(/Статус|Возврат|Самый популярный/i);
  });
});
