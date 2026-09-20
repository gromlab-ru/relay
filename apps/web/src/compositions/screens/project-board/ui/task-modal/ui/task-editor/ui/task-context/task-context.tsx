import clsx from "clsx";
import { useRef, useState } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  NativeSelect,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { ArrowLeft, FileText, Plus, X, Layers } from "lucide-react";
import {
  useProductEntities,
  useProductEntity,
  useProductTargetSearch,
  useProductContext,
  getProductTargetOptions,
  ProductKey,
} from "domains/product";
import { useDebouncedValue } from "@mantine/hooks";
import { BoardTaskError, updateBoardTask, useBoardTaskRefresh } from "domains/board-tasks";
import { MarkdownView } from "ui/markdown-view";
import { isEmptyArray } from "shared/value-predicates";
import type { TaskContextProps } from "./types/task-context-props.type";
import styles from "./styles/task-context.module.css";

/**
 * Связывает работу с постоянными требованиями продукта.
 *
 * Используется для:
 *  - выбора общих фич, сценариев и контрактов приложений
 *  - чтения требований и документов без вложенных модальных окон
 */
export const TaskContext = (props: TaskContextProps) => {
  const { projectId, task, onOwnRevision, className, ...rootAttrs } = props;
  const [isChoosing, setChoosing] = useState(false);
  const [mode, setMode] = useState("general");
  const [application, setApplication] = useState("");
  const [search, setSearch] = useState("");
  const [isContextOpen, setContextOpen] = useState(false);
  const [visibleLinks, setVisibleLinks] = useState(5);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [defect, setDefect] = useState<unknown>();
  const [isRemoving, setRemoving] = useState(false);
  const request = useRef<{ fingerprint: string; id: string } | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [debouncedSearch] = useDebouncedValue(search, 200);
  const candidateKind =
    mode === "application"
      ? "implementation"
      : mode === "scenario" || /^SCENARIO-/i.test(debouncedSearch)
        ? "scenario"
        : "feature";
  const product = useProductTargetSearch(
    projectId,
    isChoosing
      ? {
          kind: candidateKind,
          q: debouncedSearch,
          active: "true",
          ...(application === "" || mode !== "application" ? {} : { application }),
        }
      : null,
  );
  const context = useProductContext(projectId, isContextOpen ? selectedId : null);
  const details = useProductEntity(projectId, selectedId);
  const refresh = useBoardTaskRefresh(projectId);
  const form = useForm({
    mode: "uncontrolled",
    initialValues: { ids: [] as string[], revision: task.revision },
  });
  const selectedIds = form.useWatchValue("ids");
  const linkRefs = [
    ...new Set([
      ...task.productLinks.map((link) => link.id),
      ...selectedIds,
      ...(selectedId === null ? [] : [selectedId]),
    ]),
  ];
  const linked = useProductEntities(
    projectId,
    isEmptyArray(linkRefs) ? null : { refs: linkRefs, limit: 100 },
  );
  const appQuery = useProductTargetSearch(
    projectId,
    isChoosing && mode === "application" ? { kind: "application" } : null,
  );
  const applications = appQuery.items.map((entry) => ({
    value: entry.id,
    label: `${entry.key ?? ""} · ${entry.title}`,
  }));
  const options = getProductTargetOptions([...product.items, ...(linked.data?.items ?? [])]);
  const candidateItems = getProductTargetOptions(product.items).map((option) => ({
    ...option,
    isSelected: selectedIds.includes(option.id),
  }));
  const linkedItems = task.productLinks.slice(0, visibleLinks).map((link) => {
    const option = options.find((item) => item.id === link.id && item.targetKind === link.kind);
    return {
      ...link,
      key: option?.key,
      title: option?.title ?? link.id,
      path: option?.path ?? "Продуктовая цель недоступна",
      label: option?.kind ?? "Связь",
      isInactive: option !== undefined && !option.isActive,
    };
  });
  const selectedOption = options.find((item) => item.id === selectedId);
  const detailFields = details.data?.fields;
  const selected =
    selectedOption === undefined
      ? undefined
      : {
          ...selectedOption,
          description:
            detailFields === undefined || detailFields.kind === "scope"
              ? ""
              : detailFields.kind === "document"
                ? detailFields.body
                : detailFields.description,
        };
  const entryItems =
    context.data?.records.flatMap(({ record, reasons }) => {
      const fields = record.fields;
      const labels: Record<string, string> = {
        product: "продукт",
        feature: "фичу",
        scenario: "сценарий",
        application: "приложение",
        implementation: "реализацию",
      };
      const explanation = reasons
        .map((reason) => {
          const kind = /^Связь: ([a-z]+)/.exec(reason)?.[1];
          return kind === undefined ? reason : `Через ${labels[kind] ?? kind}`;
        })
        .join(" · ");
      if (fields.kind === "scope")
        return fields.contracts
          .filter((contract) => contract.id === selectedId)
          .map((contract) => ({
            id: contract.id,
            title: contract.title,
            text: contract.description,
            explanation,
          }));
      return [
        {
          id: record.id,
          title: fields.name,
          text: fields.kind === "document" ? fields.body : fields.description,
          explanation,
        },
      ];
    }) ?? [];
  const current = entryItems.find((entry) => entry.id === documentId);
  const hasCurrent = current !== undefined;
  const hasSelection = selectedId !== null;
  const shouldShowMaterials = hasSelection && !isChoosing;
  const hasPreview = selected !== undefined;
  const hasMore = product.hasMore;
  const hasMoreLinks = task.productLinks.length > visibleLinks;
  const isEmpty = isEmptyArray(task.productLinks);
  const hasLinks = !isEmpty;
  const isEmptySearch =
    isEmptyArray(candidateItems) &&
    !product.isLoading &&
    !product.isValidating &&
    product.error === undefined;
  const hasError = error !== "";
  const hasStale = context.data?.readiness.some((item) => item.stale > 0) === true;
  const isBusy = form.submitting || isRemoving;
  const isApplicationMode = mode === "application";
  const handleSave = async (
    links: typeof task.productLinks,
    revision: number,
  ): Promise<boolean> => {
    setError("");
    const fingerprint = JSON.stringify([links, revision]);
    if (request.current?.fingerprint !== fingerprint)
      request.current = { fingerprint, id: crypto.randomUUID() };
    try {
      const saved = await updateBoardTask(projectId, task.id, {
        productLinks: links,
        ifRevision: revision,
        requestId: request.current.id,
      });
      onOwnRevision(saved.revision);
      await refresh();
      return true;
    } catch (failure) {
      if (failure instanceof BoardTaskError) setError(failure.message);
      else setDefect(failure);
      return false;
    }
  };
  const handleSubmit = async (values: typeof form.values): Promise<void> => {
    const links = values.ids.map((id) => {
      const existing = task.productLinks.find((link) => link.id === id);
      const option = options.find((item) => item.id === id);
      if (existing) return existing;
      if (!option) throw new Error("Выбранная продуктовая цель отсутствует");
      return { id, kind: option.targetKind };
    });
    if (await handleSave(links, values.revision)) {
      setChoosing(false);
      setSelectedId(null);
    }
  };
  const handleChoose = (): void => {
    form.setValues({ ids: task.productLinks.map((link) => link.id), revision: task.revision });
    setChoosing(true);
    requestAnimationFrame(() => {
      searchInput.current?.closest("form")?.scrollIntoView({ block: "start" });
      searchInput.current?.focus({ preventScroll: true });
    });
    setSelectedId(null);
    setError("");
  };
  const handleRemove = async (id: string): Promise<void> => {
    setRemoving(true);
    try {
      await handleSave(
        task.productLinks.filter((link) => link.id !== id),
        task.revision,
      );
    } finally {
      setRemoving(false);
    }
  };
  if (defect !== undefined) throw defect;
  return (
    <div {...rootAttrs} className={clsx(styles.root, className)}>
      <Group justify="space-between" mb="sm">
        <Group gap="xs">
          <Text fw={600} size="sm">
            Реализует в продукте
          </Text>
          {hasLinks && (
            <Badge variant="light" color="gray" size="sm">
              {task.productLinks.length}
            </Badge>
          )}
        </Group>
        <Button
          size="xs"
          variant="subtle"
          color="gray"
          leftSection={<Plus size={14} />}
          onClick={handleChoose}
          disabled={isBusy}
        >
          Связать
        </Button>
      </Group>
      {isEmpty && (
        <Text size="sm" c="dimmed">
          Свяжите задачу с фичей, сценарием или вкладом приложения.
        </Text>
      )}
      <Stack gap="xs">
        {linkedItems.map((item) => (
          <Group key={item.id} wrap="nowrap" className={styles.option}>
            <span className={styles.symbol}>
              <Layers size={17} />
            </span>
            <UnstyledButton
              flex={1}
              className={styles.target}
              onClick={() => {
                setSelectedId(item.id);
                setDocumentId(null);
              }}
            >
              <Text size="xs" c="dimmed">
                {item.label} · {item.path}
              </Text>
              <Text size="sm" fw={600} mt={4}>
                {item.title}
              </Text>
              <ProductKey value={item.key} />
              {item.isInactive && (
                <Text size="xs" c="orange">
                  Участие приложения снято
                </Text>
              )}
            </UnstyledButton>
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label={`Удалить продуктовую связь ${item.title}`}
              disabled={isBusy || isChoosing}
              onClick={() => void handleRemove(item.id)}
            >
              <X size={14} />
            </ActionIcon>
          </Group>
        ))}
      </Stack>
      {hasMoreLinks && (
        <Button variant="subtle" size="xs" onClick={() => setVisibleLinks(visibleLinks + 10)}>
          Ещё связи с продуктом
        </Button>
      )}
      {isChoosing && (
        <form onSubmit={form.onSubmit(handleSubmit)} className={styles.chooser}>
          <Stack gap="md">
            <SegmentedControl
              value={mode}
              onChange={(value) => {
                setMode(value);
              }}
              data={[
                { value: "general", label: "Фичи" },
                { value: "scenario", label: "Сценарии" },
                { value: "application", label: "Реализации" },
              ]}
            />
            {isApplicationMode && (
              <NativeSelect
                label="Приложение"
                value={application}
                onChange={(event) => {
                  setApplication(event.currentTarget.value);
                }}
                data={[{ value: "", label: "Все приложения" }, ...applications]}
              />
            )}
            <TextInput
              ref={searchInput}
              label="Найти фичу или сценарий"
              placeholder="Ключ или название, например WEB-FI-12"
              value={search}
              onChange={(event) => {
                setSearch(event.currentTarget.value);
              }}
            />
            {appQuery.hasMore && (
              <Button
                variant="subtle"
                size="xs"
                onClick={() => void appQuery.setSize(appQuery.size + 1)}
              >
                Ещё приложения
              </Button>
            )}
            {product.isLoading && (
              <Text role="status" size="sm" c="dimmed">
                Ищем продуктовые цели…
              </Text>
            )}
            {isEmptySearch && (
              <Text c="dimmed" size="sm">
                Подходящих целей нет. Состав приложения задаётся в разделе «Продукт».
              </Text>
            )}
            <div className={styles.picker}>
              <Stack gap="sm" className={styles.results}>
                {candidateItems.map((item) => (
                  <Group key={item.id} wrap="nowrap" className={styles.option}>
                    <Checkbox
                      aria-label={`Выбрать ${item.title}`}
                      checked={item.isSelected}
                      disabled={isBusy}
                      onChange={(event) =>
                        form.setFieldValue(
                          "ids",
                          event.currentTarget.checked
                            ? [...selectedIds, item.id]
                            : selectedIds.filter((id) => id !== item.id),
                        )
                      }
                    />
                    <UnstyledButton
                      flex={1}
                      onClick={() => {
                        setSelectedId(item.id);
                        setDocumentId(null);
                      }}
                    >
                      <Text size="sm" fw={600}>
                        {item.title}
                      </Text>
                      <ProductKey value={item.key} />
                      <Text size="xs" c="dimmed">
                        {item.kind} · {item.path}
                      </Text>
                    </UnstyledButton>
                  </Group>
                ))}
              </Stack>
              <div className={styles.preview}>
                {!hasPreview && (
                  <Stack gap="sm">
                    <FileText size={22} />
                    <Text size="sm" fw={500}>
                      Сначала прочитайте требования
                    </Text>
                    <Text size="xs" c="dimmed">
                      Нажмите на название цели. Отметьте подходящие фичи и сценарии, затем сохраните
                      связи.
                    </Text>
                  </Stack>
                )}
                {hasPreview && (
                  <Stack gap="sm">
                    <Text size="xs" c="dimmed">
                      {selected.path}
                    </Text>
                    <Text fw={600} size="sm">
                      {selected.title}
                    </Text>
                    <ProductKey value={selected.key} />
                    {details.isLoading && (
                      <Text size="sm" role="status">
                        Загружаем описание…
                      </Text>
                    )}
                    <MarkdownView
                      text={selected.description}
                      emptyText="Описание пока не заполнено."
                    />
                  </Stack>
                )}
              </div>
            </div>
            {hasMore && (
              <Button
                variant="subtle"
                loading={product.isValidating}
                onClick={() => void product.setSize(product.size + 1)}
              >
                Показать ещё цели
              </Button>
            )}
            <Group justify="space-between">
              <Text size="xs" c="dimmed">
                Выбрано: {selectedIds.length}
              </Text>
              <Group gap="xs">
                <Button
                  variant="subtle"
                  onClick={() => {
                    setChoosing(false);
                    setSelectedId(null);
                  }}
                  disabled={isBusy}
                >
                  Отмена
                </Button>
                <Button type="submit" loading={form.submitting}>
                  Сохранить связи
                </Button>
              </Group>
            </Group>
          </Stack>
        </form>
      )}
      {hasError && (
        <Alert color="red" mt="sm" title="Связи не сохранены">
          {error}
        </Alert>
      )}
      {product.error !== undefined && (
        <Alert color="red" mt="sm">
          Продукт недоступен.{" "}
          <Button variant="subtle" onClick={() => void product.mutate().catch(() => undefined)}>
            Повторить
          </Button>
        </Alert>
      )}
      {linked.error !== undefined && (
        <Alert color="red" mt="sm">
          Не удалось прочитать сведения о связях.{" "}
          <Button variant="subtle" onClick={() => void linked.mutate()}>
            Повторить
          </Button>
        </Alert>
      )}
      {details.error !== undefined && (
        <Alert color="red" mt="sm">
          Описание недоступно.{" "}
          <Button variant="subtle" onClick={() => void details.mutate()}>
            Повторить
          </Button>
        </Alert>
      )}
      {shouldShowMaterials && (
        <section className={styles.chooser}>
          <Group justify="space-between" mb="md">
            <Text fw={600}>{selected?.title ?? "Материалы контекста"}</Text>
            <ActionIcon
              aria-label="Закрыть материалы"
              variant="subtle"
              onClick={() => setSelectedId(null)}
            >
              <X size={16} />
            </ActionIcon>
          </Group>
          {context.isLoading && <Text role="status">Загружаем требования…</Text>}
          {context.error !== undefined && (
            <Alert color="red">
              Не удалось прочитать контекст.{" "}
              <Button variant="subtle" onClick={() => void context.mutate().catch(() => undefined)}>
                Повторить
              </Button>
            </Alert>
          )}
          {hasStale && (
            <Alert color="orange" mb="sm">
              Требования изменились: есть устаревшие подтверждения реализации.
            </Alert>
          )}
          {selected !== undefined && (
            <MarkdownView
              text={selected.description}
              emptyText="Описание цели пока не заполнено."
            />
          )}
          {!isContextOpen && (
            <Button variant="subtle" size="sm" mt="sm" onClick={() => setContextOpen(true)}>
              Показать связанные требования и документы
            </Button>
          )}
          <Stack gap="xs" mt="md">
            {entryItems.map((entry) => (
              <UnstyledButton
                key={entry.id}
                className={styles.option}
                onClick={() => setDocumentId(entry.id)}
              >
                <Group gap="xs">
                  <FileText size={16} />
                  <Text size="sm" fw={500}>
                    {entry.title}
                  </Text>
                </Group>
                <Text size="xs" c="dimmed">
                  {entry.explanation}
                </Text>
              </UnstyledButton>
            ))}
          </Stack>
          {hasCurrent && (
            <Stack gap="md" mt="md">
              <Button
                variant="subtle"
                leftSection={<ArrowLeft size={14} />}
                onClick={() => setDocumentId(null)}
              >
                Свернуть материал
              </Button>
              <Text fw={600}>{current.title}</Text>
              <MarkdownView text={current.text} emptyText="Описание не заполнено." />
            </Stack>
          )}
        </section>
      )}
    </div>
  );
};
