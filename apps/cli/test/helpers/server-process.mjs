import assert from "node:assert/strict";
import { spawn } from "node:child_process";

/** Запускает CLI или npx и читает JSON-сообщение готовности сервера.
 * @param {string[]} args Аргументы процесса Node.js, включая путь CLI/npx.
 * @param {string} cwd Каталог временного проекта.
 * @param {NodeJS.ProcessEnv} [env] Переопределения окружения запуска.
 */
export async function startServerProcess(args, cwd, env) {
  const child = spawn(process.execPath, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  let errors = "";
  let exited = false;
  /** @type {Promise<{code: number | null, signal: NodeJS.Signals | null}>} */
  const exit = new Promise((resolve) =>
    child.once("exit", (code, signal) => {
      exited = true;
      resolve({ code, signal });
    }),
  );
  child.stderr.setEncoding("utf8").on("data", (text) => {
    errors += text;
  });
  /** @type {{url: string, pid: number}} */
  let started;
  try {
    started = await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Сервер не запустился\n${output}\n${errors}`)),
        20000,
      );
      /** @param {unknown} error */
      const fail = (error) => {
        clearTimeout(timer);
        reject(error);
      };
      child.once("error", fail);
      child.once("exit", () =>
        fail(new Error(`Сервер завершился до готовности\n${output}\n${errors}`)),
      );
      child.stdout.setEncoding("utf8").on("data", (text) => {
        output += text;
        const line = output.split("\n")[0];
        if (!output.includes("\n") || !line) return;
        try {
          const result = JSON.parse(line);
          assert.equal(result.ok, true, line);
          assert.equal(typeof result.data.url, "string");
          assert.match(result.data.url, /^http:\/\/127\.0\.0\.1:\d+(?:\/mcp)?$/);
          assert(Number.isSafeInteger(result.data.pid) && result.data.pid > 0);
          clearTimeout(timer);
          resolve(result.data);
        } catch (error) {
          fail(error);
        }
      });
    });
  } catch (error) {
    child.kill("SIGKILL");
    throw error;
  }
  return {
    url: started.url,
    async close() {
      if (exited) return;
      const timer = setTimeout(() => {
        try {
          process.kill(started.pid, "SIGKILL");
        } catch {
          /* Уже завершён. */
        }
        child.kill("SIGKILL");
      }, 10000);
      try {
        process.kill(started.pid, "SIGTERM");
        const result = await exit;
        assert.equal(result.code, 0, `Сервер завершился некорректно: ${result.signal}\n${errors}`);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/** Проверяет HTTP, Swagger и, при наличии сборки, общий origin и SPA.
 * @param {string} url URL запущенного сервера.
 * @param {{web?: boolean}} options Ожидается ли фронтенд в установленном архиве.
 */
export async function checkServerSurface(url, { web = false } = {}) {
  const health = await fetch(`${url}/api/v1/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), {
    ok: true,
    data: { status: "ok", stage: "ready", contractVersion: 1 },
  });
  const response = await fetch(url);
  if (web) {
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /text\/html/);
    const html = await response.text();
    const scripts = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].flatMap((match) =>
      match[1] ? [match[1]] : [],
    );
    const styles = [...html.matchAll(/<link[^>]*href="([^"]+\.css)"/g)].flatMap((match) =>
      match[1] ? [match[1]] : [],
    );
    assert(scripts.length > 0, "В HTML отсутствует React-сборка");
    assert(styles.length > 0, "В HTML отсутствуют стили");
    for (const path of [...scripts, ...styles]) {
      const asset = await fetch(new URL(path, url));
      assert.equal(asset.status, 200, path);
      assert.match(
        asset.headers.get("content-type") ?? "",
        path.endsWith(".css") ? /text\/css/ : /(?:text|application)\/javascript/,
        path,
      );
      assert((await asset.text()).length > 0);
    }
    const deep = await fetch(`${url}/tasks/12`);
    assert.equal(deep.status, 200);
    assert.equal(await deep.text(), html);
    const head = await fetch(url, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.match(head.headers.get("content-type") ?? "", /text\/html/);
    assert.equal(await head.text(), "");
    for (const path of ["/assets/missing.js", "/missing.css", "/api/docs/missing.js"]) {
      const missing = await fetch(`${url}${path}`);
      assert.equal(missing.status, 404, path);
      assert.equal((await missing.json()).ok, false, path);
    }
  } else {
    assert.equal(response.status, 404);
    assert.equal((await response.json()).ok, false);
  }
  const unknown = await fetch(`${url}/api/v1/not-a-route`);
  assert.equal(unknown.status, 404);
  assert.equal((await unknown.json()).ok, false);
  const spec = await fetch(`${url}/api/openapi.json`);
  assert.equal(spec.status, 200);
  const document = await spec.json();
  assert(document.paths["/api/v1/health"]);
  assert(document.paths["/api/v1/context"]);
  assert(document.paths["/api/v1/board-tasks"].post);
  assert(document.paths["/api/v1/events"].get);
  for (const path of ["/api/docs", "/api/docs/swagger-ui-bundle.js"]) {
    const resource = await fetch(`${url}${path}`);
    assert.equal(resource.status, 200);
    // Drain large Swagger assets before testing graceful server shutdown.
    assert((await resource.text()).length > 0);
  }
}
