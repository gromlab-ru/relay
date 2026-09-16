import { useState } from "react";
import { Badge, Button, Group, Text } from "@mantine/core";
import { Compass, Pencil, Target, Users, ShieldCheck } from "lucide-react";
import { isRecordOf, PROJECT_INPUT_SCHEMAS, statusLabel, useLifecycle } from "domains/lifecycle";
import { ProjectPage } from "compositions/widgets/project-page";
import { ProjectEditor } from "compositions/widgets/project-editor";
import { MarkdownView } from "ui/markdown-view";
import { formatDateTime } from "infra/date-time";
import styles from "./styles/passport.module.css";

/**
 * Представляет назначение проекта как читаемый паспорт и точку входа для участников.
 *
 * Используется для:
 *  - знакомства с пользователями, границами и ограничениями продукта
 */
export const PassportScreen = () => {
  const lifecycle = useLifecycle();
  const [isEditing, setEditing] = useState(false);
  const record = lifecycle.data?.records.find((item) => isRecordOf(item, "passport"));
  const passport = record?.fields ?? PROJECT_INPUT_SCHEMAS.passport.parse({ kind: "passport" });
  const updatedLabel =
    record === undefined
      ? "Паспорт ещё не заполнен"
      : `Обновил ${record.updatedBy} · ${formatDateTime(record.updatedAt)}`;
  return (
    <ProjectPage
      title="Паспорт проекта"
      description="Зачем существует продукт, для кого мы его развиваем и что важно учитывать."
      isLoading={lifecycle.isLoading && lifecycle.data === undefined}
      error={lifecycle.error}
      actions={
        <Button leftSection={<Pencil size={14} />} onClick={() => setEditing(true)}>
          Редактировать паспорт
        </Button>
      }
    >
      <article className={styles.document}>
        <header className={styles.cover}>
          <div className={styles.emblem}>
            <Compass size={32} />
          </div>
          <Group gap="xs">
            <Badge variant="light">{statusLabel(passport.productStage)}</Badge>
            <Badge variant="light" color="gray">
              {statusLabel(passport.mode)}
            </Badge>
          </Group>
          <h2 className={styles.name}>{passport.title || "Дайте проекту имя"}</h2>
          <Text c="dimmed" size="sm">
            {updatedLabel}
          </Text>
        </header>
        <section className={styles.purpose}>
          <h3>
            <Target size={18} /> Назначение
          </h3>
          <MarkdownView
            text={passport.purpose}
            emptyText="Опишите проблему, которую решает продукт. Это поможет агенту выбирать решения в правильном контексте."
          />
        </section>
        <div className={styles.columns}>
          <section className={styles.section}>
            <h3>
              <Users size={18} /> Для кого
            </h3>
            <MarkdownView
              text={passport.audience}
              emptyText="Кто пользуется продуктом и чего ожидает от него?"
            />
            <Text size="xs" c="dimmed" mt="xl">
              ОТВЕТСТВЕННЫЙ
            </Text>
            <Text size="sm" mt={6}>
              {passport.owner || "Пока не указан"}
            </Text>
          </section>
          <section className={styles.section}>
            <h3>
              <ShieldCheck size={18} /> Границы и ограничения
            </h3>
            <MarkdownView text={passport.scope} emptyText="Какие задачи решает продукт?" />
            <div className={styles.constraints}>
              <MarkdownView
                text={passport.constraints}
                emptyText="Добавьте технические и продуктовые ограничения, которые важно передавать исполнителям."
              />
            </div>
          </section>
        </div>
      </article>
      {isEditing && (
        <ProjectEditor kind="passport" record={record} onClose={() => setEditing(false)} />
      )}
    </ProjectPage>
  );
};
