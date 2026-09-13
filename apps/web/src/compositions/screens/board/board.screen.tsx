import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useMatch, useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Button, Drawer, Group, Kbd, Modal, Stack, Text } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { Layers3, Plus } from "lucide-react";
import { z } from "zod";
import { useGetProject } from "domains/project";
import { BOARD_FILTERS_SCHEMA, useGetBoard, useTaskConnection } from "domains/tasks";
import type { BoardFilters } from "domains/tasks";
import { readStored, writeStored } from "infra/browser-storage";
import { StatePanel } from "ui/state-panel";
import { isDefined } from "shared/value-predicates";
import { BoardToolbar } from "compositions/screens/board/ui/board-toolbar";
import { Kanban } from "compositions/screens/board/ui/kanban";
import { WorkspaceHeader } from "compositions/screens/board/ui/workspace-header";
import { readBoardFilters, readTaskId, writeBoardFilters } from "./helpers/board-location";
import type { CreateContext } from "./types/create-context.type";
import styles from "./styles/board.module.css";

const TaskPanel = lazy(() =>
  import("compositions/screens/board/ui/task-panel/lazy").then(({ Component }) => ({
    default: Component,
  })),
);
const CreateTask = lazy(() =>
  import("compositions/screens/board/ui/create-task/lazy").then(({ Component }) => ({
    default: Component,
  })),
);

/**
 * Сохраняет контекст доски при поиске, создании и открытии адресуемых задач.
 *
 * Используется для:
 *  - ежедневного планирования работы и возвращения к текущей выборке
 *  - прямых ссылок и истории браузера
 */
