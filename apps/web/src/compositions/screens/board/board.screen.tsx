import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useMatch, useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Button, Drawer, Group, Kbd, Modal, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useDebouncedValue } from "@mantine/hooks";
import { Plus } from "lucide-react";
import { useGetProject, useProjectBasePath, useProjectId } from "domains/project";
import { BOARD_FILTERS_SCHEMA, useGetBoard, useTaskConnection } from "domains/tasks";
import { PROJECT_INPUT_SCHEMAS, saveProjectRecord, useLifecycle } from "domains/lifecycle";
import type { BoardFilters } from "domains/tasks";
import { readStored, writeStored } from "infra/browser-storage";
import { StatePanel } from "ui/state-panel";
import { MarkdownLinkProvider } from "ui/markdown-link";
import { isDefined } from "shared/value-predicates";
import { BoardToolbar } from "compositions/screens/board/ui/board-toolbar";
import { GroupNavigation } from "compositions/screens/board/ui/group-navigation";
import { Kanban } from "compositions/screens/board/ui/kanban";
import {
  readBoardFilters,
  readBoardOrigin,
  readTaskId,
  writeBoardFilters,
} from "./helpers/board-location";
import { TaskLink } from "./ui/task-link/task-link";
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
  const projectPath = `${useProjectBasePath()}/`;
  const scopeId = useProjectId();
  const boardPath = `${projectPath}board`;
  const project = useGetProject();
  const lifecycle = useLifecycle();
  const connection = useTaskConnection();
  const location = useLocation();
  const navigate = useNavigate();
  const match = useMatch("/projects/:project/tasks/:id");
  const [params, setParams] = useSearchParams();
  const filters = readBoardFilters(params);
  const selectedGroup = filters.ungrouped ? null : filters.group || undefined;
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
  const isUnknownRoute = location.pathname !== boardPath && selectedId === null;
  const hasFilters = Object.values(filters).some(Boolean);
  const isEmptyProject = !board.isValidating && board.data?.total === 0 && !hasFilters;
  const hasNoResults = !board.isValidating && board.data?.total === 0 && hasFilters;
  const cameFromBoard = readBoardOrigin(location.state);
  const hasStorageError = connection.data?.state === "storage-error";
  const isDisconnected = connection.data?.state === "disconnected";
  const shouldCreate = params.get("new") === "1";
  const creationParent = lifecycle.data?.tasks.find((task) => task.id === creation?.parentId);
  const creationStageId =
    creation !== null && creation.parentId !== null
      ? (creationParent?.stageId ?? "")
      : filters.stageId;
  const selectedStage = lifecycle.data?.records.find((record) => record.id === creationStageId);
  const creationContextLabel = selectedStage?.fields.title;

  useEffect(() => {
    if (projectId === undefined) return;
    const storageKey = `tasks:filters:${projectId}`;
    if (restoredProject.current === projectId || search !== "") {
      restoredProject.current = projectId;
      writeStored(storageKey, readBoardFilters(new URLSearchParams(search)));
      return;
    }
    restoredProject.current = projectId;
    const stored = BOARD_FILTERS_SCHEMA.safeParse(readStored(storageKey));
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
  useEffect(() => {
    if (!shouldCreate || projectDefault === undefined) return;
    handleCreate();
    const next = new URLSearchParams(search);
    next.delete("new");
    setParams(next, { replace: true });
  }, [shouldCreate, projectDefault, handleCreate, search, setParams]);

  /**
   * Переходит к задаче, сохраняя фильтры и одну точку возврата к доске.
   */
  const handleOpen = (id: number): void => {
    navigate(`${projectPath}tasks/${id}${search}`, {
      replace: selectedId !== null,
      state: { fromBoard: location.pathname === boardPath || cameFromBoard },
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
    navigate(`${boardPath}${search}`, { replace: true });
  };

  /**
   * Записывает общую выборку в URL и предпочтения конкретного проекта.
   */
  const handleFilters = (next: BoardFilters, shouldReplace = true): void => {
    setParams(writeBoardFilters(next), { replace: shouldReplace, state: location.state });
  };

  /**
   * Сохраняет переходы между группами в истории, оставляя остальные условия выборки.
   */
  const handleGroup = (group: string | null | undefined): void => {
    if (group === selectedGroup) return;
    handleFilters({ ...filters, group: group ?? "", ungrouped: group === null }, false);
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
    <MarkdownLinkProvider component={TaskLink}>
      <div className={styles.root}>
        <section className={styles.main}>
          <div className={styles.intro}>
            <div>
              <span className={styles.eyebrow}>ПРОЕКТ / ИСПОЛНЕНИЕ</span>
              <h1 className={styles.title}>Доска задач</h1>
              <p className={styles.subtitle}>
                От плана к результату — работа человека и агентов в одном потоке.
              </p>
            </div>
            <Button
              visibleFrom="sm"
              leftSection={<Plus size={14} />}
              onClick={() => handleCreate()}
            >
              Создать задачу
            </Button>
          </div>
          <GroupNavigation
            groups={board.data?.groupCounts}
            selectedGroup={selectedGroup}
            onSelect={handleGroup}
          />
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
                onClick={() =>
                  handleFilters(
                    BOARD_FILTERS_SCHEMA.parse({
                      group: filters.group,
                      ungrouped: filters.ungrouped,
                    }),
                  )
                }
              >
                Сбросить фильтры
              </Button>
            </div>
          )}
          <Kanban
            key={project.data.id}
            project={project.data}
            filters={appliedFilters}
            selectedId={selectedId}
            onOpen={handleOpen}
            onCreate={handleCreate}
          />
        </section>
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
              contextLabel={creationContextLabel}
              contextId={creationStageId}
              {...creation}
              onClose={() => setCreation(null)}
              onCreated={(id) => {
                setCreation(null);
                handleOpen(id);
                if (
                  creation?.parentId === null &&
                  (filters.stageId !== "" || filters.type !== "")
                ) {
                  const fields = PROJECT_INPUT_SCHEMAS.task.parse({
                    kind: "task",
                    taskId: id,
                    stageId: filters.stageId || null,
                    type: filters.type || "task",
                  });
                  void saveProjectRecord(scopeId, fields, undefined, crypto.randomUUID())
                    .then(() => lifecycle.mutate())
                    .catch((error: unknown) =>
                      notifications.show({
                        color: "orange",
                        title: `Задача #${id} создана`,
                        message:
                          error instanceof Error
                            ? `Связь с планом не сохранена: ${error.message}`
                            : "Откройте вкладку «Проект» и свяжите задачу с этапом.",
                      }),
                    );
                }
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
    </MarkdownLinkProvider>
  );
};
