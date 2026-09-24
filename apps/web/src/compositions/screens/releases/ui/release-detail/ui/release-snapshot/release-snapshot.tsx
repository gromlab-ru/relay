import { useState } from "react";
import { Accordion, Alert, Button } from "@mantine/core";
import { useReleaseSnapshot } from "domains/releases";
import { useProjectId } from "domains/project";
import { MarkdownView } from "ui/markdown-view";
import { isDefined } from "shared/value-predicates";
import type { ReleaseSnapshotProps } from "./types/release-snapshot-props.type";
import styles from "../../styles/release-detail.module.css";

/**
 * Раскрывает самодостаточные тексты работ, требований и материалов выпуска.
 *
 * Используется для:
 *  - чтения исторического результата независимо от текущих записей
 */
export const ReleaseSnapshot = (props: ReleaseSnapshotProps) => {
  const { releaseId } = props;
  const projectId = useProjectId();
  const [isExpanded, setIsExpanded] = useState(false);
  const [limit, setLimit] = useState(12);
  const query = useReleaseSnapshot(projectId, releaseId, limit, isExpanded);
  const snapshotItems = query.data?.items ?? [];
  const hasMore = isDefined(query.data?.nextOffset);
  const hasError = isDefined(query.error);
  return (
    <section className={styles.description}>
      <details open={isExpanded} onToggle={(event) => setIsExpanded(event.currentTarget.open)}>
        <summary>Снимок работ, требований и материалов</summary>
        <p>Содержание на момент выпуска. Ссылки на текущие планы показаны выше.</p>
        {query.isLoading && <p role="status">Загружаем снимок…</p>}
        {hasError && (
          <Alert color="red">
            {query.error?.message}
            <Button size="xs" onClick={() => void query.mutate()}>
              Повторить
            </Button>
          </Alert>
        )}
        <Accordion multiple variant="separated">
          {snapshotItems.map((item) => (
            <Accordion.Item key={`${item.kind}:${item.id}`} value={`${item.kind}:${item.id}`}>
              <Accordion.Control>
                {item.key} · {item.title}
              </Accordion.Control>
              <Accordion.Panel>
                <p>{item.reason}</p>
                <MarkdownView text={item.content} />
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
        {hasMore && (
          <Button
            variant="default"
            fullWidth
            mt="md"
            loading={query.isValidating}
            onClick={() => setLimit(limit + 12)}
          >
            Показать ещё записи · {snapshotItems.length} из {query.data?.total}
          </Button>
        )}
      </details>
    </section>
  );
};
