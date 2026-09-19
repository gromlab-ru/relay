import { Link, useParams } from "react-router-dom";
import { Alert, Badge, Box, Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { useBoard } from "domains/boards";
import { useGetProject, useProjectId } from "domains/project";
import { ProjectPage } from "compositions/widgets/project-page";
import styles from "./styles/project-board.module.css";

/**
 * Показывает самостоятельную доску проекта по её slug.
 *
 * Используется для:
 *  - чтения назначения продуктовой, инфраструктурной или прикладной доски
 *  - просмотра колонок до подключения новой модели задач
 */
export const ProjectBoardScreen = () => {
  const { boardSlug = "" } = useParams();
  const projectId = useProjectId();
  const query = useBoard(projectId, boardSlug);
  const project = useGetProject();
  const board = query.data;
  const base = `/projects/${encodeURIComponent(projectId)}`;
  if (query.error !== undefined || board === undefined) {
    return (
      <ProjectPage
        title="Доска"
        description="Читаем доску выбранного проекта."
        isLoading={query.isLoading}
        error={query.error}
        actions={
          <Button variant="default" onClick={() => void query.mutate().catch(() => undefined)}>
            Повторить загрузку
          </Button>
        }
      />
    );
  }
  const descriptions = {
    product: "Общепродуктовые инициативы и работа над продуктом в целом.",
    application: "Задачи и изменения в пределах этого приложения.",
    infrastructure: "CI/CD, окружения, развёртывание и сопровождение инфраструктуры.",
  };
  const labels = {
    product: "Продуктовая",
    application: "Приложение",
    infrastructure: "Инфраструктурная",
  };
  const columnItems = project.data?.statuses ?? [];
  const applicationPath = `${base}/product/applications/${board.applicationId ?? ""}`;
  const isApplication = board.kind === "application";
  return (
    <ProjectPage
      title={board.name}
      description={descriptions[board.kind]}
      error={project.error}
      isLoading={project.isLoading}
    >
      <Stack gap="lg">
        <Group justify="space-between">
          <Group gap="xs">
            <Badge variant="light">{labels[board.kind]}</Badge>
            <Text size="sm" c="dimmed">
              /{board.slug}
            </Text>
          </Group>
          {isApplication && (
            <Button component={Link} to={applicationPath} variant="default" size="sm">
              Открыть приложение
            </Button>
          )}
        </Group>
        <Alert title="Доска создана" color="gray">
          Модель задач будет подключена следующим этапом. Здесь будут задачи только этой доски.
        </Alert>
        <Box
          className={styles.columns}
          role="region"
          tabIndex={0}
          aria-label={`Колонки доски ${board.name}`}
        >
          {columnItems.map((column) => (
            <Paper key={column.id} withBorder p="md" radius="md" className={styles.column}>
              <Group justify="space-between" wrap="nowrap">
                <Title order={2} size="sm">
                  {column.label}
                </Title>
                <Badge color="gray" variant="light">
                  0
                </Badge>
              </Group>
              <Text size="sm" c="dimmed" ta="center" mt="xl">
                Задач пока нет
              </Text>
            </Paper>
          ))}
        </Box>
      </Stack>
    </ProjectPage>
  );
};
