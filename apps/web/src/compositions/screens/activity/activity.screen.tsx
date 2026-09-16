import { useState } from "react";
import { z } from "zod";
import { Link, useSearchParams } from "react-router-dom";
import { Button, Group, Select, SimpleGrid, Tabs, Text } from "@mantine/core";
import { CheckCheck, Plus, Radio } from "lucide-react";
import { useProjectId } from "domains/project";
import { useLifecycle } from "domains/lifecycle";
import { ProjectPage } from "compositions/widgets/project-page";
import { ProjectEditor } from "compositions/widgets/project-editor";
import type { ProjectEdit } from "compositions/widgets/project-editor";
import { ProjectRecord } from "compositions/widgets/project-record";
import { isDefined, isEmptyArray } from "shared/value-predicates";
import styles from "./styles/activity.module.css";

const TAB_KIND = {
  attention: "question",
  runs: "run",
  checks: "check",
  reviews: "review",
  questions: "question",
} as const;
const TAB_SCHEMA = z
  .enum(["attention", "runs", "checks", "reviews", "questions"])
  .catch("attention");

/**
 * Собирает очередь внимания, исполнения, проверки и решения о приёмке.
 *
 * Используется для:
 *  - наблюдения за работниками и обработки вопросов оркестратором
 */
export const ActivityScreen = () => {
  const lifecycle = useLifecycle();
  const projectId = useProjectId();
  const [params, setParams] = useSearchParams();
  const [taskId, setTaskId] = useState<string | null>(null);
  const [editor, setEditor] = useState<ProjectEdit | null>(null);
  const state = lifecycle.data;
  const records = state?.records ?? [];
  const selectedRecord = records.find((record) => record.id === params.get("record"));
  const requestedTab =
    selectedRecord === undefined
      ? (params.get("tab") ?? "attention")
      : (Object.entries(TAB_KIND).find(
          ([key, kind]) => key !== "attention" && kind === selectedRecord.fields.kind,
        )?.[0] ?? "attention");
  const tab = TAB_SCHEMA.parse(requestedTab);
  const attentionIds = new Set(state?.attention.map((item) => item.recordId));
  const kind = TAB_KIND[tab];
  const items = records
    .filter((record) => {
      const matchesTab =
        tab === "attention" ? attentionIds.has(record.id) : record.fields.kind === kind;
      return (
        matchesTab &&
        (taskId === null || ("taskId" in record.fields && record.fields.taskId === Number(taskId)))
      );
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const isEmpty = isEmptyArray(items);
  const emptyTitle = tab === "attention" ? "Открытых сигналов нет" : "Работа становится прозрачной";
  const emptyDescription =
    tab === "attention"
      ? "Вопросы, неуспешные проверки и исполнения без свежих наблюдений будут собраны здесь."
      : "Здесь появятся попытки агентов, подтверждения результатов и вопросы. Состояние исполнения содержит источник наблюдения и время обновления.";
  const taskItems =
    state?.tasks.map((task) => ({
      value: String(task.id),
      label: `#${task.id} · ${task.title}`,
    })) ?? [];
  const createLabel = {
    run: "Добавить исполнение",
    check: "Записать проверку",
    review: "Принять результат",
    question: "Задать вопрос",
  }[kind];
  const initial = taskId === null ? undefined : { taskId: Number(taskId) };
  return (
    <ProjectPage
      title="Работа и проверки"
      description="Кто выполняет работу, что подтверждено и где требуется ваше решение."
      isLoading={lifecycle.isLoading && state === undefined}
      error={lifecycle.error}
      actions={
        <Button leftSection={<Plus size={14} />} onClick={() => setEditor({ kind, initial })}>
          {createLabel}
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
          <Tabs.Tab value="attention">Внимание · {state?.attention.length ?? 0}</Tabs.Tab>
          <Tabs.Tab value="runs">Исполнения</Tabs.Tab>
          <Tabs.Tab value="checks">Проверки</Tabs.Tab>
          <Tabs.Tab value="reviews">Приёмка</Tabs.Tab>
          <Tabs.Tab value="questions">Вопросы</Tabs.Tab>
        </Tabs.List>
      </Tabs>
      <Group justify="space-between" mb="lg">
        <Select
          aria-label="Задача для просмотра работы"
          placeholder="Все задачи"
          searchable
          clearable
          data={taskItems}
          value={taskId}
          onChange={setTaskId}
        />
        <Text size="xs" c="dimmed">
          Завершение сессии, проверка и приёмка учитываются отдельно
        </Text>
      </Group>
      {isEmpty && (
        <div className={styles.empty}>
          <Radio size={30} />
          <h2>{emptyTitle}</h2>
          <Text size="sm" c="dimmed" maw={470}>
            {emptyDescription}
          </Text>
          <Button variant="light" mt="lg" onClick={() => setEditor({ kind, initial })}>
            {createLabel}
          </Button>
        </div>
      )}
      <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">
        {items.map((record) => {
          const relatedTaskId = "taskId" in record.fields ? record.fields.taskId : null;
          const hasTask = relatedTaskId !== null;
          const canReview = record.fields.kind === "run" && record.fields.status === "succeeded";
          const canAnswer = record.fields.kind === "question" && record.fields.status === "open";
          const reviewCommit = record.fields.kind === "run" ? record.fields.resultCommit : "";
          const reviewCheckIds = records
            .filter(
              (check) =>
                check.fields.kind === "check" &&
                check.fields.runId === record.id &&
                check.fields.status === "passed" &&
                check.fields.commit === reviewCommit,
            )
            .map((check) => check.id);
          return (
            <ProjectRecord
              key={record.id}
              record={record}
              onEdit={(record) => setEditor({ kind: record.fields.kind, record })}
              action={
                <Group gap="xs">
                  {hasTask && (
                    <Button
                      component={Link}
                      to={`/projects/${encodeURIComponent(projectId)}/tasks/${relatedTaskId}`}
                      state={{ fromBoard: true }}
                      variant="subtle"
                      size="xs"
                    >
                      Задача #{relatedTaskId}
                    </Button>
                  )}
                  {canAnswer && (
                    <Button
                      size="xs"
                      variant="light"
                      onClick={() =>
                        setEditor({
                          kind: "question",
                          record,
                          initial: { status: "answered" },
                          fieldKeys: ["answer", "status"],
                          heading: record.fields.title,
                        })
                      }
                    >
                      Ответить
                    </Button>
                  )}
                  {canReview && (
                    <Button
                      size="xs"
                      variant="light"
                      leftSection={<CheckCheck size={13} />}
                      onClick={() =>
                        setEditor({
                          kind: "review",
                          initial: {
                            taskId: relatedTaskId,
                            runId: record.id,
                            commit: reviewCommit,
                            checkIds: reviewCheckIds,
                          },
                        })
                      }
                    >
                      Приёмка
                    </Button>
                  )}
                </Group>
              }
            />
          );
        })}
      </SimpleGrid>
      {isDefined(editor) && (
        <ProjectEditor
          key={editor.record?.id ?? editor.kind}
          {...editor}
          onClose={() => setEditor(null)}
        />
      )}
    </ProjectPage>
  );
};
