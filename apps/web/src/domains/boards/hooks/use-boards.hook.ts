import { useEffect } from "react";
import useSWR from "swr";
import type { SWRResponse } from "swr";
import useSWRInfinite from "swr/infinite";
import type { SWRInfiniteResponse } from "swr/infinite";
import { subscribeWorkspace } from "infra/workspace-events";
import { getBoard, getBoards } from "../adapters/boards.adapter";
import type { Board, BoardsPage } from "../types/boards.type";

/** Изолирует страницы каталога по проекту и перечитывает после внешних изменений. */
export const useBoards = (projectId: string): SWRInfiniteResponse<BoardsPage, Error> => {
  const query = useSWRInfinite<BoardsPage, Error>(
    (index: number, previous: BoardsPage | null) => {
      if (previous?.nextOffset === null) return null;
      return ["boards", projectId, index === 0 ? 0 : previous?.nextOffset, previous?.version];
    },
    ([, project, offset, version]: [string, string, number, string | undefined]) =>
      getBoards(project, offset, version),
    { revalidateAll: true, persistSize: false },
  );
  const { mutate, setSize } = query;
  useEffect(
    () =>
      subscribeWorkspace(projectId, (signal) => {
        if (signal.state === "connected")
          void setSize(1)
            .then(() => mutate())
            .catch(() => undefined);
      }),
    [projectId, mutate, setSize],
  );
  return query;
};

/** Поддерживает актуальность открытой доски, в том числе её названия. */
export const useBoard = (projectId: string, slug: string): SWRResponse<Board, Error> => {
  const query = useSWR<Board, Error>(["board-info", projectId, slug], () =>
    getBoard(projectId, slug),
  );
  const { mutate } = query;
  useEffect(
    () =>
      subscribeWorkspace(projectId, (signal) => {
        if (signal.state === "connected") void mutate().catch(() => undefined);
      }),
    [projectId, mutate],
  );
  return query;
};
