"use client";

import { DatabaseZap, LockKeyhole } from "lucide-react";

function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="relative grid size-8 place-items-center overflow-hidden rounded-[10px] bg-[#17201c] text-[#d7ff64]">
        <DatabaseZap className="relative z-10 size-4" />
        <i className="absolute -right-2 -bottom-2 size-5 rounded-full bg-[#7de0ae]/50 blur-sm" />
      </span>
      <span className="text-[17px] font-semibold tracking-[-0.045em] text-[#18211d]">
        narra
      </span>
    </span>
  );
}

export function Header({ compact = false }: { compact?: boolean }) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[#17201c]/8 bg-[#f4f3ee]/78 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-10">
        <Logo />
        <div className="flex items-center gap-3">
          {!compact && (
            <span className="hidden items-center gap-1.5 text-xs text-[#747d77] sm:flex">
              <LockKeyhole className="size-3.5" />
              Данные не сохраняются
            </span>
          )}
          <span className="flex items-center gap-1.5 rounded-full border border-[#d9ddd5] bg-white/60 px-2.5 py-1.5 text-[10px] font-medium text-[#667069]">
            <i className="size-1.5 rounded-full bg-[#54a876]" />
            {compact ? "Контекст загружен" : "Готов к анализу"}
          </span>
        </div>
      </div>
    </header>
  );
}
