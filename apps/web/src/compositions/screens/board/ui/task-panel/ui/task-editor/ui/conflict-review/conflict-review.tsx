import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { Button, Group, Radio, Stack, Text } from "@mantine/core";
import { FIELD_LABELS, getConflictingFields, mergeTaskInput } from "domains/tasks";
import type { TaskInput } from "domains/tasks";
import { isEmptyArray } from "shared/value-predicates";
import { describeValue } from "./helpers/describe-value";
import type { ConflictReviewProps } from "./types/conflict-review-props.type";
import styles from "./styles/conflict-review.module.css";

/**
 * Сравнивает одновременные изменения без перезаписи чужой работы.
 *
 * Используется для:
 *  - выбора значений конфликтующих полей перед повторным сохранением
 */
export const ConflictReview = (props: ConflictReviewProps) => {
  const { base, local, remote, onApply, onCancel, className, ...rootAttrs } = props;
  const [remoteFields, setRemoteFields] = useState<(keyof TaskInput)[]>([]);
  const region = useRef<HTMLDivElement>(null);
  useEffect(() => {
    region.current?.focus();
    region.current?.scrollIntoView({ block: "start" });
  }, []);
  const fields = getConflictingFields(base, local, remote);
  const hasNoConflicts = isEmptyArray(fields);
  const rows = fields.map((field) => ({
    field,
    label: FIELD_LABELS[field],
    local: describeValue(local[field]),
    remote: describeValue(remote[field]),
    choice: remoteFields.includes(field) ? "remote" : "local",
  }));
  return (
    <div
      {...rootAttrs}
      ref={region}
      tabIndex={-1}
      className={clsx(styles.root, className)}
      role="region"
      aria-label="Сравнение изменений"
    >
      <h3 className={styles.title}>У задачи появилась новая версия</h3>
      <Text size="sm" c="dimmed">
        Ваш ввод сохранён. Выберите значения для совпадающих полей. Остальные изменения объединятся
        автоматически.
      </Text>
      {hasNoConflicts && (
        <Text size="sm" mt="md">
          Правки не пересекаются: можно сохранить ваш текст вместе с новыми данными и записями
          истории.
        </Text>
      )}
      <Stack gap="lg" my="lg">
        {rows.map((row) => (
          <Radio.Group
            key={row.field}
            label={row.label}
            value={row.choice}
            onChange={(choice) =>
              setRemoteFields((current) =>
                choice === "remote"
                  ? [...current.filter((key) => key !== row.field), row.field]
                  : current.filter((key) => key !== row.field),
              )
            }
          >
            <div className={styles.choices}>
              <div className={styles.choice}>
                <Radio value="local" label="Моя версия" />
                <pre>{row.local}</pre>
              </div>
              <div className={styles.choice}>
                <Radio value="remote" label="Версия сервера" />
                <pre>{row.remote}</pre>
              </div>
            </div>
          </Radio.Group>
        ))}
      </Stack>
      <Group justify="flex-end">
        <Button variant="subtle" color="gray" onClick={onCancel}>
          Вернуться к тексту
        </Button>
        <Button onClick={() => onApply(mergeTaskInput(base, local, remote, remoteFields))}>
          Применить выбор
        </Button>
      </Group>
    </div>
  );
};
