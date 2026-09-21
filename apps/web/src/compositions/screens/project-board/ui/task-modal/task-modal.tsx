import { useState } from "react";
import { ActionIcon, Alert, Button, Group, Modal, Skeleton, Tooltip } from "@mantine/core";
import { Maximize2, Minimize2 } from "lucide-react";
import { useMediaQuery } from "@mantine/hooks";
import { useBoardTask } from "domains/board-tasks";
import { ProjectBreadcrumbs } from "compositions/widgets/page-breadcrumbs";
import { TaskEditor } from "./ui/task-editor";
import type { TaskModalProps } from "./types/task-modal-props.type";
import styles from "./styles/task-modal.module.css";

/**
 * Открывает задачу в широком центральном модальном окне.
 *
 * Используется для:
 *  - загрузки задачи по ID или ключу и полноэкранного редактора на телефоне
 */
export const TaskModal = (props: TaskModalProps) => {
  const { projectId, reference, startEditing, onClose, onOpen } = props;
  const query = useBoardTask(projectId, reference, !startEditing);
  const [isExpanded, setExpanded] = useState(false);
  const isMobile = useMediaQuery("(max-width: 48em)");
  const hasError = query.error !== undefined;
  const task = query.data;
  const title = task?.key ?? "Задача";
  const size = isExpanded ? "calc(100vw - 32px)" : "min(1180px, calc(100vw - 48px))";
  const expandLabel = isExpanded ? "Обычный размер" : "Развернуть задачу";
  const SizeIcon = isExpanded ? Minimize2 : Maximize2;
  const offset = isExpanded ? 16 : 24;
  return (
    <Modal.Root
      opened
      onClose={onClose}
      centered
      size={size}
      xOffset={offset}
      yOffset={offset}
      fullScreen={isMobile}
      classNames={{
        body: styles.body,
        header: styles.header,
        title: styles.title,
        content: styles.content,
      }}
    >
      <Modal.Overlay />
      <Modal.Content data-expanded={isExpanded}>
        <Modal.Header role="presentation">
          <Modal.Title>{title}</Modal.Title>
          <Group gap="xs">
            {!isMobile && (
              <Tooltip label={expandLabel}>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  aria-label={expandLabel}
                  aria-pressed={isExpanded}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setExpanded(!isExpanded)}
                >
                  <SizeIcon size={18} />
                </ActionIcon>
              </Tooltip>
            )}
            <Modal.CloseButton aria-label="Закрыть задачу" />
          </Group>
        </Modal.Header>
        <Modal.Body>
          <ProjectBreadcrumbs embedded />
          {query.isLoading && <Skeleton height={360} radius="md" />}
          {hasError && (
            <Alert color="red" title="Не удалось прочитать задачу">
              {query.error?.message}
              <Button variant="subtle" onClick={() => void query.mutate().catch(() => undefined)}>
                Повторить
              </Button>
            </Alert>
          )}
          {task !== undefined && (
            <TaskEditor
              key={task.id}
              projectId={projectId}
              task={task}
              startEditing={startEditing}
              onOpen={onOpen}
              onClose={onClose}
            />
          )}
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
};
