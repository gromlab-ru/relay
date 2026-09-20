import { useRef, useState } from "react";
import { Alert, Autocomplete, Button, Group, Stack, Text, Textarea } from "@mantine/core";
import { useForm } from "@mantine/form";
import { getRelations, relationError, saveRelations } from "domains/relations";
import { EntityPicker } from "../entity-picker/entity-picker";
import type { RelationEditorProps, RelationFormValues } from "./types/relation-editor-props.type";
import styles from "./styles/relation-editor.module.css";

/**
 * Устанавливает направленную связь с пояснением и защитой от параллельных изменений.
 *
 * Используется для:
 *  - связывания произвольных сущностей и добавления контекстного материала
 */
export const RelationEditor = (props: RelationEditorProps) => {
  const { projectId, root, onSaved, onCancel } = props;
  const [version, setVersion] = useState(props.version);
  const [error, setError] = useState<string | null>(null);
  const request = useRef({ signature: "", id: crypto.randomUUID() });
  const form = useForm<RelationFormValues>({
    mode: "uncontrolled",
    validateInputOnBlur: true,
    initialValues: { from: root ?? "", to: "", type: "references", description: "" },
    validate: {
      from: (value) => (value ? null : "Выберите начало связи"),
      to: (value) => (value ? null : "Выберите конец связи"),
      type: (value) =>
        /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)
          ? null
          : "Используйте латинские буквы, цифры, точку, дефис или подчёркивание",
    },
  });
  const hasError = error !== null;
  /** Передаёт фокус первому незаполненному полю. */
  const handleValidationError = (errors: typeof form.errors): void => {
    const first = Object.keys(errors)[0];
    if (first !== undefined) form.getInputNode(first)?.focus();
  };
  /** Повторяет неподтверждённый запрос с прежним ключом, сохраняя черновик при ошибке. */
  const handleSubmit = async (values: RelationFormValues): Promise<void> => {
    setError(null);
    const signature = JSON.stringify([values, version]);
    if (request.current.signature !== signature)
      request.current = { signature, id: crypto.randomUUID() };
    try {
      await saveRelations(
        projectId,
        [
          {
            action: "add",
            from: values.from,
            to: values.to,
            type: values.type,
            description: values.description,
          },
        ],
        version,
        request.current.id,
      );
      onSaved();
    } catch (failure) {
      setError(relationError(failure).message);
    }
  };
  /** Перечитывает версию только по явному действию, не заменяя введённые поля. */
  const handleRefresh = async (): Promise<void> => {
    try {
      setVersion((await getRelations(projectId, { limit: 1 })).version);
      setError(null);
    } catch (failure) {
      setError(relationError(failure).message);
    }
  };
  return (
    <form onSubmit={form.onSubmit(handleSubmit, handleValidationError)} noValidate>
      <fieldset className={styles.root} disabled={form.submitting}>
        <Stack gap="sm">
          <Text fw={600}>Новая связь</Text>
          <EntityPicker
            key={form.key("from")}
            projectId={projectId}
            label="Начало связи"
            required
            {...form.getInputProps("from")}
          />
          <Autocomplete
            key={form.key("type")}
            label="Тип отношения"
            description="Выберите подсказку или введите свой тип"
            required
            data={[
              "references",
              "contains",
              "implements",
              "affects",
              "depends-on",
              "part-of",
              "related",
            ]}
            {...form.getInputProps("type")}
          />
          <EntityPicker
            key={form.key("to")}
            projectId={projectId}
            label="Конец связи"
            required
            {...form.getInputProps("to")}
          />
          <Textarea
            key={form.key("description")}
            label="Зачем нужна связь"
            description="Необязательное пояснение в Markdown"
            autosize
            minRows={3}
            {...form.getInputProps("description")}
          />
          <Text size="xs" c="dimmed">
            Контекстная ссылка references не делает документ требованием. Новая связь не меняет
            статусы сущностей автоматически.
          </Text>
          {hasError && (
            <Alert color="red" title="Связь не подтверждена" role="alert">
              {error}
              <Button variant="subtle" onClick={() => void handleRefresh()}>
                Обновить версию, сохранив ввод
              </Button>
            </Alert>
          )}
          <Group>
            <Button type="submit" loading={form.submitting}>
              Сохранить связь
            </Button>
            <Button variant="default" onClick={onCancel}>
              Отмена
            </Button>
          </Group>
        </Stack>
      </fieldset>
    </form>
  );
};
