import { z } from "zod";

const ERROR_SCHEMA = z.object({ code: z.string(), message: z.string() });
const CONNECTED_SCHEMA = z.object({ projectId: z.string() });
const CHANGED_SCHEMA = z.object({
  source: z.enum(["api", "storage"]),
  version: z.string().optional(),
});

/** Краткий автоматический reconnect не считается длительной потерей связи. */
const DISCONNECT_DELAY = 10_000;
/** React StrictMode и Fast Refresh могут сразу вернуть последнего подписчика. */
const RELEASE_DELAY = 100;
/** Повтор после HTTP-отказа прокси, который окончательно закрывает нативный EventSource. */
const RECONNECT_DELAY = 1_000;
const MAX_RECONNECT_DELAY = 10_000;

/** Последнее транспортное состояние соединения. */
export type WorkspaceSignal = {
  /** Состояние транспорта либо отказа хранилища. */
  state: "connecting" | "connected" | "reconnecting" | "disconnected" | "storage-error";
  /** Счётчик уведомлений, включая повторное подключение. */
  sequence: number;
  /** Диагностика повреждённого хранилища. */
  message?: string;
};

const createConnection = (projectId: string, onReleased: () => void) => {
  const listeners = new Set<(signal: WorkspaceSignal) => void>();
  let source: EventSource | undefined;
  let connectTimer: ReturnType<typeof setTimeout> | undefined;
  let releaseTimer: ReturnType<typeof setTimeout> | undefined;
  let disconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let reconnectDelay = RECONNECT_DELAY;
  let signal: WorkspaceSignal = { state: "connecting", sequence: 0 };

  /**
   * Публикует последнее состояние всем подписчикам единственного транспорта.
   */
  const emit = (state: WorkspaceSignal["state"], message?: string): void => {
    if (state === "connected" || state === "storage-error") {
      reconnectDelay = RECONNECT_DELAY;
      clearTimeout(disconnectTimer);
      disconnectTimer = undefined;
    }
    signal = { state, sequence: signal.sequence + 1, message };
    for (const listener of listeners) listener(signal);
  };

  /**
   * Открывает транспорт после завершения текущего цикла эффектов React.
   */
  const connect = (): void => {
    connectTimer = undefined;
    if (listeners.size === 0 || source !== undefined) return;
    const connection = new EventSource(`/api/v1/projects/${encodeURIComponent(projectId)}/events`);
    source = connection;
    disconnectTimer ??= setTimeout(() => emit("disconnected"), DISCONNECT_DELAY);
    connection.addEventListener("connected", (event: MessageEvent<string>) => {
      if (source !== connection) return;
      try {
        CONNECTED_SCHEMA.parse(JSON.parse(event.data));
        emit("connected");
      } catch {
        emit("storage-error", "Некорректное событие сервера");
      }
    });
    connection.addEventListener("changed", (event: MessageEvent<string>) => {
      if (source !== connection) return;
      try {
        CHANGED_SCHEMA.parse(JSON.parse(event.data));
        emit("connected");
      } catch {
        emit("storage-error", "Некорректное событие сервера");
      }
    });
    connection.addEventListener("workspace-error", (event: MessageEvent<string>) => {
      if (source !== connection) return;
      try {
        const error = ERROR_SCHEMA.parse(JSON.parse(event.data));
        emit("storage-error", error.message);
      } catch {
        emit("storage-error", "Проверьте конфигурацию и документы задач");
      }
    });
    connection.onerror = () => {
      if (source !== connection) return;
      if (signal.state !== "disconnected") {
        emit("reconnecting");
        disconnectTimer ??= setTimeout(() => emit("disconnected"), DISCONNECT_DELAY);
      }
      // После 502/503 или неподходящего Content-Type браузер сам уже не переподключается.
      if (connection.readyState === EventSource.CLOSED) {
        source = undefined;
        if (listeners.size === 0) return;
        connectTimer = setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
      }
    };
  };

  /**
   * Разделяет SSE между подписчиками и переживает короткий dev-remount без отмены запроса.
   */
  const subscribe = (onSignal: (value: WorkspaceSignal) => void): (() => void) => {
    clearTimeout(releaseTimer);
    releaseTimer = undefined;
    listeners.add(onSignal);
    if (source === undefined && connectTimer === undefined) {
      connectTimer = setTimeout(connect, 0);
    }
    onSignal(signal);
    return () => {
      listeners.delete(onSignal);
      if (listeners.size === 0) {
        clearTimeout(connectTimer);
        connectTimer = undefined;
        releaseTimer = setTimeout(() => {
          releaseTimer = undefined;
          if (listeners.size !== 0) return;
          source?.close();
          source = undefined;
          clearTimeout(disconnectTimer);
          disconnectTimer = undefined;
          reconnectDelay = RECONNECT_DELAY;
          signal = { state: "connecting", sequence: signal.sequence + 1 };
          onReleased();
        }, RELEASE_DELAY);
      }
    };
  };
  return subscribe;
};

const connections = new Map<string, ReturnType<typeof createConnection>>();

/** Разделяет транспорт только между подписчиками одного проекта. */
export const subscribeWorkspace = (
  projectId: string,
  onSignal: (value: WorkspaceSignal) => void,
): (() => void) => {
  let subscribe = connections.get(projectId);
  if (subscribe === undefined) {
    subscribe = createConnection(projectId, () => connections.delete(projectId));
    connections.set(projectId, subscribe);
  }
  return subscribe(onSignal);
};
