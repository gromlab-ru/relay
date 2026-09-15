import clsx from "clsx";
import { useState } from "react";
import { Alert, Button, Group, Select, Skeleton, Stack, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDebouncedValue } from "@mantine/hooks";
import { Send } from "lucide-react";
import {
  LOG_KINDS,
  RECORD_INPUT_SCHEMA,
  addRecord,
  getDraftKey,
  toTaskError,
  useGetHistory,
  useTaskActions,
} from "domains/tasks";
import type { LogKind, RecordInput } from "domains/tasks";
import { readStored, removeStored, writeStored } from "infra/browser-storage";
import { MarkdownField } from "ui/markdown-field";
import { isDefined, isEmptyArray } from "shared/value-predicates";
import { HistoryRecord } from "./ui/history-record/history-record";
import type { TaskHistoryProps } from "./types/task-history-props.type";
import styles from "./styles/task-history.module.css";

/**
 * Организует обсуждение и отчёты с устойчивыми черновиками и подгрузкой истории.
 *
 * Используется для:
 *  - добавления комментариев и структурированных отчётов
 *  - чтения нескольких страниц истории с фильтрами
 */
export const TaskHistory = (props: TaskHistoryProps) => {
  const { projectId, taskId, kind, className, ...rootAttrs } = props;
  const key = getDraftKey(projectId, `record:${taskId}:${kind}`);
  const [author, setAuthor] = useState("");
  const [queryAuthor] = useDebouncedValue(author, 250);
  const [logKind, setLogKind] = useState<LogKind | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [canPersist, setCanPersist] = useState(true);
  const history = useGetHistory(taskId, kind, queryAuthor, logKind);
  const { refresh } = useTaskActions();
  const [initial] = useState(() => {
    const stored = RECORD_INPUT_SCHEMA.safeParse(readStored(key));
    return stored.success ? stored.data : RECORD_INPUT_SCHEMA.parse({});
  });
  const form = useForm<RecordInput>({
    mode: "uncontrolled",
    initialValues: initial,
    validate: { text: (text) => (text.trim() === "" ? "Добавьте текст сообщения" : null) },
    onValuesChange: (values) => setCanPersist(writeStored(key, values)),
  });
  const isLog = kind === "logs";
  const records = history.data?.flatMap((page) => page.items) ?? [];
  const uniqueRecords = [...new Map(records.map((record) => [record.id, record])).values()];
  const hasMore = isDefined(history.data?.at(-1)?.cursor);
  const isEmpty = !history.isLoading && history.error === undefined && isEmptyArray(uniqueRecords);
  const label = isLog ? "Текст отчёта" : "Комментарий";
  const submitLabel = isLog ? "Добавить отчёт" : "Отправить";
  const reportKinds = Object.entries(LOG_KINDS).map(([value, label]) => ({ value, label }));

  /**
   * Дополняет историю и очищает ввод только после подтверждённой записи.
   */
  const handleSubmit = async (values: RecordInput): Promise<void> => {
    setError(null);
    try {
      await addRecord(projectId, taskId, kind, values);
      form.setValues(RECORD_INPUT_SCHEMA.parse({}));
      form.resetDirty();
      removeStored(key);
      await refresh();
      await history.mutate();
    } catch (failure) {
      setError(toTaskError(failure).message);
    }
  };

  return (
    <div {...rootAttrs} className={clsx(styles.root, className)}>
      <form onSubmit={form.onSubmit(handleSubmit)} className={styles.composer}>
        <fieldset disabled={form.submitting} className={styles.fields}>
          <Stack gap="md">
            {isLog && (
              <>
                <Group grow>
                  <Select
                    key={form.key("kind")}
                    {...form.getInputProps("kind")}
                    label="Тип отчёта"
                    data={reportKinds}
                    allowDeselect={false}
                  />
                  <TextInput
                    key={form.key("title")}
                    {...form.getInputProps("title")}
                    label="Заголовок"
                    placeholder="Коротко о результате"
                  />
                </Group>
                <TextInput
                  key={form.key("summary")}
                  {...form.getInputProps("summary")}
                  label="Краткий итог"
                />
                <TextInput
                  key={form.key("sessionId")}
                  {...form.getInputProps("sessionId")}
                  label="Сессия агента"
                  placeholder="Необязательно"
                />
              </>
            )}
            <MarkdownField
              key={form.key("text")}
              {...form.getInputProps("text")}
              label={label}
              placeholder="Поделитесь контекстом, решением или следующим шагом…"
              minRows={3}
            />
            {isDefined(error) && (
              <Alert color="red" role="alert">
                {error}
              </Alert>
            )}
            {!canPersist && (
              <Alert color="orange">
                Черновик не удалось сохранить в браузере. Не закрывайте вкладку до отправки.
              </Alert>
            )}
            <Group justify="flex-end">
              <Button
                type="submit"
                size="xs"
                leftSection={<Send size={13} />}
                loading={form.submitting}
              >
                {submitLabel}
              </Button>
            </Group>
          </Stack>
        </fieldset>
      </form>
      <div className={styles.filters}>
        <TextInput
          aria-label="Фильтр истории по автору"
          placeholder="Все авторы"
          value={author}
          onChange={(event) => setAuthor(event.currentTarget.value)}
          size="xs"
        />
        {isLog && (
          <Select
            aria-label="Фильтр по типу отчёта"
            placeholder="Все типы"
            clearable
            data={reportKinds}
            value={logKind ?? null}
            onChange={(value) => {
              const parsed = RECORD_INPUT_SCHEMA.shape.kind.safeParse(value);
              setLogKind(parsed.success ? parsed.data : undefined);
            }}
            size="xs"
          />
        )}
      </div>
      {history.isLoading && (
        <Stack>
          <Skeleton height={90} />
          <Skeleton height={90} />
        </Stack>
      )}
      {isEmpty && (
        <p className={styles.empty}>
          Здесь появится история работы. Добавьте первую запись или измените фильтры.
        </p>
      )}
      {isDefined(history.error) && (
        <Alert color="red">
          {history.error.message}
          <Button variant="subtle" size="xs" onClick={() => void history.mutate()}>
            Повторить
          </Button>
        </Alert>
      )}
      <div className={styles.records}>
        {uniqueRecords.map((record) => (
          <HistoryRecord key={record.id} record={record} />
        ))}
      </div>
      {hasMore && (
        <Button
          variant="default"
          fullWidth
          loading={history.isValidating}
          onClick={() => void history.setSize(history.size + 1)}
        >
          Показать более ранние записи
        </Button>
      )}
    </div>
  );
};
