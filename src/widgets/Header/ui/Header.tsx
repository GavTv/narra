"use client";

import { DatabaseZap, LockKeyhole } from "lucide-react";

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

export function Header({ compact = false }: { compact?: boolean }) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--navy)]/10 bg-[rgb(232_238_244_/0.82)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-10">
        <Logo />
        <div className="flex items-center gap-3">
          {!compact && (
            <span className="hidden items-center gap-1.5 text-xs text-[var(--muted)] sm:flex">
              <LockKeyhole className="size-3.5" />
              Данные не сохраняются
            </span>
          )}
          <span className="flex items-center gap-1.5 rounded-md border border-[var(--line)] bg-white/70 px-2.5 py-1.5 text-[10px] font-medium text-[var(--muted)]">
            <i className="size-1.5 rounded-sm bg-[var(--accent)]" />
            {compact ? "Контекст загружен" : "Готов к анализу"}
          </span>
        </div>
      </div>
    </header>
  );
}
