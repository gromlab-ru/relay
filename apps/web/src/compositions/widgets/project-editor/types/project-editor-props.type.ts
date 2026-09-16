import type { ProjectKind, ProjectRecord, ProjectValues } from "domains/lifecycle";

/** Сценарий создания или редактирования проектного документа. */
export type ProjectEditorProps = {
  /** Вид документа. */ kind: ProjectKind;
  /** Прочитанный документ; отсутствие означает создание. */ record?: ProjectRecord | undefined;
  /** Контекст места создания: этап, задача, релиз. */ initial?: ProjectValues | undefined;
  /** Поля узкого сценария, например обновления сводки. */ fieldKeys?: string[] | undefined;
  /** Название конкретного действия. */ heading?: string | undefined;
  /** Закрытие с сохранением локального черновика. */ onClose: () => void;
  /** Завершение сохранения. */ onSaved?: ((record: ProjectRecord) => void) | undefined;
};
/** Выбранный сценарий редактирования на экране. */
export type ProjectEdit = Pick<
  ProjectEditorProps,
  "kind" | "record" | "initial" | "fieldKeys" | "heading"
>;
