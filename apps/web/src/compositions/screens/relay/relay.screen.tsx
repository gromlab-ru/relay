import { useEffect } from "react";
import { useLocation, useMatch, useNavigate } from "react-router-dom";
import { Badge, Button, Group, Select, Text } from "@mantine/core";
import { useWorkspace } from "domains/workspace";
import { ProjectScope } from "domains/project";
import { TasksSync } from "domains/tasks";
import { BoardScreen } from "compositions/screens/board";
import { StatePanel } from "ui/state-panel";
import styles from "./styles/relay.module.css";

/**
 * Открывает один проект или связывает workspace с выбором проекта в URL.
 *
 * Используется для:
 *  - переключения независимых досок и восстановления прямых ссылок
 */
export const RelayScreen = () => {
  const workspace = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  const match = useMatch("/projects/:project/*");
  const selectedId = match?.params.project;
  const workspaceData = workspace.data;
  const projectItems = workspaceData?.projects ?? [];
  const projectData = projectItems.find((project) => project.id === selectedId);
  const isWorkspace = workspaceData?.mode === "workspace";
  const canOpenProject = projectData !== undefined && projectData.available;
  const selectItems = [
    ...new Map(
      projectItems.map((project) => [
        project.id,
        {
          value: project.id,
          label: `${project.key} · ${project.name}`,
          disabled: !project.available,
        },
      ]),
    ).values(),
  ];
  const defaultProject = workspaceData?.defaultProject;
  useEffect(() => {
    if (workspaceData?.mode === "local" && defaultProject && selectedId === undefined) {
      navigate(
        `/projects/${encodeURIComponent(defaultProject)}${location.pathname}${location.search}`,
        { replace: true },
      );
    }
  }, [
    workspaceData?.mode,
    defaultProject,
    selectedId,
    navigate,
    location.pathname,
    location.search,
  ]);

  if (workspaceData === undefined) {
    return (
      <StatePanel
        title="Подключение к Relay"
        description="Запустите relay-server и проверьте подключение."
        isLoading={workspace.isLoading}
        action={<Button onClick={() => void workspace.mutate()}>Повторить</Button>}
      />
    );
  }

  const stateTitle = selectedId === undefined ? "Выберите проект" : "Проект недоступен";
  const stateDescription =
    projectData?.error ??
    "Проекты добавляются в relay.workspace.json или через relay-cli projects add.";
  return (
    <div className={styles.root}>
      {isWorkspace && (
        <Group
          component="nav"
          aria-label="Проекты Relay"
          className={styles.selector}
          justify="space-between"
        >
          <Group>
            <Text fw={700}>Relay</Text>
            <Badge variant="light">workspace</Badge>
          </Group>
          <Select
            aria-label="Выбрать проект"
            placeholder="Выберите проект"
            data={selectItems}
            value={selectedId ?? null}
            searchable
            allowDeselect={false}
            onChange={(projectId) => {
              if (projectId !== null) navigate(`/projects/${encodeURIComponent(projectId)}/`);
            }}
          />
        </Group>
      )}
      {canOpenProject && (
        <ProjectScope key={projectData.id} projectId={projectData.id}>
          <TasksSync />
          <BoardScreen />
        </ProjectScope>
      )}
      {!canOpenProject && (
        <main>
          <StatePanel title={stateTitle} description={stateDescription} />
        </main>
      )}
    </div>
  );
};
