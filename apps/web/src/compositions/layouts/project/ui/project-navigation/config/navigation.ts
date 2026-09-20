import {
  AppWindow,
  FileText,
  Files,
  Flag,
  History,
  Layers3,
  Network,
  Sparkles,
} from "lucide-react";

/** Подразделы продукта в порядке знакомства с ним. */
export const PRODUCT_NAVIGATION = [
  { path: "passport", label: "Паспорт", Icon: FileText },
  { path: "features", label: "Возможности", Icon: Sparkles },
  { path: "applications", label: "Приложения", Icon: AppWindow },
  { path: "documents", label: "Документы", Icon: Files },
];

/** Рабочие разделы проекта после продуктового контекста. */
export const PROJECT_NAVIGATION = [
  { path: "relations", label: "Связи проекта", Icon: Network },
  { path: "plans", label: "Планы", Icon: Flag },
  { path: "releases", label: "Релизы", Icon: Layers3 },
  { path: "history", label: "История", Icon: History },
];
