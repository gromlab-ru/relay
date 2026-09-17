import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { useBeforeUnload } from "react-router-dom";
import {
  Alert,
  Autocomplete,
  Badge,
  Button,
  Group,
  Select,
  Stack,
  TagsInput,
  Text,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { Check, Pencil, Save } from "lucide-react";
import {
  TaskPicker,
  discardTaskDraft,
  diffTaskInput,
  getDraftKey,
  getTask,
  hasTaskChanges,
  readTaskDraft,
  saveTaskDraft,
  toTaskError,
  toTaskInput,
  updateTask,
  useGetBoard,
  useTaskActions,
  validateTitle,
} from "domains/tasks";
import type { Task, TaskInput } from "domains/tasks";
import { MarkdownField } from "ui/markdown-field";
import { MarkdownView } from "ui/markdown-view";
import { isDefined } from "shared/value-predicates";
import { ConflictReview } from "compositions/screens/board/ui/task-panel/ui/task-editor/ui/conflict-review";
import type { TaskEditorProps } from "./types/task-editor-props.type";
import styles from "./styles/task-editor.module.css";

/**
 * Сохраняет контекст чтения, исходную ревизию и независимый локальный черновик.
 *
 * Используется для:
 *  - явного редактирования и сохранения полей задачи
 *  - восстановления ввода и разрешения конкурентных изменений
 */
export const TaskEditor = (props: TaskEditorProps) => {
  const { detail, project, onEditingChange, onPersistenceChange, className, ...rootAttrs } = props;
  const { task } = detail;
  const key = getDraftKey(project.id, task.id);
  const [draft, setDraft] = useState(() => readTaskDraft(key));
  const [isEditing, setEditing] = useState(false);
  const [base, setBase] = useState(() => ({ values: toTaskInput(task), revision: task.revision }));
  const [conflict, setConflict] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canPersist, setCanPersist] = useState(true);
  const formElement = useRef<HTMLFormElement>(null);
  const board = useGetBoard({}, undefined, 1);
  const { refresh } = useTaskActions();
  const form = useForm<TaskInput>({
    mode: "uncontrolled",
    initialValues: base.values,
    validateInputOnBlur: true,
    validate: {
      title: validateTitle,
      description: (text) =>
        new TextEncoder().encode(text).length > 256 * 1024 ? "Описание превышает 256 КиБ" : null,
      summary: (text) =>
        new TextEncoder().encode(text).length > 4096 ? "Краткий итог превышает 4096 байт" : null,
    },
    onValuesChange: (values) => {
      if (isEditing) setCanPersist(saveTaskDraft(key, base.values, values, base.revision));
    },
  });
  const parentId = form.useWatchValue("parentId");
  const dependsOn = form.useWatchValue("dependsOn");
  const parentIds = parentId === null ? [] : [parentId];
  const statusItems = project.statuses.map((status) => ({ value: status.id, label: status.label }));
  const known = [
    ...detail.dependencies,
    ...detail.children,
    ...(detail.parent ? [detail.parent] : []),
  ];
  const hasRemoteChanges = isEditing && task.revision > base.revision;

  useEffect(() => {
    onEditingChange(isEditing);
    return () => onEditingChange(false);
  }, [isEditing, onEditingChange]);
  useEffect(() => {
    onPersistenceChange(canPersist);
  }, [canPersist, onPersistenceChange]);
  useBeforeUnload((event) => {
    if (isEditing && !canPersist) event.preventDefault();
  });
  useEffect(() => {
    /**
     * Сохраняет текущую форму по системному сочетанию клавиш.
     */
    const handleKey = (event: KeyboardEvent): void => {
      if (
        isEditing &&
        (event.ctrlKey || event.metaKey) &&
        event.key === "Enter" &&
        formElement.current?.contains(document.activeElement)
      ) {
        event.preventDefault();
        formElement.current.requestSubmit();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isEditing]);

  /**
   * Начинает редактирование с актуального снимка либо восстанавливает сохранённую основу.
   */
  const handleEdit = (restore: boolean): void => {
    const values = restore && draft ? draft.values : toTaskInput(task);
    const nextBase =
      restore && draft
        ? { values: draft.base, revision: draft.revision }
        : { values: toTaskInput(task), revision: task.revision };
    setBase(nextBase);
    setEditing(true);
    setError(null);
    form.setInitialValues(nextBase.values);
    form.setValues(values);
    form.resetDirty(nextBase.values);
    setCanPersist(saveTaskDraft(key, nextBase.values, values, nextBase.revision));
  };

  /**
   * Отменяет только собственные правки, сохраняя последнюю серверную версию.
   */
  const handleDiscard = (): void => {
    discardTaskDraft(key);
    setDraft(null);
    setEditing(false);
    setConflict(null);
    setError(null);
  };

  /**
   * Проверяет исходную ревизию и сохраняет только локально изменённые поля.
   */
  const handleSubmit = async (values: TaskInput): Promise<void> => {
    setError(null);
    if (!hasTaskChanges(base.values, values)) {
      handleDiscard();
      return;
    }
    if (task.revision > base.revision) {
      setConflict(task);
      return;
    }
    try {
      await updateTask(project.id, task.id, diffTaskInput(base.values, values), base.revision);
      discardTaskDraft(key);
      setDraft(null);
      setEditing(false);
      setConflict(null);
      await refresh();
      notifications.show({
        message: "Изменения сохранены",
        icon: <Check size={16} />,
        color: "green",
      });
    } catch (failure) {
      const result = toTaskError(failure);
      if (result.code === "REVISION_CONFLICT") {
        try {
          setConflict((await getTask(project.id, task.id)).task);
        } catch {
          setError(result.message);
        }
        return;
      }
      setError(result.message);
    }
  };

  /**
   * Переводит объединённый ввод на новую основу, сохраняя явное подтверждение записи.
   */
  const handleMerge = (values: TaskInput): void => {
    if (conflict === null) return;
    const latest = toTaskInput(conflict);
    setBase({ values: latest, revision: conflict.revision });
    form.setInitialValues(latest);
    form.setValues(values);
    form.resetDirty(latest);
    setCanPersist(saveTaskDraft(key, latest, values, conflict.revision));
    setConflict(null);
  };

  if (!isEditing)
    return (
      <div {...rootAttrs} className={clsx(styles.root, className)}>
        {isDefined(draft) && (
          <Alert mb="lg" color="gray" title="Есть несохранённый черновик">
            <Group gap="xs" mt="xs">
              <Button size="xs" onClick={() => handleEdit(true)}>
                Восстановить черновик
              </Button>
              <Button size="xs" variant="subtle" onClick={handleDiscard}>
                Удалить черновик
              </Button>
            </Group>
          </Alert>
        )}
        <div className={styles.readHeading}>
          <h1 className={styles.title}>{task.title}</h1>
          <Button
            variant="subtle"
            color="gray"
            size="xs"
            leftSection={<Pencil size={13} />}
            onClick={() => handleEdit(false)}
          >
            Редактировать
          </Button>
        </div>
        <div className={styles.properties}>
          <div>
            <span>Исполнитель</span>
            <strong>{task.assignee || "Не назначен"}</strong>
          </div>
          <div>
            <span>Группа</span>
            <strong>{task.group || "Без группы"}</strong>
          </div>
        </div>
        <Group gap={5} mb="lg">
          {task.tags.map((tag) => (
            <Badge key={tag} variant="light" color="gray" size="sm" tt="none">
              {tag}
            </Badge>
          ))}
        </Group>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Описание</h2>
          <MarkdownView
            text={task.description}
            emptyText="Добавьте контекст, ожидаемый результат и критерии готовности."
          />
        </section>
        <section className={styles.summary}>
          <h2 className={styles.sectionTitle}>Состояние и следующий шаг</h2>
          <MarkdownView
            text={task.summary}
            emptyText="Коротко о том, что уже сделано и что предстоит дальше."
          />
        </section>
      </div>
    );

  return (
    <div {...rootAttrs} className={clsx(styles.root, className)}>
      {isDefined(conflict) && (
        <ConflictReview
          key={conflict.revision}
          base={base.values}
          local={form.getValues()}
          remote={toTaskInput(conflict)}
          onApply={handleMerge}
          onCancel={() => setConflict(null)}
        />
      )}
      <form
        ref={formElement}
        onSubmit={form.onSubmit(handleSubmit, () => form.getInputNode("title")?.focus())}
      >
        <fieldset disabled={form.submitting || conflict !== null} className={styles.fields}>
          <Stack gap="lg">
            {hasRemoteChanges && (
              <Alert color="orange" title="Задача обновлена другим клиентом">
                Ваши правки сохранены локально. При сохранении можно будет сравнить версии.
              </Alert>
            )}
            <TextInput
              key={form.key("title")}
              {...form.getInputProps("title")}
              label="Название задачи"
              required
            />
            <div className={styles.editProperties}>
              <Select
                key={form.key("status")}
                {...form.getInputProps("status")}
                label="Статус"
                data={statusItems}
                allowDeselect={false}
              />
              <Autocomplete
                key={form.key("assignee")}
                {...form.getInputProps("assignee")}
                label="Исполнитель"
                placeholder="Не назначен"
                data={[...new Set([project.actor, ...(board.data?.assignees ?? [])])]}
              />
              <Autocomplete
                key={form.key("group")}
                {...form.getInputProps("group")}
                label="Группа"
                placeholder="Без группы"
                data={board.data?.groups ?? []}
              />
              <TagsInput
                key={form.key("tags")}
                {...form.getInputProps("tags")}
                label="Теги"
                placeholder="Добавьте тег"
                data={board.data?.tags ?? []}
              />
            </div>
            <MarkdownField
              key={form.key("description")}
              {...form.getInputProps("description")}
              label="Описание"
            />
            <MarkdownField
              key={form.key("summary")}
              {...form.getInputProps("summary")}
              label="Состояние и следующий шаг"
              minRows={3}
            />
            <TaskPicker
              label="Родительская задача"
              single
              value={parentIds}
              known={known}
              excludeId={task.id}
              onChange={(ids) => form.setFieldValue("parentId", ids[0] ?? null)}
            />
            <TaskPicker
              label="Зависит от задач"
              value={dependsOn}
              known={known}
              excludeId={task.id}
              onChange={(ids) => form.setFieldValue("dependsOn", ids)}
            />
            {isDefined(error) && (
              <Alert color="red" role="alert">
                {error}
              </Alert>
            )}
            {!canPersist && (
              <Alert color="orange">
                Локальное хранение недоступно. Сохраните правки перед закрытием страницы.
              </Alert>
            )}
          </Stack>
        </fieldset>
        <div className={styles.saveBar}>
          <Text size="xs" c="dimmed">
            <Save size={12} /> Несохранённые изменения
          </Text>
          <Group gap="xs">
            <Button
              variant="subtle"
              color="gray"
              disabled={form.submitting}
              onClick={handleDiscard}
            >
              Отменить
            </Button>
            <Button type="submit" loading={form.submitting} disabled={conflict !== null}>
              Сохранить
            </Button>
          </Group>
        </div>
      </form>
    </div>
  );
};
