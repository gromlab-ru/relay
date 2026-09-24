import type { Release } from "../types/release.type";

/**
 * Подготавливает самостоятельный запланированный релиз без записи пустой сущности.
 */
export const createRelease = (releases: Release[]): Release => {
  const number =
    Math.max(0, ...releases.map((release) => Number(release.key.split("-").at(-1)) || 0)) + 1;
  return {
    id: crypto.randomUUID(),
    key: `REL-${String(number).padStart(3, "0")}`,
    title: "",
    version: "",
    summary: "",
    description: "",
    planIds: [],
    status: "planned",
    plannedFor: "",
    releasedAt: null,
    updatedAt: new Date().toISOString(),
    snapshot: null,
  };
};
