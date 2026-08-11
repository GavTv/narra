"use client";

import { useCallback, useSyncExternalStore } from "react";

import type { DashboardAnalysis } from "@/entities/analysis";
import type { DataSource } from "@/entities/report";
import { withReportOverview } from "@/entities/report";
import {
  clearChatMessages,
  clearSession,
  readSession,
  writeSession,
} from "@/shared/lib/sessionStorage";

import { analyzeReport } from "../api/analyzeReport";
import type { AppStatus } from "../model/types";

type SessionSnapshot = {
  status: AppStatus;
  source: DataSource | null;
  analysis: DashboardAnalysis | null;
  error: string;
  restored: boolean;
};

type StoredSession = {
  status: "ready" | "error";
  source: DataSource;
  analysis: DashboardAnalysis | null;
  error: string;
};

const idleSnapshot: SessionSnapshot = {
  status: "idle",
  source: null,
  analysis: null,
  error: "",
  restored: true,
};

const serverSnapshot: SessionSnapshot = {
  ...idleSnapshot,
  restored: false,
};

let memorySession: SessionSnapshot | null = null;
let hydrated = false;
let version = 0;
let cachedSnapshot: SessionSnapshot = serverSnapshot;
let cachedVersion = -1;
const listeners = new Set<() => void>();

function isDataSource(value: unknown): value is DataSource {
  if (!value || typeof value !== "object") return false;
  const candidate = value as DataSource;
  return (
    typeof candidate.name === "string" &&
    typeof candidate.kind === "string" &&
    typeof candidate.content === "string" &&
    Array.isArray(candidate.headers) &&
    Array.isArray(candidate.rows) &&
    Boolean(candidate.stats)
  );
}

function isAnalysis(value: unknown): value is DashboardAnalysis {
  if (!value || typeof value !== "object") return false;
  const candidate = value as DashboardAnalysis;
  return (
    typeof candidate.title === "string" &&
    typeof candidate.summary === "string" &&
    Array.isArray(candidate.metrics) &&
    Array.isArray(candidate.charts)
  );
}

function storedToSnapshot(saved: StoredSession | null): SessionSnapshot {
  if (
    !saved ||
    !isDataSource(saved.source) ||
    !(saved.status === "error" || isAnalysis(saved.analysis))
  ) {
    return idleSnapshot;
  }

  return {
    status: saved.status === "ready" && saved.analysis ? "ready" : "error",
    source: saved.source,
    analysis: isAnalysis(saved.analysis)
      ? withReportOverview(saved.source, saved.analysis)
      : null,
    error: saved.error || "",
    restored: true,
  };
}

function hydrateFromStorage() {
  if (hydrated || typeof window === "undefined") return;
  memorySession = storedToSnapshot(readSession<StoredSession>());
  hydrated = true;
  version += 1;
}

function emit(next: SessionSnapshot) {
  memorySession = next;
  hydrated = true;
  version += 1;

  if (next.status === "ready" && next.source && next.analysis) {
    writeSession({
      status: "ready",
      source: next.source,
      analysis: next.analysis,
      error: "",
    });
  } else if (next.status === "error" && next.source) {
    writeSession({
      status: "error",
      source: next.source,
      analysis: null,
      error: next.error,
    });
  } else if (next.status === "idle") {
    clearSession();
  }

  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  hydrateFromStorage();
  if (cachedVersion === version) {
    return cachedSnapshot;
  }

  cachedSnapshot = memorySession ?? idleSnapshot;
  cachedVersion = version;
  return cachedSnapshot;
}

function getServerSnapshot() {
  return serverSnapshot;
}

export function useAnalyzeSession() {
  const session = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const analyze = useCallback(async (nextSource: DataSource) => {
    clearChatMessages();
    emit({
      status: "loading",
      source: nextSource,
      analysis: null,
      error: "",
      restored: true,
    });

    try {
      const nextAnalysis = await analyzeReport(nextSource);
      emit({
        status: "ready",
        source: nextSource,
        analysis: nextAnalysis,
        error: "",
        restored: true,
      });
    } catch (caught) {
      emit({
        status: "error",
        source: nextSource,
        analysis: null,
        error:
          caught instanceof Error
            ? caught.message
            : "Попробуйте ещё раз через несколько секунд.",
        restored: true,
      });
    }
  }, []);

  const reset = useCallback(() => {
    clearSession();
    clearChatMessages();
    emit(idleSnapshot);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return {
    status: session.status,
    source: session.source,
    analysis: session.analysis,
    error: session.error,
    restored: session.restored,
    analyze,
    reset,
  };
}
