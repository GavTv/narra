export type AppError = {
  status: 400 | 500;
  message: string;
};

export type AppResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AppError };

export function ok<T>(data: T): AppResult<T> {
  return { ok: true, data };
}

export function fail(status: AppError["status"], message: string): AppResult<never> {
  return { ok: false, error: { status, message } };
}
