import { Checkbox, MultiSelect, NumberInput, Select, Textarea, TextInput } from "@mantine/core";
import { KIND_LABELS, statusLabel } from "domains/lifecycle";
import type { RecordFieldProps } from "./types/record-field-props.type";

/**
 * Подбирает ввод и доступные связи для конкретного поля проектной формы.
 *
 * Используется для:
 *  - редактирования связей без ручного ввода идентификаторов
 */
export const RecordField = (props: RecordFieldProps) => {
  const { field, form, state } = props;
  const taskType = form.useWatchValue("type");
  const hasVisibleField = !field.bugOnly || taskType === "bug";
  const fieldProps = {
    label: field.label,
    description: field.description,
    required: field.required,
    ...form.getInputProps(field.key),
  };
  const taskItems =
    state?.tasks.map((task) => ({
      value: String(task.id),
      label: `#${task.id} · ${task.title}`,
    })) ?? [];
  const recordItems =
    state?.records
      .filter(
        (record) => field.referenceKind === undefined || record.fields.kind === field.referenceKind,
      )
      .map((record) => ({
        value: record.id,
        label: `${KIND_LABELS[record.fields.kind]} · ${record.fields.title || record.id}`,
      })) ?? [];
  const enumItems = field.options?.map((value) => ({ value, label: statusLabel(value) })) ?? [];
  if (!hasVisibleField) return null;
  if (field.type === "markdown")
    return <Textarea key={form.key(field.key)} {...fieldProps} autosize minRows={3} maxRows={12} />;
  if (field.type === "boolean")
    return (
      <Checkbox
        key={form.key(field.key)}
        label={field.label}
        {...form.getInputProps(field.key, { type: "checkbox" })}
      />
    );
  if (field.type === "number")
    return <NumberInput key={form.key(field.key)} {...fieldProps} min={0} allowDecimal={false} />;
  if (field.type === "select")
    return (
      <Select key={form.key(field.key)} {...fieldProps} data={enumItems} allowDeselect={false} />
    );
  if (field.type === "task")
    return (
      <Select key={form.key(field.key)} {...fieldProps} data={taskItems} searchable clearable />
    );
  if (field.type === "tasks")
    return (
      <MultiSelect
        key={form.key(field.key)}
        {...fieldProps}
        data={taskItems}
        searchable
        clearable
      />
    );
  if (field.type === "reference")
    return (
      <Select key={form.key(field.key)} {...fieldProps} data={recordItems} searchable clearable />
    );
  if (field.type === "multi")
    return (
      <MultiSelect
        key={form.key(field.key)}
        {...fieldProps}
        data={recordItems}
        searchable
        clearable
      />
    );
  return <TextInput key={form.key(field.key)} {...fieldProps} />;
};
