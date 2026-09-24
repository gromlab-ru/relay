import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ActionIcon as MantineActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Menu,
  Modal,
  Progress,
  Tabs,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
  ArrowLeft,
  Ban,
  Check,
  CircleAlert,
  FileText,
  Flag,
  Layers3,
  MoreHorizontal,
  Pencil,
  Play,
  Target,
} from "lucide-react";
import { z } from "zod";
import {
  getPlanSummary,
  PLAN_STATUS_COLORS,
  PLAN_STATUS_LABELS,
  transitionPlan,
  usePlanningRefresh,
  PlanningError,
} from "domains/planning";
import { MarkdownView } from "ui/markdown-view";
import { MarkdownField } from "ui/markdown-field";
import { useProjectId } from "domains/project";
import { readSessionStored, removeSessionStored, writeSessionStored } from "infra/browser-storage";
import { isDefined, isNonEmptyArray } from "shared/value-predicates";
import { PlanStages } from "./ui/plan-stages";
import { PlanOverview } from "./ui/plan-overview/plan-overview";
import type { PlanDetailProps } from "./types/plan-detail-props.type";
import styles from "./styles/plan-detail.module.css";

/**
 * Раскрывает цель, маршрут по этапам и основания результата одного плана.
 *
 * Используется для:
 *  - чтения задач без потери контекста плана
 *  - чтения оснований и результата работы
 */
