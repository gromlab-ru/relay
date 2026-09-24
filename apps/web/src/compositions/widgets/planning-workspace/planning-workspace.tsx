import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Alert, Button, Group, Menu, Modal } from "@mantine/core";
import { ChevronDown, FlaskConical, RotateCcw, SquareDashed } from "lucide-react";
import { useProjectBasePath, useProjectId } from "domains/project";
import { createDemoPlan, usePlanningDemo } from "domains/planning-demo";
import type { PlanningPlan } from "domains/planning-demo";
import { StatePanel } from "ui/state-panel";
import { isDefined } from "shared/value-predicates";
import { PlanCatalog } from "./ui/plan-catalog";
import { PlanDetail } from "./ui/plan-detail";
import { PlanForm } from "./ui/plan-form";
import styles from "./styles/planning-workspace.module.css";

/** Открытая форма с самостоятельной идентичностью черновика. */
type EditorState = {
  /** Исходное содержимое формы. */
  plan: PlanningPlan;
  /** Создание вместо изменения. */
  isNew: boolean;
};

/**
 * Соединяет каталог и подробности интерактивного прототипа планирования.
 *
 * Используется для:
 *  - работы с целями, этапами и задачами в общем каркасе проекта
 */
export const PlanningWorkspace = () => {
  const basePath = useProjectBasePath();
  const projectId = useProjectId();
  const navigate = useNavigate();
  const { planId } = useParams();
  const demo = usePlanningDemo(projectId);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [resetMode, setResetMode] = useState<"empty" | "examples" | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const demoData = demo.data;
  const planData = demoData?.plans.find((plan) => plan.id === planId);
  const hasUnknownPlan = isDefined(planId) && !isDefined(planData);
  const hasResetError = isDefined(resetError);
  const hasReset = isDefined(resetMode);
  const resetTitle = resetMode === "empty" ? "Начать с пустого каталога?" : "Восстановить примеры?";
  const resetLabel = resetMode === "empty" ? "Очистить локальный каталог" : "Восстановить примеры";

  /**
   * Открывает компактное создание без записи пустой сущности.
   */
  const handleCreate = () => {
    if (!isDefined(demoData)) return;
    setEditor({
      plan: createDemoPlan(demoData.plans),
      isNew: true,
    });
  };

  /**
   * После сохранения открывает адрес созданного или изменённого плана.
   */
  const handleFormSave = (plan: PlanningPlan) => {
    const error = demo.savePlan(plan);
    if (error !== null) return error;
    navigate(`${basePath}/plans/${plan.id}`);
    return null;
  };

  /**
   * Подтверждает замену исключительно локального набора.
   */
  const handleReset = () => {
    const error = demo.reset(resetMode === "empty");
    setResetError(error);
    if (error !== null) return;
    setResetMode(null);
    navigate(`${basePath}/plans`);
  };

  if (!isDefined(demoData)) {
    return (
      <StatePanel
        title="Прототип не удалось открыть"
        titleAs="h1"
        description={resetError ?? demo.error ?? "Локальное хранилище недоступно."}
        action={
          <Button
            onClick={() => {
              setResetError(demo.reset(false));
            }}
          >
            Восстановить примеры
          </Button>
        }
      />
    );
  }

  if (hasUnknownPlan) {
    return (
      <StatePanel
        title="План не найден"
        titleAs="h1"
        description="В этом примере нет плана с таким адресом."
        action={
          <Button component={Link} to={`${basePath}/plans`}>
            К планам
          </Button>
        }
      />
    );
  }

  return (
    <section className={styles.root}>
      <div className={styles.preview}>
        <FlaskConical size={14} aria-hidden="true" />
        <strong>Прототип</strong>
        <span className={styles.previewText}>
          Пример сервиса аренды · изменения только в этой вкладке
        </span>
        <Menu position="bottom-end">
          <Menu.Target>
            <button type="button" className={styles.examples}>
              Примеры
              <ChevronDown size={12} />
            </button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<SquareDashed size={14} />}
              onClick={() => setResetMode("empty")}
            >
              Начать с пустого каталога
            </Menu.Item>
            <Menu.Item
              leftSection={<RotateCcw size={14} />}
              onClick={() => setResetMode("examples")}
            >
              Восстановить примеры
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </div>
      {!isDefined(planId) && (
        <PlanCatalog data={demoData} basePath={basePath} onCreate={handleCreate} />
      )}
      {isDefined(planData) && (
        <PlanDetail
          key={`detail-${planData.id}`}
          plan={planData}
          data={demoData}
          basePath={basePath}
          onEdit={() => setEditor({ plan: planData, isNew: false })}
          onSave={demo.savePlan}
        />
      )}
      {isDefined(editor) && (
        <PlanForm
          key={`editor-${editor.plan.id}`}
          plan={editor.plan}
          isNew={editor.isNew}
          projectId={projectId}
          onSave={handleFormSave}
          onClose={() => setEditor(null)}
        />
      )}
      <Modal
        attributes={{ header: { role: "presentation" } }}
        opened={hasReset}
        onClose={() => setResetMode(null)}
        title={resetTitle}
        closeButtonProps={{ "aria-label": "Отменить замену примеров" }}
      >
        <p className={styles.resetText}>
          Изменения планов в этом прототипе будут заменены. Данные проекта и его задач останутся
          прежними.
        </p>
        {hasResetError && <Alert color="red">{resetError}</Alert>}
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={() => setResetMode(null)}>
            Отмена
          </Button>
          <Button onClick={handleReset}>{resetLabel}</Button>
        </Group>
      </Modal>
    </section>
  );
};
