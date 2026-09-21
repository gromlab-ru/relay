import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useProjectBasePath } from "domains/project";
import {
  Alert,
  Badge,
  Button,
  Group,
  Menu,
  UnstyledButton,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { Pencil, Link2, ChevronDown, Check, Columns3, Circle } from "lucide-react";
import { useForm } from "@mantine/form";
import { useHotkeys } from "@mantine/hooks";
import { useBoards } from "domains/boards";
import {
  BoardTaskError,
  TASK_COLUMNS,
  COLUMN_SCHEMA,
  updateBoardTask,
  moveBoardTask,
  useBoardTaskRefresh,
} from "domains/board-tasks";
import { readSessionStored, writeSessionStored, removeSessionStored } from "infra/browser-storage";
import { MarkdownField } from "ui/markdown-field";
import { MarkdownView } from "ui/markdown-view";
import { TaskRelations } from "./ui/task-relations";
import { TaskContext } from "./ui/task-context";
import { TASK_DRAFT_SCHEMA } from "./config/editor.schema";
import type { TaskEditorProps } from "./types/task-editor-props.type";
import styles from "./styles/task-editor.module.css";

/**
 * Редактирует заголовок и Markdown с устойчивым черновиком.
 *
 * Используется для:
 *  - сохранения с исходной ревизией и явного разрешения конфликта
 *  - перемещения задачи и работы с междосочными связями
 */
export const TaskEditor = (props: TaskEditorProps) => {
  const { projectId, task, startEditing, onOpen } = props;
  const projectBase = useProjectBasePath();
  const draftKey = `relay:kanban:${projectId}:${task.id}`;
  const [draft] = useState(() => TASK_DRAFT_SCHEMA.safeParse(readSessionStored(draftKey)));
  const [isEditing, setEditing] = useState(startEditing || draft.success);
  const [isPlacementSaving, setPlacementSaving] = useState(false);
  const [placementError, setPlacementError] = useState("");
  const placementRequest = useRef<{ fingerprint: string; id: string } | null>(null);
  const [baseRevision, setBaseRevision] = useState(
    draft.success ? draft.data.revision : (task?.revision ?? 0),
  );
  const [error, setError] = useState("");
  const [defect, setDefect] = useState<unknown>();
  const [canPersist, setCanPersist] = useState(true);
  const [notice, setNotice] = useState("");
  const requestRef = useRef(draft.success ? draft.data.request : undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const refresh = useBoardTaskRefresh(projectId);
  const boards = useBoards(projectId);
  const initial = { title: task?.title ?? "", description: task?.description ?? "" };
  const form = useForm({
    mode: "uncontrolled",
    validateInputOnBlur: true,
    initialValues: draft.success ? draft.data.values : initial,
    validate: {
      title: (value) => (/[\r\n]/.test(value) ? "Заголовок должен быть однострочным" : null),
    },
    onValuesChange: (values) => {
      setCanPersist(
        writeSessionStored(draftKey, {
          values,
          revision: baseRevision,
          request: requestRef.current,
        }),
      );
      setError("");
      setNotice("");
    },
  });
  const boardItems =
    boards.data?.flatMap((page) =>
      page.items.map((board) => ({ value: board.slug, label: board.name })),
    ) ?? [];
  if (!boardItems.some((board) => board.value === task.boardSlug))
    boardItems.unshift({ value: task.boardSlug, label: task.boardSlug });
  const hasMoreBoards = boards.data?.at(-1)?.nextOffset !== null && boards.data !== undefined;
  const hasError = error !== "";
  const hasNotice = notice !== "";
  const hasNewerRevision = isEditing && task.revision > baseRevision;
  const title = task.title || "Без названия";
  const isBusy = form.submitting || isPlacementSaving;
  const hasPlacementError = placementError !== "";
  const statusData = TASK_COLUMNS.find((entry) => entry.value === task.column);
  const boardLabel =
    boardItems.find((entry) => entry.value === task.boardSlug)?.label ?? task.boardSlug;
  const statusMenuItems = TASK_COLUMNS.map((entry) => ({
    ...entry,
    isSelected: entry.value === task.column,
  }));
  const boardMenuItems = boardItems.map((entry) => ({
    ...entry,
    isSelected: entry.value === task.boardSlug,
  }));
  useHotkeys(
    [
      [
        "mod+Enter",
        () => {
          if (isEditing && !isBusy && formRef.current?.contains(document.activeElement))
            formRef.current?.requestSubmit();
        },
      ],
    ],
    [],
  );
  const handleFailure = (failure: unknown): void => {
    if (failure instanceof BoardTaskError) setError(failure.message);
    else setDefect(failure);
  };
  // Своя правка связей/положения не меняет Markdown и не создаёт ложного конфликта формы.
  const handleOwnRevision = (revision: number): void => {
    if (baseRevision !== task.revision) return;
    setBaseRevision(revision);
    requestRef.current = undefined;
    if (form.isDirty())
      setCanPersist(writeSessionStored(draftKey, { values: form.getValues(), revision }));
  };
  const handleSubmit = async (values: typeof initial): Promise<void> => {
    setError("");
    const fingerprint = JSON.stringify([values, baseRevision, task.id]);
    if (requestRef.current?.fingerprint !== fingerprint)
      requestRef.current = { fingerprint, id: crypto.randomUUID() };
    const requestId = requestRef.current.id;
    setCanPersist(
      writeSessionStored(draftKey, { values, revision: baseRevision, request: requestRef.current }),
    );
    try {
      const saved = await updateBoardTask(projectId, task.id, {
        ...values,
        ifRevision: baseRevision,
        requestId,
      });
      removeSessionStored(draftKey);
      requestRef.current = undefined;
      setBaseRevision(saved.revision);
      form.resetDirty(values);
      setNotice("Изменения сохранены");
      await refresh();
      setEditing(false);
    } catch (failure) {
      handleFailure(failure);
    }
  };
  const handleMove = async (board: string, column: string): Promise<void> => {
    if (isBusy || (board === task.boardSlug && column === task.column)) return;
    setPlacementError("");
    setPlacementSaving(true);
    const fingerprint = JSON.stringify([board, column, task.revision]);
    if (placementRequest.current?.fingerprint !== fingerprint)
      placementRequest.current = { fingerprint, id: crypto.randomUUID() };
    try {
      const saved = await moveBoardTask(projectId, task.id, {
        board,
        column: COLUMN_SCHEMA.parse(column),
        ifRevision: task.revision,
        requestId: placementRequest.current.id,
      });
      handleOwnRevision(saved.revision);
      setNotice(`Задача перемещена: ${saved.key}`);
      await refresh();
    } catch (failure) {
      if (failure instanceof BoardTaskError) setPlacementError(failure.message);
      else setDefect(failure);
    } finally {
      setPlacementSaving(false);
    }
  };
  const handleUseCurrent = (): void => {
    form.setValues(initial);
    form.resetDirty(initial);
    setBaseRevision(task?.revision ?? 0);
    requestRef.current = undefined;
    removeSessionStored(draftKey);
    setError("");
  };
  const handleRebase = (): void => {
    setBaseRevision(task?.revision ?? 0);
    requestRef.current = undefined;
    setCanPersist(
      writeSessionStored(draftKey, { values: form.getValues(), revision: task?.revision ?? 0 }),
    );
    setError("");
  };
  const handleEdit = (): void => {
    handleUseCurrent();
    setEditing(true);
  };
  const handleCancelEdit = (): void => {
    handleUseCurrent();
    setEditing(false);
  };
  const handleCopyLink = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/projects/${encodeURIComponent(projectId)}/boards/${encodeURIComponent(task.boardSlug)}/${task.id}`,
      );
      setNotice("Ссылка скопирована");
    } catch {
      setError("Не удалось скопировать ссылку. Адрес задачи доступен в адресной строке.");
    }
  };
  if (defect !== undefined) throw defect;
  return (
    <div className={styles.workspace}>
      <div className={styles.heading}>
        <Group justify="space-between" wrap="nowrap">
          <Title order={2} className={styles.taskTitle}>
            {title}
          </Title>
          <Button
            variant="subtle"
            color="gray"
            size="xs"
            aria-label="Копировать ссылку"
            onClick={() => void handleCopyLink()}
          >
            <Link2 size={16} />
          </Button>
        </Group>
        <Group gap="xs" mt="sm">
          {task.blocked && (
            <Badge color="red" variant="light">
              Есть блокеры
            </Badge>
          )}
          {isEditing && (
            <Text size="xs" c="dimmed">
              Редактирование · черновик в этой вкладке
            </Text>
          )}
        </Group>
      </div>
      <div className={styles.panel}>
        <Stack gap="lg">
          {hasNewerRevision && (
            <Alert
              color="orange"
              title="Задача изменилась после начала редактирования"
              classNames={{ title: styles.alertTitle }}
            >
              Введённый текст сохранён. Сверьте актуальное содержание перед сохранением.
              <Group mt="sm">
                <Button variant="light" onClick={handleUseCurrent}>
                  Загрузить актуальное
                </Button>
                <Button variant="default" onClick={handleRebase}>
                  Применить ввод к новой ревизии
                </Button>
              </Group>
            </Alert>
          )}
          {!canPersist && (
            <Alert color="orange">
              Браузер не смог сохранить черновик. Не закрывайте окно до сохранения задачи.
            </Alert>
          )}
          <div className={styles.root}>
            <div className={styles.content}>
              <div hidden={isEditing}>
                <Group justify="space-between" align="flex-start" wrap="nowrap" mb="lg">
                  <Text size="sm" fw={600} c="dimmed">
                    Описание задачи
                  </Text>
                  <Button
                    size="xs"
                    variant="subtle"
                    color="gray"
                    leftSection={<Pencil size={14} />}
                    onClick={handleEdit}
                    className={styles.editButton}
                  >
                    Изменить
                  </Button>
                </Group>
                <MarkdownView
                  text={task.description}
                  emptyText="Описание пока не добавлено. Нажмите «Изменить», чтобы уточнить задачу."
                />
              </div>
              <form
                hidden={!isEditing}
                ref={formRef}
                noValidate
                onSubmit={form.onSubmit(handleSubmit, (errors) => {
                  const field = Object.keys(errors)[0];
                  if (field) form.getInputNode(field)?.focus();
                })}
              >
                <fieldset disabled={isBusy} className={styles.fields}>
                  <Stack gap="md">
                    <TextInput
                      key={form.key("title")}
                      label="Заголовок задачи"
                      placeholder="Без названия"
                      data-autofocus
                      {...form.getInputProps("title")}
                    />
                    {isEditing && (
                      <MarkdownField
                        key={form.key("description")}
                        label="Описание в Markdown"
                        minRows={10}
                        disabled={isBusy}
                        {...form.getInputProps("description")}
                      />
                    )}
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">
                        Черновик сохраняется в этой вкладке
                      </Text>
                      <Group gap="xs">
                        <Button variant="subtle" color="gray" onClick={handleCancelEdit}>
                          Отменить
                        </Button>
                        <Button type="submit" loading={form.submitting}>
                          Сохранить
                        </Button>
                      </Group>
                    </Group>
                  </Stack>
                </fieldset>
              </form>
              <section className={styles.section}>
                <TaskContext projectId={projectId} task={task} onOwnRevision={handleOwnRevision} />
                <Button
                  component={Link}
                  variant="subtle"
                  to={`${projectBase}/relations?root=task:${task.id}`}
                >
                  Все связи и контекст задачи
                </Button>
              </section>
              <section className={styles.section}>
                <TaskRelations projectId={projectId} task={task} onOpen={onOpen} />
              </section>
            </div>
            <Stack gap="lg" className={styles.sidebar}>
              <Stack gap="sm">
                <div className={styles.propertyRow}>
                  <Text size="sm" c="dimmed">
                    Статус
                  </Text>
                  <Menu position="bottom-end" width={220} withinPortal>
                    <Menu.Target>
                      <UnstyledButton
                        className={styles.propertyButton}
                        disabled={isBusy}
                        aria-label={`Изменить статус: ${statusData?.label}`}
                      >
                        <Badge
                          variant="light"
                          color={statusData?.color}
                          tt="none"
                          radius="sm"
                          size="md"
                          fw={500}
                        >
                          {statusData?.label}
                        </Badge>
                        <ChevronDown size={13} className={styles.chevron} />
                      </UnstyledButton>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Label>Статус задачи</Menu.Label>
                      {statusMenuItems.map((item) => (
                        <Menu.Item
                          key={item.value}
                          onClick={() => void handleMove(task.boardSlug, item.value)}
                          leftSection={<Circle size={13} />}
                        >
                          <Group justify="space-between" wrap="nowrap">
                            <span>{item.label}</span>
                            {item.isSelected && <Check size={14} />}
                          </Group>
                        </Menu.Item>
                      ))}
                    </Menu.Dropdown>
                  </Menu>
                </div>
                <div className={styles.propertyRow}>
                  <Text size="sm" c="dimmed">
                    Доска
                  </Text>
                  <Menu position="bottom-end" width={240} withinPortal>
                    <Menu.Target>
                      <UnstyledButton
                        className={styles.propertyButton}
                        disabled={isBusy}
                        aria-label={`Изменить доску: ${boardLabel}`}
                        title={boardLabel}
                      >
                        <Columns3 size={14} className={styles.chevron} />
                        <span className={styles.propertyLabel}>{boardLabel}</span>
                        <ChevronDown size={13} className={styles.chevron} />
                      </UnstyledButton>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Label>Переместить на доску</Menu.Label>
                      {boardMenuItems.map((item) => (
                        <Menu.Item
                          key={item.value}
                          onClick={() => void handleMove(item.value, task.column)}
                        >
                          <Group justify="space-between" wrap="nowrap">
                            <span>{item.label}</span>
                            {item.isSelected && <Check size={14} />}
                          </Group>
                        </Menu.Item>
                      ))}
                      {hasMoreBoards && (
                        <Menu.Item
                          closeMenuOnClick={false}
                          onClick={() =>
                            void boards.setSize(boards.size + 1).catch(() => undefined)
                          }
                        >
                          Загрузить ещё доски
                        </Menu.Item>
                      )}
                    </Menu.Dropdown>
                  </Menu>
                </div>
                {isPlacementSaving && (
                  <Text size="xs" c="dimmed" role="status">
                    Сохраняем…
                  </Text>
                )}
                {hasPlacementError && (
                  <Text size="xs" c="red" role="alert">
                    {placementError}
                  </Text>
                )}
              </Stack>
            </Stack>
          </div>
          {hasError && (
            <Alert color="red" title="Действие не сохранено" role="alert">
              {error}
            </Alert>
          )}
          {hasNotice && (
            <Text role="status" c="teal" size="sm">
              {notice}
            </Text>
          )}
        </Stack>
      </div>
    </div>
  );
};
