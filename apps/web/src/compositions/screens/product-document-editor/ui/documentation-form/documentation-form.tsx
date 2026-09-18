import clsx from "clsx";
import { useRef, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  NativeSelect,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useHotkeys } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { Check, FileText } from "lucide-react";
import { useBeforeUnload, useBlocker, useNavigate } from "react-router-dom";
import { DOCUMENTATION_KIND_OPTIONS, useProductDemo } from "domains/product-demo";
import type { ProductDocumentationInput } from "domains/product-demo";
import { useProductPath } from "compositions/widgets/product-page";
import { readSessionStored, removeSessionStored, writeSessionStored } from "infra/browser-storage";
import { MarkdownField } from "ui/markdown-field";
import { DocumentScopePicker } from "./ui/document-scope-picker";
import { DOCUMENTATION_DRAFT_SCHEMA } from "./config/documentation-draft.schema";
import type { DocumentationFormProps } from "./types/documentation-form-props.type";
import styles from "./styles/documentation-form.module.css";

/**
 * Редактирует Markdown-материал с восстановлением черновика и визуальным выбором областей.
 *
 * Используется для:
 *  - сохранения документа в локальном прототипе
 *  - сохранения ввода при переходе, ошибке и конфликте ревизии
 */
export const DocumentationForm = (props: DocumentationFormProps) => {
  const { initial, revision, draftScope, backTo, returnTo, className, ...rootAttrs } = props;
  const { saveDocumentation } = useProductDemo();
  const base = useProductPath();
  const navigate = useNavigate();
  const draftKey = `relay:documentation-draft:${base}:${draftScope}`;
  const [draftData] = useState(() =>
    DOCUMENTATION_DRAFT_SCHEMA.safeParse(readSessionStored(draftKey)),
  );
  const [baseRevision, setBaseRevision] = useState(
    draftData.success ? draftData.data.revision : revision,
  );
  const [hasRestoredDraft, setRestoredDraft] = useState(draftData.success);
  const [canPersist, setCanPersist] = useState(true);
  const [saveError, setSaveError] = useState("");
  const [defect, setDefect] = useState<Error>();
  const [isDiscardOpen, setDiscardOpen] = useState(false);
  const [editorVersion, setEditorVersion] = useState(0);
  const canLeaveRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const form = useForm<ProductDocumentationInput>({
    mode: "uncontrolled",
    validateInputOnBlur: true,
    initialValues: draftData.success ? draftData.data.values : initial,
    onValuesChange: (values) => {
      setCanPersist(writeSessionStored(draftKey, { values, revision: baseRevision }));
      setSaveError("");
    },
    validate: {
      name: (name) => (name.trim() === "" ? "Введите название документа" : null),
      body: (body) => (body.trim() === "" ? "Добавьте текст документа" : null),
    },
  });
  const isDirty = form.isDirty() || hasRestoredDraft;
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && !canLeaveRef.current && currentLocation.pathname !== nextLocation.pathname,
  );
  const isBlocked = blocker.state === "blocked";
  const hasSaveError = saveError !== "";
  const hasConflict = baseRevision !== revision;
  const draftLabel = isDirty ? "Есть несохранённые изменения" : "Изменений нет";
  useBeforeUnload((event) => {
    if (isDirty && !canPersist) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  useHotkeys(
    [
      [
        "mod+Enter",
        () => {
          if (
            !form.submitting &&
            !isBlocked &&
            !isDiscardOpen &&
            document.querySelector('[role="dialog"]') === null
          )
            formRef.current?.requestSubmit();
        },
      ],
    ],
    [],
  );
  /**
   * Сохраняет материал и открывает чтение только после успешной записи.
   */
  const handleSubmit = async (values: ProductDocumentationInput): Promise<void> => {
    setSaveError("");
    try {
      const result = await saveDocumentation({ ...values, id: initial.id }, baseRevision);
      if (!result.isSaved) {
        setSaveError(result.message);
        return;
      }
      canLeaveRef.current = true;
      removeSessionStored(draftKey);
      notifications.show({
        position: "top-center",
        autoClose: 2500,
        title: "Документ сохранён",
        message: "Изменения доступны в этой вкладке прототипа.",
        color: "gray",
        closeButtonProps: { "aria-label": "Закрыть уведомление" },
      });
      navigate(`${base}/documents/${result.id}`, { replace: true, state: { returnTo } });
    } catch {
      setDefect(new Error("Неожиданный сбой редактора документа"));
    }
  };
  /**
   * Переводит фокус на первое поле с ошибкой.
   */
  const handleInvalid = (errors: typeof form.errors): void => {
    const field = Object.keys(errors)[0];
    if (field === undefined) return;
    if (field === "body") {
      // Возвращаем текстовую вкладку, чтобы ошибка не оставалась скрытой в предпросмотре.
      setEditorVersion((current) => current + 1);
      requestAnimationFrame(() =>
        formRef.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus(),
      );
      return;
    }
    const input = form.getInputNode(field);
    if (input !== null) input.focus();
    else formRef.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
  };
  /**
   * Удаляет ввод только после явной отмены.
   */
  const handleDiscard = (): void => {
    canLeaveRef.current = true;
    removeSessionStored(draftKey);
    navigate(backTo, { state: { returnTo } });
  };
  /**
   * Согласует применение текущего ввода к новой ревизии прототипа.
   */
  const handleKeepDraft = (): void => {
    setBaseRevision(revision);
    setCanPersist(writeSessionStored(draftKey, { values: form.getValues(), revision }));
    setSaveError("");
  };
  /**
   * Восстанавливает текущую запись по явному выбору пользователя.
   */
  const handleUseCurrent = (): void => {
    form.setValues(initial);
    form.resetDirty(initial);
    setBaseRevision(revision);
    setRestoredDraft(false);
    setSaveError("");
    removeSessionStored(draftKey);
  };
  if (defect !== undefined) throw defect;
  return (
    <form
      {...rootAttrs}
      ref={formRef}
      className={clsx(styles.root, className)}
      noValidate
      onSubmit={form.onSubmit(handleSubmit, handleInvalid)}
    >
      {hasRestoredDraft && (
        <Alert color="gray" mb="md">
          Восстановлен черновик этой вкладки.
        </Alert>
      )}
      {hasConflict && (
        <Alert color="orange" title="Данные изменились" mb="md">
          Ваш ввод сохранён. Выберите, с какой версией продолжить.
          <Group gap="xs" mt="sm">
            <Button size="xs" variant="default" onClick={handleKeepDraft}>
              Оставить мой ввод
            </Button>
            <Button size="xs" variant="subtle" color="gray" onClick={handleUseCurrent}>
              Загрузить актуальную версию
            </Button>
          </Group>
        </Alert>
      )}
      {!canPersist && (
        <Alert color="orange" role="alert" mb="md">
          Не удалось сохранить черновик в браузере. Не закрывайте страницу до сохранения.
        </Alert>
      )}
      <fieldset className={styles.fields} disabled={form.submitting}>
        <div className={styles.editor}>
          <div className={styles.editorHeading}>
            <FileText size={18} aria-hidden="true" />
            <h2 className={styles.title}>Содержание документа</h2>
            <span className={styles.format}>MARKDOWN</span>
          </div>
          <Stack gap="lg">
            <TextInput
              key={form.key("name")}
              label="Название"
              placeholder="Например, правила бронирования"
              required
              {...form.getInputProps("name")}
            />
            <TextInput
              key={form.key("summary")}
              label="Краткое описание"
              description="Одна-две фразы для карточки в библиотеке."
              placeholder="О чём этот документ и когда к нему обращаться"
              {...form.getInputProps("summary")}
            />
            <MarkdownField
              key={`${form.key("body")}:${editorVersion}`}
              label="Текст документа"
              minRows={16}
              placeholder={
                "## Задача\nЧто должно получиться и для кого.\n\n## Ожидаемое поведение\n1. …\n\n## Критерии приёмки\n- [ ] …"
              }
              {...form.getInputProps("body")}
            />
          </Stack>
        </div>
        <aside className={styles.aside} aria-label="Свойства документа">
          <section className={styles.properties}>
            <h2 className={styles.title}>О документе</h2>
            <NativeSelect
              key={form.key("kind")}
              label="Тип документа"
              data={DOCUMENTATION_KIND_OPTIONS}
              mt="md"
              {...form.getInputProps("kind")}
            />
            <Text size="xs" c="dimmed" lh={1.7} mt="md">
              Выберите формат, чтобы материал было проще найти в библиотеке.
            </Text>
          </section>
          <DocumentScopePicker key={form.key("scopeIds")} {...form.getInputProps("scopeIds")} />
        </aside>
      </fieldset>
      {hasSaveError && (
        <Alert color="red" role="alert" title="Не удалось сохранить" mt="md">
          {saveError}
        </Alert>
      )}
      <footer className={styles.footer}>
        <div>
          <Badge color="gray" variant="light" tt="none" fw={500} role="status">
            {draftLabel}
          </Badge>
          <Text size="xs" c="dimmed" mt={5}>
            Черновик в этой вкладке · Ctrl/⌘ + Enter
          </Text>
        </div>
        <Group gap="xs">
          <Button
            variant="default"
            disabled={form.submitting}
            onClick={() => {
              if (isDirty) setDiscardOpen(true);
              else handleDiscard();
            }}
          >
            Отмена
          </Button>
          <Button
            type="submit"
            loading={form.submitting}
            leftSection={<Check size={16} aria-hidden="true" />}
          >
            Сохранить документ
          </Button>
        </Group>
      </footer>
      <Modal
        opened={isBlocked}
        onClose={() => blocker.reset?.()}
        title="Есть несохранённые изменения"
        centered
        closeButtonProps={{ "aria-label": "Остаться в редакторе" }}
      >
        <Text size="sm">
          Можно продолжить редактирование или перейти дальше с сохранённым черновиком.
        </Text>
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={() => blocker.reset?.()}>
            Остаться
          </Button>
          <Button disabled={!canPersist} onClick={() => blocker.proceed?.()}>
            Перейти с черновиком
          </Button>
        </Group>
      </Modal>
      <Modal
        opened={isDiscardOpen}
        onClose={() => setDiscardOpen(false)}
        title="Отменить правки?"
        centered
        closeButtonProps={{ "aria-label": "Продолжить редактирование" }}
      >
        <Text size="sm">Несохранённый ввод и черновик этого документа будут удалены.</Text>
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={() => setDiscardOpen(false)}>
            Продолжить редактирование
          </Button>
          <Button onClick={handleDiscard}>Отменить правки</Button>
        </Group>
      </Modal>
    </form>
  );
};
