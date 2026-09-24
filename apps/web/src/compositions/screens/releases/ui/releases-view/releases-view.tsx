import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@mantine/core";
import { FlaskConical } from "lucide-react";
import { useProjectBasePath, useProjectId } from "domains/project";
import { usePlanningDemo } from "domains/planning-demo";
import { createRelease, useReleasesDemo } from "domains/releases-demo";
import type { Release, ReleaseStatus } from "domains/releases-demo";
import { isDefined } from "shared/value-predicates";
import { StatePanel } from "ui/state-panel";
import { ReleaseCatalog } from "../release-catalog";
import { ReleaseDetail } from "../release-detail";
import { ReleaseForm } from "../release-form";
import styles from "./styles/releases-view.module.css";

/**
 * Координирует каталог, просмотр и создание самостоятельных релизов.
 *
 * Используется для:
 *  - сохранения выбранных планов и собственного статуса выпуска
 */
export const ReleasesView = () => {
  const projectId = useProjectId();
  const basePath = useProjectBasePath();
  const navigate = useNavigate();
  const { releaseId } = useParams();
  const plans = usePlanningDemo(projectId);
  const releases = useReleasesDemo(projectId, plans.data);
  const [editor, setEditor] = useState<Release | null>(null);
  const workData = plans.data;
  const releasesData = releases.data;
  const releaseData = releasesData?.releases.find((release) => release.id === releaseId);
  const hasUnknownRelease = isDefined(releaseId) && !isDefined(releaseData);
  const isNew =
    isDefined(editor) && !releasesData?.releases.some((release) => release.id === editor.id);

  /**
   * Открывает новую сущность с пустым составом и статусом «Запланирован».
   */
  const handleCreate = () => {
    if (isDefined(releasesData)) setEditor(createRelease(releasesData.releases));
  };

  /**
   * Сохраняет релиз, затем открывает его постоянный адрес.
   */
  const handleSave = (release: Release) => {
    const error = releases.saveRelease(release);
    if (error !== null) return error;
    navigate(`${basePath}/releases/${release.id}`);
    return null;
  };

  /**
   * Открывает предметную форму, при необходимости предлагая новый статус.
   */
  const handleEdit = (status?: ReleaseStatus) => {
    if (isDefined(releaseData)) setEditor({ ...releaseData, status: status ?? releaseData.status });
  };

  if (!isDefined(workData) || !isDefined(releasesData))
    return (
      <StatePanel
        title="Релизы недоступны"
        titleAs="h1"
        description={plans.error ?? releases.error ?? "Не удалось прочитать локальные данные."}
        action={<Button onClick={() => window.location.reload()}>Повторить чтение</Button>}
      />
    );
  if (hasUnknownRelease)
    return (
      <StatePanel
        title="Релиз не найден"
        titleAs="h1"
        description="В этом проекте нет релиза с таким адресом."
        action={
          <Button component={Link} to={`${basePath}/releases`}>
            Все релизы
          </Button>
        }
      />
    );

  return (
    <section className={styles.root}>
      <div className={styles.preview}>
        <FlaskConical size={14} aria-hidden="true" />
        <strong>Прототип</strong>
        <span>Самостоятельные релизы · изменения только в этой вкладке</span>
      </div>
      {!isDefined(releaseId) && (
        <ReleaseCatalog
          releases={releasesData.releases}
          work={workData}
          basePath={basePath}
          onCreate={handleCreate}
        />
      )}
      {isDefined(releaseData) && (
        <ReleaseDetail
          key={`release-${releaseData.id}`}
          release={releaseData}
          work={workData}
          basePath={basePath}
          onEdit={handleEdit}
        />
      )}
      {isDefined(editor) && (
        <ReleaseForm
          key={`editor-${editor.id}`}
          release={editor}
          work={workData}
          projectId={projectId}
          isNew={isNew}
          onSave={handleSave}
          onClose={() => setEditor(null)}
        />
      )}
    </section>
  );
};
