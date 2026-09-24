import { useState } from "react";
import { Badge, Button, Checkbox, Select, TextInput } from "@mantine/core";
import { Search } from "lucide-react";
import { getPlanSummary, PLAN_STATUS_LABELS, PLAN_STATUS_COLORS } from "domains/planning-demo";
import { isDefined, isEmptyArray } from "shared/value-predicates";
import type { ReleasePlanPickerProps } from "./types/release-plan-picker-props.type";
import styles from "./styles/release-plan-picker.module.css";

/**
 * Выбирает планы в форме релиза и сохраняет выбор при поиске и смене страницы.
 *
 * Используется для:
 *  - комплектования будущего выпуска незавершёнными и готовыми планами
 */
export const ReleasePlanPicker = (props: ReleasePlanPickerProps) => {
  const { work, selectedIds, onChange, error } = props;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [limit, setLimit] = useState(12);
  const candidateItems = work.plans.filter(
    (plan) =>
      (status === "all" || plan.status === status) &&
      `${plan.title} ${plan.key}`.toLocaleLowerCase("ru").includes(query.toLocaleLowerCase("ru")),
  );
  const planItems = candidateItems.slice(0, limit).map((plan) => ({
    ...plan,
    isSelected: selectedIds.includes(plan.id),
    isDisabled: plan.status === "cancelled" && !selectedIds.includes(plan.id),
    progress: getPlanSummary(plan, work.tasks),
  }));
  const hiddenCount = selectedIds.filter((id) => !planItems.some((plan) => plan.id === id)).length;
  const missingIds = selectedIds.filter((id) => !work.plans.some((plan) => plan.id === id));
  const hasHidden = hiddenCount > 0;
  const isEmpty = isEmptyArray(planItems);
  const hasMore = candidateItems.length > limit;
  const hasError = isDefined(error);

  /**
   * Меняет один элемент полного выбора без потери скрытых строк.
   */
  const handleSelect = (id: string, isSelected: boolean) =>
    onChange(isSelected ? [...selectedIds, id] : selectedIds.filter((selected) => selected !== id));

  return (
    <section className={styles.root} aria-label="Выбор планов для релиза">
      <div className={styles.heading}>
        <h3>
          Состав релиза <span aria-hidden="true">*</span>
        </h3>
        <span role="status">Выбрано: {selectedIds.length}</span>
      </div>
      <div className={styles.toolbar}>
        <TextInput
          id="release-plan-search"
          className={styles.search}
          aria-label="Поиск планов для релиза"
          placeholder="Название или ключ плана"
          leftSection={<Search size={14} />}
          value={query}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
            setLimit(12);
          }}
        />
        <Select
          className={styles.status}
          aria-label="Состояние выбираемых планов"
          allowDeselect={false}
          value={status}
          onChange={(next) => {
            setStatus(next ?? "all");
            setLimit(12);
          }}
          data={[
            { value: "all", label: "Все состояния" },
            { value: "active", label: "В работе" },
            { value: "completed", label: "Завершённые" },
            { value: "draft", label: "Черновики" },
            { value: "cancelled", label: "Отменённые" },
          ]}
        />
      </div>
      {hasHidden && <p className={styles.hidden}>Вне текущего списка выбрано: {hiddenCount}</p>}
      <div className={styles.list}>
        {planItems.map((plan) => (
          <div key={plan.id} className={styles.choice} data-selected={plan.isSelected}>
            <Checkbox
              className={styles.checkbox}
              label={plan.title}
              description={`${plan.key} · ${plan.progress.done} из ${plan.progress.total} задач`}
              checked={plan.isSelected}
              disabled={plan.isDisabled}
              onChange={(event) => handleSelect(plan.id, event.currentTarget.checked)}
            />
            <Badge
              className={styles.badge}
              color={PLAN_STATUS_COLORS[plan.status]}
              size="sm"
              variant="light"
            >
              {PLAN_STATUS_LABELS[plan.status]}
            </Badge>
          </div>
        ))}
        {isEmpty && (
          <p className={styles.empty}>
            Подходящих планов нет. Измените поиск или создайте план в разделе «Планы».
          </p>
        )}
        {hasMore && (
          <Button variant="subtle" fullWidth onClick={() => setLimit(limit + 12)}>
            Показать ещё · {planItems.length} из {candidateItems.length}
          </Button>
        )}
      </div>
      {missingIds.map((id) => (
        <div key={id} className={styles.missing}>
          <span>План недоступен: {id}</span>
          <Button size="xs" variant="subtle" onClick={() => handleSelect(id, false)}>
            Убрать из состава
          </Button>
        </div>
      ))}
      {hasError && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </section>
  );
};
