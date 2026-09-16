import { useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Badge, Button, Group, Modal, MultiSelect, Stack, Text } from "@mantine/core";
import { useForm } from "@mantine/form";
import { CheckCircle2, Link2, Plus } from "lucide-react";
import { useProjectId } from "domains/project";
import {
  isRecordOf,
  PROJECT_INPUT_SCHEMAS,
  saveProjectRecord,
  statusColor,
  statusLabel,
  useLifecycle,
} from "domains/lifecycle";
import { ProjectTasks } from "compositions/widgets/project-tasks";
import { ProjectRecord } from "compositions/widgets/project-record";
import { MarkdownView } from "ui/markdown-view";
import type { StageDetailProps } from "./types/stage-detail-props.type";
import styles from "./styles/stage-detail.module.css";

/**
 * Связывает результат этапа, критерии приёмки и задачи.
 *
 * Используется для:
 *  - декомпозиции этапа и проверки готовности результата
 */
export const StageDetail = (props: StageDetailProps) => {
  const { stage, state, onEdit } = props;
  const projectId = useProjectId();
  const lifecycle = useLifecycle();
  const [isLinking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stageTasks = state.tasks.filter((task) => task.stageId === stage.id);
  const form = useForm({
    mode: "uncontrolled",
    initialValues: { ids: stageTasks.map((task) => String(task.id)) },
  });
  const taskItems = state.tasks.map((task) => ({
    value: String(task.id),
    label: `#${task.id} · ${task.title}`,
  }));
  const stageTaskIds = new Set(stageTasks.map((task) => task.id));
  const checkItems = state.records.filter(
    (record) =>
      isRecordOf(record, "check") &&
      (record.fields.stageId === stage.id ||
        (record.fields.taskId !== null && stageTaskIds.has(record.fields.taskId))),
  );
  const isAccepted = stage.fields.status === "accepted";
  const hasError = error !== null;
  const base = `/projects/${encodeURIComponent(projectId)}`;
  const status = statusLabel(stage.fields.status);
  const color = statusColor(stage.fields.status);

  /**
   * Сохраняет явные связи, сохраняя остальные сведения о каждой задаче.
   */
  const handleLink = async ({ ids }: { ids: string[] }): Promise<void> => {
    setError(null);
    const selected = new Set(ids.map(Number));
    const affected = new Set([...stageTasks.map((task) => task.id), ...selected]);
    try {
      for (const taskId of affected) {
        const record = state.records.find((item) => item.id === `task_${taskId}`);
        const current =
          record && isRecordOf(record, "task")
            ? record.fields
            : PROJECT_INPUT_SCHEMAS.task.parse({ kind: "task", taskId });
        const stageId = selected.has(taskId) ? stage.id : null;
        if (record !== undefined && current.stageId === stageId) continue;
        await saveProjectRecord(projectId, { ...current, stageId }, record, crypto.randomUUID());
      }
      setLinking(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Не удалось сохранить связи.");
    } finally {
      await lifecycle.mutate();
    }
  };
  return (
    <article className={styles.root}>
      <Group justify="space-between" align="flex-start">
        <div>
          <Badge variant="light" color={color}>
            {status}
          </Badge>
          <h2 className={styles.title}>{stage.fields.title}</h2>
        </div>
        <Button
          size="xs"
          variant="default"
          onClick={() => onEdit({ kind: "stage", record: stage })}
        >
          Изменить этап
        </Button>
      </Group>
      <section className={styles.section}>
        <Text size="xs" c="dimmed" fw={600} mb="sm">
          ОЖИДАЕМЫЙ РЕЗУЛЬТАТ
        </Text>
        <MarkdownView
          text={stage.fields.outcome}
          emptyText="Сформулируйте результат, который получим по завершении этапа."
        />
      </section>
      <section className={styles.criteria}>
        <Text size="xs" fw={600} mb="sm">
          Критерии готовности
        </Text>
        <MarkdownView
          text={stage.fields.criteria}
          emptyText="Добавьте проверяемые критерии: по ним оркестратор сможет принять результат."
        />
      </section>
      <Group justify="space-between" mt="xl" mb="sm">
        <Text fw={600} size="sm">
          Задачи этапа
        </Text>
        <Group gap="xs">
          <Button
            size="compact-xs"
            variant="subtle"
            leftSection={<Link2 size={13} />}
            onClick={() => {
              form.setValues({ ids: stageTasks.map((task) => String(task.id)) });
              setLinking(true);
            }}
          >
            Связать задачи
          </Button>
          <Button
            component={Link}
            size="compact-xs"
            variant="light"
            to={`${base}/board?new=1&planId=${stage.fields.planId}&stageId=${stage.id}`}
            leftSection={<Plus size={13} />}
          >
            Создать
          </Button>
        </Group>
      </Group>
      <ProjectTasks tasks={stageTasks} />
      <Button
        component={Link}
        size="compact-xs"
        variant="subtle"
        mt="sm"
        to={`${base}/board?planId=${stage.fields.planId}&stageId=${stage.id}`}
      >
        Открыть этап на доске →
      </Button>
      <Group justify="space-between" mt="xl" mb="md">
        <Text fw={600} size="sm">
          Подтверждение результата
        </Text>
        <Button
          size="compact-xs"
          variant="subtle"
          onClick={() => onEdit({ kind: "check", initial: { stageId: stage.id } })}
        >
          + Проверка
        </Button>
      </Group>
      <Stack gap="sm">
        {checkItems.map((record) => (
          <ProjectRecord
            key={record.id}
            record={record}
            onEdit={(record) => onEdit({ kind: "check", record })}
          />
        ))}
      </Stack>
      {isAccepted && (
        <Alert color="teal" mt="lg" icon={<CheckCircle2 size={16} />} title="Этап принят">
          <MarkdownView text={stage.fields.acceptance} />
          <Text size="xs" mt="sm">
            {stage.updatedBy} · основание сохранено в истории
          </Text>
        </Alert>
      )}
      {!isAccepted && (
        <Button
          mt="lg"
          variant="light"
          color="teal"
          leftSection={<CheckCircle2 size={14} />}
          onClick={() =>
            onEdit({
              kind: "stage",
              record: stage,
              initial: { status: "accepted" },
              fieldKeys: ["status", "acceptance"],
              heading: "Принять результат этапа",
            })
          }
        >
          Принять результат этапа
        </Button>
      )}
      <Modal
        opened={isLinking}
        onClose={() => setLinking(false)}
        title="Задачи этапа"
        size="lg"
        closeButtonProps={{ "aria-label": "Закрыть выбор задач" }}
      >
        <form onSubmit={form.onSubmit(handleLink)}>
          <MultiSelect
            key={form.key("ids")}
            label="Выберите задачи"
            description="Карточки остаются общими для плана и доски. Подзадачи наследуют этап родителя."
            data={taskItems}
            searchable
            {...form.getInputProps("ids")}
          />
          {hasError && (
            <Alert color="red" mt="md">
              {error}
            </Alert>
          )}
          <Group justify="flex-end" mt="lg">
            <Button type="submit" loading={form.submitting}>
              Сохранить связи
            </Button>
          </Group>
        </form>
      </Modal>
    </article>
  );
};
