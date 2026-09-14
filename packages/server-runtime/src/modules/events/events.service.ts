import { Inject, Injectable } from "@nestjs/common";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { createHash } from "node:crypto";
import { watch } from "node:fs";
import type { FSWatcher } from "node:fs";
import { basename, dirname } from "node:path";
import { Observable, Subject } from "rxjs";
import type { ServerEvent } from "@tasks/contracts";
import { TaskQueries } from "@tasks/core/application/queries/tasks";
import { WorkspaceService } from "../workspace/workspace.module.js";
import { httpFailure } from "../../common/errors.js";

/** Поддерживает SSE активным при простое, до типичных таймаутов прокси. */
const HEARTBEAT_INTERVAL = 15_000;

@Injectable()
export class EventsService implements OnModuleInit, OnModuleDestroy {
  private readonly events = new Subject<ServerEvent>();
  private readonly watchers = new Map<string, FSWatcher>();
  private fingerprints = new Map<number, string>();
  private version: string | undefined;
  private lastError: { code: string; message: string } | undefined;
  private storageRoot: string | undefined;
  private debounce: NodeJS.Timeout | undefined;
  private poll: NodeJS.Timeout | undefined;
  private heartbeat: NodeJS.Timeout | undefined;
  private refreshing: Promise<void> | undefined;
  private pending = false;
  private stopped = false;

  constructor(@Inject(WorkspaceService) private readonly workspace: WorkspaceService) {}

  async onModuleInit(): Promise<void> {
    await this.refresh();
    // Восстановление после пропущенного fs.watch, удаления или замены каталога.
    this.poll = setInterval(() => void this.refresh(), 3000);
    this.poll.unref();
    this.heartbeat = setInterval(() => {
      this.events.next({ type: "heartbeat", data: { timestamp: new Date().toISOString() } });
    }, HEARTBEAT_INTERVAL);
    this.heartbeat.unref();
  }

  stream(): Observable<ServerEvent> {
    return new Observable((subscriber) => {
      subscriber.next({ type: "connected", data: { projectId: this.workspace.projectId } });
      if (this.lastError) subscriber.next({ type: "workspace-error", data: this.lastError });
      return this.events.subscribe(subscriber);
    });
  }

  apiChanged(taskId: number): void {
    if (this.stopped) return;
    this.events.next({ type: "changed", data: { source: "api", taskIds: [taskId] } });
    this.schedule();
  }

  private schedule(): void {
    if (this.stopped || this.debounce) return;
    this.debounce = setTimeout(() => {
      this.debounce = undefined;
      void this.refresh();
    }, 40);
    this.debounce.unref();
  }

  private async refresh(): Promise<void> {
    if (this.stopped) return;
    if (this.refreshing) {
      this.pending = true;
      return this.refreshing;
    }
    this.refreshing = this.scan().finally(() => {
      this.refreshing = undefined;
      if (this.pending) {
        this.pending = false;
        this.schedule();
      }
    });
    return this.refreshing;
  }

  private async scan(): Promise<void> {
    try {
      // Наблюдаем и родительские каталоги: atomic rename заменяет inode самого файла.
      this.rebind();
      const workspace = await this.workspace.open();
      if (this.stopped) return;
      this.storageRoot = workspace.root;
      this.rebind();
      const { tasks, version } = await new TaskQueries(workspace).snapshot();
      if (this.stopped) return;
      const fingerprints = new Map(
        [...tasks].map(([id, task]) => [
          id,
          createHash("sha256").update(JSON.stringify(task)).digest("hex"),
        ]),
      );
      if ((this.version !== undefined && this.version !== version) || this.lastError) {
        const ids = [...new Set([...this.fingerprints.keys(), ...fingerprints.keys()])]
          .filter((id) => this.fingerprints.get(id) !== fingerprints.get(id))
          .sort((a, b) => a - b);
        this.events.next({
          type: "changed",
          data: {
            source: "storage",
            version,
            ...(ids.length ? { taskIds: ids } : {}),
          },
        });
      }
      this.version = version;
      this.fingerprints = fingerprints;
      this.lastError = undefined;
    } catch (error) {
      if (this.stopped) return;
      const { code, message } = httpFailure(error).body.error;
      if (this.lastError?.code !== code || this.lastError.message !== message)
        this.events.next({ type: "workspace-error", data: { code, message } });
      this.lastError = { code, message };
    }
  }

  private rebind(): void {
    if (this.stopped) return;
    const configParent = dirname(this.workspace.options.configPath);
    const desired = new Set([
      configParent,
      ...(this.storageRoot ? [this.storageRoot, dirname(this.storageRoot)] : []),
    ]);
    for (const [path, watcher] of this.watchers) {
      if (!desired.has(path)) {
        watcher.close();
        this.watchers.delete(path);
      }
    }
    for (const path of desired) {
      if (this.watchers.has(path)) continue;
      try {
        const watcher = watch(path, { persistent: false }, (_event, filename) => {
          const name = filename?.toString();
          if (
            name === undefined ||
            (path === configParent && name === basename(this.workspace.options.configPath)) ||
            (path === this.storageRoot && (name.endsWith(".json") || name === basename(path))) ||
            (this.storageRoot &&
              path === dirname(this.storageRoot) &&
              name === basename(this.storageRoot))
          ) {
            // При замене каталога переоткрываем наблюдатель, привязанный к старому inode.
            if (
              this.storageRoot &&
              path === dirname(this.storageRoot) &&
              name === basename(this.storageRoot)
            ) {
              this.watchers.get(this.storageRoot)?.close();
              this.watchers.delete(this.storageRoot);
            }
            this.schedule();
          }
        });
        watcher.on("error", () => {
          watcher.close();
          if (this.watchers.get(path) === watcher) this.watchers.delete(path);
          this.schedule();
        });
        this.watchers.set(path, watcher);
      } catch {
        // Каталог может временно отсутствовать. Poll повторит подписку и проверку Core.
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    clearTimeout(this.debounce);
    clearInterval(this.poll);
    clearInterval(this.heartbeat);
    for (const watcher of this.watchers.values()) watcher.close();
    this.watchers.clear();
    this.events.complete();
    await this.refreshing;
  }
}
