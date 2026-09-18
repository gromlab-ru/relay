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
