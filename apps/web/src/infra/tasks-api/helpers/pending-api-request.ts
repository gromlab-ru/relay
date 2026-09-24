import { z } from "zod";
import { ApiError } from "@relay/rest-sdk/http-client";

const PENDING_SCHEMA = z.object({ requestId: z.string(), fingerprint: z.string() });

/** Неподтверждённый запрос либо недоступное хранилище ключа повтора. */
export class PendingRequestError extends Error {}

/**
 * Сохраняет ключ до отправки; потеря ответа и перезагрузка не создают второй запрос.
 */
export const pendingApiRequest = async <Result>(
  project: string,
  operation: string,
  payload: unknown,
  send: (requestId: string) => Promise<Result>,
): Promise<Result> => {
  const key = `relay:pending-api:v1:${project}:${operation}`;
  const fingerprint = JSON.stringify(payload);
  let requestId: string;
  try {
    const raw = sessionStorage.getItem(key);
    const pending = raw === null ? null : PENDING_SCHEMA.parse(JSON.parse(raw));
    if (pending !== null && pending.fingerprint !== fingerprint)
      throw new PendingRequestError(
        "Предыдущее сохранение не подтверждено. Сначала повторите его с прежним вводом; новый запрос ещё не отправлен.",
      );
    requestId = pending?.requestId ?? crypto.randomUUID();
    sessionStorage.setItem(key, JSON.stringify({ requestId, fingerprint }));
  } catch (error) {
    if (error instanceof PendingRequestError) throw error;
    throw new PendingRequestError(
      "Не удалось сохранить ключ повтора в этой вкладке. Разрешите sessionStorage и повторите сохранение.",
    );
  }
  try {
    const result = await send(requestId);
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* Сервер уже подтвердил запись; квитанция остаётся безопасным повтором. */
    }
    return result;
  } catch (error) {
    if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
      try {
        sessionStorage.removeItem(key);
      } catch {
        /* Отказ операции уже известен; сохраняем его исходную диагностику. */
      }
    }
    throw error;
  }
};
