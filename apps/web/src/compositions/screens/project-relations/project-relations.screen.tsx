import { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Alert,
  Anchor,
  Button,
  Group,
  NumberInput,
  Paper,
  Select,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useProjectId } from "domains/project";
import { relationAddress, relationError, saveRelations, useRelations } from "domains/relations";
import { EntityPicker } from "./ui/entity-picker/entity-picker";
import { RelationEditor } from "./ui/relation-editor/relation-editor";
import { RelationCard } from "./ui/relation-card/relation-card";
import styles from "./styles/project-relations.module.css";

/**
 * Связывает сущности проекта и восстанавливает объяснимое окружение выбранной сущности.
 *
 * Используется для:
 *  - просмотра общего графа и его постраничного контекста
 *  - установки произвольных отношений и контекстных ссылок
 */
export const ProjectRelationsScreen = () => {
  const projectId = useProjectId();
  const [params, setParams] = useSearchParams();
  const root = params.get("root");
  const [depth, setDepth] = useState(4);
  const [profile, setProfile] = useState<"all" | "context">("context");
  const [page, setPage] = useState({ offset: 0, version: undefined as string | undefined });
  const [isEditorOpen, setEditorOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const request = useRef({ signature: "", id: crypto.randomUUID() });
  const query = useRelations(projectId, {
    ...page,
    ...(root ? { root } : {}),
    depth,
    profile,
    limit: 30,
  });
  const graph = query.data;
  const version = graph?.version ?? "";
  const nodesData = graph?.nodes ?? [];
  const edgesData = graph?.edges ?? [];
  const labelsMap = new Map(
    [...nodesData, ...(graph?.endpoints ?? [])].map((node) => [
      relationAddress(node.ref),
      `${node.key} · ${node.title}`,
    ]),
  );
  const pathsMap = new Map(
    (graph?.paths ?? []).map((path) => [
      relationAddress(path.target),
      (
        path.keys ??
        path.nodes.map((ref) => labelsMap.get(relationAddress(ref)) ?? relationAddress(ref))
      ).join(" → "),
    ]),
  );
  const nodeItems = nodesData.map((node) => ({
    ...node,
    address: relationAddress(node.ref),
    path: pathsMap.get(relationAddress(node.ref)) ?? "Прямая запись каталога",
  }));
  const edgeItems = edgesData.map((edge) => ({
    edge,
    fromLabel: labelsMap.get(relationAddress(edge.from)) ?? relationAddress(edge.from),
    toLabel: labelsMap.get(relationAddress(edge.to)) ?? relationAddress(edge.to),
  }));
  const hasError = error !== null || query.error !== undefined;
  const errorMessage = error ?? query.error?.message;
  const isEmpty = graph?.totalNodes === 0;
  const hasNoEdges = graph?.totalEdges === 0;
  const hasMore = graph?.nextOffset !== undefined && graph.nextOffset !== null;
  const hasBoundary = graph?.depthLimited === true;
  const canEdit = version !== "" && query.error === undefined;
  const shouldShowEditor = isEditorOpen && version !== "";
  const hasNotice = notice !== "";
  /** Начинает новое согласованное чтение, не сбрасывая открытую форму. */
  const handleRefresh = (): void => {
    setPage({ offset: 0, version: undefined });
    setError(null);
    void query.mutate().catch(() => undefined);
  };
  /** Сохраняет корень контекста в URL для агента и оператора. */
  const handleSelect = (address: string | null): void => {
    setParams(address ? { root: address } : {});
    setPage({ offset: 0, version: undefined });
  };
  /** Отзывает только явно установленное ребро; неподтверждённый запрос повторяется безопасно. */
  const handleRemove = async (id: string): Promise<void> => {
    const signature = JSON.stringify([id, version]);
    if (request.current.signature !== signature)
      request.current = { signature, id: crypto.randomUUID() };
    try {
      await saveRelations(projectId, [{ action: "remove", id }], version, request.current.id);
      setNotice("Связь удалена; её история сохранена.");
      handleRefresh();
    } catch (failure) {
      setError(relationError(failure).message);
    }
  };
  /** Обновляет граф после подтверждённой записи формы. */
  const handleSaved = (): void => {
    setEditorOpen(false);
    setNotice("Связь сохранена.");
    handleRefresh();
  };
  return (
    <section className={styles.root}>
      <Group justify="space-between">
        <div>
          <Title order={1}>Связи проекта</Title>
          <Text c="dimmed" size="sm">
            Сущности, отношения и причины включения в контекст
          </Text>
        </div>
        <Button disabled={!canEdit} onClick={() => setEditorOpen(true)}>
          Добавить связь
        </Button>
      </Group>
      <div className={styles.filters}>
        <EntityPicker
          projectId={projectId}
          label="Контекст сущности"
          value={root}
          onChange={handleSelect}
        />
        <Select
          label="Область обхода"
          value={profile}
          data={[
            { value: "context", label: "Контекст работы" },
            { value: "all", label: "Все отношения" },
          ]}
          allowDeselect={false}
          onChange={(value) => {
            setProfile(value === "all" ? "all" : "context");
            setPage({ offset: 0, version: undefined });
          }}
        />
        <NumberInput
          label="Глубина"
          min={0}
          max={100}
          value={depth}
          onChange={(value) => {
            setDepth(Number(value));
            setPage({ offset: 0, version: undefined });
          }}
        />
      </div>
      <Group>
        <Button variant="default" onClick={handleRefresh}>
          Обновить граф
        </Button>
        <Button variant="subtle" onClick={() => handleSelect(null)}>
          Весь проект
        </Button>
        <Text size="sm" c="dimmed">
          Сущностей: {graph?.totalNodes ?? 0} · Связей: {graph?.totalEdges ?? 0}
        </Text>
      </Group>
      {hasNotice && <Text role="status">{notice}</Text>}
      {shouldShowEditor && (
        <RelationEditor
          projectId={projectId}
          version={version}
          root={root}
          onSaved={handleSaved}
          onCancel={() => setEditorOpen(false)}
        />
      )}
      {hasError && (
        <Alert color="red" title="Не удалось обновить связи" role="alert">
          {errorMessage}
        </Alert>
      )}
      {query.isLoading && <Text role="status">Загружаем граф…</Text>}
      {hasBoundary && (
        <Alert title="За границей глубины есть ещё связи">
          Увеличьте глубину или откройте окружение одной из показанных сущностей.
        </Alert>
      )}
      <div className={styles.columns}>
        <Stack gap="sm">
          <Title order={2} size="h3">
            Сущности и пути
          </Title>
          {isEmpty && <Text c="dimmed">Сущностей в этой области нет.</Text>}
          {nodeItems.map((node) => (
            <Paper key={node.address} withBorder p="sm" radius="md" className={styles.node}>
              <Anchor component="button" ta="left" onClick={() => handleSelect(node.address)}>
                {node.key} · {node.title}
              </Anchor>
              <Text size="xs" c="dimmed">
                {node.address} · {node.status}
              </Text>
              <Text size="xs" mt={6}>
                Почему включено: {node.path}
              </Text>
            </Paper>
          ))}
        </Stack>
        <Stack gap="sm">
          <Title order={2} size="h3">
            Направленные отношения
          </Title>
          <Text size="xs" c="dimmed">
            Предметные связи читаются из своих записей. Явные связи можно удалить здесь.
          </Text>
          {hasNoEdges && <Text c="dimmed">Отношений пока нет. Добавьте первую связь.</Text>}
          {edgeItems.map((entry) => (
            <RelationCard
              key={entry.edge.id}
              {...entry}
              onSelect={handleSelect}
              onRemove={handleRemove}
            />
          ))}
        </Stack>
      </div>
      {hasMore && (
        <Button
          variant="default"
          onClick={() => setPage({ offset: graph?.nextOffset ?? 0, version })}
        >
          Следующая страница графа
        </Button>
      )}
    </section>
  );
};
