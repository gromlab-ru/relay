import { useState } from "react";
import { z } from "zod";
import { useSearchParams } from "react-router-dom";
import {
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Timeline,
} from "@mantine/core";
import { History, Plus, Save } from "lucide-react";
import {
  contextMarkdown,
  isRecordOf,
  KIND_LABELS,
  useLifecycle,
  useProjectChanges,
} from "domains/lifecycle";
import { ProjectPage } from "compositions/widgets/project-page";
import { ProjectEditor } from "compositions/widgets/project-editor";
import { ProjectRecord } from "compositions/widgets/project-record";
import { ProjectTasks } from "compositions/widgets/project-tasks";
import { formatDateTime } from "infra/date-time";
import { isDefined, isEmptyArray } from "shared/value-predicates";
import styles from "./styles/history.module.css";
const TAB_SCHEMA = z.enum(["checkpoints", "events"]).catch("checkpoints");

/**
 * Сохраняет преемственность работы и показывает изменения после передачи проекта.
 *
 * Используется для:
 *  - восстановления контекста по контрольной точке
 *  - просмотра авторства значимых изменений
 */
export const HistoryScreen = () => {
  const lifecycle = useLifecycle();
  const [params, setParams] = useSearchParams();
  const [isCreating, setCreating] = useState(false);
  const checkpointId = params.get("checkpoint");
  const changes = useProjectChanges(checkpointId);
  const tab = TAB_SCHEMA.parse(params.get("tab"));
  const records = lifecycle.data?.records ?? [];
  const checkpoints = records
    .filter((record) => isRecordOf(record, "checkpoint"))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const isEmpty = isEmptyArray(checkpoints);
  const events = records
    .flatMap((record) =>
      record.events.map((event) => ({
        ...event,
        id: `${record.id}:${event.revision}`,
        title: record.fields.title || KIND_LABELS[record.fields.kind],
        kind: KIND_LABELS[record.fields.kind],
      })),
    )
    .sort((a, b) => b.at.localeCompare(a.at));
  const isCheckpointTab = tab === "checkpoints";
  const changesData = changes.data;
  const hasChangesError = changes.error !== undefined;
  const changesErrorMessage = changes.error?.message;
  const initial = { summary: lifecycle.data === undefined ? "" : contextMarkdown(lifecycle.data) };
  return (
    <ProjectPage
      title="История и передача"
      description="Сохраните точку продолжения и восстановите контекст без перечитывания всей истории."
      isLoading={lifecycle.isLoading && lifecycle.data === undefined}
      error={lifecycle.error}
      actions={
        <Button leftSection={<Save size={14} />} onClick={() => setCreating(true)}>
          Сохранить точку
        </Button>
      }
    >
      <Tabs
        value={tab}
        onChange={(value) => {
          if (value !== null) setParams({ tab: value });
        }}
        mb="lg"
      >
        <Tabs.List>
          <Tabs.Tab value="checkpoints">Точки продолжения</Tabs.Tab>
          <Tabs.Tab value="events">Журнал проекта</Tabs.Tab>
        </Tabs.List>
      </Tabs>
      {isCheckpointTab && (
        <>
          <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">
            {checkpoints.map((record) => (
              <ProjectRecord
                key={record.id}
                record={record}
                action={
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => setParams({ checkpoint: record.id })}
                  >
                    Что изменилось →
                  </Button>
                }
              >
                <Text size="xs" c="dimmed" mt="sm">
                  {formatDateTime(record.createdAt)} · {record.createdBy}
                </Text>
              </ProjectRecord>
            ))}
          </SimpleGrid>
          {isEmpty && (
            <div className={styles.empty}>
              <History size={30} />
              <h2>Работа продолжится с нужного места</h2>
              <Text c="dimmed" size="sm" maw={460}>
                Перед завершением сессии зафиксируйте результат, незавершённую работу и следующий
                шаг. Система сохранит версии задач и проектных документов.
              </Text>
              <Button
                mt="lg"
                variant="light"
                leftSection={<Plus size={14} />}
                onClick={() => setCreating(true)}
              >
                Первая точка продолжения
              </Button>
            </div>
          )}
        </>
      )}
      {!isCheckpointTab && (
        <div className={styles.journal}>
          <Timeline bulletSize={12} lineWidth={1}>
            {events.map((event) => (
              <Timeline.Item key={event.id} title={event.title}>
                <Group gap="xs" mt={5}>
                  <Badge size="xs" variant="light" color="gray">
                    {event.kind}
                  </Badge>
                  <Text size="xs" c="dimmed">
                    {event.actor} · {formatDateTime(event.at)} · версия {event.revision}
                  </Text>
                </Group>
                <Text size="xs" c="dimmed" mt={6}>
                  Изменены сведения: {event.fields.join(", ")}
                </Text>
              </Timeline.Item>
            ))}
          </Timeline>
        </div>
      )}
      {isCreating && (
        <ProjectEditor kind="checkpoint" initial={initial} onClose={() => setCreating(false)} />
      )}
      <Modal
        opened={checkpointId !== null}
        onClose={() => setParams({ tab })}
        title="Изменения после контрольной точки"
        size="lg"
        closeButtonProps={{ "aria-label": "Закрыть сравнение" }}
      >
        {changes.isLoading && <Text c="dimmed">Сравниваем сохранённый и текущий снимки…</Text>}
        {hasChangesError && <Alert color="red">{changesErrorMessage}</Alert>}
        {isDefined(changesData) && (
          <Stack>
            <Text size="sm" c="dimmed">
              После {formatDateTime(changesData.since)} изменено документов:{" "}
              {changesData.records.length}, задач: {changesData.tasks.length}.
            </Text>
            <ProjectTasks tasks={changesData.tasks} emptyText="Задачи не изменились." />
            {changesData.records.map((record) => (
              <ProjectRecord key={record.id} record={record} />
            ))}
            <Text size="xs" c="dimmed">
              Удалено документов: {changesData.removedRecords.length}; задач:{" "}
              {changesData.removedTasks.length}.
            </Text>
          </Stack>
        )}
      </Modal>
    </ProjectPage>
  );
};
