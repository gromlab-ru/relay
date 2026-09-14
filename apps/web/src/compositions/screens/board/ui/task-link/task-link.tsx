import { Link, useLocation, useMatch } from "react-router-dom";
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
  const isTaskOpen = useMatch("/tasks/:id") !== null;
  const destination = readLinkTarget(href, window.location.href);
  const taskId = readTaskId(destination?.pathname.match(/^\/tasks\/(\d+)\/?$/)?.[1]);
  const isBoardLink = destination?.pathname === "/";
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
    pathname: destination.pathname,
    search: destination.search || location.search,
    hash: destination.hash,
  };
  const state = { fromBoard: location.pathname === "/" || readBoardOrigin(location.state) };
  return (
    <Link {...anchorAttrs} to={to} state={state} replace={isTaskOpen}>
      {children}
    </Link>
  );
};
