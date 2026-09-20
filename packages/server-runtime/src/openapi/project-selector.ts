/** Преобразование URL выполняется только в Swagger; сервер сохраняет явную область запроса. */
export function scopeSwaggerUrl(
  input: string,
  origin: string,
  mode: string,
  projectId: string | null,
): string {
  const url = new URL(input, origin);
  if (url.origin !== origin || !url.pathname.startsWith("/api/v1/") || mode !== "workspace")
    return input;
  if (
    url.pathname === "/api/v1/server" ||
    url.pathname === "/api/v1/health" ||
    url.pathname === "/api/v1/projects" ||
    url.pathname.startsWith("/api/v1/projects/")
  )
    return input;
  if (!projectId) throw new Error("Сначала выберите проект в панели Relay над Swagger.");
  url.pathname = `/api/v1/projects/${encodeURIComponent(projectId)}${url.pathname.slice("/api/v1".length)}`;
  return url.toString();
}

/** Самодостаточный callback: Swagger сериализует его для выполнения в браузере. */
export function swaggerProjectRequest(request: { url: string }): Promise<{ url: string }> {
  return (
    globalThis as unknown as {
      relaySwaggerScope: { intercept(request: { url: string }): Promise<{ url: string }> };
    }
  ).relaySwaggerScope.intercept(request);
}

/** Код панели не зависит от React, Node.js или выбранной записи проекта на сервере. */
export function swaggerProjectScript(): string {
  return `(() => {
  const scopeUrl = ${scopeSwaggerUrl.toString()};
  const state = { mode: null, projectId: null, projects: [], ready: null };
  const storageKey = "relay.swagger.project:" + location.origin;
  globalThis.relaySwaggerScope = {
    async intercept(request) {
      const path = new URL(request.url, location.origin).pathname;
      if (!path.startsWith("/api/v1/") || path === "/api/v1/server" || path === "/api/v1/health" || path === "/api/v1/projects" || path.startsWith("/api/v1/projects/")) return request;
      await state.ready;
      // Вне обычного клика оставляем серверу его штатный отказ PROJECT_REQUIRED.
      // Отклонённый Promise requestInterceptor некорректно отображается Swagger UI.
      if (state.mode === null || (state.mode === "workspace" && !state.projectId)) return request;
      request.url = scopeUrl(request.url, location.origin, state.mode, state.projectId);
      return request;
    }
  };
  const mount = () => {
    const panel = document.createElement("section");
    panel.id = "relay-swagger-project";
    panel.setAttribute("aria-label", "Проект Relay для запросов Swagger");
    const label = document.createElement("label");
    label.htmlFor = "relay-swagger-project-select";
    label.textContent = "Проект Relay";
    const select = document.createElement("select");
    select.id = label.htmlFor;
    select.disabled = true;
    const refresh = document.createElement("button");
    refresh.type = "button";
    refresh.textContent = "Обновить проекты";
    const hint = document.createElement("p");
    hint.setAttribute("role", "status");
    panel.append(label, select, refresh, hint);
    const root = document.getElementById("swagger-ui");
    if (root) root.before(panel); else document.body.prepend(panel);
    const showSelection = () => {
      hint.setAttribute("role", "status");
      const project = state.projects.find((entry) => entry.id === state.projectId);
      hint.textContent = state.mode === "local"
        ? "Локальный режим: запросы относятся к открытому проекту."
        : project
          ? "Workspace: " + project.name + ". Локальные операции ниже отправляются по /api/v1/projects/" + project.id + "/…; итоговый curl содержит проект."
          : "Workspace: выберите проект перед выполнением проектных операций. Серверные операции доступны без выбора.";
    };
    document.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return;
      const execute = event.target.closest("button.execute");
      const path = execute && execute.closest(".opblock")?.querySelector(".opblock-summary-path")?.getAttribute("data-path");
      if (!path || (state.mode !== null && (state.mode !== "workspace" || state.projectId))) return;
      try { scopeUrl(path, location.origin, "workspace", null); return; } catch {}
      event.preventDefault();
      event.stopImmediatePropagation();
      hint.setAttribute("role", "alert");
      hint.textContent = state.mode === null
        ? "Не удалось определить режим Relay. Нажмите «Обновить проекты»."
        : "Сначала выберите проект для этого запроса.";
      select.focus();
    }, true);
    select.addEventListener("change", () => {
      state.projectId = select.value || null;
      try {
        if (state.projectId) sessionStorage.setItem(storageKey, state.projectId);
        else sessionStorage.removeItem(storageKey);
      } catch {}
      showSelection();
    });
    const load = async () => {
      select.disabled = true;
      refresh.disabled = true;
      hint.textContent = "Загружаем режим и проекты Relay…";
      try {
        const response = await fetch("/api/v1/server", { cache: "no-store" });
        const body = await response.json();
        if (!response.ok || !body.ok || !body.data || !["local", "workspace"].includes(body.data.mode) || !Array.isArray(body.data.projects)) throw new Error("Неверный ответ сервера");
        state.mode = body.data.mode;
        state.projects = body.data.projects.filter((entry) => entry.available);
        let saved = state.projectId;
        try { saved = saved || sessionStorage.getItem(storageKey); } catch {}
        state.projectId = state.mode === "local" ? body.data.defaultProject : state.projects.some((entry) => entry.id === saved) ? saved : null;
        select.replaceChildren();
        const empty = document.createElement("option");
        empty.value = "";
        empty.textContent = "Выберите проект";
        select.append(empty);
        for (const project of state.projects) {
          const option = document.createElement("option");
          option.value = project.id;
          option.textContent = project.name === project.key ? project.name : project.name + " (" + project.key + ")";
          select.append(option);
        }
        select.value = state.projectId || "";
        select.disabled = state.mode !== "workspace" || state.projects.length === 0;
        showSelection();
      } catch {
        state.mode = null;
        state.projectId = null;
        hint.textContent = "Не удалось загрузить проекты. Проверьте сервер и нажмите «Обновить проекты».";
      } finally {
        refresh.disabled = false;
      }
    };
    refresh.addEventListener("click", () => { state.ready = load(); });
    state.ready = load();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
})();`;
}

export const swaggerProjectStyles = `
#relay-swagger-project { max-width: 1460px; margin: 20px auto; padding: 16px 20px; box-sizing: border-box; font: 16px system-ui, sans-serif; color: #202530; background: #f1f5fa; border: 1px solid #7d8798; border-radius: 6px; }
#relay-swagger-project label { font-weight: 650; margin-right: 12px; }
#relay-swagger-project select, #relay-swagger-project button { max-width: 100%; margin: 4px 12px 4px 0; padding: 8px; color: #202530; background: white; border: 1px solid #687588; border-radius: 4px; }
#relay-swagger-project p { margin: 8px 0 0; overflow-wrap: anywhere; }
`;
