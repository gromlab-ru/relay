import { Button, NativeSelect, TextInput } from "@mantine/core";
import { FilePlus2, Library, Search } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { DOCUMENTATION_KIND_OPTIONS, useProductDemo } from "domains/product-demo";
import { ProductPage, useProductPath } from "compositions/widgets/product-page";
import { StatePanel } from "ui/state-panel";
import { isEmptyArray } from "shared/value-predicates";
import { DocumentCard } from "./ui/document-card";
import { DOCUMENT_FILTERS } from "./config/document-filters";
import { filterDocuments, matchesDocumentScope } from "./helpers/filter-documents";
import styles from "./styles/product-documents.module.css";

/**
 * Собирает библиотеку Markdown-материалов продукта с поиском и визуальным контекстом.
 *
 * Используется для:
 *  - поиска требований, описаний и решений по продукту
 *  - создания и открытия документа с сохранением фильтров каталога
 */
export const ProductDocumentsScreen = () => {
  const { snapshot, scopes } = useProductDemo();
  const base = useProductPath();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const requestedKind = searchParams.get("kind") ?? "all";
  const kind = DOCUMENTATION_KIND_OPTIONS.some((entry) => entry.value === requestedKind)
    ? requestedKind
    : "all";
  const requestedScope = searchParams.get("scope") ?? "all";
  const scope = DOCUMENT_FILTERS.some((entry) => entry.value === requestedScope)
    ? requestedScope
    : "all";
  const sort = searchParams.get("sort") === "name" ? "name" : "updated";
  const documentItems = filterDocuments(snapshot.documentation, query, kind, scope, scopes).sort(
    (left, right) =>
      sort === "name"
        ? left.name.localeCompare(right.name, "ru")
        : right.updatedAt.localeCompare(left.updatedAt),
  );
  const filterItems = DOCUMENT_FILTERS.map((entry) => ({
    ...entry,
    count: snapshot.documentation.filter((document) =>
      matchesDocumentScope(document, entry.value, scopes),
    ).length,
    isActive: scope === entry.value,
    variant: scope === entry.value ? "default" : "subtle",
  }));
  const hasNoDocuments = isEmptyArray(snapshot.documentation);
  const hasNoResults = !hasNoDocuments && isEmptyArray(documentItems);
  const hasFilters = query !== "" || kind !== "all" || scope !== "all";
  const returnTo = `${base}/documents${searchParams.size > 0 ? `?${searchParams}` : ""}`;
  /**
   * Сохраняет фильтр в URL без отдельной записи истории на каждый символ.
   */
  const updateFilter = (key: string, value: string): void => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value === "" || value === "all" || (key === "sort" && value === "updated"))
          next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );
  };
  return (
    <ProductPage
      title="Документы"
      description="Требования, описания и решения — единая библиотека знаний о продукте."
      actions={
        <Button
          component={Link}
          to={`${base}/documents/new`}
          state={{ returnTo }}
          leftSection={<FilePlus2 size={16} aria-hidden="true" />}
        >
          Создать документ
        </Button>
      }
    >
      <div className={styles.root}>
        <div className={styles.toolbar}>
          <TextInput
            className={styles.search}
            aria-label="Поиск документов"
            placeholder="Найти по названию, тексту или области…"
            leftSection={<Search size={16} aria-hidden="true" />}
            value={query}
            onChange={(event) => updateFilter("q", event.currentTarget.value)}
          />
          <NativeSelect
            aria-label="Тип документа"
            value={kind}
            onChange={(event) => updateFilter("kind", event.currentTarget.value)}
            data={[{ value: "all", label: "Все типы документов" }, ...DOCUMENTATION_KIND_OPTIONS]}
          />
        </div>
        <div className={styles.filterBar}>
          <div className={styles.filters} role="group" aria-label="Область документов">
            {filterItems.map((entry) => (
              <Button
                key={entry.value}
                size="xs"
                variant={entry.variant}
                color="gray"
                aria-pressed={entry.isActive}
                onClick={() => updateFilter("scope", entry.value)}
                rightSection={<span className={styles.count}>{entry.count}</span>}
              >
                {entry.label}
              </Button>
            ))}
          </div>
          <NativeSelect
            size="xs"
            aria-label="Сортировка документов"
            value={sort}
            onChange={(event) => updateFilter("sort", event.currentTarget.value)}
            data={[
              { value: "updated", label: "Сначала обновлённые" },
              { value: "name", label: "По названию" },
            ]}
          />
        </div>
        <div className={styles.results}>
          <span role="status">
            Показано {documentItems.length} из {snapshot.documentation.length}
          </span>
          {hasFilters && (
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              onClick={() => setSearchParams({})}
            >
              Сбросить фильтры
            </Button>
          )}
        </div>
        {hasNoDocuments && (
          <StatePanel
            title="Начните с первого документа"
            description="Опишите требования к продукту, ожидаемое поведение или важное решение. Всё будет под рукой у команды."
            action={
              <Button
                component={Link}
                to={`${base}/documents/new`}
                variant="default"
                leftSection={<FilePlus2 size={15} aria-hidden="true" />}
              >
                Создать документ
              </Button>
            }
          />
        )}
        {hasNoResults && (
          <StatePanel
            title="Ничего не нашлось"
            description="Попробуйте другой запрос или расширьте область поиска."
            action={
              <Button variant="default" onClick={() => setSearchParams({})}>
                Сбросить фильтры
              </Button>
            }
          />
        )}
        <ul className={styles.grid} aria-label="Документы продукта">
          {documentItems.map((document) => (
            <li key={document.id}>
              <DocumentCard
                document={document}
                href={`${base}/documents/${document.id}`}
                returnTo={returnTo}
              />
            </li>
          ))}
        </ul>
        <p className={styles.note}>
          <Library size={15} aria-hidden="true" />
          Продуктовые документы связаны с общими требованиями и реализациями приложений.
        </p>
      </div>
    </ProductPage>
  );
};
