import clsx from "clsx";
import { Stack, Text, SimpleGrid, Paper, VisuallyHidden } from "@mantine/core";
import { ArrowRight } from "lucide-react";
import { ActivityValue } from "../activity-value/activity-value";
import type { ActivityChangeProps } from "./types/activity-change-props.type";
import styles from "./styles/activity-change.module.css";

/**
 * Сравнивает полные значения изменённого поля.
 *
 * Используется для:
 *  - чтения прежнего и нового содержания без обрезания Markdown
 */
export const ActivityChange = (props: ActivityChangeProps) => {
  const { change, className, ...rootAttrs } = props;
  const valuesData = [
    { label: "До", value: change.before },
    { label: "После", value: change.after },
  ];
  if (change.format === "text")
    return (
      <div {...rootAttrs} className={clsx(styles.root, className)}>
        <Text size="xs" c="dimmed" mb={4}>
          {change.label}
        </Text>
        <div className={styles.comparison}>
          <div className={styles.previous}>
            <VisuallyHidden>До: </VisuallyHidden>
            <ActivityValue value={change.before} markdown={false} field={change.field} />
          </div>
          <ArrowRight size={13} className={styles.arrow} aria-hidden />
          <div className={styles.value}>
            <VisuallyHidden>После: </VisuallyHidden>
            <ActivityValue value={change.after} markdown={false} field={change.field} />
          </div>
        </div>
      </div>
    );
  return (
    <div {...rootAttrs} className={clsx(styles.root, className)}>
      <Stack gap="xs">
        <Text fw={600} size="sm">
          {change.label}
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          {valuesData.map((side) => (
            <Paper key={side.label} p="sm" withBorder className={styles.value}>
              <Text size="xs" c="dimmed" mb="xs">
                {side.label}
              </Text>
              <ActivityValue
                value={side.value}
                markdown={change.format === "markdown"}
                field={change.field}
              />
            </Paper>
          ))}
        </SimpleGrid>
      </Stack>
    </div>
  );
};
