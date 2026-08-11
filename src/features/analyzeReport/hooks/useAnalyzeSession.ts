"use client";

import { useState } from "react";

import type { DashboardAnalysis } from "@/entities/analysis";
import type { DataSource } from "@/entities/report";

import { analyzeReport } from "../api/analyzeReport";
import type { AppStatus } from "../model/types";

export function useAnalyzeSession() {
  const [status, setStatus] = useState<AppStatus>("idle");
  const [source, setSource] = useState<DataSource | null>(null);
  const [analysis, setAnalysis] = useState<DashboardAnalysis | null>(null);
  const [error, setError] = useState("");

  const analyze = async (nextSource: DataSource) => {
    setSource(nextSource);
    setAnalysis(null);
    setError("");
    setStatus("loading");

    try {
      const nextAnalysis = await analyzeReport(nextSource);
      setAnalysis(nextAnalysis);
      setStatus("ready");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Попробуйте ещё раз через несколько секунд.",
      );
      setStatus("error");
    }
  };

  const reset = () => {
    setStatus("idle");
    setSource(null);
    setAnalysis(null);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return {
    status,
    source,
    analysis,
    error,
    analyze,
    reset,
  };
}
