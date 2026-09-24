import { useState } from "react";
import { ActionIcon, Alert, Button, Drawer, Group } from "@mantine/core";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Layers3,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { PLANNING_TASK_LABELS } from "domains/planning-demo";
import type { PlanningTask, PlanStage } from "domains/planning-demo";
import { useProjectId } from "domains/project";
import { MarkdownView } from "ui/markdown-view";
import { isDefined, isEmptyArray } from "shared/value-predicates";
import { PlanTask } from "./ui/plan-task/plan-task";
import { TaskPicker } from "./ui/task-picker";
import { StageForm } from "./ui/stage-form";
import type { PlanStagesProps } from "./types/plan-stages-props.type";
import styles from "./styles/plan-stages.module.css";

/**
 * Организует последовательное чтение этапов и существующих задач.
 *
 * Используется для:
 *  - раскрытия промежуточного результата и актуального состава
 *  - просмотра задачи рядом с её этапом
 */
export const PlanStages = (props: PlanStagesProps) => {
  const { plan, data: demoData, onSave } = props;
  const projectId = useProjectId();
  const [selectedTask, setSelectedTask] = useState<PlanningTask | null>(null);
  const [pickerStageId, setPickerStageId] = useState<string | null>(null);
  const [editingStage, setEditingStage] = useState<PlanStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [taskLimits, setTaskLimits] = useState<Record<string, number>>({});
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({});
  const [stageLimit, setStageLimit] = useState(12);
  const pickerStage = plan.stages.find((stage) => stage.id === pickerStageId);
  const isNewStage =
    isDefined(editingStage) && !plan.stages.some((stage) => stage.id === editingStage.id);
  const draftKey = `relay:planning-stage:v1:${projectId}:${plan.id}:${isNewStage ? "new" : editingStage?.id}`;
  const hasError = isDefined(error);
  const canEdit = plan.status === "draft" || plan.status === "active";
  const stageItems = plan.stages.map((stage, index) => {
    const taskItems = stage.taskIds.flatMap((id) => {
      const taskData = demoData.tasks.find((task) => task.id === id);
      return isDefined(taskData) ? [taskData] : [];
    });
    const done = taskItems.filter((task) => task.status === "done").length;
    const isDone = !isEmptyArray(taskItems) && done === taskItems.length;
    const isActive = taskItems.some((task) => task.status === "active" || task.status === "review");
    const label = isDone ? "Задачи готовы" : isActive ? "В работе" : "Предстоит";
    const limit = taskLimits[stage.id] ?? 12;
    return {
      ...stage,
      taskItems: taskItems.slice(0, limit),
      total: taskItems.length,
      hasMore: taskItems.length > limit,
      done,
      isDone,
      isActive,
      label,
      index: String(index + 1).padStart(2, "0"),
      isEmpty: isEmptyArray(taskItems),
      isExpanded: expandedById[stage.id] ?? (isActive || isEmptyArray(taskItems)),
      isFirst: index === 0,
      isLast: index === plan.stages.length - 1,
    };
  });
  const isEmpty = isEmptyArray(stageItems);
  const visibleStageItems = stageItems.slice(0, stageLimit);
  const hasMoreStages = stageItems.length > stageLimit;
  const hasSelectedTask = isDefined(selectedTask);
  const taskStatus = isDefined(selectedTask) ? PLANNING_TASK_LABELS[selectedTask.status] : "";

  /**
   * Открывает новый этап, не добавляя пустую запись в состав.
   */
  const handleNewStage = () =>
    setEditingStage({ id: crypto.randomUUID(), title: "", outcome: "", taskIds: [] });

  /**
   * Сохраняет состав через одного владельца локального плана.
   */
  const handleStages = (stages: PlanStage[]) => {
    const outcome = onSave({ ...plan, stages });
    setError(outcome);
    return outcome;
  };

  /**
   * Меняет только порядок отображения, без изменения статусов задач.
   */
  const handleReorder = (id: string, direction: number) => {
    const index = plan.stages.findIndex((stage) => stage.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= plan.stages.length) return;
    const stages = [...plan.stages];
    const [moved] = stages.splice(index, 1);
    if (!isDefined(moved)) return;
    stages.splice(target, 0, moved);
    handleStages(stages);
  };

  return (
    <div className={styles.root}>
      <div className={styles.intro}>
        <p>У каждого этапа — свой результат и понятный состав работ.</p>
        {canEdit && (
          <Button
            variant="subtle"
            size="xs"
            leftSection={<Plus size={13} />}
            onClick={handleNewStage}
          >
            Добавить этап
          </Button>
        )}
      </div>
      {hasError && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}
      {isEmpty && (
        <div className={styles.empty}>
          <Layers3 size={28} strokeWidth={1.3} />
          <h2>Наметьте первый этап</h2>
          <p>Начните с ближайшего результата. Даже небольшому плану достаточно одного этапа.</p>
        </div>
      )}
      <div className={styles.timeline}>
        {visibleStageItems.map((stage) => (
          <details
            key={stage.id}
            className={styles.stage}
            open={stage.isExpanded}
            data-done={stage.isDone}
            data-active={stage.isActive}
            onToggle={(event) => {
              const isOpen = event.currentTarget.open;
              setExpandedById((previous) =>
                previous[stage.id] === isOpen ? previous : { ...previous, [stage.id]: isOpen },
              );
            }}
          >
            <summary className={styles.stageHeader}>
              <span className={styles.marker} data-done={stage.isDone} data-active={stage.isActive}>
                {stage.isDone && <Check size={17} />}
                {!stage.isDone && <span>{stage.index}</span>}
              </span>
              <span className={styles.stageIdentity}>
                <span className={styles.stageTitle}>{stage.title}</span>
                <span className={styles.stageMeta}>
                  {stage.label}
                  <span className={styles.metaDivider} aria-hidden="true">
                    ·
                  </span>
                  {stage.done} из {stage.total} задач
                </span>
              </span>
              <span className={styles.miniProgress} aria-hidden="true">
                <span style={{ width: `${(stage.done / Math.max(stage.total, 1)) * 100}%` }} />
              </span>
              <ChevronDown
                size={16}
                className={styles.chevron}
                data-open={stage.isExpanded}
                aria-hidden="true"
              />
            </summary>
            <div className={styles.stageBody}>
              <div className={styles.outcome}>
                <span className={styles.outcomeLabel}>РЕЗУЛЬТАТ ЭТАПА</span>
                <MarkdownView
                  text={stage.outcome}
                  compact
                  emptyText="Результат этапа ещё не описан."
                />
              </div>
              <div
                className={styles.taskList}
                role="group"
                aria-label={`Задачи этапа «${stage.title}»`}
              >
                {stage.taskItems.map((task) => (
                  <PlanTask key={task.id} task={task} onOpen={() => setSelectedTask(task)} />
                ))}
              </div>
              {stage.isEmpty && (
                <p className={styles.noTasks}>
                  Задач пока нет. Выберите существующие задачи с любой доски.
                </p>
              )}
              {stage.hasMore && (
                <Button
                  variant="subtle"
                  size="xs"
                  fullWidth
                  onClick={() =>
                    setTaskLimits((previous) => ({
                      ...previous,
                      [stage.id]: (previous[stage.id] ?? 12) + 12,
                    }))
                  }
                >
                  Показать ещё · {stage.taskItems.length} из {stage.total}
                </Button>
              )}
              {canEdit && (
                <div className={styles.stageActions}>
                  <Button
                    variant="subtle"
                    size="xs"
                    leftSection={<Plus size={13} />}
                    onClick={() => setPickerStageId(stage.id)}
                  >
                    Выбрать задачи
                  </Button>
                  <Group gap={2}>
                    <ActionIcon
                      aria-label={`Изменить этап «${stage.title}»`}
                      onClick={() => setEditingStage(stage)}
                    >
                      <Pencil size={13} />
                    </ActionIcon>
                    <ActionIcon
                      disabled={stage.isFirst}
                      aria-label={`Поднять этап «${stage.title}»`}
                      onClick={() => handleReorder(stage.id, -1)}
                    >
                      <ArrowUp size={13} />
                    </ActionIcon>
                    <ActionIcon
                      disabled={stage.isLast}
                      aria-label={`Опустить этап «${stage.title}»`}
                      onClick={() => handleReorder(stage.id, 1)}
                    >
                      <ArrowDown size={13} />
                    </ActionIcon>
                    {stage.isEmpty && (
                      <ActionIcon
                        aria-label={`Удалить пустой этап «${stage.title}»`}
                        color="red"
                        onClick={() =>
                          handleStages(plan.stages.filter((candidate) => candidate.id !== stage.id))
                        }
                      >
                        <Trash2 size={13} />
                      </ActionIcon>
                    )}
                  </Group>
                </div>
              )}
            </div>
          </details>
        ))}
      </div>
      {hasMoreStages && (
        <Button variant="default" fullWidth mt="md" onClick={() => setStageLimit(stageLimit + 12)}>
          Показать ещё этапы · {visibleStageItems.length} из {stageItems.length}
        </Button>
      )}
      <p className={styles.footnote}>
        Порядок этапов показывает маршрут. Он не запрещает параллельную работу.
      </p>
      {isDefined(pickerStage) && (
        <TaskPicker
          key={`picker-${pickerStage.id}`}
          plan={plan}
          stage={pickerStage}
          data={demoData}
          onClose={() => setPickerStageId(null)}
          onApply={(taskIds) =>
            handleStages(
              plan.stages.map((stage) =>
                stage.id === pickerStage.id ? { ...stage, taskIds } : stage,
              ),
            )
          }
        />
      )}
      {isDefined(editingStage) && (
        <StageForm
          key={`editor-${editingStage.id}`}
          stage={editingStage}
          isNew={isNewStage}
          draftKey={draftKey}
          onClose={() => setEditingStage(null)}
          onSave={(stage) =>
            handleStages(
              isNewStage
                ? [...plan.stages, stage]
                : plan.stages.map((candidate) => (candidate.id === stage.id ? stage : candidate)),
            )
          }
        />
      )}
      <Drawer
        attributes={{ header: { role: "presentation" } }}
        opened={hasSelectedTask}
        onClose={() => setSelectedTask(null)}
        position="right"
        size="lg"
        title="Задача в плане"
        closeButtonProps={{ "aria-label": "Закрыть задачу" }}
      >
        {isDefined(selectedTask) && (
          <div className={styles.taskPreview}>
            <div className={styles.previewMeta}>
              {selectedTask.key} · {selectedTask.board} · {taskStatus}
            </div>
            <h2>{selectedTask.title}</h2>
            <MarkdownView text={selectedTask.description} />
            <p className={styles.footnote}>
              Пример задачи для оценки интерфейса. Исходная доска и колонка сохраняются при
              включении в план.
            </p>
          </div>
        )}
      </Drawer>
    </div>
  );
};
