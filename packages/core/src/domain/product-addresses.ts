import type { ProductMutation, ProductRecord } from "./product.js";
import { productIdSchema, productKeySchema } from "./product.js";
import { invariant } from "../shared/errors.js";

export type ProductAddress = {
  id: string;
  key?: string | undefined;
  kind: string;
  name: string;
  applicationId?: string | null | undefined;
  aliases?: readonly string[] | undefined;
};

/** Индивидуальные адреса включают реализации, даже пока читается прежний состав. */
export function productAddresses(
  records: Pick<ProductRecord, "id" | "key" | "fields">[],
): ProductAddress[] {
  return records.flatMap((record): ProductAddress[] => [
    {
      id: record.id,
      key: record.key,
      kind: record.fields.kind,
      name: "name" in record.fields ? record.fields.name : "Состав приложения",
      aliases: "reservedKeys" in record ? (record.reservedKeys as string[] | undefined) : undefined,
    },
    ...(record.fields.kind === "scope"
      ? record.fields.contracts.map((entry) => ({
          id: entry.id,
          key: entry.key,
          kind: "implementation",
          name: entry.title,
          applicationId: record.fields.kind === "scope" ? record.fields.applicationId : undefined,
        }))
      : []),
  ]);
}

/** Ключ никогда не выбирает первую запись при коллизии; ID имеет приоритет. */
export function resolveProductAddress(
  addresses: ProductAddress[],
  ref: string,
  kind?: string,
): ProductAddress {
  const input = ref.includes(":") ? ref.split(":") : undefined;
  const expected = input?.[0] ?? kind;
  const value = input?.[1] ?? ref;
  const candidates = addresses.filter(
    (entry) =>
      (!expected || entry.kind === expected) &&
      (entry.id === value || entry.key === value || entry.aliases?.includes(value)),
  );
  const ids = candidates.filter((entry) => entry.id === value);
  const matches = ids.length > 0 ? ids : candidates;
  invariant(
    matches.length > 0,
    kind ? "INVALID_REFERENCE" : "PRODUCT_RECORD_NOT_FOUND",
    "Сущность продукта не найдена в выбранном проекте",
    3,
  );
  invariant(
    matches.length === 1,
    "AMBIGUOUS_PRODUCT_KEY",
    "Ключ неоднозначен. Используйте ID и назначьте свободный ключ.",
    4,
    { candidates: matches.map(({ id, key, kind, name }) => ({ id, key, kind, name })) },
  );
  const selected = matches[0]!;
  invariant(
    !kind || selected.kind === kind,
    "INVALID_REFERENCE",
    "Тип продуктовой цели не соответствует ссылке",
    4,
  );
  return selected;
}

/** Разрешение относится к входной границе; сохраняются исключительно ID. */
export function normalizeProductMutation(
  command: ProductMutation,
  records: ProductRecord[],
): ProductMutation {
  invariant(
    command.action !== "create" ||
      command.id === undefined ||
      productIdSchema.safeParse(command.id).success,
    "INVALID_ARGUMENT",
    "При создании можно задать постоянный ID, но не ключ вместо ID",
  );
  const addresses = productAddresses(records);
  const resolve = (ref: string, kind?: string) => resolveProductAddress(addresses, ref, kind).id;
  const input = command.fields;
  let fields = input;
  if (input.kind === "scenario")
    fields = { ...input, featureId: resolve(input.featureId, "feature") };
  if (input.kind === "scope")
    fields = {
      ...input,
      applicationId: resolve(input.applicationId, "application"),
      contracts: input.contracts.map((entry) => ({
        ...entry,
        featureId: resolve(entry.featureId, "feature"),
        scenarioId: entry.scenarioId === null ? null : resolve(entry.scenarioId, "scenario"),
      })),
    };
  if (input.kind === "contract")
    fields = {
      ...input,
      applicationId: resolve(input.applicationId, "application"),
      contractId: resolve(input.contractId, "implementation"),
    };
  if (input.kind === "document")
    fields = {
      ...input,
      links: input.links.map((link) => {
        if (link.kind === "product") return link;
        if (link.kind === "implementation")
          return {
            ...link,
            id: resolve(link.id, link.kind),
            applicationId: resolve(link.applicationId, "application"),
          };
        return { ...link, id: resolve(link.id, link.kind) };
      }),
    };
  if (input.kind === "implementation")
    fields = {
      ...input,
      applicationId: resolve(input.applicationId, "application"),
      featureId: resolve(input.featureId, "feature"),
      scenarioId: input.scenarioId === null ? null : resolve(input.scenarioId, "scenario"),
    };
  return {
    ...command,
    fields,
    ...(command.id === undefined
      ? {}
      : {
          id: command.action === "create" ? productIdSchema.parse(command.id) : resolve(command.id),
        }),
  };
}

/** Ключ проверяется независимо от идентичности и резервируется после переименования. */
export function assertProductKey(
  key: string,
  kind: string,
  id: string,
  records: ProductRecord[],
): void {
  productKeySchema.parse(key);
  invariant(
    ["passport", "feature", "scenario", "application", "implementation", "document"].includes(kind),
    "INVALID_ARGUMENT",
    "У этого вида записи нет публичного ключа",
  );
  invariant(
    !productAddresses(records).some(
      (entry) => entry.id !== id && (entry.key === key || entry.id === key),
    ) && !records.some((entry) => entry.id !== id && entry.reservedKeys?.includes(key)),
    "ALREADY_EXISTS",
    "Ключ уже занят или зарезервирован",
    4,
  );
}

/** Номера учитывают прежние ключи, чтобы переименование не освобождало номер. */
export function nextProductKey(
  kind: "feature" | "scenario" | "document",
  records: ProductRecord[],
  reserved: readonly string[] = [],
): string {
  const prefix = { feature: "FEATURE", scenario: "SCENARIO", document: "DOC" }[kind];
  const keys = [
    ...records.flatMap((entry) => [entry.key, ...(entry.reservedKeys ?? [])]),
    ...reserved,
  ];
  const maximum = keys.reduce(
    (max, key) =>
      key && new RegExp(`^${prefix}-[1-9]\\d*$`).test(key)
        ? Math.max(max, Number(key.slice(prefix.length + 1)))
        : max,
    0,
  );
  invariant(
    Number.isSafeInteger(maximum + 1),
    "INVALID_DATA",
    "Диапазон номеров продукта исчерпан",
    5,
  );
  return `${prefix}-${maximum + 1}`;
}
