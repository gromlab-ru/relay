import { z } from "zod";

const ERROR_SCHEMA = z.object({ code: z.string(), message: z.string() });
const CONNECTED_SCHEMA = z.object({ projectId: z.string() });
const CHANGED_SCHEMA = z.object({
  source: z.enum(["api", "storage"]),
  taskIds: z.array(z.number()).optional(),
  version: z.string().optional(),
});

/** Последнее транспортное состояние соединения. */
export type WorkspaceSignal = {
  /** Состояние транспорта либо отказа хранилища. */
  state: "connected" | "reconnecting" | "storage-error";
  /** Счётчик уведомлений, включая повторное подключение. */
  sequence: number;
  /** Диагностика повреждённого хранилища. */
  message?: string;
};

const listeners = new Set<(signal: WorkspaceSignal) => void>();
let source: EventSource | undefined;
let signal: WorkspaceSignal = { state: "reconnecting", sequence: 0 };

/**
 * Публикует последнее состояние всем подписчикам единственного транспорта.
 */
const emit = (state: WorkspaceSignal["state"], message?: string): void => {
  signal = { state, sequence: signal.sequence + 1, message };
  for (const listener of listeners) listener(signal);
};

/**
 * Подключает один собственный EventSource до освобождения последнего потребителя.
 */
export const subscribeWorkspace = (onSignal: (value: WorkspaceSignal) => void): (() => void) => {
  listeners.add(onSignal);
  if (source === undefined) {
    source = new EventSource("/api/v1/events");
    source.addEventListener("connected", (event: MessageEvent<string>) => {
      try {
        CONNECTED_SCHEMA.parse(JSON.parse(event.data));
        emit("connected");
      } catch {
        emit("storage-error", "Некорректное событие сервера");
      }
    });
    source.addEventListener("changed", (event: MessageEvent<string>) => {
      try {
        CHANGED_SCHEMA.parse(JSON.parse(event.data));
        emit("connected");
      } catch {
        emit("storage-error", "Некорректное событие сервера");
      }
    });
    source.addEventListener("workspace-error", (event: MessageEvent<string>) => {
      try {
        const error = ERROR_SCHEMA.parse(JSON.parse(event.data));
        emit("storage-error", error.message);
      } catch {
        emit("storage-error", "Проверьте конфигурацию и документы задач");
      }
    });
    source.onerror = () => emit("reconnecting");
  }
  onSignal(signal);
  return () => {
    listeners.delete(onSignal);
    if (listeners.size === 0) {
      source?.close();
      source = undefined;
      signal = { state: "reconnecting", sequence: signal.sequence + 1 };
    }
  };
};
