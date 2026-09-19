import { Module } from "@nestjs/common";
import type { DynamicModule } from "@nestjs/common";
import { ServeStaticModule } from "@nestjs/serve-static";
import { HealthModule } from "./modules/health/health.module.js";
import { ContextModule } from "./modules/context/context.module.js";
import { BoardModule } from "./modules/board/board.module.js";
import { TasksModule } from "./modules/tasks/tasks.module.js";
import { CommentsModule } from "./modules/comments/comments.module.js";
import { LogsModule } from "./modules/logs/logs.module.js";
import { EventsModule } from "./modules/events/events.module.js";
import { WorkspaceModule } from "./modules/workspace/workspace.module.js";
import type { WorkspaceOptions } from "./modules/workspace/workspace.module.js";
import { ProjectModule } from "./modules/project/project.module.js";
import { ServerModule } from "./modules/workspace/server.module.js";
import { LifecycleModule } from "./modules/lifecycle/lifecycle.module.js";
import { ProductModule } from "./modules/product/product.module.js";
import { BoardsModule } from "./modules/boards/boards.module.js";
import { BoardTasksModule } from "./modules/board-tasks/board-tasks.module.js";

@Module({})
export class AppModule {
  static register(workspace: WorkspaceOptions, webRoot?: string): DynamicModule {
    const staticOptions = {
      fallthrough: true,
      dotfiles: "deny",
      redirect: false,
      cacheControl: false,
      // Fastify-опция: статические файлы не могут занять зарезервированный /api.
      globIgnore: ["api/**"],
    };
    return {
      module: AppModule,
      imports: [
        WorkspaceModule.register(workspace),
        HealthModule,
        ServerModule,
        ContextModule,
        BoardModule,
        TasksModule,
        ProjectModule,
        LifecycleModule,
        ProductModule,
        BoardsModule,
        BoardTasksModule,
        CommentsModule,
        LogsModule,
        EventsModule,
        ...(webRoot
          ? [
              ServeStaticModule.forRoot({
                rootPath: webRoot,
                renderPath: "/*",
                serveStaticOptions: staticOptions,
              }),
            ]
          : []),
      ],
    };
  }
}
