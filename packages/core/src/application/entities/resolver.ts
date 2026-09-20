import { entityReferenceSchema } from "@relay/contracts/primitives";
import { parse } from "../../domain/validation.js";
import { invariant } from "../../shared/errors.js";

export type Addressable = {
  ref: { kind: string; id: string };
  key: string;
  aliases?: readonly string[];
  selectors?: readonly string[];
};

/** Единое разрешение публичного адреса для движка сущностей и расширяемого графа. */
export function resolveAddress<T extends Addressable>(
  entries: readonly T[],
  input: string | { kind: string; id: string },
  expected?: string | readonly string[],
): T {
  const reference = typeof input === "string" ? input : `${input.kind}:${input.id}`;
  parse(entityReferenceSchema, reference, "ключ или ID сущности");
  const pieces = reference.split(":");
  invariant(pieces.length <= 2, "INVALID_REFERENCE", "Ожидается ключ, ID или kind:ID", 4);
  const qualified = pieces.length === 2 ? pieces[0] : undefined;
  const value = pieces.length === 2 ? pieces[1]! : reference;
  const kinds =
    expected === undefined ? undefined : typeof expected === "string" ? [expected] : expected;
  invariant(
    !qualified || !kinds || kinds.includes(qualified),
    "ENTITY_KIND_MISMATCH",
    "Вид ссылки не соответствует действию",
    4,
  );
  const candidates = entries.filter(
    (entry) =>
      (!qualified || entry.ref.kind === qualified) &&
      (entry.ref.id === value || entry.key === value || entry.aliases?.includes(value)),
  );
  const exactIds = qualified ? candidates.filter((entry) => entry.ref.id === value) : [];
  const resolved = exactIds.length > 0 ? exactIds : candidates;
  const selected = kinds ? resolved.filter((entry) => kinds.includes(entry.ref.kind)) : resolved;
  if (!selected.length && kinds?.length === 1)
    selected.push(
      ...entries.filter((entry) => entry.ref.kind === kinds[0] && entry.selectors?.includes(value)),
    );
  invariant(
    selected.length > 0,
    candidates.length ? "ENTITY_KIND_MISMATCH" : "ENTITY_NOT_FOUND",
    candidates.length
      ? "Сущность имеет другой вид"
      : `Сущность ${reference} не найдена в выбранном проекте`,
    candidates.length ? 4 : 3,
  );
  invariant(
    selected.length === 1,
    "AMBIGUOUS_ENTITY_REFERENCE",
    "Адрес неоднозначен. Укажите вид и постоянный ID",
    4,
    { candidates: selected.map(({ ref, key }) => ({ ref, key })) },
  );
  return selected[0]!;
}
