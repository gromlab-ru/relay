import { useState } from "react";
import { z } from "zod";
import { Accordion, Alert, Button, Drawer, Group, Stack, Text } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useProjectId } from "domains/project";
import {
  KIND_LABELS,
  PROJECT_INPUT_SCHEMAS,
  saveProjectRecord,
  useLifecycle,
} from "domains/lifecycle";
import type { ProjectValues } from "domains/lifecycle";
import { getBrowserSessionId, readStored, writeStored, removeStored } from "infra/browser-storage";
import { isNonEmptyArray } from "shared/value-predicates";
import { EDITOR_FIELDS } from "./config/fields";
import { editorValues, normalizeValues } from "./helpers/values";
import { RecordField } from "./ui/record-field/record-field";
import type { ProjectEditorProps } from "./types/project-editor-props.type";
import styles from "./styles/project-editor.module.css";

const DRAFT_SCHEMA = z.object({
  values: z.record(
    z.string(),
    z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.null(),
      z.array(z.string()),
      z.array(z.number()),
    ]),
  ),
  revision: z.number(),
  requestId: z.string(),
});

/**
 * Проводит создание и изменение проектного документа с сохранением черновика.
 *
 * Используется для:
 *  - ввода основных сведений и выбора связей
 *  - сохранения работы при ошибках сети и конкурирующих изменениях
 */
