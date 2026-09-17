import { useState } from "react";
import {
  ActionIcon,
  Alert,
  Button,
  Drawer,
  Group,
  Menu,
  Modal,
  Select,
  Tabs,
  Text,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  Check,
  ChevronDown,
  CircleAlert,
  Copy,
  GitBranch,
  MessageSquare,
  MoreHorizontal,
  NotebookPen,
  UserRoundCheck,
} from "lucide-react";
import {
  claimTask,
  releaseTask,
  toTaskError,
  updateTask,
  useGetTask,
  useTaskActions,
} from "domains/tasks";
import { copyText } from "infra/clipboard";
import { formatDateTime } from "infra/date-time";
import { StatePanel } from "ui/state-panel";
import { isDefined, isNonEmptyArray } from "shared/value-predicates";
import { TaskEditor } from "compositions/screens/board/ui/task-panel/ui/task-editor";
import { TaskRelations } from "compositions/screens/board/ui/task-panel/ui/task-relations";
import { TaskHistory } from "compositions/screens/board/ui/task-panel/ui/task-history";
import { TaskLifecycle } from "compositions/widgets/task-lifecycle";
import type { TaskPanelProps } from "./types/task-panel-props.type";
import styles from "./styles/task-panel.module.css";

/**
 * Собирает чтение, редактирование, связи и историю в адресуемой панели задачи.
 *
 * Используется для:
 *  - работы с карточкой без потери контекста доски
 *  - назначения, завершения и переходов по связям
 */
