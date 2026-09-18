import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ActionIcon, Badge, Button, Drawer, Group, Select, Text, Tooltip } from "@mantine/core";
import { ClipboardList, Layers3, Menu, Moon, Plus, Sun } from "lucide-react";
import { useGetProject, useProjectId } from "domains/project";
import { useWorkspace } from "domains/workspace";
import { useTaskConnection } from "domains/tasks";
import { isRecordOf, useLifecycle } from "domains/lifecycle";
import { useThemeColorScheme } from "ui/themes";
import { ProjectNavigation } from "./ui/project-navigation";
import styles from "./styles/project.module.css";

/**
 * Организует постоянную навигацию и рабочую область одного проекта.
 *
 * Используется для:
 *  - переходов между планированием, исполнением и сопровождением
 *  - выбора проекта без собственного продуктового состояния workspace
 */
export const ProjectLayout = () => {
  const projectId = useProjectId();
  const project = useGetProject();
  const workspace = useWorkspace();
  const lifecycle = useLifecycle();
  const connection = useTaskConnection();
  const location = useLocation();
  const navigate = useNavigate();
  const [isNavigationOpen, setNavigationOpen] = useState(false);
  const { colorScheme, setColorScheme } = useThemeColorScheme();
  const base = `/projects/${encodeURIComponent(projectId)}`;
  const passport = lifecycle.data?.records.find((record) => isRecordOf(record, "passport"));
  const projectName = passport?.fields.title || project.data?.name || "Проект";
  const projectItems =
    workspace.data?.projects.map((item) => ({
      value: item.id,
      label: item.key,
      disabled: !item.available,
    })) ?? [];
  const isWorkspace = workspace.data?.mode === "workspace";
  const isDark = colorScheme === "dark";
  const ThemeIcon = isDark ? Sun : Moon;
  const nextTheme = isDark ? "light" : "dark";
  const state = connection.data?.state ?? "connecting";
  const connectionLabel = {
    connected: "Синхронизировано",
    connecting: "Соединяемся",
    reconnecting: "Переподключаемся",
    disconnected: "Нет соединения",
    "storage-error": "Ошибка хранилища",
  }[state];
  const attentionCount = lifecycle.data?.attention.length ?? 0;
  const hasAttention = attentionCount > 0;
  const isTaskPage = location.pathname.startsWith(`${base}/tasks/`);

  /**
   * Открывает создание, сохраняя выбранные на доске план, этап и группу.
   */
  const handleCreate = (): void => {
    const isBoardScope = isTaskPage || location.pathname === `${base}/board`;
    const params = new URLSearchParams(isBoardScope ? location.search : "");
    params.set("new", "1");
    navigate(`${base}/board?${params.toString()}`);
  };
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <Group gap="sm" wrap="nowrap" className={styles.identity}>
          <ActionIcon
            className={styles.menuToggle}
            variant="subtle"
            color="gray"
            aria-label="Открыть навигацию"
            aria-expanded={isNavigationOpen}
            aria-haspopup="dialog"
            onClick={() => setNavigationOpen(true)}
          >
            <Menu size={20} aria-hidden="true" />
          </ActionIcon>
          <Layers3 size={22} className={styles.brandIcon} />
          <span className={styles.brand}>Relay</span>
          <span className={styles.divider}>/</span>
          <Text
            className={styles.projectName}
            data-workspace={isWorkspace}
            fw={600}
            size="sm"
            lineClamp={1}
          >
            {projectName}
          </Text>
          {isWorkspace && (
            <Select
              aria-label="Выбрать проект"
              size="xs"
              data={projectItems}
              value={projectId}
              allowDeselect={false}
              onChange={(id) => {
                if (id !== null) navigate(`/projects/${encodeURIComponent(id)}/`);
              }}
              className={styles.selector}
              comboboxProps={{ width: 260, position: "bottom-start" }}
            />
          )}
        </Group>
        <Group gap="sm" wrap="nowrap" className={styles.actions}>
          <Tooltip label={connectionLabel}>
            <span className={styles.connection} data-state={state} role="status">
              <span className={styles.dot} />
              <span className={styles.connectionText}>{connectionLabel}</span>
            </span>
          </Tooltip>
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label="Переключить цветовую тему"
            onClick={() => setColorScheme(nextTheme)}
          >
            <ThemeIcon size={17} />
          </ActionIcon>
          <Button
            size="xs"
            variant="default"
            leftSection={<Plus size={14} />}
            onClick={handleCreate}
          >
            Задача
          </Button>
        </Group>
      </header>
      <div className={styles.workspace}>
        <aside className={styles.sidebar}>
          <div className={styles.sectionLabel}>ПРОЕКТ</div>
          <ProjectNavigation basePath={base} />
          <div className={styles.sidebarFooter}>
            <ClipboardList size={16} />
            <Text size="xs" c="dimmed">
              Общий контекст.
              <br />
              Осмысленный следующий шаг.
            </Text>
          </div>
        </aside>
        <main className={styles.content}>
          {hasAttention && (
            <button className={styles.attention} onClick={() => navigate(`${base}/activity`)}>
              <Badge color="orange" size="xs" variant="light">
                {attentionCount}
              </Badge>{" "}
              Требует внимания: вопросы, проверки или состояние исполнений <span>Открыть →</span>
            </button>
          )}
          <Outlet />
        </main>
      </div>
      <Drawer
        opened={isNavigationOpen}
        onClose={() => setNavigationOpen(false)}
        position="left"
        size="min(20rem, calc(100vw - 2rem))"
        title="Разделы проекта"
        closeButtonProps={{ "aria-label": "Закрыть навигацию" }}
        classNames={{ content: styles.drawer, header: styles.drawerHeader }}
      >
        <ProjectNavigation basePath={base} onNavigate={() => setNavigationOpen(false)} />
      </Drawer>
    </div>
  );
};
