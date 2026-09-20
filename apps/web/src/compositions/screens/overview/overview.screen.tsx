import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Group, Modal, Progress, SimpleGrid, Stack, Text } from "@mantine/core";
import { ArrowRight, Compass, Copy, Flag, Plus, Save, Sparkles } from "lucide-react";
import { useProjectBasePath } from "domains/project";
import {
  contextMarkdown,
  isRecordOf,
  PROJECT_INPUT_SCHEMAS,
  statusLabel,
  useLifecycle,
} from "domains/lifecycle";
import { ProjectPage } from "compositions/widgets/project-page";
import { ProjectEditor } from "compositions/widgets/project-editor";
import type { ProjectEdit } from "compositions/widgets/project-editor";
import { ProjectTasks } from "compositions/widgets/project-tasks";
import { MarkdownView } from "ui/markdown-view";
import { copyText } from "infra/clipboard";
import { isDefined, isEmptyArray, isNonEmptyArray } from "shared/value-predicates";
import styles from "./styles/overview.module.css";

/**
 * Показывает смысл текущей работы, подтверждённый прогресс и следующий шаг.
 *
 * Используется для:
 *  - входа оркестратора и человека в проект
 *  - передачи контекста и сохранения точки продолжения
 */
export const OverviewScreen = () => {
  const lifecycle = useLifecycle();
  const base = useProjectBasePath();
  const [editor, setEditor] = useState<ProjectEdit | null>(null);
  const [isContextOpen, setContextOpen] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const state = lifecycle.data;
  if (state === undefined)
    return (
      <ProjectPage
        title="Обзор проекта"
        description="Собираем цель, работу и подтверждённые результаты."
        isLoading={lifecycle.isLoading}
        error={lifecycle.error}
      />
    );
  const passportRecord = state.records.find((record) => isRecordOf(record, "passport"));
  const passport =
    passportRecord?.fields ?? PROJECT_INPUT_SCHEMAS.passport.parse({ kind: "passport" });
  const plan = state.records.find(
    (record) => isRecordOf(record, "plan") && record.id === passport.focusPlanId,
  );
  const focusPlan = plan && isRecordOf(plan, "plan") ? plan : undefined;
  const focusStages = state.records.filter(
    (record) => isRecordOf(record, "stage") && record.fields.planId === focusPlan?.id,
  );
  const activeStageTitles = focusStages
    .filter((record) => isRecordOf(record, "stage") && record.fields.status === "active")
    .map((record) => record.fields.title);
  const acceptedStageCount = focusStages.filter(
    (record) => isRecordOf(record, "stage") && record.fields.status === "accepted",
  ).length;
  const stageLabel =
    activeStageTitles.join(" · ") ||
    (isNonEmptyArray(focusStages) && acceptedStageCount === focusStages.length
      ? "Все этапы приняты"
      : "Этапы ещё не запущены");
  const progress = focusPlan ? state.progress[focusPlan.id] : undefined;
  const progressPercent =
    progress && progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
  const nextStep = focusPlan?.fields.nextStep || passport.nextStep;
  const hasNextStep = nextStep !== "";
  const hasPassport = passport.purpose !== "";
  const hasFocus = focusPlan !== undefined;
  const attentionItems = state.attention.slice(0, 5);
  const isQuiet = isEmptyArray(attentionItems);
  const openTasks = state.tasks
    .filter((task) => !task.terminal && (focusPlan === undefined || task.planId === focusPlan.id))
    .slice(0, 6);
  const summary = focusPlan?.fields.summary || passport.summary;
  const hasSummary = summary !== "";
  const context = contextMarkdown(state);
  const stats = [
    {
      label: "Открытые задачи",
      value: state.tasks.filter((task) => !task.terminal).length,
      description: "Предстоит выполнить",
      href: `${base}/board`,
    },
    {
      label: "Исполнения",
      value: state.records.filter(
        (record) => isRecordOf(record, "run") && record.fields.status === "running",
      ).length,
      description: "Зарегистрировано в работе",
      href: `${base}/activity?tab=runs`,
    },
    {
      label: "Требует внимания",
      value: state.attention.length,
      description: "Вопросы и подтверждения",
      href: `${base}/activity`,
    },
  ];
  const snapshotInitial = {
    summary: context,
    nextStep,
    taskIds: openTasks.map((task) => task.id),
    planId: focusPlan?.id ?? null,
  };
  return (
    <ProjectPage
      title="Обзор проекта"
      description="Общая картина, чтобы каждый следующий шаг был осмысленным."
      error={lifecycle.error}
      actions={
        <>
          <Button
            variant="default"
            leftSection={<Copy size={14} />}
            onClick={() => setContextOpen(true)}
          >
            Контекст для агента
          </Button>
          <Button
            leftSection={<Save size={14} />}
            onClick={() => setEditor({ kind: "checkpoint", initial: snapshotInitial })}
          >
            Сохранить точку
          </Button>
        </>
      }
    >
      <div className={styles.hero}>
        <div className={styles.heroIcon}>
          <Compass size={24} />
        </div>
        <div className={styles.heroBody}>
          <Group gap="xs" mb="xs">
            <Badge variant="light">{statusLabel(passport.productStage)}</Badge>
            <Badge color="gray" variant="light">
              {statusLabel(passport.mode)}
            </Badge>
          </Group>
          <h2 className={styles.heroTitle}>{passport.title || "С чего начинается ваш проект?"}</h2>
          <Text c="dimmed" size="sm">
            {passport.purpose ||
              "Расскажите, что вы создаёте и для кого. Этот контекст станет основой поручений агентам."}
          </Text>
        </div>
        {!hasPassport && (
          <Button
            variant="light"
            onClick={() => setEditor({ kind: "passport", record: passportRecord })}
          >
            Заполнить паспорт
          </Button>
        )}
      </div>
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" my="lg">
        {stats.map((stat) => (
          <Link className={styles.stat} key={stat.label} to={stat.href}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
            <small>
              {stat.description} <ArrowRight size={12} />
            </small>
          </Link>
        ))}
      </SimpleGrid>
      <div className={styles.grid}>
        <section className={styles.panel}>
          <Group justify="space-between" mb="lg">
            <h2 className={styles.panelTitle}>
              <Flag size={16} /> План в фокусе
            </h2>
            <Group gap={4}>
              <Button
                size="compact-xs"
                variant="subtle"
                onClick={() =>
                  setEditor({
                    kind: focusPlan === undefined ? "passport" : "plan",
                    record: focusPlan ?? passportRecord,
                    fieldKeys: ["summary", "nextStep"],
                    heading: "Обновить состояние проекта",
                  })
                }
              >
                Обновить сводку
              </Button>
              <Button component={Link} to={`${base}/plans`} variant="subtle" size="xs">
                Все планы →
              </Button>
            </Group>
          </Group>
          {hasFocus && (
            <Stack gap="md">
              <Link className={styles.focusTitle} to={`${base}/plans/${focusPlan.id}`}>
                {focusPlan.fields.title}
              </Link>
              <Text size="sm" c="dimmed">
                {focusPlan.fields.goal}
              </Text>
              <Text size="sm" fw={600}>
                {stageLabel}
              </Text>
              <Progress
                value={progressPercent}
                size={7}
                radius="xl"
                aria-label="Выполнение задач текущего плана"
              />
              <Text size="xs" c="dimmed">
                Выполнено {progress?.completed ?? 0} из {progress?.total ?? 0} листовых задач ·
                приёмка этапов учитывается отдельно
              </Text>
            </Stack>
          )}
          {!hasFocus && (
            <Stack gap="sm">
              <Text size="sm" c="dimmed">
                Выберите цель ближайшей работы. План свяжет ожидаемый результат, этапы и задачи.
              </Text>
              <Button
                component={Link}
                to={`${base}/plans`}
                variant="light"
                leftSection={<Plus size={14} />}
              >
                Перейти к планам
              </Button>
            </Stack>
          )}
          {hasSummary && (
            <div className={styles.summary}>
              <Text fw={600} size="xs" mb="xs">
                СЕЙЧАС
              </Text>
              <MarkdownView text={summary} />
            </div>
          )}
          {hasNextStep && (
            <div className={styles.next}>
              <Sparkles size={17} />
              <div>
                <Text fw={600} size="xs">
                  Следующий шаг
                </Text>
                <Text size="sm" mt={4}>
                  {nextStep}
                </Text>
              </div>
            </div>
          )}
        </section>
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Требует внимания</h2>
          {isQuiet && (
            <div className={styles.quiet}>
              <Compass size={28} />
              <Text size="sm" c="dimmed">
                Открытых вопросов и зарегистрированных проблем нет. Продолжайте по текущему плану.
              </Text>
            </div>
          )}
          <Stack gap="xs" mt="md">
            {attentionItems.map((item) => (
              <Link
                key={item.recordId}
                className={styles.attentionItem}
                to={`${base}/activity?record=${item.recordId}`}
              >
                <span>{item.title}</span>
                <ArrowRight size={14} />
              </Link>
            ))}
          </Stack>
        </section>
      </div>
      <section className={styles.panel}>
        <Group justify="space-between">
          <h2 className={styles.panelTitle}>Ближайшая работа</h2>
          <Button component={Link} to={`${base}/board`} variant="subtle" size="xs">
            Открыть доску →
          </Button>
        </Group>
        <ProjectTasks tasks={openTasks} emptyText="Открытых задач в текущем фокусе пока нет." />
      </section>
      {isDefined(editor) && <ProjectEditor {...editor} onClose={() => setEditor(null)} />}
      <Modal
        opened={isContextOpen}
        onClose={() => setContextOpen(false)}
        title="Контекст для агента"
        size="lg"
        closeButtonProps={{ "aria-label": "Закрыть контекст" }}
      >
        <MarkdownView text={context} />
        <Group mt="lg">
          <Button
            onClick={() => {
              void copyText(context).then(
                () => setCopyMessage("Скопировано"),
                () => setCopyMessage("Выделите и скопируйте текст вручную"),
              );
            }}
          >
            Скопировать Markdown
          </Button>
          <Text size="sm">{copyMessage}</Text>
        </Group>
      </Modal>
    </ProjectPage>
  );
};
