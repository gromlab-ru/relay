import { useState } from "react";
import { Alert, Button, Checkbox, Group, Modal, Select, Switch, TextInput } from "@mantine/core";
import { Search } from "lucide-react";
import { z } from "zod";
import { PLANNING_TASK_LABELS } from "domains/planning-demo";
import { useProjectId } from "domains/project";
import { readSessionStored, removeSessionStored, writeSessionStored } from "infra/browser-storage";
import { isDefined, isEmptyArray } from "shared/value-predicates";
import type { TaskPickerProps } from "./types/task-picker-props.type";
import styles from "./styles/task-picker.module.css";

/**
 * Выбирает существующие задачи, сохраняя отмеченные строки вне фильтра.
 *
 * Используется для:
 *  - комплектования этапа задачами нескольких досок
 *  - явного подтверждения локального состава
 */
export const TaskPicker = (props: TaskPickerProps) => {
  const { plan, stage, data: demoData, onClose, onApply } = props;
  const projectId = useProjectId();
  const storageKey = `relay:planning-selection:v1:${projectId}:${plan.id}:${stage.id}`;
  const [selectedIds, setSelectedIds] = useState(() => {
    const parsed = z.array(z.string()).safeParse(readSessionStored(storageKey));
    return parsed.success ? parsed.data : stage.taskIds;
  });
  const [query, setQuery] = useState("");
  const [board, setBoard] = useState("all");
  const [isAvailableOnly, setAvailableOnly] = useState(true);
  const [limit, setLimit] = useState(12);
  const [error, setError] = useState<string | null>(null);
  const [canPersist, setCanPersist] = useState(true);
  const assignments = new Map(
    demoData.plans
      .filter((candidate) => candidate.status !== "cancelled")
      .flatMap((candidate) =>
        candidate.stages
          .filter((candidateStage) => candidate.id !== plan.id || candidateStage.id !== stage.id)
          .flatMap((candidateStage) =>
            candidateStage.taskIds.map(
              (id) => [id, `${candidate.key} · ${candidateStage.title}`] as const,
            ),
          ),
      ),
  );
  const boardItems = [
    { value: "all", label: "Все доски" },
    ...Array.from(new Set(demoData.tasks.map((task) => task.board))).map((name) => ({
      value: name,
      label: name,
    })),
  ];
  const filteredItems = demoData.tasks.filter(
    (task) =>
      (board === "all" || task.board === board) &&
      `${task.title} ${task.key}`.toLocaleLowerCase("ru").includes(query.toLocaleLowerCase("ru")) &&
      (!isAvailableOnly || !assignments.has(task.id)),
  );
  const taskItems = filteredItems.slice(0, limit).map((task) => ({
    ...task,
    isSelected: selectedIds.includes(task.id),
    isUnavailable: assignments.has(task.id),
    assignment: assignments.get(task.id),
    statusLabel: PLANNING_TASK_LABELS[task.status],
  }));
  const hiddenCount = selectedIds.filter((id) => !taskItems.some((task) => task.id === id)).length;
  const hasHiddenSelection = hiddenCount > 0;
  const hasMore = filteredItems.length > limit;
  const isEmpty = isEmptyArray(taskItems);
  const hasError = isDefined(error);
  const hasSelection = !isEmptyArray(selectedIds);

  /**
   * Изменяет полный выбор, а не только видимую страницу.
   */
  const handleSelection = (nextIds: string[]) => {
    setSelectedIds(nextIds);
    setCanPersist(writeSessionStored(storageKey, nextIds));
    setError(null);
  };

  /**
   * Подтверждает весь выбранный набор одним локальным действием владельца этапа.
   */
  const handleApply = () => {
    const outcome = onApply(selectedIds);
    if (outcome !== null) {
      setError(outcome);
      return;
    }
    removeSessionStored(storageKey);
    onClose();
  };

  return (
    <Modal
      attributes={{ header: { role: "presentation" } }}
      opened
      onClose={onClose}
      title="Выбрать задачи"
      size="lg"
      closeButtonProps={{ "aria-label": "Свернуть выбор задач" }}
      classNames={{ title: styles.modalTitle, body: styles.modalBody }}
    >
      <div className={styles.root}>
        <div className={styles.destination}>
          <span>ЭТАП</span>
          <strong>{stage.title}</strong>
          <p>Задачи сохраняют свою доску и колонку.</p>
        </div>
        <div className={styles.toolbar}>
          <TextInput
            className={styles.search}
            placeholder="Название или ключ задачи"
            aria-label="Поиск задач"
            leftSection={<Search size={14} />}
            value={query}
            onChange={(event) => {
              setQuery(event.currentTarget.value);
              setLimit(12);
            }}
          />
          <Select
            className={styles.board}
            aria-label="Доска задач"
            data={boardItems}
            value={board}
            onChange={(next) => {
              setBoard(next ?? "all");
              setLimit(12);
            }}
            allowDeselect={false}
          />
        </div>
        <div className={styles.options}>
          <Switch
            label="Только свободные задачи"
            size="xs"
            checked={isAvailableOnly}
            onChange={(event) => {
              setAvailableOnly(event.currentTarget.checked);
              setLimit(12);
            }}
          />
          <span role="status">Найдено: {filteredItems.length}</span>
        </div>
        <div className={styles.list}>
          {taskItems.map((task) => (
            <label
              className={styles.task}
              key={task.id}
              data-selected={task.isSelected}
              data-disabled={task.isUnavailable}
            >
              <Checkbox
                checked={task.isSelected}
                disabled={task.isUnavailable}
                aria-label={`Выбрать ${task.key}`}
                size="xs"
                onChange={(event) =>
                  handleSelection(
                    event.currentTarget.checked
                      ? [...selectedIds, task.id]
                      : selectedIds.filter((id) => id !== task.id),
                  )
                }
              />
              <span className={styles.taskBody}>
                <span className={styles.taskTitle}>{task.title}</span>
                <span className={styles.taskMeta}>
                  <span className={styles.key}>{task.key}</span>
                  {task.board}
                  <span>{task.statusLabel}</span>
                </span>
                {task.isUnavailable && (
                  <span className={styles.assignment}>В плане {task.assignment}</span>
                )}
              </span>
            </label>
          ))}
          {isEmpty && (
            <div className={styles.empty}>
              <Search size={22} />
              <strong>Задачи не найдены</strong>
              <span>Измените запрос, доску или включите занятые задачи.</span>
            </div>
          )}
          {hasMore && (
            <Button variant="subtle" fullWidth onClick={() => setLimit(limit + 12)}>
              Показать ещё · {taskItems.length} из {filteredItems.length}
            </Button>
          )}
        </div>
        {!canPersist && (
          <Alert color="orange">
            Выбор не удалось сохранить в черновике. Примените его, прежде чем закрыть окно.
          </Alert>
        )}
        {hasError && <Alert color="red">{error}</Alert>}
        <footer className={styles.footer}>
          <div className={styles.selection} role="status">
            <strong>Выбрано: {selectedIds.length}</strong>
            {hasHiddenSelection && <span>Вне текущего списка: {hiddenCount}</span>}
            {hasSelection && (
              <button type="button" onClick={() => handleSelection([])}>
                Снять выбор
              </button>
            )}
          </div>
          <Group gap="xs">
            <Button variant="default" onClick={onClose}>
              Свернуть
            </Button>
            <Button onClick={handleApply}>Применить</Button>
          </Group>
        </footer>
      </div>
    </Modal>
  );
};
