import { useState } from "react";
import { Alert, Button, Group, Modal, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { z } from "zod";
import { readSessionStored, removeSessionStored, writeSessionStored } from "infra/browser-storage";
import { MarkdownField } from "ui/markdown-field";
import { isDefined } from "shared/value-predicates";
import type { StageFormProps } from "./types/stage-form-props.type";
import styles from "./styles/stage-form.module.css";

/**
 * Формулирует промежуточный результат этапа до выбора задач.
 *
 * Используется для:
 *  - создания и уточнения этапа с восстановимым черновиком
 */
export const StageForm = (props: StageFormProps) => {
  const { stage, draftKey, isNew, onSave, onClose } = props;
  const [draft] = useState(() =>
    z
      .object({
        title: z.string(),
        outcome: z.array(z.string()).transform((lines) => lines.join("\n")),
      })
      .safeParse(readSessionStored(draftKey)),
  );
  const [error, setError] = useState<string | null>(null);
  const [canPersist, setCanPersist] = useState(true);
  const form = useForm({
    mode: "uncontrolled",
    initialValues: draft.success ? draft.data : { title: stage.title, outcome: stage.outcome },
    validateInputOnBlur: true,
    validate: {
      title: (title) =>
        title.trim() === ""
          ? "Назовите промежуточный результат"
          : title.length > 160 || /[\r\n]/.test(title)
            ? "Название должно быть одной строкой до 160 символов"
            : null,
    },
    onValuesChange: (values) =>
      setCanPersist(
        writeSessionStored(draftKey, { ...values, outcome: values.outcome.split("\n") }),
      ),
  });
  const title = isNew ? "Новый этап" : "Изменить этап";
  const buttonLabel = isNew ? "Добавить этап" : "Сохранить этап";
  const hasError = isDefined(error);

  /**
   * Сохраняет название и результат, не переписывая состав задач этапа.
   */
  const handleSubmit = (values: typeof form.values) => {
    const outcome = onSave({ ...stage, title: values.title.trim(), outcome: values.outcome });
    if (outcome !== null) {
      setError(outcome);
      return;
    }
    removeSessionStored(draftKey);
    onClose();
  };

  return (
    <Modal
      attributes={{ header: { role: "presentation" } }}
      opened
      onClose={onClose}
      title={title}
      closeButtonProps={{ "aria-label": "Свернуть редактор этапа" }}
      size="lg"
    >
      <form
        className={styles.root}
        noValidate
        onSubmit={form.onSubmit(handleSubmit, () => form.getInputNode("title")?.focus())}
      >
        <p className={styles.hint}>
          Этап — законченный промежуточный результат. Задачи добавляются после создания.
        </p>
        <TextInput
          required
          label="Название этапа"
          placeholder="Например, проверка сквозного сценария"
          maxLength={160}
          data-autofocus
          key={form.key("title")}
          {...form.getInputProps("title")}
        />
        <MarkdownField
          label="Результат и условия завершения"
          key={form.key("outcome")}
          {...form.getInputProps("outcome")}
        />
        {!canPersist && (
          <Alert color="orange">
            Черновик не сохранился. Не закрывайте окно до сохранения этапа.
          </Alert>
        )}
        {hasError && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Свернуть
          </Button>
          <Button type="submit">{buttonLabel}</Button>
        </Group>
      </form>
    </Modal>
  );
};
