import { z } from "zod";
import {
  entityPageQuerySchema,
  entityTypeQuerySchema,
  entitiesQuerySchema,
  entityGetQuerySchema,
  entityKeysQuerySchema,
  entityKeySpacesQuerySchema,
  entityCreateDataSchemas,
  entityUpdateDataSchemas,
  entityCreateSchema,
  entityUpdateSchema,
  entityRenameSchema,
  entityMoveTaskSchema,
  entityLinkTaskSchema,
} from "@relay/contracts/entities";
import type { EntitySaved } from "@relay/contracts/entities";
import { actorSchema, entityReferenceSchema, requestIdSchema } from "@relay/contracts/primitives";
import { graphQuerySchema } from "@relay/contracts/entities/graph";
import type { Backend } from "@relay/project-runtime/backend/types";
import type { Result } from "./output.js";

type EntityTool = {
  name: string;
  description: string;
  schema: z.ZodObject;
  readOnly: boolean;
  run: (backend: Backend, input: Record<string, unknown>) => Promise<Result>;
};
const saved = (data: EntitySaved): Result => ({
  data,
  text: `${data.key}: ${data.action}. Вид: ${data.ref.kind}. ID: ${data.ref.id}. Ревизия: ${data.revision}. Ключ повтора: ${data.requestId}.`,
});
const write = { actor: actorSchema, requestId: requestIdSchema };

/** Аргументы инструментов выводятся из контрактов видов и остаются на верхнем уровне. */
export const entityTools: EntityTool[] = [
  {
    name: "entity_types",
    description: "Перечислить основные виды сущностей, их назначение, действия и фильтры",
    schema: entityPageQuerySchema,
    readOnly: true,
    run: async (backend, input) => ({
      data: await backend.entities.types(entityPageQuerySchema.parse(input)),
    }),
  },
  {
    name: "entity_type_get",
    description: "Прочитать контракт вида: поля, схемы создания/изменения и правила ключей",
    schema: entityTypeQuerySchema,
    readOnly: true,
    run: async (backend, input) => ({
      data: await backend.entities.describe(entityTypeQuerySchema.parse(input)),
    }),
  },
  {
    name: "entities_list",
    description:
      "Найти сущности по виду, ключу, доске, приложению и другим объявленным фильтрам; продолжение по nextOffset/version",
    schema: entitiesQuerySchema,
    readOnly: true,
    run: async (backend, input) => ({
      data: await backend.entities.list(entitiesQuerySchema.parse(input)),
    }),
  },
  {
    name: "entity_get",
    description: "Прочитать полные типизированные данные сущности по читаемому ключу либо ID",
    schema: entityGetQuerySchema,
    readOnly: true,
    run: async (backend, input) => {
      const data = await backend.entities.get(entityGetQuerySchema.parse(input));
      return {
        data,
        text: `${data.key} — ${data.title}\nВид: ${data.ref.kind}. Ревизия: ${data.revision}.${data.document ? ` Документ: ${data.document.kind}; состояние: ${data.document.status}.` : ""} Полные данные доступны в structuredContent.`,
      };
    },
  },
  {
    name: "entity_resolve",
    description:
      "Найти постоянный адрес и текущий ключ по ключу, алиасу или ID; обычно отдельный вызов не требуется",
    schema: entityGetQuerySchema,
    readOnly: true,
    run: async (backend, input) => ({
      data: await backend.entities.resolve(entityGetQuerySchema.parse(input)),
    }),
  },
  {
    name: "entity_keys",
    description: "Прочитать текущий и прежние ключи сущности с постраничным продолжением",
    schema: entityKeysQuerySchema,
    readOnly: true,
    run: async (backend, input) => ({
      data: await backend.entities.keys(entityKeysQuerySchema.parse(input)),
    }),
  },
  {
    name: "entity_key_spaces",
    description:
      "Перечислить актуальные области нумерации, доски и префиксы ключей выбранного вида",
    schema: entityKeySpacesQuerySchema,
    readOnly: true,
    run: async (backend, input) => ({
      data: await backend.entities.keySpaces(entityKeySpacesQuerySchema.parse(input)),
    }),
  },
  {
    name: "entity_history",
    description: "Прочитать фактически сохранённые события ревизий сущности по ключу или ID",
    schema: entityKeysQuerySchema,
    readOnly: true,
    run: async (backend, input) => ({
      data: await backend.entities.history(entityKeysQuerySchema.parse(input)),
    }),
  },
  {
    name: "entity_context",
    description:
      "Прочитать сохранённые связи сущности по ключу или ID: входящие и исходящие направления, узлы, пути и границы глубины. Продуктовые поля не создают рёбер; документы и приложения не скрывают продолжение цепочки",
    schema: graphQuerySchema.omit({ root: true }).extend({
      ref: entityReferenceSchema,
      profile: graphQuerySchema.shape.profile.default("all"),
    }),
    readOnly: true,
    run: async (backend, input) => {
      const { ref, ...query } = input;
      return { data: await backend.graph.read(graphQuerySchema.parse({ ...query, root: ref })) };
    },
  },
  {
    name: "entity_rename_key",
    description:
      "Изменить читаемый ключ сущности, сохранив ID, отношения и прежние алиасы; требуется прочитанная ревизия",
    schema: entityRenameSchema.extend({ actor: actorSchema }),
    readOnly: false,
    run: async (backend, input) => {
      const command = entityRenameSchema.parse(input);
      return saved(await backend.entities.rename(command, actorSchema.parse(input.actor)));
    },
  },
  {
    name: "entity_task_move",
    description:
      "Переместить задачу в колонку или на доску; все ссылки принимают ключи или ID, блокеры проверяет Core",
    schema: entityMoveTaskSchema.extend({ actor: actorSchema }),
    readOnly: false,
    run: async (backend, input) => {
      const command = entityMoveTaskSchema.parse(input);
      return saved(await backend.entities.moveTask(command, actorSchema.parse(input.actor)));
    },
  },
  {
    name: "entity_task_link",
    description:
      "Установить или снять зависимость, родительство либо контекстную связь задач по ключам или ID",
    schema: entityLinkTaskSchema.extend({ actor: actorSchema }),
    readOnly: false,
    run: async (backend, input) => {
      const command = entityLinkTaskSchema.parse(input);
      return saved(await backend.entities.linkTask(command, actorSchema.parse(input.actor)));
    },
  },
];

