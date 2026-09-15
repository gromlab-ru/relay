import { Link, useLocation, useMatch } from "react-router-dom";
import { useProjectId } from "domains/project";
import { readBoardOrigin, readTaskId } from "../../helpers/board-location";
import { readLinkTarget } from "../../helpers/read-link-target";
import type { TaskLinkProps } from "./types/task-link-props.type";

/**
 * Открывает ссылки доски через React Router, сохраняя группу и точку возврата.
 *
 * Используется для:
 *  - переходов между задачами без перезагрузки приложения и SSE
 *  - обычных внешних ссылок, якорей и открытия в другой вкладке
 */
export const TaskLink = (props: TaskLinkProps) => {
  const { href, children, ...anchorAttrs } = props;
  const location = useLocation();
  const projectPath = `/projects/${encodeURIComponent(useProjectId())}`;
  const isTaskOpen = useMatch("/projects/:project/tasks/:id") !== null;
  const destination = readLinkTarget(href, window.location.href);
  const path = destination?.pathname.startsWith(`${projectPath}/`)
    ? destination.pathname.slice(projectPath.length)
    : destination?.pathname;
  const taskId = readTaskId(path?.match(/^\/tasks\/(\d+)\/?$/)?.[1]);
  const isBoardLink = path === "/";
  const isAppLink =
    destination?.origin === window.location.origin && (isBoardLink || taskId !== null);
  const isAnchor = href?.startsWith("#") ?? false;
  const hasDownload = anchorAttrs.download !== undefined;
  if (destination === null || !isAppLink || isAnchor || hasDownload) {
    return (
      <a {...anchorAttrs} href={href}>
        {children}
      </a>
    );
  }
  const to = {
    pathname: `${projectPath}${path}`,
    search: destination.search || location.search,
    hash: destination.hash,
  };
  const state = {
    fromBoard: location.pathname === `${projectPath}/` || readBoardOrigin(location.state),
  };
  return (
    <Link {...anchorAttrs} to={to} state={state} replace={isTaskOpen}>
      {children}
    </Link>
  );
};
