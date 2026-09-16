import { useState } from "react";
import { useBeforeUnload } from "react-router-dom";
import {
  Alert,
  Autocomplete,
  Button,
  Collapse,
  Group,
  Modal,
  Select,
  Stack,
  TagsInput,
  Text,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { ChevronDown, Plus, Save } from "lucide-react";
import {
  createTask,
  discardTaskDraft,
  emptyTaskInput,
  getDraftKey,
  readTaskDraft,
  saveTaskDraft,
  toTaskError,
  useGetBoard,
  useTaskActions,
  validateTitle,
  TaskPicker,
} from "domains/tasks";
import type { TaskInput } from "domains/tasks";
import { MarkdownField } from "ui/markdown-field";
import { isDefined } from "shared/value-predicates";
import type { CreateTaskProps } from "./types/create-task-props.type";
import styles from "./styles/create-task.module.css";

/**
 * Превращает короткую мысль в задачу с видимым контекстом создания.
 *
 * Используется для:
 *  - создания из доски, колонки и списка подзадач
 *  - восстановления незавершённого ввода
 */
export const CreateTask = (props: CreateTaskProps) => {
  const { project, status, group, parentId, onClose, onCreated, contextLabel, contextId } = props;
  const contextSuffix = contextId === undefined || contextId === "" ? "" : `:stage:${contextId}`;
  const key = getDraftKey(
    project.id,
    `new:${status}:${group ?? ""}:${parentId ?? ""}${contextSuffix}`,
  );
  const [draft, setDraft] = useState(() => readTaskDraft(key));
  const [base] = useState(() => emptyTaskInput(status, group, parentId));
  const [isExpanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canPersist, setCanPersist] = useState(true);
  const board = useGetBoard({}, undefined, 1);
  const { refresh } = useTaskActions();
  const form = useForm<TaskInput>({
    mode: "uncontrolled",
    initialValues: draft?.values ?? base,
    validateInputOnBlur: true,
    validate: { title: validateTitle },
    onValuesChange: (values) => setCanPersist(saveTaskDraft(key, base, values, 0)),
  });
  const dependencyIds = form.useWatchValue("dependsOn");
  const currentParentId = form.useWatchValue("parentId");
  const parentIds = currentParentId === null ? [] : [currentParentId];
  const statuses = project.statuses.map((column) => ({ value: column.id, label: column.label }));
  const title = parentId === null ? "Новая задача" : `Подзадача для #${parentId}`;
  useBeforeUnload((event) => {
    if (!canPersist) event.preventDefault();
  });

  /**
   * Сохраняет возможность вернуться к вводу при отказе локального хранения.
   */
  const handleClose = (): void => {
    if (form.submitting) return;
    if (!canPersist) {
      setError(
        "Браузер не сохранил черновик. Создайте задачу или явно закройте форму без сохранения.",
      );
      return;
    }
    onClose();
  };

  /**
   * Сохраняет задачу и открывает подтверждённый сервером документ.
   */
  const handleSubmit = async (values: TaskInput): Promise<void> => {
    setError(null);
    try {
      const id = await createTask(project.id, values);
      discardTaskDraft(key);
      await refresh();
      onCreated(id);
    } catch (failure) {
      setError(toTaskError(failure).message);
    }
  };

  return (
    <Modal
      opened
      onClose={handleClose}
      title={title}
      size="lg"
      closeButtonProps={{ disabled: form.submitting, "aria-label": "Закрыть создание задачи" }}
      closeOnClickOutside={!form.submitting}
      closeOnEscape={!form.submitting}
    >
      <form
        onSubmit={form.onSubmit(handleSubmit, () => form.getInputNode("title")?.focus())}
        className={styles.root}
      >
        <fieldset className={styles.fields} disabled={form.submitting}>
          <Stack gap="lg">
            {isDefined(contextLabel) && (
              <Alert color="indigo" variant="light" title="Задача для этапа">
                {contextLabel}
              </Alert>
            )}
            {isDefined(draft) && (
              <Alert variant="light" color="indigo" title="Черновик восстановлен">
                <Button
                  variant="subtle"
                  size="xs"
                  onClick={() => {
                    form.setValues(base);
                    discardTaskDraft(key);
                    setDraft(null);
                  }}
                >
                  Начать заново
                </Button>
              </Alert>
            )}
            <TextInput
              key={form.key("title")}
              {...form.getInputProps("title")}
              data-autofocus
              label="Название задачи"
              placeholder="Что нужно сделать?"
              classNames={{ input: styles.titleInput }}
              required
            />
            <div className={styles.context}>
              <Select
                key={form.key("status")}
                {...form.getInputProps("status")}
                label="Статус"
                data={statuses}
                allowDeselect={false}
              />
              <Autocomplete
                key={form.key("group")}
                {...form.getInputProps("group")}
                label="Группа"
                placeholder="Без группы"
                data={board.data?.groups ?? []}
              />
            </div>
            <MarkdownField
              key={form.key("description")}
              {...form.getInputProps("description")}
              label="Описание"
              placeholder="Контекст, ожидаемый результат и критерии готовности…"
              minRows={4}
            />
            <Button
              variant="subtle"
              color="gray"
              justify="space-between"
              rightSection={<ChevronDown size={14} />}
              onClick={() => setExpanded(!isExpanded)}
              aria-expanded={isExpanded}
            >
              Исполнитель, теги и связи
            </Button>
            <Collapse expanded={isExpanded}>
              <Stack gap="md">
                <Autocomplete
                  key={form.key("assignee")}
                  {...form.getInputProps("assignee")}
                  label="Исполнитель"
                  placeholder="Пока не назначен"
                  data={[...new Set([project.actor, ...(board.data?.assignees ?? [])])]}
                />
                <TagsInput
                  key={form.key("tags")}
                  {...form.getInputProps("tags")}
                  label="Теги"
                  placeholder="Добавьте тег и нажмите Enter"
                  data={board.data?.tags ?? []}
                />
                <TaskPicker
                  label="Родительская задача"
                  value={parentIds}
                  onChange={(ids) => form.setFieldValue("parentId", ids[0] ?? null)}
                  single
                />
                <TaskPicker
                  label="Зависит от задач"
                  value={dependencyIds}
                  onChange={(ids) => form.setFieldValue("dependsOn", ids)}
                />
              </Stack>
            </Collapse>
            {isDefined(error) && (
              <Alert color="red" title="Задача не создана" role="alert">
                {error}
              </Alert>
            )}
            {!canPersist && (
              <Alert color="orange">
                Браузер не разрешил сохранить черновик. Оставьте форму открытой до сохранения
                задачи.
                <Button size="xs" variant="subtle" color="orange" onClick={onClose}>
                  Закрыть без сохранения
                </Button>
              </Alert>
            )}
            <Group justify="space-between" className={styles.footer}>
              <Text size="xs" c="dimmed">
                <Save size={12} /> Черновик сохраняется локально
              </Text>
              <Button type="submit" leftSection={<Plus size={15} />} loading={form.submitting}>
                Создать задачу
              </Button>
            </Group>
          </Stack>
        </fieldset>
      </form>
    </Modal>
  );
};
