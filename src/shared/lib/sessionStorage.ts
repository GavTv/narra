const SESSION_KEY = "narra.session.v1";
const CHAT_PREFIX = "narra.chat.v1:";

let chatRuntimeEpoch = 0;

export type PersistedSession = {
  status: "ready" | "error";
  source: unknown;
  analysis: unknown | null;
  error: string;
};

/** Bumps when chat persistence is wiped so in-memory chat stores reload. */
export function getChatRuntimeEpoch() {
  return chatRuntimeEpoch;
}

function bumpChatRuntimeEpoch() {
  chatRuntimeEpoch += 1;
}

export function sourceStorageKey(source: {
  name: string;
  kind: string;
  stats: { characters: number; rows: number; columns: number };
}) {
  return `${source.kind}:${source.name}:${source.stats.rows}x${source.stats.columns}:${source.stats.characters}`;
}

export function readSession<T extends PersistedSession>(): T | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeSession(session: PersistedSession) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Quota / private mode — ignore.
  }
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(SESSION_KEY);
}

export function readChatMessages<T>(sourceKey: string): T[] | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(CHAT_PREFIX + sourceKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}

export function writeChatMessages(sourceKey: string, messages: unknown) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(
      CHAT_PREFIX + sourceKey,
      JSON.stringify(messages),
    );
  } catch {
    // ignore
  }
}

export function clearChatMessages(sourceKey?: string) {
  if (typeof window === "undefined") {
    bumpChatRuntimeEpoch();
    return;
  }

  if (sourceKey) {
    window.sessionStorage.removeItem(CHAT_PREFIX + sourceKey);
    bumpChatRuntimeEpoch();
    return;
  }

  const keysToRemove: string[] = [];
  for (let index = 0; index < window.sessionStorage.length; index += 1) {
    const key = window.sessionStorage.key(index);
    if (key?.startsWith(CHAT_PREFIX)) keysToRemove.push(key);
  }
  keysToRemove.forEach((key) => window.sessionStorage.removeItem(key));
  bumpChatRuntimeEpoch();
}
