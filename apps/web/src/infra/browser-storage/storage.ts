/**
 * Читает недоверенные локальные данные, включая восстановление после повреждения JSON.
 */
export const readStored = (key: string): unknown => {
  try {
    const text = localStorage.getItem(key);
    return text === null ? undefined : JSON.parse(text);
  } catch {
    return undefined;
  }
};

/**
 * Сохраняет снимок; сообщает отказ браузерного хранилища вызывающему владельцу.
 */
export const writeStored = (key: string, value: unknown): boolean => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

/**
 * Удаляет подтверждённый либо явно отменённый черновик.
 */
export const removeStored = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch {
    // Недоступность persistence не препятствует работе с сервером.
  }
};

let sessionId: string | undefined;

/**
 * Разделяет черновики вкладок, сохраняя идентичность вкладки при перезагрузке.
 */
export const getBrowserSessionId = (): string => {
  if (sessionId !== undefined) return sessionId;
  try {
    const stored = sessionStorage.getItem("tasks:editor-session");
    if (stored !== null && /^[a-z0-9-]{1,80}$/i.test(stored)) {
      sessionId = stored;
      return stored;
    }
    sessionId = crypto.randomUUID();
    sessionStorage.setItem("tasks:editor-session", sessionId);
    return sessionId;
  } catch {
    sessionId = "storage-unavailable";
    return sessionId;
  }
};
