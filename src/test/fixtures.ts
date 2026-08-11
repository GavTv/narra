import type { DataSource } from "@/entities/report";

export const salesFixture: DataSource = {
  name: "sales.csv",
  kind: "csv",
  content: [
    "Дата,Товар,Выручка,Заказы",
    "2026-07-01,Куртка Urban,100000,10",
    "2026-07-02,Куртка Urban,50000,5",
    "2026-07-01,Кепка Street,90000,9",
    "2026-07-03,Рюкзак Trek,30000,3",
  ].join("\n"),
  headers: ["Дата", "Товар", "Выручка", "Заказы"],
  rows: [
    ["2026-07-01", "Куртка Urban", 100_000, 10],
    ["2026-07-02", "Куртка Urban", 50_000, 5],
    ["2026-07-01", "Кепка Street", 90_000, 9],
    ["2026-07-03", "Рюкзак Trek", 30_000, 3],
  ],
  stats: {
    rows: 4,
    columns: 4,
    characters: 180,
  },
};

export const multiMonthSalesFixture: DataSource = {
  name: "sales-months.csv",
  kind: "csv",
  content: [
    "Дата,Товар,Выручка,Заказы",
    "2026-06-10,Куртка Urban,40000,4",
    "2026-06-20,Кепка Street,20000,2",
    "2026-07-01,Куртка Urban,100000,10",
    "2026-07-15,Кепка Street,90000,9",
    "2026-08-01,Рюкзак Trek,30000,3",
  ].join("\n"),
  headers: ["Дата", "Товар", "Выручка", "Заказы"],
  rows: [
    ["2026-06-10", "Куртка Urban", 40_000, 4],
    ["2026-06-20", "Кепка Street", 20_000, 2],
    ["2026-07-01", "Куртка Urban", 100_000, 10],
    ["2026-07-15", "Кепка Street", 90_000, 9],
    ["2026-08-01", "Рюкзак Trek", 30_000, 3],
  ],
  stats: {
    rows: 5,
    columns: 4,
    characters: 220,
  },
};

export const marketingFixture: DataSource = {
  name: "marketing.csv",
  kind: "csv",
  content: [
    "Канал,Расходы,Лиды",
    "Поиск,100000,200",
    "Соцсети,70000,160",
    "Партнёры,40000,80",
  ].join("\n"),
  headers: ["Канал", "Расходы", "Лиды"],
  rows: [
    ["Поиск", 100_000, 200],
    ["Соцсети", 70_000, 160],
    ["Партнёры", 40_000, 80],
  ],
  stats: {
    rows: 3,
    columns: 3,
    characters: 100,
  },
};
