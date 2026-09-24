import {
  taskProgressSchema,
  implementationProgressSchema,
  scenarioProgressSchema,
  featureProgressSchema,
  applicationProgressSchema,
  productProgressSchema,
} from "@relay/contracts/progress";
import type { ProgressQuery, ProgressPageQuery } from "@relay/contracts/progress";
import type { Workspace } from "../../storage/workspace.js";
import { readProgressSnapshot } from "./snapshot.js";
import {
  taskProgress,
  implementationProgress,
  scenarioProgress,
  featureProgress,
  applicationProgress,
  productProgress,
} from "./handlers.js";

/** Отдельные предметные обработчики; каждый ответ строится под общей блокировкой проекта. */
export class ProgressService {
  constructor(private readonly workspace: Workspace) {}

  async task(input: ProgressQuery) {
    return this.workspace.locked(async () =>
      taskProgressSchema.parse(
        taskProgress(await readProgressSnapshot(this.workspace, "task", input)),
      ),
    );
  }
  async implementation(input: ProgressQuery) {
    return this.workspace.locked(async () =>
      implementationProgressSchema.parse(
        implementationProgress(await readProgressSnapshot(this.workspace, "implementation", input)),
      ),
    );
  }
  async scenario(input: ProgressQuery) {
    return this.workspace.locked(async () =>
      scenarioProgressSchema.parse(
        scenarioProgress(await readProgressSnapshot(this.workspace, "scenario", input)),
      ),
    );
  }
  async feature(input: ProgressQuery) {
    return this.workspace.locked(async () =>
      featureProgressSchema.parse(
        featureProgress(await readProgressSnapshot(this.workspace, "feature", input)),
      ),
    );
  }
  async application(input: ProgressQuery) {
    return this.workspace.locked(async () =>
      applicationProgressSchema.parse(
        applicationProgress(await readProgressSnapshot(this.workspace, "application", input)),
      ),
    );
  }
  async product(input: ProgressPageQuery = {}) {
    return this.workspace.locked(async () =>
      productProgressSchema.parse(
        productProgress(await readProgressSnapshot(this.workspace, "product", input)),
      ),
    );
  }
}