for (const [kind, schema] of Object.entries(entityCreateDataSchemas)) {
  const { kind: _kind, ...shape } = schema.shape;
  entityTools.push({
    name: `entity_${kind}_create`,
    description: `Создать сущность ${kind} с продуктовыми линками. Рёбра контекста не вычисляются из полей автоматически. Полные описания — Markdown; ссылки принимают ключи или ID. Повторять с тем же requestId.`,
    schema: z.strictObject({ ...shape, ...write }),
    readOnly: false,
    run: async (backend, input) => {
      const { actor, requestId, ...fields } = input;
      const command = entityCreateSchema.parse({ data: { ...fields, kind }, actor, requestId });
      return saved(await backend.entities.create(command, actorSchema.parse(actor)));
    },
  });
}
for (const [kind, schema] of Object.entries(entityUpdateDataSchemas)) {
  const { kind: _kind, ...shape } = schema.shape;
  entityTools.push({
    name: `entity_${kind}_update`,
    description: `Изменить содержание сущности ${kind} по ключу или ID. Отсутствующие поля сохраняются; требуются прочитанная ревизия и ключ повтора.`,
    schema: z.strictObject({
      ...shape,
      ...write,
      ref: entityReferenceSchema,
      ifRevision: entityUpdateSchema.shape.ifRevision,
    }),
    readOnly: false,
    run: async (backend, input) => {
      const { actor, requestId, ref, ifRevision, ...fields } = input;
      const command = entityUpdateSchema.parse({
        changes: { ...fields, kind },
        actor,
        requestId,
        ref,
        ifRevision,
      });
      return saved(await backend.entities.update(command, actorSchema.parse(actor)));
    },
  });
}