export const ProjectEditor = (props: ProjectEditorProps) => {
  const { kind, record, initial, onClose, onSaved, fieldKeys, heading } = props;
  const projectId = useProjectId();
  const lifecycle = useLifecycle();
  const creationScope = [
    "taskId",
    "stageId",
    "planId",
    "releaseId",
    "requirementId",
    "runId",
    "category",
  ]
    .map((key) => initial?.[key] ?? "")
    .join(":");
  const draftKey = `relay:project-draft:${getBrowserSessionId()}:${projectId}:${kind}:${record?.id ?? creationScope}`;
  const [draft] = useState(() => DRAFT_SCHEMA.safeParse(readStored(draftKey)));
  const [requestId] = useState(() => (draft.success ? draft.data.requestId : crypto.randomUUID()));
  const [revision, setRevision] = useState(() =>
    draft.success ? draft.data.revision : (record?.revision ?? 0),
  );
  const [error, setError] = useState<string | null>(null);
  const [hasStoredDraft, setStoredDraft] = useState(draft.success);
  const [canPersist, setCanPersist] = useState(true);
  const form = useForm<ProjectValues>({
    mode: "uncontrolled",
    validateInputOnBlur: true,
    initialValues: draft.success ? draft.data.values : editorValues(kind, record, initial),
    onValuesChange: (values) => {
      const saved = writeStored(draftKey, { values, revision, requestId });
      setCanPersist(saved);
    },
    validate: (values) => {
      const parsed = PROJECT_INPUT_SCHEMAS[kind].safeParse(normalizeValues(kind, values));
      if (parsed.success) return {};
      return Object.fromEntries(
        parsed.error.issues.map((issue) => {
          const key = String(issue.path[0]);
          const label = EDITOR_FIELDS[kind].find((field) => field.key === key)?.label ?? key;
          return [key, `Проверьте поле «${label}»: заполните корректное значение.`];
        }),
      );
    },
  });
  const fields =
    fieldKeys === undefined
      ? EDITOR_FIELDS[kind]
      : EDITOR_FIELDS[kind]
          .filter((field) => fieldKeys.includes(field.key))
          .map((field) => ({ ...field, section: undefined }));
  const mainFields = fields.filter((field) => field.section === undefined);
  const detailsFields = fields.filter((field) => field.section === "details");
  const linkFields = fields.filter((field) => field.section === "links");
  const hasDetails = isNonEmptyArray(detailsFields);
  const hasLinks = isNonEmptyArray(linkFields);
  const currentRecord = lifecycle.data?.records.find((item) => item.id === record?.id);
  const hasConflict = currentRecord !== undefined && currentRecord.revision !== revision;
  const hasError = error !== null;
  const editorTitle =
    heading ??
    `${record === undefined ? "Создать" : "Изменить"}: ${KIND_LABELS[kind].toLowerCase()}`;
  const canClose = !form.submitting && (canPersist || !form.isDirty());

  /**
   * Отправляет проверенный ввод и сбрасывает только подтверждённый черновик.
   */
  const handleSubmit = async (values: ProjectValues): Promise<void> => {
    setError(null);
    try {
      const fields = PROJECT_INPUT_SCHEMAS[kind].parse(normalizeValues(kind, values));
      const baseRecord = record === undefined ? undefined : { ...record, revision };
      const saved = await saveProjectRecord(projectId, fields, baseRecord, requestId);
      removeStored(draftKey);
      await lifecycle.mutate();
      onSaved?.(saved);
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Не удалось сохранить документ.");
    }
  };

  /**
   * Явно заменяет черновик актуальной серверной версией.
   */
  const handleReload = (): void => {
    if (currentRecord === undefined) return;
    const values = editorValues(kind, currentRecord);
    form.setValues(values);
    form.resetDirty(values);
    setRevision(currentRecord.revision);
    removeStored(draftKey);
    setStoredDraft(false);
    setError(null);
  };

  /**
   * Переводит фокус на первое некорректное поле.
   */
  const handleInvalid = (errors: typeof form.errors): void => {
    const key = Object.keys(errors)[0];
    if (key !== undefined) form.getInputNode(key)?.focus();
  };

  return (
    <Drawer
      opened
      position="right"
      size="min(100vw, 42rem)"
      title={editorTitle}
      onClose={onClose}
      closeButtonProps={{ "aria-label": "Закрыть редактор" }}
      withCloseButton={canClose}
      closeOnClickOutside={canClose}
      closeOnEscape={canClose}
    >
      <form
        className={styles.root}
        noValidate
        onSubmit={form.onSubmit(handleSubmit, handleInvalid)}
      >
        <Text size="sm" c="dimmed" mb="lg">
          Сначала главное. Связи и технические детали можно дополнить по мере работы.
        </Text>
        {hasStoredDraft && (
          <Alert color="gray" mb="md">
            Восстановлен ваш несохранённый черновик.
          </Alert>
        )}
        {hasConflict && (
          <Alert color="orange" mb="md" title="Появилась новая версия">
            Ваш ввод сохранён. Перед сохранением согласуйте изменения.
            <Button variant="subtle" onClick={handleReload}>
              Загрузить актуальную версию
            </Button>
          </Alert>
        )}
        {!canPersist && (
          <Alert color="orange" mb="md">
            Браузер не смог сохранить черновик. Сохраните документ перед закрытием.
          </Alert>
        )}
        <fieldset disabled={form.submitting} className={styles.fields}>
          <Stack gap="md">
            {mainFields.map((field) => (
              <RecordField key={field.key} field={field} form={form} state={lifecycle.data} />
            ))}
          </Stack>
          <Accordion multiple mt="lg">
            {hasDetails && (
              <Accordion.Item value="details">
                <Accordion.Control>Дополнительные сведения</Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="md">
                    {detailsFields.map((field) => (
                      <RecordField
                        key={field.key}
                        field={field}
                        form={form}
                        state={lifecycle.data}
                      />
                    ))}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            )}
            {hasLinks && (
              <Accordion.Item value="links">
                <Accordion.Control>Связи с проектом</Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="md">
                    {linkFields.map((field) => (
                      <RecordField
                        key={field.key}
                        field={field}
                        form={form}
                        state={lifecycle.data}
                      />
                    ))}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            )}
          </Accordion>
        </fieldset>
        {hasError && (
          <Alert color="red" mt="md" role="alert">
            {error}
          </Alert>
        )}
        <Group className={styles.footer} justify="space-between">
          <Text size="xs" c="dimmed">
            Черновик сохраняется на этом устройстве
          </Text>
          <Group gap="xs">
            <Button
              variant="subtle"
              color="gray"
              disabled={form.submitting}
              onClick={() => {
                removeStored(draftKey);
                onClose();
              }}
            >
              Отменить правки
            </Button>
            <Button type="submit" loading={form.submitting}>
              Сохранить
            </Button>
          </Group>
        </Group>
      </form>
    </Drawer>
  );
};
