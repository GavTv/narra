"use client";

import { DatabaseZap, LockKeyhole, RotateCcw } from "lucide-react";

function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="relative grid size-8 place-items-center overflow-hidden rounded-md bg-[var(--navy)] text-[var(--accent)]">
        <DatabaseZap className="relative z-10 size-4" />
        <i className="absolute -right-2 -bottom-2 size-5 rounded-full bg-[var(--steel)]/50 blur-sm" />
      </span>
      <span className="font-display text-[18px] font-semibold tracking-[-0.04em] text-[var(--ink)]">
        narra
      </span>
    </span>
  );
}

export function Header({
  compact = false,
  onReset,
}: {
  compact?: boolean;
  onReset?: () => void;
}) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--navy)]/10 bg-[rgb(232_238_244_/0.82)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
        <Logo />
        <div className="flex items-center gap-2 sm:gap-4">
          {!compact && (
            <span className="hidden items-center gap-1.5 text-xs text-[var(--muted)] md:flex">
              <LockKeyhole className="size-3.5" />
              Данные не сохраняются
            </span>
          )}
          {onReset ? (
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-1.5 text-xs font-semibold text-[var(--navy)] underline decoration-[var(--accent)] decoration-2 underline-offset-4 transition hover:text-[var(--accent)]"
            >
              <RotateCcw className="size-3.5" />
              Другой отчёт
            </button>
          ) : (
            <span className="text-[10px] font-medium tracking-[0.08em] text-[var(--muted)] uppercase">
              {compact ? "Контекст загружен" : "Готов к анализу"}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
