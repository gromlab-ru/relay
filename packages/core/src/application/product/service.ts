import { createHash } from "node:crypto";
import { shortId } from "../../shared/ids.js";
import { defaultBoardPrefix } from "../../domain/board.js";
import { productMutationSchema, productRecordSchema } from "../../domain/product.js";
import type {
  ProductMutation,
  ProductRecord,
  ProductSaved,
  ProductState,
  ProductContract,
} from "../../domain/product.js";
import { actorSchema, parse } from "../../domain/validation.js";
import { ProductRepository } from "../../storage/product.js";
import { BoardRepository } from "../../storage/boards.js";
import type { Workspace } from "../../storage/workspace.js";
import { invariant } from "../../shared/errors.js";
import { contractBasis, productState, productVersion, validateProduct } from "./model.js";
import {
  assertProductKey,
  nextProductKey,
  normalizeProductMutation,
} from "../../domain/product-addresses.js";

/** Единая граница записи для Web, REST, CLI и MCP. */
export class ProductService {
  constructor(readonly workspace: Workspace) {}

  async state(): Promise<ProductState> {
    return this.workspace.locked(async (assertOwned) => {
      const repository = new ProductRepository(this.workspace);
      const records = await repository.ensureKeys(assertOwned);
      validateProduct(records);
      return productState(repository.productId, records);
    });
  }

