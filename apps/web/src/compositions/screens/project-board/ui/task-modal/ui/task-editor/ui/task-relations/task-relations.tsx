import { useEffect, useRef, useState } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Combobox,
  InputBase,
  useCombobox,
  Select,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDebouncedValue } from "@mantine/hooks";
import { X, Plus, Circle, CheckCircle2, Ban } from "lucide-react";
import {
  BoardTaskError,
  RELATION_LABELS,
  RELATION_SCHEMA,
  TASK_RELATIONS,
  TASK_COLUMNS,
  linkBoardTask,
  useTaskLinks,
  useBoardTasks,
  useBoardTaskRefresh,
  useBoardTask,
} from "domains/board-tasks";
import type { LinkTaskInput } from "domains/board-tasks";
import { useBoards } from "domains/boards";
import { MarkdownView } from "ui/markdown-view";
import { isEmptyArray } from "shared/value-predicates";
import type { TaskRelationsProps } from "./types/task-relations-props.type";
import styles from "./styles/task-relations.module.css";

/**
 * Показывает граф работы и позволяет связать задачи разных досок.
 *
 * Используется для:
 *  - чтения блокеров, обратных зависимостей и декомпозиции
 *  - поиска задачи и добавления или удаления связи
 */
export const TaskRelations = (props: TaskRelationsProps) => {
  const { projectId, task, onOpen, onOwnRevision } = props;
  const [search, setSearch] = useState("");
  const [selectedBoard, setSelectedBoard] = useState<string | null>(task.boardSlug);
  const [isPreviewOpen, setPreviewOpen] = useState(false);
  const [debouncedSearch] = useDebouncedValue(search, 200);
  const [error, setError] = useState("");
  const [defect, setDefect] = useState<unknown>();
  const [isRemoving, setRemoving] = useState(false);
  const [isAdding, setAdding] = useState(false);
  const requests = useRef(new Map<string, string>());
  const searchInput = useRef<HTMLInputElement>(null);
  const boardInput = useRef<HTMLInputElement>(null);
  const dropdown = useRef<HTMLDivElement>(null);
  const query = useTaskLinks(projectId, task.id);
  const boards = useBoards(projectId);
  const hasBoard = selectedBoard !== null;
  const boardItems =
    boards.data
      ?.flatMap((page) => page.items)
      .map((board) => ({ value: board.slug, label: board.name })) ?? [];
  const hasMoreBoards = boards.data !== undefined && boards.data.at(-1)?.nextOffset !== null;
  const candidates = useBoardTasks(
    projectId,
    {
      board: selectedBoard ?? undefined,
      q: debouncedSearch,
      completion: "unfinished",
      searchIn: "title",
    },
    isAdding && hasBoard,
  );
  const refresh = useBoardTaskRefresh(projectId);
  const form = useForm({
    mode: "controlled",
    initialValues: { target: "", relation: "depends-on" },
    validate: { target: (value) => (value === "" ? "Выберите задачу" : null) },
  });
  const selectedTask = useBoardTask(
    projectId,
    isAdding && form.values.target !== "" ? form.values.target : null,
  );
  const taskSelect = useCombobox({
    onDropdownClose: () => {
      taskSelect.resetSelectedOption();
      setSearch("");
    },
  });
  const { resetSelectedOption, updateSelectedOptionIndex } = taskSelect;
  useEffect(() => {
    const activeId = searchInput.current?.getAttribute("aria-activedescendant");
    if (activeId && document.getElementById(activeId) !== null) {
      updateSelectedOptionIndex();
      return;
    }
    resetSelectedOption();
    // Mantine сохраняет прежний ID клавиатурного выбора при смене асинхронных вариантов.
    searchInput.current?.removeAttribute("aria-activedescendant");
  }, [
    resetSelectedOption,
    updateSelectedOptionIndex,
    candidates.data,
    search,
    selectedBoard,
    taskSelect.dropdownOpened,
  ]);
  const previewTitle = selectedTask.data?.title || "Без названия";
  const hasSelection = form.values.target !== "";
  const replacesParent =
    form.values.relation === "child"
      ? selectedTask.data !== undefined &&
        selectedTask.data.parentId !== null &&
        selectedTask.data.parentId !== task.id
      : form.values.relation === "parent" &&
        task.parentId !== null &&
        task.parentId !== form.values.target;
  const items = query.data?.flatMap((page) => page.items) ?? [];
  const isAlreadyLinked = items.some(
    (item) => item.task.id === form.values.target && item.relation === form.values.relation,
  );
  const isSelectedFinished =
    selectedTask.data?.column === "done" || selectedTask.data?.column === "cancelled";
  const canAdd =
    hasSelection && selectedTask.data !== undefined && !isAlreadyLinked && !isSelectedFinished;
  const rows = items.map((entry) => ({
    ...entry,
    title: entry.task.title || "Без названия",
    label: RELATION_LABELS[entry.relation],
    columnLabel: TASK_COLUMNS.find((column) => column.value === entry.task.column)?.label,
    StatusIcon:
      entry.task.column === "done"
        ? CheckCircle2
        : entry.task.column === "cancelled"
          ? Ban
          : Circle,
    statusColor: TASK_COLUMNS.find((column) => column.value === entry.task.column)?.color,
  }));
  const groups = (["parent", "child", "depends-on", "blocks", "related"] as const)
    .map((relation) => [relation, RELATION_LABELS[relation]] as const)
    .map(([relation, label]) => ({
      label:
        relation === "child"
          ? "Дочерние задачи"
          : relation === "parent"
            ? "Родительская задача"
            : label,
      relation,
      isChild: relation === "child",
      items: rows.filter((entry) => entry.relation === relation),
    }))
    .filter((group) => !isEmptyArray(group.items));
  const options =
    candidates.data
      ?.flatMap((page) => page.items)
      .filter(
        (entry) => entry.id !== task.id && entry.column !== "done" && entry.column !== "cancelled",
      )
      .map((entry) => ({
        value: entry.id,
        label: `${entry.key} · ${entry.title || "Без названия"}`,
        title: entry.title || "Без названия",
        key: entry.key,
        board: entry.boardSlug,
        status: TASK_COLUMNS.find((column) => column.value === entry.column)?.label,
        isSelected: form.values.target === entry.id,
        isLinked: items.some(
          (item) => item.task.id === entry.id && item.relation === form.values.relation,
        ),
      })) ?? [];
  const hasNoCandidates =
    isAdding &&
    hasBoard &&
    !candidates.isLoading &&
    candidates.error === undefined &&
    isEmptyArray(options);
  const isEmpty = isEmptyArray(items) && !query.isLoading && query.error === undefined;
  const hasError = error !== "";
  const hasQueryError = query.error !== undefined || candidates.error !== undefined;
  const hasMore = query.data !== undefined && query.data.at(-1)?.nextOffset !== null;
  const hasMoreCandidates =
    candidates.data !== undefined && candidates.data.at(-1)?.nextOffset !== null;
  const isBusy = form.submitting || isRemoving;
  const addLabel = isAdding ? "Свернуть" : "Добавить связь";
  const selectedLabel =
    selectedTask.data === undefined
      ? (options.find((item) => item.value === form.values.target)?.label ?? "")
      : `${selectedTask.data.key} · ${previewTitle}`;
  const inputText = taskSelect.dropdownOpened ? search : selectedLabel;
  const isSearching = candidates.isLoading || search !== debouncedSearch;
  const visibleOptions = isSearching ? [] : options;
  const shouldShowPreview = hasSelection && isPreviewOpen;
  const previewLabel = isPreviewOpen ? "Скрыть описание" : "Посмотреть описание";
  const relationItems = [
    ...TASK_RELATIONS.map((item) => ({
      ...item,
      label: item.value === "parent" ? "Родительская задача" : item.label,
    })),
    { value: "child", label: "Дочерняя задача" },
    { value: "blocks", label: "Блокирует" },
  ].map((item) => ({ ...item, isSelected: item.value === form.values.relation }));
  const relationExplanation = (
    {
      "depends-on": "Текущая задача зависит от выбранной: завершение будет доступно после неё.",
      blocks: "Текущая задача блокирует выбранную: сначала нужно завершить текущую.",
      parent: "Выбранная задача станет родительской для текущей.",
      child: "Выбранная задача станет дочерней для текущей. Это не создаёт блокировку.",
      related: "Смысловая связь без ограничений порядка выполнения.",
    } as Record<string, string>
  )[form.values.relation];
  const children = rows.filter((entry) => entry.relation === "child");
  const cancelledCount = children.filter((entry) => entry.task.column === "cancelled").length;
  const cancelledLabel = cancelledCount > 0 ? ` · ${cancelledCount} отменено` : "";
  const progressLabel = hasMore
    ? "Загружена часть связей"
    : `${children.filter((entry) => entry.task.column === "done").length} из ${children.length} готово${cancelledLabel}`;
  const handleWrite = async (
    id: string,
    input: Omit<LinkTaskInput, "requestId">,
  ): Promise<boolean> => {
    setError("");
    const fingerprint = JSON.stringify([id, input]);
    const requestId = requests.current.get(fingerprint) ?? crypto.randomUUID();
    requests.current.set(fingerprint, requestId);
    try {
      const saved = await linkBoardTask(projectId, id, { ...input, requestId });
      if (id === task.id) onOwnRevision(saved.revision);
      await refresh();
      return true;
    } catch (failure) {
      if (failure instanceof BoardTaskError) setError(failure.message);
      else setDefect(failure);
      return false;
    }
  };
  const handleAdd = async (values: typeof form.values): Promise<void> => {
    if (!canAdd) return;
    const isIncoming = values.relation === "child" || values.relation === "blocks";
    if (isIncoming && selectedTask.data === undefined) return;
    const relation =
      values.relation === "child"
        ? "parent"
        : values.relation === "blocks"
          ? "depends-on"
          : RELATION_SCHEMA.parse(values.relation);
    const isSaved = await handleWrite(isIncoming ? values.target : task.id, {
      target: isIncoming ? task.id : values.target,
      relation,
      ifRevision: isIncoming ? selectedTask.data!.revision : task.revision,
    });
    if (isSaved) {
      form.reset();
      setAdding(false);
    }
  };
  const handleRemove = async (entry: (typeof items)[number]): Promise<void> => {
    setRemoving(true);
    try {
      const isIncoming = entry.relation === "blocks" || entry.relation === "child";
      const relation =
        entry.relation === "blocks"
          ? "depends-on"
          : entry.relation === "child"
            ? "parent"
            : entry.relation;
      await handleWrite(isIncoming ? entry.task.id : task.id, {
        target: isIncoming ? task.id : entry.task.id,
        relation,
        remove: true,
        ifRevision: isIncoming ? entry.task.revision : task.revision,
      });
    } finally {
      setRemoving(false);
    }
  };
  if (defect !== undefined) throw defect;
  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Text fw={600} size="sm">
          Связи с задачами
        </Text>
        <Button
          variant="subtle"
          color="gray"
          size="xs"
          aria-label={addLabel}
          aria-expanded={isAdding}
          onClick={() => {
            setAdding(!isAdding);
            if (!isAdding)
              requestAnimationFrame(() => {
                const input = hasBoard ? searchInput.current : boardInput.current;
                input?.closest("form")?.scrollIntoView({ block: "start" });
              });
          }}
          leftSection={<Plus size={14} />}
        >
          {addLabel}
        </Button>
      </Group>
      {isEmpty && (
        <Text size="sm" c="dimmed">
          Связей пока нет. Добавьте родительскую, дочернюю или связанную задачу.
        </Text>
      )}
      {groups.map((group) => (
        <section key={group.relation}>
          <Group justify="space-between" mt="sm" mb={4}>
            <Text fw={500} size="xs" c="dimmed">
              {group.label}
            </Text>
            {group.isChild && (
              <Text size="xs" c="dimmed">
                {progressLabel}
              </Text>
            )}
          </Group>
          {group.items.map((entry) => (
            <Group
              key={`${entry.relation}:${entry.task.id}`}
              wrap="nowrap"
              align="flex-start"
              gap="xs"
              className={styles.row}
            >
              <entry.StatusIcon size={16} className={styles.statusIcon} aria-hidden="true" />
              <UnstyledButton
                onClick={() => onOpen(entry.task.id, entry.task.boardSlug)}
                className={styles.link}
              >
                <span className={styles.key}>{entry.task.key}</span>
                <span>{entry.title}</span>
              </UnstyledButton>
              <Group gap={4}>
                <Badge
                  size="xs"
                  variant="light"
                  color={entry.statusColor}
                  tt="none"
                  className={styles.status}
                >
                  {entry.columnLabel}
                </Badge>
                {entry.task.blocked && (
                  <Badge size="xs" color="red" variant="light">
                    Заблокирована
                  </Badge>
                )}
              </Group>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                aria-label={`Удалить связь ${entry.task.key}: ${entry.label}`}
                disabled={isBusy}
                onClick={() => void handleRemove(entry)}
              >
                <X size={14} />
              </ActionIcon>
            </Group>
          ))}
        </section>
      ))}
      {hasMore && (
        <Button
          variant="subtle"
          size="xs"
          loading={query.isValidating}
          onClick={() => void query.setSize(query.size + 1).catch(() => undefined)}
        >
          Ещё связи
        </Button>
      )}
      {hasQueryError && (
        <Alert color="red" title="Ошибка чтения связей">
          {query.error?.message ?? candidates.error?.message}
          <Button
            variant="subtle"
            size="xs"
            onClick={() =>
              void Promise.all([
                query.setSize(1).then(() => query.mutate()),
                candidates.setSize(1).then(() => candidates.mutate()),
              ]).catch(() => undefined)
            }
          >
            Повторить
          </Button>
        </Alert>
      )}
      <form hidden={!isAdding} onSubmit={form.onSubmit(handleAdd)}>
        <fieldset className={styles.fields} disabled={isBusy}>
          <Stack gap="md">
            <Group gap={6} role="group" aria-label="Тип связи">
              {relationItems.map((relation) => (
                <UnstyledButton
                  key={relation.value}
                  className={styles.relationType}
                  aria-pressed={relation.isSelected}
                  data-selected={relation.isSelected}
                  disabled={isBusy}
                  onClick={() => form.setFieldValue("relation", relation.value)}
                >
                  {relation.label}
                </UnstyledButton>
              ))}
            </Group>
            <div className={styles.selectors}>
              <Select
                ref={boardInput}
                label="Доска"
                placeholder="Выберите доску"
                searchable
                allowDeselect={false}
                data={boardItems}
                value={selectedBoard}
                disabled={isBusy || boards.isLoading}
                nothingFoundMessage="Доски не найдены"
                onChange={(value) => {
                  setSelectedBoard(value);
                  setSearch("");
                  form.setFieldValue("target", "");
                  setPreviewOpen(false);
                  setError("");
                }}
              />
              <Combobox
                store={taskSelect}
                withinPortal={false}
                onOptionSubmit={(value) => {
                  form.setFieldValue("target", value);
                  setPreviewOpen(false);
                  taskSelect.closeDropdown();
                }}
              >
                <Combobox.Target withExpandedAttribute>
                  <InputBase
                    role="combobox"
                    aria-autocomplete="list"
                    ref={searchInput}
                    label="Задача"
                    placeholder="Выберите задачу"
                    value={inputText}
                    disabled={!hasBoard || isBusy}
                    rightSection={<Combobox.Chevron />}
                    rightSectionPointerEvents="none"
                    onClick={() => taskSelect.openDropdown()}
                    onBlur={(event) => {
                      if (!(
                        event.relatedTarget instanceof Node &&
                        dropdown.current?.contains(event.relatedTarget)
                      ))
                        taskSelect.closeDropdown();
                    }}
                    onChange={(event) => {
                      setSearch(event.currentTarget.value);
                      form.setFieldValue("target", "");
                      setPreviewOpen(false);
                      taskSelect.openDropdown();
                      taskSelect.updateSelectedOptionIndex();
                    }}
                  />
                </Combobox.Target>
                <Combobox.Dropdown
                  ref={dropdown}
                  onBlur={(event) => {
                    if (
                      event.relatedTarget !== searchInput.current &&
                      !(
                        event.relatedTarget instanceof Node &&
                        dropdown.current?.contains(event.relatedTarget)
                      )
                    )
                      taskSelect.closeDropdown();
                  }}
                >
                  <Combobox.Options
                    aria-label="Задачи выбранной доски"
                    className={styles.dropdownOptions}
                    tabIndex={0}
                  >
                    {isSearching && <Combobox.Empty>Ищем задачи…</Combobox.Empty>}
                    {hasNoCandidates && !isSearching && (
                      <Combobox.Empty>Нет подходящих незавершённых задач</Combobox.Empty>
                    )}
                    {visibleOptions.map((option) => (
                      <Combobox.Option
                        key={option.value}
                        value={option.value}
                        disabled={option.isLinked}
                      >
                        <Group gap="xs" wrap="nowrap" justify="space-between">
                          <div className={styles.optionText}>
                            <Text size="xs" c="dimmed">
                              {option.key}
                            </Text>
                            <Text size="sm" lineClamp={2}>
                              {option.title}
                            </Text>
                          </div>
                          <Badge size="xs" variant="light" color="gray" tt="none">
                            {option.status}
                          </Badge>
                        </Group>
                        {option.isLinked && (
                          <Text size="xs" c="dimmed">
                            Такая связь уже есть
                          </Text>
                        )}
                      </Combobox.Option>
                    ))}
                  </Combobox.Options>
                  {hasMoreCandidates && (
                    <Combobox.Footer>
                      <Button
                        variant="subtle"
                        size="xs"
                        fullWidth
                        loading={candidates.isValidating}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          searchInput.current?.focus({ preventScroll: true });
                          void candidates.setSize(candidates.size + 1).catch(() => undefined);
                        }}
                      >
                        Показать ещё задачи
                      </Button>
                    </Combobox.Footer>
                  )}
                </Combobox.Dropdown>
              </Combobox>
            </div>
            {hasMoreBoards && (
              <Button
                size="xs"
                variant="subtle"
                onClick={() => void boards.setSize(boards.size + 1).catch(() => undefined)}
              >
                Ещё доски
              </Button>
            )}
            {boards.error !== undefined && (
              <Alert color="red">
                Не удалось загрузить доски.{" "}
                <Button
                  variant="subtle"
                  onClick={() => void boards.mutate().catch(() => undefined)}
                >
                  Повторить
                </Button>
              </Alert>
            )}
            {hasSelection && (
              <Group justify="space-between" gap="xs">
                <Text size="xs" c="dimmed">
                  {relationExplanation}
                </Text>
                <Button
                  variant="subtle"
                  color="gray"
                  size="xs"
                  onClick={() => setPreviewOpen(!isPreviewOpen)}
                >
                  {previewLabel}
                </Button>
              </Group>
            )}
            {shouldShowPreview && (
              <div className={styles.preview}>
                {selectedTask.isLoading && (
                  <Text role="status" size="sm">
                    Загружаем описание…
                  </Text>
                )}
                {selectedTask.error !== undefined && (
                  <Alert color="red">
                    Не удалось загрузить описание.
                    <Button
                      variant="subtle"
                      onClick={() => void selectedTask.mutate().catch(() => undefined)}
                    >
                      Повторить
                    </Button>
                  </Alert>
                )}
                {selectedTask.data !== undefined && (
                  <Stack gap="sm">
                    <Text size="xs" c="dimmed">
                      {selectedTask.data.key}
                    </Text>
                    <Text fw={600}>{previewTitle}</Text>
                    <MarkdownView
                      text={selectedTask.data.description}
                      emptyText="Описание не заполнено."
                    />
                  </Stack>
                )}
              </div>
            )}
            {hasSelection && (
              <Stack gap="sm">
                {isSelectedFinished && (
                  <Text size="sm" c="dimmed">
                    Задача уже завершена или отменена. Выберите другую.
                  </Text>
                )}
                {isAlreadyLinked && (
                  <Text size="sm" c="dimmed">
                    Такая связь уже установлена. Выберите другой тип.
                  </Text>
                )}
                {replacesParent && (
                  <Alert color="orange">Сохранение заменит прежнюю родительскую связь.</Alert>
                )}
              </Stack>
            )}
            <Group justify="flex-end">
              <Button
                variant="subtle"
                color="gray"
                onClick={() => {
                  setAdding(false);
                  form.reset();
                }}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={!canAdd} loading={form.submitting}>
                Добавить связь
              </Button>
            </Group>
          </Stack>
        </fieldset>
      </form>
      {hasError && (
        <Alert color="red" title="Связь не сохранена">
          {error}
        </Alert>
      )}
    </Stack>
  );
};
