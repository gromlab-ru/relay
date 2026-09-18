import { useEffect, useRef, useState } from "react";
import { readDemoSession, refreshDemoSession, writeDemoSession } from "../../adapters/demo-session";
import { createSnapshot } from "../../helpers/create-snapshot";
import { updateDocument } from "../../helpers/update-document";
import { updateApplicationScope } from "../../helpers/update-application-scope";
import { validateApplicationScope } from "../../helpers/validate-application-scope";
import { DOCUMENTATION_INPUT_SCHEMA } from "../../config/documentation.schema";
import type { ProductDocumentationInput } from "../../types/documentation.type";
import { ProductDemoContext } from "./product-demo-context";
import type { DemoSession } from "../../adapters/demo-session";
import type {
  DemoMode,
  ProductDocumentInput,
  ProductContributionInput,
  ProductSnapshot,
  ProductSaveResult,
} from "../../types/product-demo.type";
import type { ProductDemoProviderProps } from "./types/product-demo-provider-props.type";

/**
 * Подключает единую моковую модель продукта в рамках текущего проекта.
 *
 * Используется для:
 *  - согласованного чтения паспорта, фич, приложений и работы
 *  - сохранения локальных правок между переходами и обновлениями страницы
 */
export const ProductDemoProvider = (props: ProductDemoProviderProps) => {
  const { scopeId, children } = props;
  const [initialData] = useState(() => readDemoSession(scopeId));
  const [session, setSession] = useState(initialData.session);
  const [notice, setNotice] = useState(initialData.notice);
  const sessionRef = useRef(session);
  useEffect(() => {
    const refreshed = refreshDemoSession(sessionRef.current);
    if (refreshed !== sessionRef.current) {
      sessionRef.current = refreshed;
      setSession(refreshed);
      setNotice(
        "Стандартные примеры вкладов дополнены Markdown-описаниями реализации и проверок. Ваши правки сохранены.",
      );
    }
    if (!writeDemoSession(scopeId, refreshed))
      setNotice("Хранилище вкладки недоступно. Изменения живут до обновления страницы.");
  }, [scopeId]);
  /**
   * Публикует снимок для последовательных локальных действий.
   */
  const publishSession = (nextSession: DemoSession): void => {
    sessionRef.current = nextSession;
    setSession(nextSession);
  };
  /**
   * Переключает сценарий, сохраняя независимые наборы данных.
   */
  const setMode = (mode: DemoMode): void => {
    const currentSession = sessionRef.current;
    const bucket = mode === "filled" || mode === "empty" ? mode : currentSession.bucket;
    const nextSession = { ...currentSession, mode, bucket };
    if (!writeDemoSession(scopeId, nextSession))
      setNotice("Хранилище вкладки недоступно. Изменения живут до обновления страницы.");
    publishSession(nextSession);
  };
  /**
   * Возвращает общий отказ сохранения, сохраняя ввод у владельца формы.
   */
  const getSaveError = (revision: number): string => {
    const currentSession = sessionRef.current;
    if (currentSession.mode === "save-error") {
      setMode(currentSession.bucket);
      return "Проверочная ошибка сохранения. Ввод остался в черновике. Повторите сохранение.";
    }
    if (revision !== currentSession[currentSession.bucket].revision)
      return "Данные изменились. Выберите, с какой версией продолжить; ваш ввод сохранён.";
    return "";
  };
  /**
   * Публикует полностью подготовленное изменение только после локальной записи.
   */
  const persistSnapshot = (snapshot: ProductSnapshot, id: string): ProductSaveResult => {
    const currentSession = sessionRef.current;
    const nextSession = { ...currentSession, [currentSession.bucket]: snapshot };
    if (!writeDemoSession(scopeId, nextSession))
      return {
        isSaved: false,
        message:
          "Браузер не разрешил локальное сохранение. Ввод остаётся в форме; повторите попытку.",
      };
    publishSession(nextSession);
    setNotice("");
    return { isSaved: true, id };
  };
  /**
   * Сохраняет описание документа, не меняя состав реализации приложений.
   */
  const saveDocument = async (
    input: ProductDocumentInput,
    revision: number,
  ): Promise<ProductSaveResult> => {
    const error = getSaveError(revision);
    if (error !== "") return { isSaved: false, message: error };
    const currentSession = sessionRef.current;
    const currentSnapshot = currentSession[currentSession.bucket];
    if (
      input.kind === "scenarios" &&
      !currentSnapshot.features.some((feature) => feature.id === input.featureId)
    )
      return { isSaved: false, message: "Родительская фича больше не существует. Ввод сохранён." };
    const id = input.id || crypto.randomUUID();
    return persistSnapshot(updateDocument(currentSnapshot, { ...input, id }), id);
  };
  /**
   * Сохраняет материал библиотеки; моковые области не создают связей с другими сущностями.
   */
  const saveDocumentation = async (
    input: ProductDocumentationInput,
    revision: number,
  ): Promise<ProductSaveResult> => {
    const error = getSaveError(revision);
    if (error !== "") return { isSaved: false, message: error };
    const parsed = DOCUMENTATION_INPUT_SCHEMA.safeParse(input);
    if (!parsed.success || input.name.trim() === "" || input.body.trim() === "")
      return { isSaved: false, message: "Укажите название и текст документа." };
    const current = sessionRef.current[sessionRef.current.bucket];
    if (input.id !== "" && !current.documentation.some((entry) => entry.id === input.id))
      return { isSaved: false, message: "Документ больше не существует. Ваш ввод сохранён." };
    const id = input.id || crypto.randomUUID();
    const document = {
      ...parsed.data,
      id,
      name: input.name.trim(),
      summary: input.summary.trim(),
      updatedAt: new Date().toISOString(),
    };
    const documentation =
      input.id === ""
        ? [document, ...current.documentation]
        : current.documentation.map((entry) => (entry.id === id ? document : entry));
    return persistSnapshot({ ...current, documentation, revision: current.revision + 1 }, id);
  };
  /**
   * Атомарно сохраняет выбранные фичи, сценарии и описания вклада одного приложения.
   */
  const saveApplicationScope = async (
    applicationId: string,
    contributions: ProductContributionInput[],
    revision: number,
  ): Promise<ProductSaveResult> => {
    const error = getSaveError(revision);
    if (error !== "") return { isSaved: false, message: error };
    const currentSession = sessionRef.current;
    const currentSnapshot = currentSession[currentSession.bucket];
    const validationError = validateApplicationScope(currentSnapshot, applicationId, contributions);
    if (validationError !== "") return { isSaved: false, message: validationError };
    return persistSnapshot(
      updateApplicationScope(currentSnapshot, applicationId, contributions),
      applicationId,
    );
  };
  /**
   * Восстанавливает исходный продукт и инвалидирует предыдущие черновики.
   */
  const reset = (): void => {
    const nextSession: DemoSession = {
      filled: createSnapshot(),
      empty: createSnapshot(true),
      bucket: "filled",
      mode: "filled",
    };
    const isStored = writeDemoSession(scopeId, nextSession);
    setNotice(
      isStored
        ? "Исходные данные восстановлены."
        : "Исходные данные восстановлены. Хранилище вкладки недоступно.",
    );
    publishSession(nextSession);
  };
  return (
    <ProductDemoContext
      value={{
        snapshot: session[session.bucket],
        mode: session.mode,
        notice,
        setMode,
        saveDocument,
        saveDocumentation,
        saveApplicationScope,
        reset,
      }}
    >
      {children}
    </ProductDemoContext>
  );
};
