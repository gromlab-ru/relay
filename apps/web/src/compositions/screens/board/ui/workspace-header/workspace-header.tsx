import clsx from "clsx";
import { ActionIcon, Avatar, Button, Menu, Tooltip } from "@mantine/core";
import { Check, ChevronDown, Keyboard, Layers3, Monitor, Moon, Plus, Sun } from "lucide-react";
import { useTaskConnection } from "domains/tasks";
import { useThemeColorScheme } from "ui/themes";
import type { WorkspaceHeaderProps } from "./types/workspace-header-props.type";
import styles from "./styles/workspace-header.module.css";

/**
 * Организует проект, создание задач и настройки рабочего пространства.
 *
 * Используется для:
 *  - постоянной навигации, выбора темы и наблюдения за синхронизацией
 */
export const WorkspaceHeader = (props: WorkspaceHeaderProps) => {
  const { project, onCreate, onHelp, className, ...rootAttrs } = props;
  const { colorScheme, setColorScheme } = useThemeColorScheme();
  const connection = useTaskConnection();
  const state = connection.data?.state ?? "connecting";
  const statusLabel = {
    connecting: "Соединяемся…",
    connected: "Синхронизировано",
    reconnecting: "Переподключаемся…",
    disconnected: "Нет соединения",
    "storage-error": "Проверьте хранилище",
  }[state];
  const name = project?.name ?? "Рабочее пространство";
  const actor = project?.actor ?? "…";
  const isUnavailable = project === undefined;
  return (
    <header {...rootAttrs} className={clsx(styles.root, className)}>
      <div className={styles.identity}>
        <span className={styles.brand}>
          <Layers3 size={19} strokeWidth={1.8} />
          <span>Relay</span>
        </span>
        <span className={styles.separator}>/</span>
        <Menu position="bottom-start" width={280}>
          <Menu.Target>
            <button type="button" className={styles.project}>
              {name}
              <ChevronDown size={13} />
            </button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>Текущий проект</Menu.Label>
            <Menu.Item disabled>{project?.configPath}</Menu.Item>
            <Menu.Label>Автор изменений: {actor}</Menu.Label>
            <Menu.Item
              disabled={isUnavailable}
              leftSection={<Keyboard size={15} />}
              onClick={onHelp}
            >
              Управление с клавиатуры
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </div>
      <div className={styles.actions}>
        <Tooltip label={connection.data?.message ?? statusLabel}>
          <span className={styles.connection} data-state={state} role="status">
            <span className={styles.dot} data-state={state} />
            <span className={styles.connectionText}>{statusLabel}</span>
          </span>
        </Tooltip>
        <Menu position="bottom-end" width={180}>
          <Menu.Target>
            <ActionIcon aria-label="Цветовая тема">
              <Sun size={17} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>Оформление</Menu.Label>
            <Menu.Item
              leftSection={<Sun size={14} />}
              rightSection={colorScheme === "light" && <Check size={14} />}
              onClick={() => setColorScheme("light")}
            >
              Светлая
            </Menu.Item>
            <Menu.Item
              leftSection={<Moon size={14} />}
              rightSection={colorScheme === "dark" && <Check size={14} />}
              onClick={() => setColorScheme("dark")}
            >
              Тёмная
            </Menu.Item>
            <Menu.Item
              leftSection={<Monitor size={14} />}
              rightSection={colorScheme === "auto" && <Check size={14} />}
              onClick={() => setColorScheme("auto")}
            >
              Системная
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
        <Tooltip label={`Автор действий: ${actor}`}>
          <Avatar size={27} radius="xl" color="gray" className={styles.avatar}>
            {actor.slice(0, 2).toUpperCase()}
          </Avatar>
        </Tooltip>
        <Button
          leftSection={<Plus size={15} />}
          onClick={onCreate}
          disabled={isUnavailable}
          className={styles.create}
        >
          Создать задачу
        </Button>
      </div>
    </header>
  );
};
