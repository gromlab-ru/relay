import { useState } from "react";
import { z } from "zod";
import { useSearchParams } from "react-router-dom";
import { Button, Group, SimpleGrid, Switch, Tabs, Text, TextInput } from "@mantine/core";
import { BookOpen, Plus, Search } from "lucide-react";
import { isRecordOf, useLifecycle } from "domains/lifecycle";
import { ProjectPage } from "compositions/widgets/project-page";
import { ProjectEditor } from "compositions/widgets/project-editor";
import type { ProjectEdit } from "compositions/widgets/project-editor";
import { ProjectRecord } from "compositions/widgets/project-record";
import { isDefined, isEmptyArray } from "shared/value-predicates";
import styles from "./styles/knowledge.module.css";
const TAB_SCHEMA = z.enum(["requirements", "decisions", "guides"]).catch("requirements");

/**
 * Организует требования и долговременную память проекта по назначению документа.
 *
 * Используется для:
 *  - чтения правил продукта, решений и инструкций исполнителями
 */
export const KnowledgeScreen = () => {
  const lifecycle = useLifecycle();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [editor, setEditor] = useState<ProjectEdit | null>(null);
  const tab = TAB_SCHEMA.parse(params.get("tab"));
  const records = lifecycle.data?.records ?? [];
  const items = records
    .filter((record) => {
      const fields = record.fields;
      const matchesTab =
        tab === "requirements"
          ? fields.kind === "requirement"
          : fields.kind === "knowledge" &&
            (tab === "decisions" ? fields.category === "decision" : fields.category !== "decision");
      const isCurrent = !(
        (isRecordOf(record, "knowledge") && record.fields.status === "superseded") ||
        (isRecordOf(record, "requirement") && record.fields.status === "retired")
      );
      return (
        matchesTab &&
        (showHistory || isCurrent) &&
        JSON.stringify(fields).toLocaleLowerCase().includes(search.toLocaleLowerCase())
      );
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const isEmpty = isEmptyArray(items);
  const createLabel =
    tab === "requirements"
      ? "Новое требование"
      : tab === "decisions"
        ? "Записать решение"
        : "Добавить знание";
  const createTarget: ProjectEdit =
    tab === "requirements"
      ? { kind: "requirement" }
      : { kind: "knowledge", initial: { category: tab === "decisions" ? "decision" : "runbook" } };
  return (
    <ProjectPage
      title="Требования и знания"
      description="Как должен работать продукт и почему мы выбрали именно такие решения."
      isLoading={lifecycle.isLoading && lifecycle.data === undefined}
      error={lifecycle.error}
      actions={
        <Button leftSection={<Plus size={14} />} onClick={() => setEditor(createTarget)}>
          {createLabel}
        </Button>
      }
    >
      <Tabs
        value={tab}
        onChange={(value) => {
          if (value !== null) setParams({ tab: value });
        }}
        mb="lg"
      >
        <Tabs.List>
          <Tabs.Tab value="requirements">Требования</Tabs.Tab>
          <Tabs.Tab value="decisions">Решения</Tabs.Tab>
          <Tabs.Tab value="guides">Архитектура и инструкции</Tabs.Tab>
        </Tabs.List>
      </Tabs>
      <Group justify="space-between" mb="lg">
        <TextInput
          aria-label="Поиск по знаниям"
          placeholder="Найти правило или решение…"
          leftSection={<Search size={15} />}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
        />
        <Switch
          size="xs"
          label="Показать заменённые"
          checked={showHistory}
          onChange={(event) => setShowHistory(event.currentTarget.checked)}
        />
      </Group>
      {isEmpty && (
        <div className={styles.empty}>
          <BookOpen size={30} />
          <h2>Контекст, который переживёт сессию</h2>
          <Text c="dimmed" size="sm" maw={460}>
            Запишите ожидаемое поведение, важное решение или инструкцию. Свяжите документ с
            задачами, чтобы он попадал в поручения работникам.
          </Text>
          <Button variant="light" mt="lg" onClick={() => setEditor(createTarget)}>
            {createLabel}
          </Button>
        </div>
      )}
      <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">
        {items.map((record) => (
          <ProjectRecord
            key={record.id}
            record={record}
            onEdit={(record) => setEditor({ kind: record.fields.kind, record })}
          />
        ))}
      </SimpleGrid>
      {isDefined(editor) && (
        <ProjectEditor
          key={editor.record?.id ?? editor.kind}
          {...editor}
          onClose={() => setEditor(null)}
        />
      )}
    </ProjectPage>
  );
};
