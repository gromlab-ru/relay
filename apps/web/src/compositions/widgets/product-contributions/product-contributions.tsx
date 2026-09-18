import clsx from "clsx";
import { Text } from "@mantine/core";
import { ArrowUpRight } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { ProductReadiness, useProductDemo } from "domains/product-demo";
import { useProductPath } from "compositions/widgets/product-page";
import { isEmptyArray } from "shared/value-predicates";
import type { ProductContributionsProps } from "./types/product-contributions-props.type";
import styles from "./styles/product-contributions.module.css";

/**
 * Показывает объявленный вклад приложений в общую фичу.
 *
 * Используется для:
 *  - переходов от фичи к приложению и обратно
 */
export const ProductContributions = (props: ProductContributionsProps) => {
  const { featureId, className, ...rootAttrs } = props;
  const { snapshot } = useProductDemo();
  const location = useLocation();
  const base = useProductPath();
  const contributionItems = snapshot.contributions
    .filter((link) => link.featureId === featureId)
    .flatMap((link) => {
      const targetData = snapshot.applications.find(
        (application) => application.id === link.applicationId,
      );
      if (targetData === undefined) return [];
      return [
        {
          ...link,
          id: targetData.id,
          name: targetData.name,
          typeLabel: targetData.type,
          href: `${base}/applications/${targetData.id}?open=${encodeURIComponent(link.featureId)}#application-feature-${link.featureId}`,
        },
      ];
    });
  const hasNoContributions = isEmptyArray(contributionItems);
  const returnTo = location.pathname + location.search + location.hash;
  return (
    <section {...rootAttrs} className={clsx(styles.root, className)}>
      <h2 className={styles.title}>Реализация по приложениям</h2>
      <Text size="xs" c="dimmed" mb="md" lh={1.7}>
        Приложения выбирают сценарии и описывают, какую часть поведения обеспечивают.
      </Text>
      {hasNoContributions && (
        <Text size="sm" c="dimmed">
          Участие пока не объявлено. Выберите эту фичу на странице нужного приложения.
        </Text>
      )}
      <ul className={styles.list}>
        {contributionItems.map((contribution) => (
          <li key={contribution.id} className={styles.contribution}>
            <Link to={contribution.href} state={{ returnTo }} className={styles.link}>
              {contribution.name}
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
            <Text size="xs" c="dimmed" mb="sm">
              {contribution.typeLabel}
            </Text>
            <ProductReadiness status={contribution.status} />
            <Text size="xs" c="dimmed">
              Выбрано сценариев: {contribution.scenarios.length}
            </Text>
            <p className={styles.description}>
              {contribution.title || "Заголовок вклада ещё не задан."}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
};
