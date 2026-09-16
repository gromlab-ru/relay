import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Badge, Button, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { ArrowLeft, Layers3, Plus, Rocket } from "lucide-react";
import { useProjectId } from "domains/project";
import { isRecordOf, statusColor, statusLabel, useLifecycle } from "domains/lifecycle";
import { ProjectPage } from "compositions/widgets/project-page";
import { ProjectEditor } from "compositions/widgets/project-editor";
import type { ProjectEdit } from "compositions/widgets/project-editor";
import { ProjectRecord } from "compositions/widgets/project-record";
import { ProjectTasks } from "compositions/widgets/project-tasks";
import { MarkdownView } from "ui/markdown-view";
import { isDefined, isEmptyArray } from "shared/value-predicates";
import styles from "./styles/releases.module.css";

/**
 * Связывает состав версии с проверками и фактическими установками в окружениях.
 *
 * Используется для:
 *  - подготовки выпуска и подтверждения результата эксплуатации
 */
export const ReleasesScreen = () => {
  const lifecycle = useLifecycle();
  const projectId = useProjectId();
  const { releaseId } = useParams();
  const navigate = useNavigate();
  const [editor, setEditor] = useState<ProjectEdit | null>(null);
  const state = lifecycle.data;
  const base = `/projects/${encodeURIComponent(projectId)}`;
  const records = state?.records.filter((record) => isRecordOf(record, "release")) ?? [];
  const release = records.find((record) => record.id === releaseId);
  const isEmpty = isEmptyArray(records);
  if (releaseId === undefined)
    return (
      <ProjectPage
        title="Релизы"
        description="Какие изменения готовы к поставке и что уже работает у пользователей."
        isLoading={lifecycle.isLoading && state === undefined}
        error={lifecycle.error}
        actions={
          <Button leftSection={<Plus size={14} />} onClick={() => setEditor({ kind: "release" })}>
            Подготовить релиз
          </Button>
        }
      >
        {isEmpty && (
          <div className={styles.empty}>
            <Rocket size={32} />
            <h2>От выполненной работы к выпуску</h2>
            <Text size="sm" c="dimmed" maw={450}>
              Соберите изменения в версию, приложите проверки и зафиксируйте установку в окружение.
            </Text>
            <Button mt="lg" variant="light" onClick={() => setEditor({ kind: "release" })}>
              Первый релиз
            </Button>
          </div>
        )}
        <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">
          {records.map((record) => (
            <ProjectRecord
              key={record.id}
              record={record}
              onEdit={(record) => setEditor({ kind: "release", record })}
              action={
                <Button
                  component={Link}
                  to={`${base}/releases/${record.id}`}
                  size="xs"
                  variant="light"
                >
                  Состав и окружения →
                </Button>
              }
            >
              <Text size="xs" c="dimmed" mt="sm">
                {record.fields.versionName} · {record.fields.taskIds.length} задач
              </Text>
            </ProjectRecord>
          ))}
        </SimpleGrid>
        {isDefined(editor) && (
          <ProjectEditor
            {...editor}
            onClose={() => setEditor(null)}
            onSaved={(record) => navigate(`${base}/releases/${record.id}`)}
          />
        )}
      </ProjectPage>
    );
  if (release === undefined)
    return (
      <ProjectPage
        title="Релиз недоступен"
        description="Выберите версию из списка."
        isLoading={lifecycle.isLoading}
        actions={
          <Button component={Link} to={`${base}/releases`}>
            К релизам
          </Button>
        }
      />
    );
  const tasks = state?.tasks.filter((task) => release.fields.taskIds.includes(task.id)) ?? [];
  const deployments =
    state?.records.filter(
      (record) => isRecordOf(record, "deployment") && record.fields.releaseId === release.id,
    ) ?? [];
  const checks =
    state?.records.filter(
      (record) =>
        isRecordOf(record, "check") &&
        (record.fields.releaseId === release.id ||
          (record.fields.taskId !== null &&
            release.fields.taskIds.includes(record.fields.taskId) &&
            record.fields.commit === release.fields.commit)),
    ) ?? [];
  const hasNoDeployments = isEmptyArray(deployments);
  const status = statusLabel(release.fields.status);
  const color = statusColor(release.fields.status);
  return (
    <ProjectPage
      title={`${release.fields.versionName} · ${release.fields.title}`}
      description="Проверенный состав, ограничения и история установки."
      actions={
        <>
          <Button variant="default" onClick={() => setEditor({ kind: "release", record: release })}>
            Изменить релиз
          </Button>
          <Button
            leftSection={<Rocket size={14} />}
            onClick={() => setEditor({ kind: "deployment", initial: { releaseId: release.id } })}
          >
            Записать установку
          </Button>
        </>
      }
    >
      <Group justify="space-between" mb="lg">
        <Button
          component={Link}
          to={`${base}/releases`}
          size="xs"
          variant="subtle"
          leftSection={<ArrowLeft size={14} />}
        >
          Все релизы
        </Button>
        <Badge color={color} variant="light">
          {status}
        </Badge>
      </Group>
      <div className={styles.grid}>
        <section className={styles.panel}>
          <h2>Что изменилось</h2>
          <MarkdownView
            text={release.fields.notes}
            emptyText="Добавьте описание результата для пользователей."
          />
          <Text size="xs" c="dimmed" mt="lg">
            Коммит: {release.fields.commit || "ещё не зафиксирован"}
          </Text>
          <h2>Состав релиза</h2>
          <ProjectTasks tasks={tasks} />
        </section>
        <section className={styles.panel}>
          <h2>
            <Layers3 size={17} /> Окружения
          </h2>
          {hasNoDeployments && (
            <Text c="dimmed" size="sm" py="lg">
              Установки пока не зарегистрированы. Запишите окружение и результат проверки после
              выпуска.
            </Text>
          )}
          <Stack>
            {deployments.map((record) => (
              <ProjectRecord
                key={record.id}
                record={record}
                onEdit={(record) => setEditor({ kind: "deployment", record })}
              />
            ))}
          </Stack>
          <h2>Ограничения и откат</h2>
          <MarkdownView
            text={release.fields.limitations}
            emptyText="Известные ограничения не указаны."
          />
          <MarkdownView text={release.fields.rollback} emptyText="Порядок отката ещё не описан." />
        </section>
      </div>
      <Group justify="space-between" mt="xl" mb="md">
        <Text fw={600}>Проверки релиза</Text>
        <Button
          size="xs"
          variant="light"
          onClick={() =>
            setEditor({
              kind: "check",
              initial: { releaseId: release.id, commit: release.fields.commit },
            })
          }
        >
          Добавить проверку
        </Button>
      </Group>
      <SimpleGrid cols={{ base: 1, xl: 2 }}>
        {checks.map((record) => (
          <ProjectRecord
            key={record.id}
            record={record}
            onEdit={(record) => setEditor({ kind: "check", record })}
          />
        ))}
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
