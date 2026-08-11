export type ChartType = "bar" | "line" | "pie";

export interface ChartDatum {
  label: string;
  value: number;
  secondary?: number;
}

export interface ChartSpec {
  id: string;
  type: ChartType;
  title: string;
  subtitle: string;
  valueLabel: string;
  secondaryLabel?: string;
  insight: string;
  data: ChartDatum[];
}

export interface Metric {
  label: string;
  value: string;
  detail: string;
  tone: "positive" | "warning" | "neutral";
}

export interface DashboardAnalysis {
  eyebrow: string;
  title: string;
  summary: string;
  metrics: Metric[];
  charts: ChartSpec[];
  suggestedQuestions: string[];
  generatedBy: "ai" | "local";
}