export const PlanDetail = (props: PlanDetailProps) => {
  const { plan, basePath, onEdit } = props;
  const [searchParams, setSearchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [transitionMode, setTransitionMode] = useState<"complete" | "cancel" | null>(null);
  const projectId = useProjectId();
  const refresh = usePlanningRefresh(projectId);
  const [isStarting, setIsStarting] = useState(false);
  const outcomeKey = `relay:planning-outcome:server-v1:${projectId}:${plan.id}`;
  const [outcomeDraft] = useState(() =>
    z
      .object({ result: z.array(z.string()), revision: z.number() })
      .safeParse(readSessionStored(outcomeKey)),
  );
  const [transitionRevision, setTransitionRevision] = useState(
    outcomeDraft.success ? outcomeDraft.data.revision : plan.revision,
  );
  const outcomeForm = useForm({
    mode: "uncontrolled",
    initialValues: {
      result: outcomeDraft.success ? outcomeDraft.data.result.join("\n") : plan.result,
    },
    validate: {
      result: (result) => (result.trim() === "" ? "Опишите результат или причину отмены" : null),
    },
    onValuesChange: (values) => {
      writeSessionStored(outcomeKey, {
        result: values.result.split("\n"),
        revision: transitionRevision,
      });
    },
  });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isCompleted = plan.status === "completed";
  const isCancelled = plan.status === "cancelled";
  const isDraft = plan.status === "draft";
  const isActive = plan.status === "active";
  const canEdit = isDraft || isActive;
  const summaryData = getPlanSummary(plan);
  const statusLabel = PLAN_STATUS_LABELS[plan.status];
  const canFinish = plan.isReady;
  const hasDivergence = isCompleted && !plan.isReady;
  const canStart = summaryData.total > 0 && plan.goal.trim() !== "";
  const actionLabel = isDraft ? "Начать план" : "Завершить план";
  const ActionIcon = isDraft ? Play : Check;
  const isActionDisabled = isDraft ? !canStart : !canFinish;
  const actionHint = isDraft
    ? "Добавьте цель и хотя бы одну задачу для начала."
    : "Завершение доступно после выполнения всего состава.";
  const defaultTab = "stages";
  const requestedTab = searchParams.get("tab") ?? defaultTab;
  const activeTab = ["stages", "overview"].includes(requestedTab) ? requestedTab : defaultTab;
  const dateLabel = new Intl.DateTimeFormat("ru", { day: "numeric", month: "long" }).format(
    new Date(plan.updatedAt),
  );
  const hasError = isDefined(error);
  const hasBlockers = summaryData.blocked > 0;
  const hasResult = plan.result !== "";
  const hasScope = isNonEmptyArray(plan.scope);
  const resultLabel = isCancelled ? "ПРИЧИНА ОТМЕНЫ" : "ИТОГ ПЛАНА";
  const nextTitle = isCancelled
    ? "План отменён"
    : isCompleted
      ? "Результат зафиксирован"
      : isDraft
        ? "Подготовьте состав"
        : (plan.nextStageTitle ?? "Проверьте результат");
  const nextDescription = isCancelled
    ? "Основание выполнения снято. Причина сохранена в плане."
    : isCompleted
      ? "Итог сохранён в описании плана."
      : isDraft
        ? "Уточните этапы и задачи, затем явно начните план."
        : "Начало плана не перемещает задачи между колонками автоматически.";
  const actionTitle = isActionDisabled ? actionHint : undefined;
  const isTransitionOpen = isDefined(transitionMode);
  const transitionTitle = transitionMode === "cancel" ? "Отменить план" : "Завершить план";
  const outcomeLabel =
    transitionMode === "cancel" ? "Почему работа отменена" : "Итог и подтверждение результата";

  useEffect(() => {
    document.title = `${plan.title} · Relay`;
    headingRef.current?.focus({ preventScroll: true });
  }, [plan.id, plan.title]);

  /**
   * Переключает адресную вкладку без потери остальных параметров.
   */
  const handleTab = (tab: string | null) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("tab", tab ?? defaultTab);
      return next;
    });
  };

  /**
   * Выполняет начало либо открывает подтверждение с исходной ревизией.
   */
  const handleTransition = async () => {
    if (isDraft) {
      setIsStarting(true);
      try {
        await transitionPlan(projectId, plan.id, plan.revision, "start");
        void refresh().catch(() => undefined);
        setError(null);
      } catch (error) {
        if (error instanceof PlanningError) setError(error.message);
        else throw error;
      } finally {
        setIsStarting(false);
      }
      return;
    }
    setTransitionRevision(outcomeDraft.success ? outcomeDraft.data.revision : plan.revision);
    setTransitionMode("complete");
  };

  /**
   * Фиксирует итог только после повторной серверной проверки состава.
   */
  const handleOutcome = async (values: typeof outcomeForm.values) => {
    const action = transitionMode === "cancel" ? "cancel" : "complete";
    try {
      await transitionPlan(projectId, plan.id, transitionRevision, action, values.result);
      void refresh().catch(() => undefined);
      removeSessionStored(outcomeKey);
      setError(null);
      setTransitionMode(null);
    } catch (error) {
      if (error instanceof PlanningError) setError(error.message);
      else throw error;
    }
  };

  return (
    <div className={styles.root}>
      <Link to={`${basePath}/plans`} className={styles.back}>
        <ArrowLeft size={14} />
        Все планы
      </Link>
      <header className={styles.header}>
        <div className={styles.identity}>
          <div className={styles.meta}>
            <span className={styles.typeIcon}>
              <Flag size={16} />
            </span>
            <span className={styles.key}>{plan.key}</span>
            <Badge variant="light" color={PLAN_STATUS_COLORS[plan.status]} className={styles.badge}>
              {statusLabel}
            </Badge>
          </div>
          <h1 className={styles.title} ref={headingRef} tabIndex={-1}>
            {plan.title}
          </h1>
          <p className={styles.summary}>{plan.summary}</p>
        </div>
        <div className={styles.actions}>
          {canEdit && (
            <Button variant="default" leftSection={<Pencil size={14} />} onClick={onEdit}>
              Изменить
            </Button>
          )}
          {canEdit && (
            <Button
              disabled={isActionDisabled}
              loading={isStarting}
              title={actionTitle}
              leftSection={<ActionIcon size={14} />}
              onClick={handleTransition}
            >
              {actionLabel}
            </Button>
          )}
          {canEdit && (
            <Menu position="bottom-end">
              <Menu.Target>
                <MantineActionIcon
                  aria-label="Другие действия с планом"
                  variant="default"
                  size={36}
                >
                  <MoreHorizontal size={16} />
                </MantineActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  color="red"
                  leftSection={<Ban size={14} />}
                  onClick={() => {
                    setTransitionRevision(
                      outcomeDraft.success ? outcomeDraft.data.revision : plan.revision,
                    );
                    setTransitionMode("cancel");
                  }}
                >
                  Отменить план
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          )}
        </div>
      </header>
      <div className={styles.mobileProgress}>
        <span>
          {summaryData.done} из {summaryData.total} задач
        </span>
        <Progress
          value={summaryData.percent}
          size={4}
          color="teal"
          className={styles.mobileTrack}
          aria-label={`Выполнение ${summaryData.percent}%`}
        />
        <a href="#plan-summary">Сводка · {summaryData.percent}%</a>
      </div>
      {hasError && (
        <Alert
          color="red"
          title="Изменение не сохранено"
          withCloseButton
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}
      {hasDivergence && (
        <Alert color="orange" title="Состав изменился после завершения" mb="md">
          Сохранённый итог остаётся историческим фактом. Текущие обязательства задач больше не
          выполнены; подробности доступны в задачах этапов.
        </Alert>
      )}

      <div className={styles.layout}>
        <div className={styles.main}>
          <section className={styles.goal}>
            <div className={styles.sectionLabel}>
              <Target size={15} />
              ЦЕЛЬ ПЛАНА
            </div>
            <MarkdownView
              text={plan.goal}
              compact
              emptyText="Сформулируйте результат, ради которого начинается работа."
            />
          </section>
          <Tabs
            value={activeTab}
            onChange={handleTab}
            classNames={{ list: styles.tabs, tab: styles.tab }}
          >
            <Tabs.List aria-label="Содержание плана">
              <Tabs.Tab value="stages" leftSection={<Layers3 size={14} />}>
                Этапы и задачи<span className={styles.tabCount}>{plan.stageCount}</span>
              </Tabs.Tab>
              <Tabs.Tab value="overview" leftSection={<FileText size={14} />}>
                Описание
              </Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="stages" pt="lg">
              <PlanStages plan={plan} />
            </Tabs.Panel>
            <Tabs.Panel value="overview" pt="lg">
              <PlanOverview plan={plan} />
            </Tabs.Panel>
          </Tabs>
          {hasResult && (
            <section className={styles.result}>
              <div className={styles.sectionLabel}>
                <Check size={15} />
                {resultLabel}
              </div>
              <MarkdownView text={plan.result} compact />
            </section>
          )}
        </div>

        <aside className={styles.aside} id="plan-summary" aria-label="Сводка плана">
          <section className={styles.progressPanel}>
            <h2 className={styles.asideTitle}>Выполнение задач</h2>
            <div className={styles.progressValue}>
              <strong>
                {summaryData.percent}
                <span>%</span>
              </strong>
              <span>
                {summaryData.done} из {summaryData.total} завершено
              </span>
            </div>
            <Progress
              value={summaryData.percent}
              size={5}
              color="teal"
              aria-label={`Завершено ${summaryData.done} из ${summaryData.total} задач`}
            />
            <dl className={styles.counts}>
              <div>
                <dt>
                  <span className={styles.dot} data-state="done" />
                  Готово
                </dt>
                <dd>{summaryData.done}</dd>
              </div>
              <div>
                <dt>
                  <span className={styles.dot} data-state="active" />В работе
                </dt>
                <dd>{summaryData.active}</dd>
              </div>
              <div>
                <dt>
                  <span className={styles.dot} data-state="review" />
                  На проверке
                </dt>
                <dd>{summaryData.review}</dd>
              </div>
              <div>
                <dt>
                  <span className={styles.dot} />
                  Остальные
                </dt>
                <dd>
                  {summaryData.total - summaryData.done - summaryData.active - summaryData.review}
                </dd>
              </div>
            </dl>
            {hasBlockers && (
              <div className={styles.blocker}>
                <CircleAlert size={15} />
                <span>
                  Невыполненные обязательства · {summaryData.blocked}
                  <small>Подробности — в задачах этапа</small>
                </span>
              </div>
            )}
          </section>
          <section className={styles.asideSection}>
            <h2 className={styles.asideTitle}>Область изменения</h2>
            <div className={styles.scope}>
              {plan.scopeLabels.map((scope) => (
                <span key={scope}>{scope}</span>
              ))}
            </div>
            {!hasScope && <p className={styles.hint}>Область ещё не указана.</p>}
          </section>
          <section className={styles.next}>
            <span className={styles.sectionLabel}>СЛЕДУЮЩИЙ ШАГ</span>
            <h2>{nextTitle}</h2>
            <p>{nextDescription}</p>
          </section>
          <div className={styles.updated}>
            Обновлён {dateLabel}
            <span>Ревизия {plan.revision}</span>
          </div>
        </aside>
      </div>
      <Modal
        attributes={{ header: { role: "presentation" } }}
        opened={isTransitionOpen}
        onClose={() => setTransitionMode(null)}
        title={transitionTitle}
        size="lg"
        closeButtonProps={{ "aria-label": "Свернуть подтверждение" }}
      >
        <form onSubmit={outcomeForm.onSubmit(handleOutcome)}>
          <p className={styles.hint}>
            Состояние и итог сохранятся в проекте. Готовность повторно проверит сервер.
          </p>
          <MarkdownField
            label={outcomeLabel}
            disabled={outcomeForm.submitting}
            key={outcomeForm.key("result")}
            {...outcomeForm.getInputProps("result")}
          />
          {hasError && (
            <Alert color="red" mt="md">
              {error}
            </Alert>
          )}
          <Group justify="flex-end" mt="lg">
            <Button variant="default" onClick={() => setTransitionMode(null)}>
              Свернуть
            </Button>
            <Button type="submit" loading={outcomeForm.submitting}>
              {transitionTitle}
            </Button>
          </Group>
        </form>
      </Modal>
    </div>
  );
};
