import type { ProjectKind } from "domains/lifecycle";

/** Поле сценария редактирования проектного документа. */
export type EditorField = {
  /** Ключ значения формы. */ key: string;
  /** Название для пользователя. */ label: string;
  /** Представление ввода. */ type?:
    | "text"
    | "markdown"
    | "select"
    | "reference"
    | "multi"
    | "task"
    | "tasks"
    | "number"
    | "boolean";
  /** Смысловая группа формы. */ section?: "details" | "links";
  /** Пояснение результата ввода. */ description?: string;
  /** Допустимые значения перечисления. */ options?: string[];
  /** Вид связанных документов. */ referenceKind?: ProjectKind;
  /** Обязательность поля. */ required?: boolean;
  /** Условное поле карточки бага. */ bugOnly?: boolean;
};
