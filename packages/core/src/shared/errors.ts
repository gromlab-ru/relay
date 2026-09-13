/** Ошибки предметной области имеют стабильный код, пригодный для обработки агентом. */
export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly exitCode = 2,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function isErrno(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

export function asAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (isErrno(error, "ENOENT"))
    return new AppError("NOT_FOUND", "Указанный файл или каталог не найден", 3);
  if (isErrno(error, "ELOCKED")) {
    return new AppError("STORAGE_BUSY", "Хранилище занято другим процессом; повторите команду", 4);
  }
  return new AppError(
    "IO_ERROR",
    error instanceof Error ? error.message : "Неизвестная ошибка выполнения",
    5,
  );
}

export function invariant(
  condition: unknown,
  code: string,
  message: string,
  exitCode = 2,
  details?: unknown,
): asserts condition {
  if (!condition) throw new AppError(code, message, exitCode, details);
}