  async mutate(input: ProductMutation, defaultActor: string): Promise<ProductSaved> {
    let command = parse(productMutationSchema, input, "изменение продукта");
    invariant(
      command.key === undefined || command.action === "update",
      "INVALID_ARGUMENT",
      "При создании ключ назначается автоматически",
    );
    const actor = parse(actorSchema, command.actor ?? defaultActor, "автор");
    return this.workspace.locked(async (assertOwned) => {
      const repository = new ProductRepository(this.workspace);
      const records = await repository.ensureKeys(assertOwned);
      validateProduct(records);
      const key = createHash("sha256").update(`${actor}/${command.requestId}`).digest("hex");
      const hash = createHash("sha256")
        .update(JSON.stringify({ ...command, actor }))
        .digest("hex");
      const receipt = records
        .flatMap((record) => Object.entries(record.requests))
        .find(([requestKey]) => requestKey === key)?.[1];
      if (receipt) {
        invariant(
          receipt.hash === hash,
          "IDEMPOTENCY_CONFLICT",
          "Ключ запроса уже использован с другим содержимым",
          4,
        );
        return receipt.result;
      }
      command = normalizeProductMutation(command, records);
      invariant(
        command.ifVersion === undefined || command.ifVersion === productVersion(records),
        "REVISION_CONFLICT",
        "Продукт изменился после чтения",
        4,
      );
      const kind = command.fields.kind === "contract" ? "scope" : command.fields.kind;
      const stableId =
        kind === "passport"
          ? "passport"
          : command.fields.kind === "scope" || command.fields.kind === "contract"
            ? records.find(
                (record) =>
                  record.fields.kind === "scope" &&
                  record.fields.applicationId ===
                    (command.fields.kind === "scope" || command.fields.kind === "contract"
                      ? command.fields.applicationId
                      : ""),
              )?.id
            : undefined;
      const occupied = new Set(
        records.flatMap((record) => [
          record.id,
          ...(record.fields.kind === "scope"
            ? record.fields.contracts.map((contract) => contract.id)
            : []),
        ]),
      );
      const id = command.id ?? stableId ?? shortId(occupied);
      occupied.add(id);
      invariant(!stableId || id === stableId, "INVALID_ARGUMENT", "Неверный ID записи");
      const previous = records.find((record) => record.id === id);
      invariant(
        command.action !== "create" || !previous,
        "ALREADY_EXISTS",
        "Запись уже существует",
        4,
      );
      invariant(
        command.action !== "update" || previous,
        "PRODUCT_RECORD_NOT_FOUND",
        "Запись продукта не найдена",
        3,
      );
      invariant(
        command.action !== "update" ||
          command.id !== undefined ||
          command.fields.kind === "scope" ||
          command.fields.kind === "contract",
        "INVALID_ARGUMENT",
        "Для обновления нужен ID",
      );
      if (previous) {
        invariant(previous.fields.kind === kind, "IMMUTABLE_FIELD", "Вид записи неизменяем", 4);
        invariant(
          command.ifRevision !== undefined,
          "REVISION_REQUIRED",
          "Передайте прочитанную ревизию",
          4,
        );
        if (previous.fields.kind === "scenario" && command.fields.kind === "scenario")
          invariant(
            previous.fields.featureId === command.fields.featureId,
            "IMMUTABLE_FIELD",
            "Перенос сценария между фичами не поддерживается",
            4,
          );
      }
      invariant(
        command.ifRevision === undefined || command.ifRevision === (previous?.revision ?? 0),
        "REVISION_CONFLICT",
        "Запись изменилась после чтения",
        4,
        { actual: previous?.revision ?? 0, expected: command.ifRevision },
      );
      let fields: ProductRecord["fields"];
      let inputFields = command.fields;
      if (inputFields.kind === "contract") {
        const patch = inputFields;
        invariant(
          command.action === "update" && previous?.fields.kind === "scope",
          "PRODUCT_RECORD_NOT_FOUND",
          "Состав приложения не найден",
          3,
        );
        invariant(
          previous.fields.contracts.some(
            (contract) => contract.id === patch.contractId && contract.active,
          ),
          "PRODUCT_RECORD_NOT_FOUND",
          "Активный контракт не найден",
          3,
        );
        inputFields = {
          kind: "scope",
          applicationId: patch.applicationId,
          contracts: previous.fields.contracts
            .filter((entry) => entry.active)
            .map(({ id: contractId, active: _active, basis: _basis, ...contract }) =>
              contractId === patch.contractId
                ? {
                    ...contract,
                    status: patch.status,
                    title: patch.title ?? contract.title,
                    description: patch.description ?? contract.description,
                  }
                : contract,
            ),
        };
      }
      if (inputFields.kind === "scope") {
        invariant(
          command.ifVersion !== undefined,
          "REVISION_REQUIRED",
          "Состав требует версию прочитанного каталога",
          4,
        );
        const old = previous?.fields.kind === "scope" ? previous.fields.contracts : [];
        const contracts: ProductContract[] = inputFields.contracts.map(
          ({ key: _key, revision: _revision, ...entry }) => {
            const prior = old.find(
              (contract) =>
                contract.featureId === entry.featureId && contract.scenarioId === entry.scenarioId,
            );
            const preserveBasis =
              command.fields.kind === "contract" &&
              prior !== undefined &&
              prior.id !== command.fields.contractId;
            const contractId = prior?.id ?? shortId(occupied);
            occupied.add(contractId);
            return {
              ...entry,
              id: contractId,
              ...(prior?.key ? { key: prior.key } : {}),
              revision: prior?.revision ?? 1,
              active: true,
              basis: preserveBasis ? prior.basis : contractBasis(entry, records),
            };
          },
        );
        fields = {
          ...inputFields,
          contracts: [
            ...contracts,
            ...old
              .filter((entry) => !contracts.some((contract) => contract.id === entry.id))
              .map((entry) => ({ ...entry, active: false })),
          ],
        };
      } else fields = inputFields;
      if (fields.kind === "application") {
        const slug = fields.slug;
        const prefix =
          fields.prefix ??
          (previous?.fields.kind === "application" ? previous.fields.prefix : undefined) ??
          defaultBoardPrefix(slug);
        fields = { ...fields, prefix };
        invariant(
          previous?.fields.kind !== "application" ||
            (previous.fields.prefix ?? defaultBoardPrefix(previous.fields.slug)) === prefix,
          "IMMUTABLE_FIELD",
          "Префикс доски нельзя менять после создания",
          4,
        );
        const boards = await new BoardRepository(this.workspace).all();
        invariant(
          !boards.some(
            (entry) =>
              entry.applicationId !== id &&
              (entry.prefix ?? defaultBoardPrefix(entry.slug)) === prefix,
          ),
          "ALREADY_EXISTS",
          "Префикс доски уже занят",
          4,
        );
        invariant(
          !["PRODUCT", "INFRA"].includes(prefix),
          "ALREADY_EXISTS",
          "Префикс зарезервирован системной доской",
          4,
        );
        invariant(
          previous?.fields.kind !== "application" || previous.fields.slug === slug,
          "IMMUTABLE_FIELD",
          "Адрес приложения и доски нельзя менять после создания",
          4,
        );
        invariant(
          !records.some(
            (entry) =>
              entry.id !== id && entry.fields.kind === "application" && entry.fields.slug === slug,
          ),
          "ALREADY_EXISTS",
          "Этот адрес приложения уже занят",
          4,
        );
        const board = (await new BoardRepository(this.workspace).all()).find(
          (entry) => entry.slug === slug,
        );
        invariant(
          board === undefined || board.applicationId === id,
          "ALREADY_EXISTS",
          "Этот адрес доски уже занят",
          4,
        );
      }
      if (fields.kind === "document") {
        const oldLinks =
          previous?.fields.kind === "document"
            ? previous.fields.links.map((link) => JSON.stringify(link))
            : [];
        for (const link of fields.links) {
          if (link.kind !== "implementation" || oldLinks.includes(JSON.stringify(link))) continue;
          invariant(
            records.some(
              (record) =>
                record.fields.kind === "scope" &&
                record.fields.applicationId === link.applicationId &&
                record.fields.contracts.some(
                  (contract) => contract.id === link.id && contract.active,
                ),
            ),
            "INVALID_REFERENCE",
            "Новая связь требует активного контракта",
          );
        }
      }
      const now = new Date().toISOString();
      const publicKey =
        command.key ??
        previous?.key ??
        (fields.kind === "feature" || fields.kind === "scenario"
          ? nextProductKey(fields.kind, records)
          : fields.kind === "application"
            ? (fields.prefix ?? defaultBoardPrefix(fields.slug))
            : undefined);
      if (publicKey && (command.key !== undefined || previous === undefined))
        assertProductKey(publicKey, kind, id, records);
      const result = {
        id,
        revision: (previous?.revision ?? 0) + 1,
        ...(publicKey ? { key: publicKey } : {}),
      };
      const record = parse(
        productRecordSchema,
        {
          version: 1,
          productId: repository.productId,
          ...result,
          ...(previous?.reservedKeys || (previous?.key && previous.key !== publicKey)
            ? {
                reservedKeys: [
                  ...new Set([
                    ...(previous?.reservedKeys ?? []),
                    ...(previous?.key && previous.key !== publicKey ? [previous.key] : []),
                  ]),
                ],
              }
            : {}),
          fields,
          createdAt: previous?.createdAt ?? now,
          createdBy: previous?.createdBy ?? actor,
          updatedAt: now,
          updatedBy: actor,
          events: [...(previous?.events ?? []), { revision: result.revision, actor, at: now }],
          requests: { ...previous?.requests, [key]: { hash, result } },
        },
        "запись продукта",
      );
      validateProduct([...records.filter((entry) => entry.id !== id), record]);
      assertOwned();
      if (record.fields.kind === "application" && previous === undefined)
        await new BoardRepository(this.workspace).createApplication(record, assertOwned);
      else await repository.save(record, previous === undefined, assertOwned);
      // Новые реализации получают постоянные ключи до освобождения общей блокировки.
      if (record.fields.kind === "scope") await repository.ensureKeys(assertOwned);
      return result;
    });
  }
}
