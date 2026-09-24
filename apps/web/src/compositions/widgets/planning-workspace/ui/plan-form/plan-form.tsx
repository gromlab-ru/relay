import { useState } from "react";
import {
  Accordion,
  Alert,
  Button,
  Group,
  Modal,
  Stack,
  TagsInput,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { MarkdownField } from "ui/markdown-field";
import { isDefined } from "shared/value-predicates";
import { clearPlanDraft, readPlanDraft, writePlanDraft } from "./helpers/plan-form-draft";
import type { PlanFormProps, PlanFormValues } from "./types/plan-form-props.type";
import styles from "./styles/plan-form.module.css";

/**
 * Помогает сформулировать цель, сохраняя подробности и незавершённый ввод.
 *
 * Используется для:
 *  - компактного создания плана работ
 *  - редактирования Markdown без потери черновика при закрытии
 */
export const PlanForm = (props: PlanFormProps) => {
  const { plan, isNew, projectId, onSave, onClose } = props;
  const draftKey = `relay:planning-form:v2:${projectId}:${isNew ? "new" : plan.id}`;
  const [initialDraft] = useState(() =>
    readPlanDraft(draftKey, {
      title: plan.title,
      summary: plan.summary,
      goal: plan.goal,
      rationale: plan.rationale,
      boundaries: plan.boundaries,
      scope: plan.scope,
    }),
  );
  const [draftError, setDraftError] = useState(initialDraft.error);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<PlanFormValues>({
    mode: "uncontrolled",
    initialValues: initialDraft.values,
    validateInputOnBlur: true,
    validate: {
      title: (title) =>
        title.trim() === ""
          ? "Назовите результат плана"
          : title.length > 160 || /[\r\n]/.test(title)
            ? "Не более 160 символов в одной строке"
            : null,
    },
    onValuesChange: (values) => {
      if (initialDraft.error !== null) return;
      setDraftError(writePlanDraft(draftKey, values));
      setError(null);
    },
  });
  const title = isNew ? "Новый план" : "Редактировать план";
  const submitLabel = isNew ? "Создать план" : "Сохранить изменения";
  const hasError = isDefined(error);
  const hasDraftError = isDefined(draftError);

  /**
   * Сохраняет предметно названный локальный результат и очищает ввод только после успеха.
   */
  const handleSubmit = (values: PlanFormValues) => {
    if (initialDraft.error !== null) {
      setError("Сначала сбросьте повреждённый черновик.");
      return;
    }
    const outcome = onSave({
      ...plan,
      ...values,
      title: values.title.trim(),
    });
    if (outcome !== null) {
      setError(outcome);
      return;
    }
    try {
      clearPlanDraft(draftKey);
    } catch {
      /* План уже сохранён; повторное открытие покажет оставшийся черновик. */
    }
    onClose();
  };

  /**
   * Передаёт фокус первому полю с ошибкой без очистки формы.
   */
  const handleValidationError = (errors: typeof form.errors) => {
    const path = Object.keys(errors)[0];
    if (isDefined(path)) form.getInputNode(path)?.focus();
  };

  return (
    <Modal
      attributes={{ header: { role: "presentation" } }}
      opened
      onClose={onClose}
      title={title}
      size="lg"
      closeButtonProps={{ "aria-label": "Свернуть редактор плана" }}
      classNames={{ title: styles.modalTitle, body: styles.modalBody }}
    >
      <form
        className={styles.root}
        noValidate
        onSubmit={form.onSubmit(handleSubmit, handleValidationError)}
      >
        <p className={styles.intro}>
          Начните с намерения. Этапы и задачи можно добавить следующим шагом.
        </p>
        {hasDraftError && (
          <Alert color="orange" title="Проверьте черновик">
            {draftError}
            <Button
              mt="sm"
              size="xs"
              variant="default"
              onClick={() => {
                try {
                  clearPlanDraft(draftKey);
                  onClose();
                } catch {
                  setDraftError("Хранилище недоступно. Повторите сброс позже.");
                }
              }}
            >
              Сбросить черновик и закрыть
            </Button>
          </Alert>
        )}
        <fieldset className={styles.fields} disabled={form.submitting}>
          <Stack gap="md">
            <TextInput
              label="Название"
              placeholder="Какой результат хотим получить?"
              required
              maxLength={160}
              data-autofocus
              key={form.key("title")}
              {...form.getInputProps("title")}
            />
            <Textarea
              label="Краткое описание"
              placeholder="Пара предложений, чтобы понять план в каталоге"
              autosize
              minRows={2}
              maxRows={4}
              key={form.key("summary")}
              {...form.getInputProps("summary")}
            />
            <MarkdownField
              label="Цель и ожидаемый результат"
              placeholder="Что изменится и как поймём, что достигли цели?"
              key={form.key("goal")}
              {...form.getInputProps("goal")}
            />
            <Accordion variant="separated" radius="md">
              <Accordion.Item value="details">
                <Accordion.Control>
                  Область, основания и границы
                  <span className={styles.optional}>Необязательно сейчас</span>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="md">
                    <TagsInput
                      label="Область изменения"
                      placeholder="Приложение, фича или весь проект"
                      data={[
                        "Весь проект",
                        "Web",
                        "API",
                        "Инфраструктура",
                        "Каталог",
                        "Бронирование",
                      ]}
                      key={form.key("scope")}
                      {...form.getInputProps("scope")}
                    />
                    <MarkdownField
                      label="Почему начинаем"
                      key={form.key("rationale")}
                      {...form.getInputProps("rationale")}
                    />
                    <MarkdownField
                      label="Границы работы"
                      key={form.key("boundaries")}
                      {...form.getInputProps("boundaries")}
                    />
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          </Stack>
        </fieldset>
        {hasError && (
          <Alert color="red" title="Не удалось сохранить">
            {error}
          </Alert>
        )}
        <footer className={styles.footer}>
          <span>Черновик остаётся в этой вкладке</span>
          <Group gap="xs">
            <Button variant="default" onClick={onClose}>
              Свернуть
            </Button>
            <Button type="submit" loading={form.submitting}>
              {submitLabel}
            </Button>
          </Group>
        </footer>
      </form>
    </Modal>
  );
};
