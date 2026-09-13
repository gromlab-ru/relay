/**
 * Готовит читаемую строку сравниваемого поля без потери содержимого.
 */
export const describeValue = (value: unknown): string => {
  if (value === null || value === "") return "Не задано";
  if (Array.isArray(value)) return value.join(", ") || "Пустой список";
  return String(value);
};