export const BoardScreen = () => {
  const project = useGetProject();
  const connection = useTaskConnection();
  const [hasConnected, setHasConnected] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const match = useMatch("/tasks/:id");
  const [params, setParams] = useSearchParams();
  const filters = readBoardFilters(params);
  const [query] = useDebouncedValue(filters.search, 250);
  const appliedFilters = { ...filters, search: query };
  const board = useGetBoard(appliedFilters, undefined, 1);
  const [creation, setCreation] = useState<CreateContext | null>(null);
  const [isHelpOpen, setHelpOpen] = useState(false);
  const restoredProject = useRef<string | null>(null);
  const selectedId = readTaskId(match?.params.id);
  const projectId = project.data?.id;
  const projectDefault = project.data?.defaultStatus;
  const search = location.search;
  const isUnknownRoute = location.pathname !== "/" && selectedId === null;
  const hasFilters = Object.values(filters).some(Boolean);
  const isEmptyProject = board.data?.total === 0 && !hasFilters;
  const hasNoResults = board.data?.total === 0 && hasFilters;
  const routeState = z.object({ fromBoard: z.boolean() }).safeParse(location.state);
  const cameFromBoard = routeState.success && routeState.data.fromBoard;
  const hasStorageError = connection.data?.state === "storage-error";
  const isDisconnected = hasConnected && connection.data?.state === "reconnecting";
  useEffect(() => {
    if (connection.data?.state === "connected") setHasConnected(true);
  }, [connection.data?.state]);

  useEffect(() => {
    if (projectId === undefined || restoredProject.current === projectId) return;
    restoredProject.current = projectId;
    if (search !== "") return;
    const stored = BOARD_FILTERS_SCHEMA.safeParse(readStored(`tasks:filters:${projectId}`));
    if (stored.success) setParams(writeBoardFilters(stored.data), { replace: true });
  }, [projectId, search, setParams]);

  /**
   * Открывает создание с видимым статусом и выбранной группой.
   */
  const handleCreate = useCallback(
    (status?: string, parentId: number | null = null): void => {
      if (projectDefault === undefined) return;
      setCreation({ status: status ?? projectDefault, group: filters.group || null, parentId });
    },
    [projectDefault, filters.group],
  );

  /**
   * Переходит к задаче, сохраняя фильтры и одну точку возврата к доске.
   */
  const handleOpen = (id: number): void => {
    navigate(`/tasks/${id}${search}`, {
      replace: selectedId !== null,
      state: { fromBoard: location.pathname === "/" || cameFromBoard },
    });
  };

  /**
   * Возвращается в историю доски либо на её адрес при прямом открытии карточки.
   */
  const handleClose = (): void => {
    if (cameFromBoard) {
      navigate(-1);
      return;
    }
    navigate(`/${search}`, { replace: true });
  };

  /**
   * Записывает общую выборку в URL и предпочтения конкретного проекта.
   */
  const handleFilters = (next: BoardFilters): void => {
    setParams(writeBoardFilters(next), { replace: true, state: location.state });
    if (projectId !== undefined) writeStored(`tasks:filters:${projectId}`, next);
  };

  useEffect(() => {
    /**
     * Обрабатывает команды доски только вне полей ввода и открытых панелей.
     */
    const handleKey = (event: KeyboardEvent): void => {
      const element = event.target;
      const isTyping =
        element instanceof HTMLElement &&
        (element.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName));
      if (
        isTyping ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        selectedId !== null ||
        creation !== null ||
        isHelpOpen
      )
        return;
      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        handleCreate();
      }
      if (event.key === "/") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('input[aria-label="Найти задачу"]')?.focus();
      }
      if (event.key === "?") {
        event.preventDefault();
        setHelpOpen(true);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleCreate, selectedId, creation, isHelpOpen]);

  if (project.data === undefined) {
    const title = project.error ? "Сервер недоступен" : "Открываем рабочее пространство";
    const description = project.error
      ? "Запустите tasks-cli server и повторите подключение. Локальные черновики сохранены."
      : "Загружаем проект и ваши задачи.";
    return (
      <div className={styles.root}>
        <WorkspaceHeader onCreate={() => handleCreate()} onHelp={() => setHelpOpen(true)} />
        <StatePanel
          title={title}
          description={description}
          isLoading={project.isLoading}
          action={
            <Button variant="light" onClick={() => void project.mutate()}>
              Подключиться
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <WorkspaceHeader
        project={project.data}
        onCreate={() => handleCreate()}
        onHelp={() => setHelpOpen(true)}
      />
      <main className={styles.main}>
        <div className={styles.intro}>
          <div>
            <span className={styles.eyebrow}>РАБОЧЕЕ ПРОСТРАНСТВО</span>
            <h1 className={styles.title}>Доска проекта</h1>
            <p className={styles.subtitle}>Меньше шума. Больше завершённых задач.</p>
          </div>
          <span className={styles.local}>
            <Layers3 size={14} /> На вашем устройстве
          </span>
        </div>
        <BoardToolbar
          filters={filters}
          board={board.data}
          actor={project.data.actor}
          onChange={handleFilters}
        />
        {isDisconnected && (
          <Alert mx="xl" mb="md" color="orange" title="Соединение прервано">
            Показаны последние загруженные данные. Переподключимся автоматически; введённые
            черновики остаются в браузере.
          </Alert>
        )}
        {hasStorageError && (
          <Alert mx="xl" mb="md" color="red" title="Хранилище временно недоступно">
            {connection.data?.message} После исправления данные обновятся автоматически.
          </Alert>
        )}
        {isDefined(board.error) && (
          <Alert mx="xl" mb="md" color="orange" title="Не удалось обновить доску">
            {board.error.message}
            <Button variant="subtle" size="xs" onClick={() => void board.mutate()}>
              Повторить
            </Button>
          </Alert>
        )}
        {isEmptyProject && (
          <div className={styles.onboarding}>
            <div>
              <strong>Всё начинается с первой задачи</strong>
              <p>Запишите следующий шаг — детали можно добавить позже.</p>
            </div>
            <Button size="xs" leftSection={<Plus size={13} />} onClick={() => handleCreate()}>
              Создать первую задачу
            </Button>
          </div>
        )}
        {hasNoResults && (
          <div className={styles.onboarding}>
            <span>Подходящих задач не нашлось. Попробуйте изменить условия.</span>
            <Button
              size="xs"
              variant="light"
              onClick={() => handleFilters(BOARD_FILTERS_SCHEMA.parse({}))}
            >
              Сбросить фильтры
            </Button>
          </div>
        )}
        <Kanban
          project={project.data}
          filters={appliedFilters}
          selectedId={selectedId}
          onOpen={handleOpen}
          onCreate={handleCreate}
        />
      </main>
      <footer className={styles.footer}>
        <span>Локальные данные · человек и агенты в одном потоке</span>
        <button type="button" onClick={() => setHelpOpen(true)}>
          <Kbd size="xs">N</Kbd> новая задача <Kbd size="xs">/</Kbd> поиск
        </button>
      </footer>
      {isDefined(selectedId) && (
        <Suspense
          fallback={
            <Drawer
              opened
              position="right"
              size="min(100vw, 44rem)"
              onClose={handleClose}
              title="Открываем задачу"
            >
              <StatePanel
                isLoading
                title="Загружаем редактор"
                description="Подготавливаем рабочую область."
              />
            </Drawer>
          }
        >
          <TaskPanel
            key={`${project.data.id}:${selectedId}`}
            taskId={selectedId}
            project={project.data}
            onClose={handleClose}
            onOpen={handleOpen}
            onCreateChild={(id) => handleCreate(undefined, id)}
          />
        </Suspense>
      )}
      {isDefined(creation) && (
        <Suspense
          fallback={
            <Modal opened onClose={() => setCreation(null)} title="Новая задача">
              <StatePanel
                isLoading
                title="Открываем форму"
                description="Подготавливаем создание задачи."
              />
            </Modal>
          }
        >
          <CreateTask
            project={project.data}
            {...creation}
            onClose={() => setCreation(null)}
            onCreated={(id) => {
              setCreation(null);
              handleOpen(id);
            }}
          />
        </Suspense>
      )}
      <Modal
        opened={isHelpOpen}
        onClose={() => setHelpOpen(false)}
        title="Быстрее с клавиатурой"
        size="sm"
      >
        <Stack gap="md">
          <Group justify="space-between">
            <Text size="sm">Создать задачу</Text>
            <Kbd>N</Kbd>
          </Group>
          <Group justify="space-between">
            <Text size="sm">Найти задачу</Text>
            <Kbd>/</Kbd>
          </Group>
          <Group justify="space-between">
            <Text size="sm">Сохранить правки</Text>
            <Kbd>Ctrl / ⌘ + Enter</Kbd>
          </Group>
          <Group justify="space-between">
            <Text size="sm">Закрыть панель</Text>
            <Kbd>Esc</Kbd>
          </Group>
          <Text size="sm" c="dimmed">
            Для переноса сфокусируйте ручку карточки, нажмите пробел и используйте стрелки. Пробел
            подтверждает перенос, Escape отменяет.
          </Text>
        </Stack>
      </Modal>
      <Modal
        opened={isUnknownRoute}
        onClose={() => navigate("/", { replace: true })}
        title="Страница не найдена"
      >
        <StatePanel
          title="Такого адреса нет"
          description="Откройте задачу на доске или проверьте ссылку."
          action={<Button onClick={() => navigate("/", { replace: true })}>На доску</Button>}
        />
      </Modal>
    </div>
  );
};
