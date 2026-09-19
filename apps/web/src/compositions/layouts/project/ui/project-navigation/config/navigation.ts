import {
  AppWindow,
  BookOpen,
  FileText,
  Files,
  Flag,
  History,
  Layers3,
  LayoutDashboard,
  Radio,
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
  { path: "plans", label: "Планы", Icon: Flag },
  { path: "board", label: "Прежняя доска", Icon: LayoutDashboard },
  // Временно скрыты только в сайдбаре; страницы доступны по прямым адресам.
  { path: "knowledge", label: "Требования и знания", Icon: BookOpen, isHidden: true },
  { path: "activity", label: "Работа и проверки", Icon: Radio, isHidden: true },
  { path: "releases", label: "Релизы", Icon: Layers3 },
  { path: "history", label: "История", Icon: History },
];
