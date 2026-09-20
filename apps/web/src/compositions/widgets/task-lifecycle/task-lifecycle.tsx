import clsx from "clsx";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Badge, Button, Group, Modal, Stack, Tabs, Text } from "@mantine/core";
import { Copy, Flag, Plus, WandSparkles } from "lucide-react";
import { useProjectBasePath, useProjectId } from "domains/project";
import { getBriefing, isRecordOf, statusColor, statusLabel, useLifecycle } from "domains/lifecycle";
import { ProjectEditor } from "compositions/widgets/project-editor";
import type { ProjectEdit } from "compositions/widgets/project-editor";
import { ProjectRecord } from "compositions/widgets/project-record";
import { MarkdownView } from "ui/markdown-view";
import { copyText } from "infra/clipboard";
import { isDefined, isEmptyArray } from "shared/value-predicates";
import type { TaskLifecycleProps } from "./types/task-lifecycle-props.type";
import styles from "./styles/task-lifecycle.module.css";

/**
 * Превращает карточку задачи в ограниченное поручение с проверяемым результатом.
 *
 * Используется для:
 *  - связи задачи с планом, требованиями и сведениями о баге
 *  - чтения исполнений, проверок и приёмки результата
 */
export const TaskLifecycle = (props: TaskLifecycleProps) => {
  const { taskId, className, ...rootAttrs } = props;
  const base = useProjectBasePath();
  const projectId = useProjectId();
  const lifecycle = useLifecycle();
  const [tab, setTab] = useState<string | null>("context");
  const [editor, setEditor] = useState<ProjectEdit | null>(null);
  const [briefing, setBriefing] = useState<string | null>(null);
  const [isPreparing, setPreparing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const state = lifecycle.data;
  const records = state?.records ?? [];
  const task = state?.tasks.find((item) => item.id === taskId);
  const contextRecord = records.find(
    (record) => isRecordOf(record, "task") && record.fields.taskId === taskId,
  );
  const context =
    contextRecord && isRecordOf(contextRecord, "task") ? contextRecord.fields : undefined;
  const stage = records.find((record) => record.id === task?.stageId);
  const plan = records.find((record) => record.id === task?.planId);
  const runs = records
    .filter((record) => isRecordOf(record, "run") && record.fields.taskId === taskId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const checks = records.filter(
    (record) => isRecordOf(record, "check") && record.fields.taskId === taskId,
  );
  const reviews = records.filter(
    (record) => isRecordOf(record, "review") && record.fields.taskId === taskId,
  );
  const questions = records.filter(
    (record) => isRecordOf(record, "question") && record.fields.taskId === taskId,
  );
  const documents = records.filter(
    (record) =>
      context?.requirementIds.includes(record.id) || context?.knowledgeIds.includes(record.id),
  );
  const hasPlan = plan !== undefined;
  const isBug = context?.type === "bug";
  const hasContext = context !== undefined;
  const hasMessage = message !== null;
  const hasNoRuns = isEmptyArray(runs);
  const hasNoChecks = isEmptyArray(checks);
  const typeLabel = statusLabel(context?.type ?? "task");
  const severityLabel = statusLabel(context?.severity ?? "medium");
  const severityColor = statusColor(context?.severity ?? "medium");

  /**
   * Получает поручение из согласованного серверного контекста.
   */
  const handleBriefing = async (): Promise<void> => {
    setPreparing(true);
    setMessage(null);
    try {
      setBriefing(await getBriefing(projectId, taskId));
    } catch (failure) {
      setMessage(failure instanceof Error ? failure.message : "Не удалось собрать поручение.");
    } finally {
      setPreparing(false);
    }
  };
  return (
    <div {...rootAttrs} className={clsx(styles.root, className)}>
      <Group justify="space-between" mb="lg">
        <Badge variant="light" color="gray">
          {typeLabel}
        </Badge>
        <Button
          size="xs"
          variant="light"
          leftSection={<WandSparkles size={14} />}
          loading={isPreparing}
          onClick={() => void handleBriefing()}
        >
          Поручение агенту
        </Button>
      </Group>
      {hasMessage && (
        <Alert color="orange" mb="md">
          {message}
        </Alert>
      )}
      <Tabs value={tab} onChange={setTab} keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="context">Контекст</Tabs.Tab>
          <Tabs.Tab value="runs">Исполнения · {runs.length}</Tabs.Tab>
          <Tabs.Tab value="checks">Проверки · {checks.length}</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="context" pt="lg">
          <section className={styles.context}>
            <Group justify="space-between" mb="md">
              <Text size="sm" fw={600}>
                Место в проекте
              </Text>
              <Button
                size="compact-xs"
                variant="subtle"
                onClick={() =>
                  setEditor({
                    kind: "task",
                    record: contextRecord,
                    initial: { taskId, stageId: task?.stageId ?? null },
                  })
                }
              >
                Настроить контекст
              </Button>
            </Group>
            {hasPlan && (
              <Link
                className={styles.planLink}
                to={`${base}/plans/${plan.id}?stage=${stage?.id ?? ""}`}
              >
                <Flag size={16} />
                <span>
                  {plan.fields.title}
                  <small>{stage?.fields.title}</small>
                </span>
              </Link>
            )}
            {!hasPlan && (
              <Text size="sm" c="dimmed">
                Свяжите задачу с этапом плана, чтобы оркестратор видел её вклад в общий результат.
              </Text>
            )}
            {hasContext && (
              <Stack gap="lg" mt="lg">
                <section>
                  <Text fw={600} size="xs" mb="xs">
                    Границы поручения
                  </Text>
                  <MarkdownView
                    text={context.boundaries}
                    emptyText="Границы изменений не заданы."
                  />
                </section>
                <section>
                  <Text fw={600} size="xs" mb="xs">
                    Критерии приёмки
                  </Text>
                  <MarkdownView
                    text={context.acceptanceCriteria}
                    emptyText="Критерии берутся из задачи и этапа; здесь можно уточнить результат работника."
                  />
                </section>
              </Stack>
            )}
          </section>
          {isBug && (
            <section className={styles.bug}>
              <Group mb="sm">
                <Badge color="orange">Баг</Badge>
                <Badge variant="light" color={severityColor}>
                  Серьёзность: {severityLabel}
                </Badge>
                <Text size="xs" c="dimmed">
                  {context.affectedVersion} · {context.environment}
                </Text>
              </Group>
              <Text size="xs" fw={600}>
                Ожидается
              </Text>
              <MarkdownView text={context.expectedBehavior} />
              <Text size="xs" fw={600} mt="md">
                Наблюдается
              </Text>
              <MarkdownView text={context.actualBehavior} />
              <Text size="xs" fw={600} mt="md">
                Воспроизведение
              </Text>
              <MarkdownView text={context.reproduction} />
              <Text size="xs" fw={600} mt="md">
                Обходное решение
              </Text>
              <MarkdownView text={context.workaround} emptyText="Пока не указано." />
            </section>
          )}
          <Stack mt="lg">
            {documents.map((record) => (
              <ProjectRecord key={record.id} record={record} />
            ))}
          </Stack>
          <Group justify="space-between" mt="xl" mb="md">
            <Text size="sm" fw={600}>
              Вопросы по задаче
            </Text>
            <Button
              size="compact-xs"
              variant="subtle"
              onClick={() => setEditor({ kind: "question", initial: { taskId } })}
            >
              Задать вопрос
            </Button>
          </Group>
          <Stack>
            {questions.map((record) => (
              <ProjectRecord
                key={record.id}
                record={record}
                onEdit={(record) => setEditor({ kind: "question", record })}
              />
            ))}
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="runs" pt="lg">
          <Group justify="space-between" mb="md">
            <Text size="sm" c="dimmed">
              Попытки выполнения этой задачи
            </Text>
            <Button
              size="xs"
              variant="light"
              leftSection={<Plus size={13} />}
              onClick={() =>
                setEditor({ kind: "run", initial: { taskId, agent: task?.assignee ?? "" } })
              }
            >
              Исполнение
            </Button>
          </Group>
          {hasNoRuns && (
            <Text size="sm" c="dimmed" py="lg">
              Зарегистрируйте сессию работника. Здесь будут её результат, коммиты и причина
              завершения.
            </Text>
          )}
          <Stack>
            {runs.map((record) => (
              <ProjectRecord
                key={record.id}
                record={record}
                onEdit={(record) => setEditor({ kind: "run", record })}
              />
            ))}
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="checks" pt="lg">
          <Group justify="space-between" mb="md">
            <Text size="sm" fw={600}>
              Подтверждения готовности
            </Text>
            <Button
              size="xs"
              variant="light"
              onClick={() => setEditor({ kind: "check", initial: { taskId } })}
            >
              + Проверка
            </Button>
          </Group>
          {hasNoChecks && (
            <Text size="sm" c="dimmed" py="lg">
              Запишите проверяемый сценарий, результат и точное состояние кода.
            </Text>
          )}
          <Stack>
            {checks.map((record) => (
              <ProjectRecord
                key={record.id}
                record={record}
                onEdit={(record) => setEditor({ kind: "check", record })}
              />
            ))}
          </Stack>
          <Group justify="space-between" mt="xl" mb="md">
            <Text fw={600} size="sm">
              Приёмка оркестратором
            </Text>
            <Button
              size="xs"
              variant="light"
              color="teal"
              onClick={() =>
                setEditor({
                  kind: "review",
                  initial: {
                    taskId,
                    checkIds: checks
                      .filter(
                        (record) =>
                          isRecordOf(record, "check") && record.fields.status === "passed",
                      )
                      .map((record) => record.id),
                  },
                })
              }
            >
              Принять / доработать
            </Button>
          </Group>
          <Stack>
            {reviews.map((record) => (
              <ProjectRecord
                key={record.id}
                record={record}
                onEdit={(record) => setEditor({ kind: "review", record })}
              />
            ))}
          </Stack>
        </Tabs.Panel>
      </Tabs>
      {isDefined(editor) && (
        <ProjectEditor
          key={editor.record?.id ?? editor.kind}
          {...editor}
          onClose={() => setEditor(null)}
        />
      )}
      <Modal
        opened={briefing !== null}
        onClose={() => setBriefing(null)}
        title="Поручение работнику"
        size="lg"
        closeButtonProps={{ "aria-label": "Закрыть поручение" }}
      >
        <MarkdownView text={briefing ?? ""} />
        <Button
          mt="lg"
          leftSection={<Copy size={14} />}
          onClick={() => {
            void copyText(briefing ?? "").then(
              () => setMessage("Поручение скопировано"),
              () => setMessage("Выделите и скопируйте текст вручную"),
            );
          }}
        >
          Скопировать поручение
        </Button>
      </Modal>
    </div>
  );
};
