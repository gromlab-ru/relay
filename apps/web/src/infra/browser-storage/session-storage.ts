/**
 * Читает изолированные данные вкладки, проверку содержимого выполняет владелец.
 */
export const readSessionStored = (key: string): unknown => {
  try {
    const text = sessionStorage.getItem(key);
    return text === null ? undefined : JSON.parse(text);
  } catch {
    return undefined;
  }
};

/** Результат чтения, отличающий отсутствие черновика от повреждения. */
type SessionReadResult = {
  /** Разобранное значение; undefined при отсутствии записи. */
  value: unknown;
  /** Понятная причина отказа чтения. */
  error: string | null;
};

/**
 * Читает черновик без молчаливой подмены повреждённого JSON пустым вводом.
 */
export const readSessionValue = (key: string): SessionReadResult => {
  try {
    const raw = sessionStorage.getItem(key);
    return { value: raw === null ? undefined : JSON.parse(raw), error: null };
  } catch {
    return {
      value: undefined,
      error:
        "Не удалось восстановить черновик. Проверьте хранилище вкладки или явно отбросьте повреждённый ввод.",
    };
  }
};

/**
 * Сохраняет локальный снимок и сообщает об отказе браузерного хранилища.
 */
export const writeSessionStored = (key: string, snapshot: unknown): boolean => {
  try {
    sessionStorage.setItem(key, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
};

/**
 * Удаляет явно отменённый или успешно сохранённый черновик.
 */
export const removeSessionStored = (key: string): void => {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Недоступность хранилища не препятствует завершению локального действия.
  }
};