export const TaskPanel = (props: TaskPanelProps) => {
  const { taskId, project, onClose, onOpen, onCreateChild } = props;
  const detail = useGetTask(taskId);
  const [isEditing, setEditing] = useState(false);
  const [canPersist, setCanPersist] = useState(true);
  const [isActing, setActing] = useState(false);
  const [isReleaseConfirm, setReleaseConfirm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { refresh } = useTaskActions();

  /**
   * Выполняет ревизионное действие и обновляет связанные проекции.
   */
  const handleAction = async (action: () => Promise<unknown>): Promise<void> => {
    setActing(true);
    setActionError(null);
    try {
      await action();
      await refresh();
    } catch (error) {
      setActionError(toTaskError(error).message);
      await refresh();
    } finally {
      setActing(false);
    }
  };

  /**
   * Возвращает к доске, сохраняя введённый редактором локальный черновик.
   */
  const handleClose = (): void => {
    if (isEditing && !canPersist) {
      setActionError(
        "Браузер не сохранил черновик. Сохраните или явно отмените правки перед закрытием.",
      );
      return;
    }
    if (isEditing)
      notifications.show({
        message: "Черновик сохранён. Продолжите при следующем открытии задачи.",
        closeButtonProps: { "aria-label": "Закрыть уведомление" },
        color: "gray",
      });
    onClose();
  };

  /**
   * Копирует прямой адрес карточки.
   */
  const handleCopy = async (): Promise<void> => {
    try {
      await copyText(
        `${window.location.origin}/projects/${encodeURIComponent(project.id)}/tasks/${taskId}`,
      );
      notifications.show({ message: "Ссылка скопирована", color: "green" });
    } catch {
      setActionError(
        `Ссылка на задачу: ${window.location.origin}/projects/${encodeURIComponent(project.id)}/tasks/${taskId}`,
      );
    }
  };

  const title = `Задача #${taskId}`;
  const drawerSize = "min(100vw, var(--tasks-panel-width))";
  const queryError = detail.error;
  if (detail.data === undefined) {
    const stateTitle = queryError ? "Задача недоступна" : "Открываем задачу";
    const description = queryError?.message ?? "Загружаем содержание и актуальные связи.";
    return (
      <Drawer
        opened
        position="right"
        size={drawerSize}
        title={title}
        onClose={onClose}
        closeButtonProps={{ "aria-label": "Закрыть задачу" }}
      >
        <StatePanel
          title={stateTitle}
          description={description}
          isLoading={detail.isLoading}
          action={
            <Button variant="light" onClick={() => void detail.mutate()}>
              Повторить
            </Button>
          }
        />
      </Drawer>
    );
  }
  const task = detail.data.task;
  const isDisabled = isActing || isEditing;
  const canClaim = detail.data.isReady && task.assignee === null;
  const hasAssignee = task.assignee !== null;
  const isBlocked = isNonEmptyArray(detail.data.blockedBy);
  const statuses = project.statuses.map((status) => ({ value: status.id, label: status.label }));
  const completions = project.statuses.filter((status) => status.isSuccessful && status.isTerminal);
  const endings = project.statuses.filter((status) => status.isTerminal && !status.isSuccessful);
  const currentStatus = project.statuses.find((status) => status.id === task.status);
  const canComplete = !currentStatus?.isTerminal && isNonEmptyArray(completions);
  const reopenStatus =
    project.statuses.find((status) => status.id === project.defaultStatus && !status.isTerminal) ??
    project.statuses.find((status) => !status.isTerminal);
  const canReopen = (currentStatus?.isTerminal ?? false) && reopenStatus !== undefined;
  const createdLabel = formatDateTime(task.createdAt);
  const updatedLabel = formatDateTime(task.updatedAt);
  return (
    <>
      <Drawer
        opened
        position="right"
        size={drawerSize}
        title={title}
        onClose={handleClose}
        closeButtonProps={{ "aria-label": "Закрыть задачу" }}
        overlayProps={{ backgroundOpacity: 0.16 }}
        classNames={{ content: styles.root, body: styles.body, header: styles.header }}
      >
        <div className={styles.controls}>
          <Select
            aria-label="Статус задачи"
            value={task.status}
            data={statuses}
            onChange={(status) => {
              if (status !== null && status !== task.status)
                void handleAction(() => updateTask(project.id, task.id, { status }, task.revision));
            }}
            disabled={isDisabled}
            allowDeselect={false}
            className={styles.status}
            size="xs"
          />
          {canClaim && (
            <Button
              size="xs"
              variant="light"
              leftSection={<UserRoundCheck size={13} />}
              disabled={isDisabled}
              onClick={() => void handleAction(() => claimTask(project.id, task.id, task.revision))}
            >
              Взять себе
            </Button>
          )}
          {canComplete && (
            <Menu position="bottom-end">
              <Menu.Target>
                <Button
                  size="xs"
                  variant="light"
                  color="green"
                  className={styles.complete}
                  leftSection={<Check size={13} />}
                  rightSection={<ChevronDown size={12} />}
                  disabled={isDisabled}
                >
                  Завершить
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                {completions.map((status) => (
                  <Menu.Item
                    key={status.id}
                    onClick={() =>
                      void handleAction(() =>
                        updateTask(project.id, task.id, { status: status.id }, task.revision),
                      )
                    }
                  >
                    {status.label}
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
          )}
          <Tooltip label="Скопировать ссылку">
            <ActionIcon aria-label="Скопировать ссылку" onClick={handleCopy}>
              <Copy size={15} />
            </ActionIcon>
          </Tooltip>
          <Menu position="bottom-end">
            <Menu.Target>
              <ActionIcon aria-label="Действия с задачей" disabled={isDisabled}>
                <MoreHorizontal size={17} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<GitBranch size={14} />}
                onClick={() => onCreateChild(task.id)}
              >
                Создать подзадачу
              </Menu.Item>
              {hasAssignee && (
                <Menu.Item
                  onClick={() => {
                    if (task.assignee !== project.actor) {
                      setReleaseConfirm(true);
                      return;
                    }
                    void handleAction(() => releaseTask(project.id, task.id, task.revision));
                  }}
                >
                  Освободить задачу
                </Menu.Item>
              )}
              {canReopen && (
                <Menu.Item
                  onClick={() => {
                    if (reopenStatus)
                      void handleAction(() =>
                        updateTask(project.id, task.id, { status: reopenStatus.id }, task.revision),
                      );
                  }}
                >
                  Переоткрыть → {reopenStatus?.label}
                </Menu.Item>
              )}
              {endings.map((status) => (
                <Menu.Item
                  key={status.id}
                  color="red"
                  onClick={() =>
                    void handleAction(() =>
                      updateTask(project.id, task.id, { status: status.id }, task.revision),
                    )
                  }
                >
                  Отменить → {status.label}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        </div>
        {isDefined(actionError) && (
          <Alert
            color="red"
            mb="md"
            role="alert"
            withCloseButton
            onClose={() => setActionError(null)}
          >
            {actionError}
          </Alert>
        )}
        {isBlocked && (
          <Alert
            color="orange"
            mb="lg"
            icon={<CircleAlert size={16} />}
            title="Есть незавершённые зависимости"
          >
            <Group gap={4}>
              {detail.data.dependencies
                .filter((dependency) => detail.data?.blockedBy.includes(dependency.id))
                .map((dependency) => (
                  <Button
                    key={dependency.id}
                    variant="subtle"
                    color="orange"
                    size="xs"
                    onClick={() => onOpen(dependency.id)}
                  >
                    #{dependency.id} · {dependency.title}
                  </Button>
                ))}
            </Group>
          </Alert>
        )}
        <Tabs defaultValue="details" keepMounted={false}>
          <Tabs.List className={styles.tabs}>
            <Tabs.Tab value="details">Задача</Tabs.Tab>
            <Tabs.Tab value="project" disabled={isEditing}>
              Проект и результат
            </Tabs.Tab>
            <Tabs.Tab value="relations" leftSection={<GitBranch size={13} />} disabled={isEditing}>
              Связи
            </Tabs.Tab>
            <Tabs.Tab
              value="comments"
              leftSection={<MessageSquare size={13} />}
              disabled={isEditing}
            >
              Обсуждение · {task.commentCount}
            </Tabs.Tab>
            <Tabs.Tab value="logs" leftSection={<NotebookPen size={13} />} disabled={isEditing}>
              Отчёты · {task.logCount}
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="details">
            <TaskEditor
              detail={detail.data}
              project={project}
              onEditingChange={setEditing}
              onPersistenceChange={setCanPersist}
            />
          </Tabs.Panel>
          <Tabs.Panel value="project">
            <TaskLifecycle taskId={task.id} />
          </Tabs.Panel>
          <Tabs.Panel value="relations">
            <TaskRelations
              detail={detail.data}
              project={project}
              onOpen={onOpen}
              onCreateChild={() => onCreateChild(task.id)}
            />
          </Tabs.Panel>
          <Tabs.Panel value="comments">
            <TaskHistory projectId={project.id} taskId={task.id} kind="comments" />
          </Tabs.Panel>
          <Tabs.Panel value="logs">
            <TaskHistory projectId={project.id} taskId={task.id} kind="logs" />
          </Tabs.Panel>
        </Tabs>
        <footer className={styles.metadata}>
          <span>
            Создана {createdLabel} · {task.createdBy}
          </span>
          <span>
            Обновлена {updatedLabel} · {task.updatedBy}
          </span>
          <span>Ревизия {task.revision}</span>
        </footer>
      </Drawer>
      <Modal
        opened={isReleaseConfirm}
        onClose={() => setReleaseConfirm(false)}
        title="Освободить задачу?"
        size="sm"
      >
        <Text size="sm" mb="lg">
          Сейчас исполнитель — {task.assignee}. Подтвердите снятие назначения.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setReleaseConfirm(false)}>
            Назад
          </Button>
          <Button
            onClick={() => {
              setReleaseConfirm(false);
              void handleAction(() => releaseTask(project.id, task.id, task.revision, true));
            }}
          >
            Освободить
          </Button>
        </Group>
      </Modal>
    </>
  );
};
