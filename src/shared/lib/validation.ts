import { z } from "zod";

const cellSchema = z.union([
  z.string().max(2_000),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

export const dataSourceSchema = z.object({
  name: z.string().min(1).max(150),
  kind: z.enum(["csv", "xlsx", "text", "demo"]),
  content: z.string().min(1).max(80_000),
  headers: z.array(z.string().max(120)).max(50),
  rows: z.array(z.array(cellSchema).max(50)).max(500),
  stats: z.object({
    rows: z.number().int().nonnegative().max(100_000),
    columns: z.number().int().nonnegative().max(1_000),
    characters: z.number().int().nonnegative().max(10_000_000),
  }),
});

export const chatRequestSchema = z.object({
  source: dataSourceSchema,
  question: z.string().trim().min(2).max(500),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(2_000),
      }),
    )
    .max(10)
    .default([]),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
