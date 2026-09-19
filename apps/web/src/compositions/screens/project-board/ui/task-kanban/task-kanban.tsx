import { useCallback, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensors,
  useSensor,
} from "@dnd-kit/core";
import type {
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  CollisionDetection,
} from "@dnd-kit/core";
import { Alert, Box, Text } from "@mantine/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useReducedMotion } from "@mantine/hooks";
import {
  BoardTaskError,
  KANBAN_COLUMNS,
  TASK_COLUMNS,
  COLUMN_SCHEMA,
  TASK_SUMMARY_SCHEMA,
  moveBoardTask,
  useBoardTaskRefresh,
} from "domains/board-tasks";
import type { TaskSummary, TaskColumn as ColumnId, TasksPage } from "domains/board-tasks";
import { TaskColumn, TaskCardPreview } from "./ui/task-column";
import { getBoardCollisions, getKeyboardCoordinates } from "ui/kanban-dnd";
import type { TaskKanbanProps } from "./types/task-kanban-props.type";
import styles from "./styles/task-kanban.module.css";

/**
 * Координирует перенос задач с видимым местом вставки и сохранением ревизии.
 *
 * Используется для:
 *  - переноса мышью, удержанием на сенсорном экране и клавиатурой
 *  - отображения ошибок записи без потери подтверждённого порядка
 */
