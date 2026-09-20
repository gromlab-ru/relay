import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Alert, Badge, Button, Group, Progress, SimpleGrid, Stack, Text } from "@mantine/core";
import { ArrowLeft, CheckCircle2, Circle, Flag, Plus, Target } from "lucide-react";
import { useProjectBasePath, useProjectId } from "domains/project";
import {
  isRecordOf,
  PROJECT_INPUT_SCHEMAS,
  saveProjectRecord,
  statusColor,
  statusLabel,
  useLifecycle,
} from "domains/lifecycle";
import { ProjectPage } from "compositions/widgets/project-page";
import { ProjectEditor } from "compositions/widgets/project-editor";
import type { ProjectEdit } from "compositions/widgets/project-editor";
import { ProjectRecord } from "compositions/widgets/project-record";
import { ProductLinks } from "compositions/widgets/product-links";
import { isDefined, isEmptyArray } from "shared/value-predicates";
import { StageDetail } from "./ui/stage-detail/stage-detail";
import styles from "./styles/plans.module.css";

/**
 * Связывает цель плана с этапами, критериями и реальными задачами доски.
 *
 * Используется для:
 *  - планирования создания и развития продукта
 *  - контроля результата этапов без двойного учёта задач
 */
export const PlansScreen = () => {
  const lifecycle = useLifecycle();
  const base = useProjectBasePath();
  const projectId = useProjectId();
  const { planId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [editor, setEditor] = useState<ProjectEdit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setSaving] = useState(false);
  const state = lifecycle.data;
  const planItems = state?.records.filter((record) => isRecordOf(record, "plan")) ?? [];
  const plan = planItems.find((record) => record.id === planId);
  const stageItems =
    state?.records
      .filter((record) => isRecordOf(record, "stage") && record.fields.planId === plan?.id)
      .sort((a, b) => {
        if (!isRecordOf(a, "stage") || !isRecordOf(b, "stage")) return 0;
        return a.fields.order - b.fields.order || a.createdAt.localeCompare(b.createdAt);
      }) ?? [];
  const stage = stageItems.find((record) => record.id === params.get("stage")) ?? stageItems[0];
  const passportRecord = state?.records.find((record) => isRecordOf(record, "passport"));
  const passport =
    passportRecord?.fields ?? PROJECT_INPUT_SCHEMAS.passport.parse({ kind: "passport" });
  const isFocused = plan !== undefined && passport.focusPlanId === plan.id;
  const hasError = error !== null;
  const isEmpty = isEmptyArray(planItems);
  const hasNoStages = isEmptyArray(stageItems);
  const hasProductLinks = plan !== undefined && !isEmptyArray(plan.fields.productLinks);
  const progress = plan === undefined ? undefined : state?.progress[plan.id];
  const acceptedCount = stageItems.filter(
    (record) => isRecordOf(record, "stage") && record.fields.status === "accepted",
  ).length;
  const hasSelectedStage = stage !== undefined && isRecordOf(stage, "stage") && state !== undefined;
  const stageRows = stageItems.map((record, index) => ({
    record,
    number: index + 1,
    isSelected: record.id === stage?.id,
    Icon:
      isRecordOf(record, "stage") && record.fields.status === "accepted" ? CheckCircle2 : Circle,
    progress: state?.progress[record.id],
  }));

  /**
   * Явно выбирает ближайшую цель для обзора проекта и агентского контекста.
   */
  const handleFocus = async (): Promise<void> => {
    if (plan === undefined) return;
    setSaving(true);
    setError(null);
    try {
      await saveProjectRecord(
        projectId,
        { ...passport, focusPlanId: plan.id },
        passportRecord,
        crypto.randomUUID(),
      );
      await lifecycle.mutate();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Не удалось выбрать план.");
    } finally {
      setSaving(false);
    }
  };

  if (planId === undefined)
    return (
      <ProjectPage
        title="Планы работ"
        description="От ожидаемого результата — к этапам и конкретной работе."
        isLoading={lifecycle.isLoading && state === undefined}
        error={lifecycle.error}
        actions={
          <Button leftSection={<Plus size={14} />} onClick={() => setEditor({ kind: "plan" })}>
            Новый план
          </Button>
        }
      >
        {isEmpty && (
          <div className={styles.empty}>
            <Flag size={36} />
            <h2>Какого результата добиваемся?</h2>
            <Text c="dimmed" size="sm" maw={440}>
              Создайте план первого выпуска, новой возможности или технического улучшения. Разбейте
              результат на этапы и свяжите их с задачами.
            </Text>
            <Button mt="lg" onClick={() => setEditor({ kind: "plan" })}>
              Составить первый план
            </Button>
          </div>
        )}
        <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg">
          {planItems.map((record) => {
            const count = state?.progress[record.id];
            const percent = count && count.total > 0 ? (count.completed / count.total) * 100 : 0;
            const isFocus = record.id === passport.focusPlanId;
            return (
              <ProjectRecord
                key={record.id}
                record={record}
                onEdit={(record) => setEditor({ kind: "plan", record })}
                action={
                  <Button
                    component={Link}
                    to={`${base}/plans/${record.id}`}
                    size="xs"
                    variant="subtle"
                  >
                    Открыть план →
                  </Button>
                }
              >
                <Progress
                  value={percent}
                  size={5}
                  mt="lg"
                  aria-label={`Выполнение задач плана ${record.fields.title}`}
                />
                <Group justify="space-between" mt="xs">
                  <Text c="dimmed" size="xs">
                    {count?.completed ?? 0}/{count?.total ?? 0} задач выполнено
                  </Text>
                  {isFocus && (
                    <Badge size="xs" variant="dot">
                      В фокусе
                    </Badge>
                  )}
                </Group>
              </ProjectRecord>
            );
          })}
        </SimpleGrid>
        {isDefined(editor) && (
          <ProjectEditor
            {...editor}
            onClose={() => setEditor(null)}
            onSaved={(record) => {
              if (record.fields.kind === "plan") navigate(`${base}/plans/${record.id}`);
            }}
          />
        )}
      </ProjectPage>
    );
  if (plan === undefined)
    return (
      <ProjectPage
        title="План недоступен"
        description="Проверьте ссылку или выберите план из списка."
        isLoading={lifecycle.isLoading}
        error={lifecycle.error}
        actions={
          <Button component={Link} to={`${base}/plans`}>
            К планам
          </Button>
        }
      />
    );
  return (
    <ProjectPage
      title={plan.fields.title}
      description={
        plan.fields.goal || "Определите результат плана и добавьте этапы его достижения."
      }
      error={lifecycle.error}
      actions={
        <>
          <Button variant="default" onClick={() => setEditor({ kind: "plan", record: plan })}>
            Изменить
          </Button>
          <Button
            variant="light"
            leftSection={<Target size={14} />}
            loading={isSaving}
            disabled={isFocused}
            onClick={() => void handleFocus()}
          >
            В фокус проекта
          </Button>
        </>
      }
    >
      <Group justify="space-between" mb="lg">
        <Button
          component={Link}
          to={`${base}/plans`}
          leftSection={<ArrowLeft size={14} />}
          variant="subtle"
          color="gray"
          size="xs"
        >
          Все планы
        </Button>
        <Group gap="xs">
          <Badge color={statusColor(plan.fields.status)} variant="light">
            {statusLabel(plan.fields.status)}
          </Badge>
          <Text c="dimmed" size="xs">
            Принято этапов {acceptedCount}/{stageItems.length} · выполнено задач{" "}
            {progress?.completed ?? 0}/{progress?.total ?? 0}
          </Text>
        </Group>
      </Group>
      {hasError && (
        <Alert color="red" mb="lg">
          {error}
        </Alert>
      )}
      {hasProductLinks && <ProductLinks value={plan.fields.productLinks} />}
      <div className={styles.workspace}>
        <aside className={styles.stages}>
          <Group justify="space-between" mb="md">
            <Text size="xs" fw={600} c="dimmed">
              ЭТАПЫ ПЛАНА
            </Text>
            <Button
              size="compact-xs"
              variant="subtle"
              onClick={() =>
                setEditor({ kind: "stage", initial: { planId: plan.id, order: stageItems.length } })
              }
            >
              + Добавить
            </Button>
          </Group>
          <Stack gap={6}>
            {stageRows.map((row) => (
              <button
                className={styles.stage}
                data-selected={row.isSelected}
                key={row.record.id}
                onClick={() => setParams({ stage: row.record.id })}
              >
                <row.Icon size={17} />
                <div>
                  <span>
                    {row.number}. {row.record.fields.title}
                  </span>
                  <small>
                    {row.progress?.completed ?? 0}/{row.progress?.total ?? 0} задач
                  </small>
                </div>
              </button>
            ))}
          </Stack>
          {hasNoStages && (
            <Text size="sm" c="dimmed" py="lg">
              Добавьте первый этап: какой законченный результат нужно получить?
            </Text>
          )}
        </aside>
        {hasSelectedStage && (
          <StageDetail key={stage.id} stage={stage} state={state} onEdit={setEditor} />
        )}
        {hasNoStages && (
          <div className={styles.empty}>
            <Flag size={32} />
            <h2>От цели к этапам</h2>
            <Text c="dimmed" size="sm">
              У каждого этапа будет свой результат, критерии приёмки и связанные задачи.
            </Text>
            <Button
              mt="lg"
              onClick={() => setEditor({ kind: "stage", initial: { planId: plan.id, order: 0 } })}
            >
              Добавить первый этап
            </Button>
          </div>
        )}
      </div>
      {isDefined(editor) && (
        <ProjectEditor
          key={editor.record?.id ?? editor.kind}
          {...editor}
          onClose={() => setEditor(null)}
          onSaved={(record) => {
            if (record.fields.kind === "stage") setParams({ stage: record.id });
          }}
        />
      )}
    </ProjectPage>
  );
};
