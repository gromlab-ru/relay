import type { UseFormReturnType } from "@mantine/form";
import type { LifecycleState, ProjectValues } from "domains/lifecycle";
import type { EditorField } from "../../../types/field.type";

/** Поле формы с предметными вариантами выбора. */
export type RecordFieldProps = {
  /** Определение пользовательского ввода. */ field: EditorField;
  /** Единый владелец значений и ошибок. */ form: UseFormReturnType<ProjectValues>;
  /** Доступные связи выбранного проекта. */ state: LifecycleState | undefined;
};