export const TaskKanban = (props: TaskKanbanProps) => {
  const { projectId, filters, showCancelled, onOpen, onCreate } = props;
  const boardRef = useRef<HTMLDivElement>(null);
  const detectCollisions: CollisionDetection = (args) => {
    const rect = boardRef.current?.getBoundingClientRect();
    const pointer = args.pointerCoordinates;
    if (
      rect !== undefined &&
      pointer !== null &&
      (pointer.x < rect.left ||
        pointer.x > rect.right ||
        pointer.y < rect.top ||
        pointer.y > rect.bottom)
    )
      return [];
    return getBoardCollisions(args);
  };
  const [active, setActive] = useState<{
    task: TaskSummary;
    version: string;
    width: number;
    height: number;
  } | null>(null);
  const snapshots = useRef(new Map<ColumnId, TasksPage>());
  const nextIds = useRef(new Map<ColumnId, string | null>());
  const dragPages = useRef(new Map<ColumnId, TasksPage>());
  const dragNextIds = useRef(new Map<ColumnId, string | null>());
  const [preview, setPreview] = useState<Map<ColumnId, TaskSummary[]> | null>(null);
  const previewRef = useRef<Map<ColumnId, TaskSummary[]> | null>(null);
  const handleSnapshot = useCallback(
    (column: ColumnId, page: TasksPage, nextId: string | null): void => {
      snapshots.current.set(column, page);
      nextIds.current.set(column, nextId);
    },
    [],
  );
  const updatePreview = (next: Map<ColumnId, TaskSummary[]> | null): void => {
    previewRef.current = next;
    setPreview(next);
  };
  const [targetId, setTargetId] = useState<string | null>(null);
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [defect, setDefect] = useState<unknown>();
  const refresh = useBoardTaskRefresh(projectId);
  const shouldReduceMotion = useReducedMotion();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: (event, args) =>
        getKeyboardCoordinates(
          event,
          args,
          TASK_COLUMNS.map((column) => column.value),
        ),
    }),
  );
  const columns = showCancelled ? TASK_COLUMNS : KANBAN_COLUMNS;
  const columnItems = columns.map((column) => {
    const items = preview?.get(column.value);
    const original = dragPages.current.get(column.value);
    const total =
      items !== undefined && original !== undefined
        ? original.total + items.length - original.items.length
        : undefined;
    return { column, items, total };
  });
  const hasError = error !== "";
  const dropAnimation = shouldReduceMotion ? null : { duration: 180, easing: "ease-out" };
  const handleStart = (event: DragStartEvent): void => {
    const task = TASK_SUMMARY_SCHEMA.safeParse(event.active.data.current?.task);
    const version = event.active.data.current?.version;
    if (task.success && typeof version === "string") {
      const rect = event.active.rect.current.initial;
      dragPages.current = new Map(snapshots.current);
      dragNextIds.current = new Map(nextIds.current);
      setActive({
        task: task.data,
        version,
        width: rect?.width ?? 288,
        height: rect?.height ?? 100,
      });
      updatePreview(
        new Map([...snapshots.current].map(([column, page]) => [column, [...page.items]])),
      );
    }
    setError("");
  };
  const handleOver = (event: DragOverEvent): void => {
    const current = previewRef.current;
    if (current === null || active === null || event.over === null) return;
    const column = COLUMN_SCHEMA.safeParse(event.over.data.current?.column);
    if (!column.success) return;
    const source = [...current].find(([, items]) =>
      items.some((item) => item.id === active.task.id),
    );
    const destination = current.get(column.data);
    if (source === undefined || destination === undefined || source[0] === column.data) return;
    const index = destination.findIndex((item) => item.id === event.over?.id);
    const rect = event.active.rect.current.translated;
    const isAfter = rect !== null && rect.top > event.over.rect.top + event.over.rect.height / 2;
    const insertion = index < 0 ? destination.length : index + Number(isAfter);
    const next = new Map(current);
    next.set(
      source[0],
      source[1].filter((item) => item.id !== active.task.id),
    );
    const target = [...destination];
    target.splice(insertion, 0, { ...active.task, column: column.data });
    next.set(column.data, target);
    updatePreview(next);
    setTargetId(null);
  };
  const handleEnd = async (event: DragEndEvent): Promise<void> => {
    setActive(null);
    setTargetId(null);
    if (!active || !event.over || isSaving) {
      updatePreview(null);
      return;
    }
    const column = COLUMN_SCHEMA.safeParse(event.over.data.current?.column);
    if (!column.success) {
      updatePreview(null);
      return;
    }
    const current = previewRef.current;
    const items = current?.get(column.data);
    if (current === null || items === undefined) {
      updatePreview(null);
      return;
    }
    const from = items.findIndex((item) => item.id === active.task.id);
    const over = items.findIndex((item) => item.id === event.over?.id);
    if (from < 0) {
      updatePreview(null);
      return;
    }
    const to = over < 0 ? items.length - 1 : over;
    const ordered = arrayMove(items, from, to);
    const beforeId = ordered[to + 1]?.id ?? dragNextIds.current.get(column.data) ?? null;
    const original = dragPages.current.get(active.task.column)?.items ?? [];
    const originalIndex = original.findIndex((item) => item.id === active.task.id);
    if (column.data === active.task.column && originalIndex === to) {
      updatePreview(null);
      return;
    }
    // Сначала публикуем визуальный результат. Ответ сети не управляет анимацией отпускания.
    updatePreview(new Map(current).set(column.data, ordered));
    setSaving(true);
    try {
      await moveBoardTask(projectId, active.task.id, {
        column: column.data,
        beforeId,
        ifRevision: active.task.revision,
        ifVersion: active.version,
        requestId: crypto.randomUUID(),
      });
    } catch (failure) {
      if (failure instanceof BoardTaskError) setError(failure.message);
      else setDefect(failure);
    } finally {
      try {
        // Ошибки чтения принадлежат колонкам; они не должны оставлять жест в состоянии сохранения.
        await refresh(active.task.id).catch(() => undefined);
      } finally {
        updatePreview(null);
        setSaving(false);
      }
    }
  };
  if (defect !== undefined) throw defect;
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={detectCollisions}
      onDragStart={handleStart}
      onDragOver={handleOver}
      onDragEnd={handleEnd}
      onDragCancel={() => {
        setActive(null);
        setTargetId(null);
        updatePreview(null);
      }}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Пробел — поднять карточку. Стрелки —выбрать место. Пробел — переместить. Escape — отменить.",
        },
        announcements: {
          onDragStart: () => "Карточка поднята",
          onDragOver: ({ over }) => (over ? "Выбрано место вставки" : "За пределами доски"),
          onDragEnd: () => "Перенос отправлен на сохранение",
          onDragCancel: () => "Перенос отменён",
        },
      }}
    >
      {hasError && (
        <Alert color="red" title="Перенос не сохранён" mb="md">
          {error}
        </Alert>
      )}
      {isSaving && (
        <Text role="status" size="sm" className={styles.saving}>
          Сохраняем перемещение…
        </Text>
      )}
      <Box
        ref={boardRef}
        className={styles.root}
        role="region"
        aria-label="Канбан-доска"
        tabIndex={0}
        aria-busy={isSaving}
      >
        {columnItems.map(({ column, items, total }) => (
          <TaskColumn
            key={column.value}
            projectId={projectId}
            filters={filters}
            column={column}
            targetId={targetId}
            isSaving={isSaving}
            preview={items}
            previewTotal={total}
            activeId={active?.task.id ?? null}
            onSnapshot={handleSnapshot}
            onOpen={onOpen}
            onCreate={onCreate}
          />
        ))}
      </Box>
      <DragOverlay dropAnimation={dropAnimation}>
        {active !== null && (
          <div className={styles.overlay} style={{ width: active.width, height: active.height }}>
            <TaskCardPreview task={active.task} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
};
