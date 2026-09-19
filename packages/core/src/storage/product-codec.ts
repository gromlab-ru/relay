import { z } from "zod";
import { productFieldsSchema, productRecordSchema } from "../domain/product.js";
import type { ProductRecord } from "../domain/product.js";
import { parse } from "../domain/validation.js";
import { toText } from "../domain/markdown.js";

// Не нормализуем CRLF при миграции: отпечатки требований зависят от точного текста.
const lines = z.array(
  z.string().refine((line) => !line.includes("\n"), "Элемент содержит перевод строки"),
);
const fields = productFieldsSchema.options;
export const storedProductSchema = productRecordSchema.extend({
  version: z.literal(2),
  fields: z.discriminatedUnion("kind", [
    fields[0].extend({ description: lines }),
    fields[1].extend({ description: lines }),
    fields[2].extend({ description: lines }),
    fields[3].extend({ description: lines }),
    fields[4].extend({
      contracts: z
        .array(fields[4].shape.contracts.element.extend({ description: lines }))
        .max(10000),
    }),
    fields[5].extend({ body: lines }),
  ]),
});

/** Преобразование дискового формата без изменения публичного контракта и ревизии. */
export function decodeProduct(value: unknown, path: string): ProductRecord {
  if (typeof value === "object" && value !== null && "version" in value && value.version === 1)
    return parse(productRecordSchema, value, path, true);
  const stored = parse(storedProductSchema, value, path, true);
  const data = stored.fields;
  const decoded =
    data.kind === "scope"
      ? {
          ...data,
          contracts: data.contracts.map((entry) => ({
            ...entry,
            description: toText(entry.description),
          })),
        }
      : data.kind === "document"
        ? { ...data, body: toText(data.body) }
        : { ...data, description: toText(data.description) };
  return parse(productRecordSchema, { ...stored, version: 1, fields: decoded }, path, true);
}

export function encodeProduct(record: ProductRecord): z.infer<typeof storedProductSchema> {
  const data = record.fields;
  const encoded =
    data.kind === "scope"
      ? {
          ...data,
          contracts: data.contracts.map((entry) => ({
            ...entry,
            description: entry.description.split("\n"),
          })),
        }
      : data.kind === "document"
        ? { ...data, body: data.body.split("\n") }
        : { ...data, description: data.description.split("\n") };
  return storedProductSchema.parse({ ...record, version: 2, fields: encoded });
}
