import lockfile from "proper-lockfile";
import { join } from "node:path";
import { AppError } from "../shared/errors.js";

/** Общая короткая блокировка защищает также инварианты между разными карточками. */
export async function withStorageLock<T>(
  root: string,
  operation: (assertOwned: () => void) => Promise<T>,
): Promise<T> {
  let compromised: Error | undefined;
  const release = await lockfile.lock(root, {
    lockfilePath: join(root, ".runtime", "write.lock"),
    realpath: true,
    stale: 10000,
    update: 2000,
    retries: { retries: 60, factor: 1.2, minTimeout: 25, maxTimeout: 250, randomize: true },
    onCompromised(error) {
      compromised = error;
    },
  });
  const assertOwned = () => {
    if (compromised)
      throw new AppError("LOCK_LOST", "Потеряна блокировка хранилища; запись отменена", 4);
  };
  try {
    assertOwned();
    return await operation(assertOwned);
  } finally {
    if (!compromised) await release();
  }
}
