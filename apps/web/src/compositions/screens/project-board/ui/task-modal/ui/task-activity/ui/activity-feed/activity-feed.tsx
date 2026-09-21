import clsx from "clsx";
import { Text, Timeline } from "@mantine/core";
import { groupActivityDays, getActivityIcon } from "../../helpers/activity-presentation";
import { DiscussionMessage } from "../discussion-message/discussion-message";
import { ActivityEntry } from "../activity-entry/activity-entry";
import type { ActivityFeedProps } from "./types/activity-feed-props.type";
import styles from "./styles/activity-feed.module.css";

/**
 * Организует сообщения и историю по дням с разными ритмами чтения.
 *
 * Используется для:
 *  - чтения обсуждения без растянутых карточек
 *  - непрерывной линии событий, включая раскрытые записи
 */
export const ActivityFeed = (props: ActivityFeedProps) => {
  const { projectId, taskId, entries, comments, active, className, ...rootAttrs } = props;
  const daysData = groupActivityDays(entries).map((day) => ({
    ...day,
    items: day.entries.map((entry) => ({ entry, Icon: getActivityIcon(entry.action) })),
  }));
  if (comments)
    return (
      <div {...rootAttrs} className={clsx(styles.root, className)}>
        {daysData.map((day) => (
          <section key={day.key} aria-label={day.label}>
            <Text component="h3" className={styles.day}>
              {day.label}
            </Text>
            <ol className={styles.messages}>
              {day.entries.map((entry) => (
                <li key={entry.id} className={styles.message}>
                  <DiscussionMessage
                    projectId={projectId}
                    taskId={taskId}
                    entry={entry}
                    active={active}
                  />
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    );
  return (
    <div {...rootAttrs} className={clsx(styles.root, className)}>
      {daysData.map((day) => (
        <section key={day.key} aria-label={day.label}>
          <Text component="h3" className={styles.day}>
            {day.label}
          </Text>
          <Timeline
            bulletSize={18}
            lineWidth={1}
            classNames={{
              item: styles.timelineItem,
              itemBullet: styles.bullet,
              itemBody: styles.itemBody,
            }}
          >
            {day.items.map(({ entry, Icon }) => (
              <Timeline.Item key={entry.id} bullet={<Icon size={10} aria-hidden />}>
                <ActivityEntry
                  projectId={projectId}
                  taskId={taskId}
                  entry={entry}
                  active={active}
                />
              </Timeline.Item>
            ))}
          </Timeline>
        </section>
      ))}
    </div>
  );
};
