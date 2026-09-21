const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const state = {
  workspace: null,
  openIds: [],
  activeId: null,
  view: "builder",
  responses: {},
  bodyMode: "pretty",
  sending: false,
  selectedEnvId: null,
  collapsed: new Set(),
  search: "",
};

let persistTimer = null;
let skipEditorSync = false;

function uid(prefix = "id") {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add("hidden"), 2400);
}

function kv(key = "", value = "", enabled = true) {
  return { key, value, enabled };
}

function emptyAuth() {
  return { token: "", username: "", password: "", api_key: "", api_value: "", api_in: "header" };
}

function emptyRequest(name = "New request") {
  return {
    id: uid("req"),
    type: "request",
    name,
    method: "GET",
    url: "{{baseUrl}}/",
    params: [kv()],
    headers: [kv("Accept", "application/json")],
    body_type: "none",
    body: "",
    auth_type: "none",
    auth: emptyAuth(),
    pre_request_script: "",
    test_script: "",
    description: "",
    mock_enabled: false,
    mock_status: 200,
    mock_delay_ms: 0,
    mock_body: "",
    mock_headers: [kv("Content-Type", "application/json")],
  };
}

function walk(nodes, visit) {
  for (const node of nodes || []) {
    visit(node);
    if (node.type === "folder") walk(node.children, visit);
  }
}

function findNode(nodes, id) {
  for (const node of nodes || []) {
    if (node.id === id) return node;
    if (node.type === "folder") {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

function locate(id) {
  for (const collection of state.workspace.collections) {
    if (collection.id === id) return { collection, node: collection, parent: null };
    const found = findNode(collection.children, id);
    if (found) return { collection, node: found, parent: collection };
  }
  return null;
}

function removeNode(nodes, id) {
  const index = (nodes || []).findIndex((n) => n.id === id);
  if (index >= 0) {
    nodes.splice(index, 1);
    return true;
  }
  for (const node of nodes || []) {
    if (node.type === "folder" && removeNode(node.children || [], id)) return true;
  }
  return false;
}

function findParentInfo(nodes, id, parentNode) {
  for (let index = 0; index < (nodes || []).length; index += 1) {
    const node = nodes[index];
    if (node.id === id) return { array: nodes, index, parentNode };
    if (node.type === "folder") {
      const found = findParentInfo(node.children, id, node);
      if (found) return found;
    }
  }
  return null;
}

// Unlike locate(), which only reports the top-level collection, this reports
// the node's immediate container (a folder or the collection root) — needed
// to reorder/move it in place.
function locateParentInfo(id) {
  for (const collection of state.workspace.collections) {
    if (collection.id === id) return null;
    const found = findParentInfo(collection.children, id, collection);
    if (found) return found;
  }
  return null;
}

function isAncestor(folderNode, targetId) {
  if (folderNode.type !== "folder") return false;
  let found = false;
  walk(folderNode.children, (child) => {
    if (child.id === targetId) found = true;
  });
  return found;
}

function currentRequest() {
  if (!state.activeId || !state.workspace) return null;
  const loc = locate(state.activeId);
  return loc && loc.node.type === "request" ? loc.node : null;
}

function activeEnv() {
  const id = state.workspace.active_environment_id;
  return (state.workspace.environments || []).find((e) => e.id === id) || null;
}

function envMap() {
  const map = {};
  const env = activeEnv();
  for (const row of env?.variables || []) {
    if (row.enabled && row.key) map[row.key] = row.value ?? "";
  }
  return map;
}

function interpolate(text, vars) {
  if (text == null) return "";
  const builtins = {
    origin: location.origin,
    $timestamp: String(Date.now()),
    $isoTimestamp: new Date().toISOString(),
    $guid: crypto.randomUUID(),
    $randomInt: String(Math.floor(Math.random() * 1000)),
  };
  return String(text).replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(builtins, key)) return builtins[key];
    if (Object.prototype.hasOwnProperty.call(vars, key)) return vars[key];
    return match;
  });
}

function persist(immediate = false) {
  const save = () => apiSaveWorkspace(state.workspace).catch((err) => toast(err.message));
  if (immediate) return save();
  clearTimeout(persistTimer);
  persistTimer = setTimeout(save, 400);
  const btn = document.getElementById("btn-save");
  if (btn) {
    btn.textContent = "Saved";
  }
}

function applyEnvUpdates(updates) {
  const env = activeEnv();
  if (!env) return;
  for (const [key, value] of Object.entries(updates)) {
    let row = env.variables.find((item) => item.key === key);
    if (!row) {
      env.variables.push(kv(key, String(value)));
    } else {
      row.value = String(value);
    }
  }
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function jsonPrimitiveHtml(value) {
  if (typeof value === "string") return `<span class="j-str">${escapeHtml(JSON.stringify(value))}</span>`;
  if (typeof value === "number") return `<span class="j-num">${escapeHtml(String(value))}</span>`;
  if (typeof value === "boolean") return `<span class="j-bool">${value}</span>`;
  return `<span class="j-null">null</span>`;
}

function jsonKeyHtml(key) {
  return `<span class="j-key">${escapeHtml(JSON.stringify(String(key)))}</span><span class="j-punc">: </span>`;
}

// Renders one value as a line (leaf) or a collapsible node (object/array),
// recursing into children. Each node keeps its own open/close bracket lines
// so collapsing it can hide everything between them and show an inline
// summary instead.
function jsonNodeHtml(value, keyHtml, trailingComma) {
  const comma = trailingComma ? `<span class="j-punc">,</span>` : "";
  if (value !== null && typeof value === "object") {
    const isArray = Array.isArray(value);
    const entries = isArray ? value.map((v, i) => [i, v]) : Object.entries(value);
    const open = isArray ? "[" : "{";
    const close = isArray ? "]" : "}";
    if (!entries.length) {
      return `<div class="j-line"><span class="j-gutter"></span><span class="j-content">${keyHtml}<span class="j-punc">${open}${close}</span>${comma}</span></div>`;
    }
    const count = entries.length;
    const noun = isArray ? "item" : "key";
    const childrenHtml = entries
      .map(([k, v], idx) => jsonNodeHtml(v, isArray ? "" : jsonKeyHtml(k), idx < count - 1))
      .join("");
    return `<div class="j-node">
      <div class="j-line j-toggle-line" data-j-toggle>
        <span class="j-gutter"><span class="j-caret">▾</span></span>
        <span class="j-content">${keyHtml}<span class="j-punc">${open}</span><span class="j-collapsed-summary"> ${count} ${noun}${count === 1 ? "" : "s"} ${close}${comma}</span></span>
      </div>
      <div class="j-children">${childrenHtml}</div>
      <div class="j-line j-close"><span class="j-gutter"></span><span class="j-content"><span class="j-punc">${close}</span>${comma}</span></div>
    </div>`;
  }
  return `<div class="j-line"><span class="j-gutter"></span><span class="j-content">${keyHtml}${jsonPrimitiveHtml(value)}${comma}</span></div>`;
}

function jsonTreeHtml(text) {
  const value = JSON.parse(text);
  return `<div class="j-tree">${jsonNodeHtml(value, "", false)}</div>`;
}

function matchesSearch(node) {
  const q = state.search.trim().toLowerCase();
  if (!q) return true;
  let hit = `${node.name || ""} ${node.url || ""} ${node.method || ""}`.toLowerCase().includes(q);
  if (node.type === "folder") {
    walk(node.children, (child) => {
      if (`${child.name || ""} ${child.url || ""}`.toLowerCase().includes(q)) hit = true;
    });
  }
  return hit;
}

function renderTree() {
  const root = document.getElementById("tree");
  const html = (state.workspace.collections || [])
    .filter((col) => {
      if (!state.search.trim()) return true;
      return col.name.toLowerCase().includes(state.search.toLowerCase()) || treeHasMatch(col.children);
    })
    .map(renderCollection)
    .join("");
  root.innerHTML = html || `<p class="muted pad">No collections yet.</p>`;
}

function treeHasMatch(nodes) {
  for (const node of nodes || []) {
    if (matchesSearch(node)) return true;
  }
  return false;
}

function renderCollection(col) {
  const open = !state.collapsed.has(col.id);
  return `<div class="tree-col" data-id="${col.id}">
    <div class="tree-col-h" data-act="toggle" data-id="${col.id}" data-drop="collection" data-drop-id="${col.id}">
      <span class="caret">${open ? "▼" : "▶"}</span>
      <span class="tree-name">${escapeHtml(col.name)}</span>
      <button class="icon-btn" data-act="menu" data-kind="collection" data-id="${col.id}" title="More">⋯</button>
    </div>
    ${open ? `<div class="tree-children">${renderNodes(col.children)}</div>` : ""}
  </div>`;
}

function renderNodes(nodes) {
  return (nodes || [])
    .filter(matchesSearch)
    .map((node) => {
      if (node.type === "folder") {
        const open = !state.collapsed.has(node.id);
        return `<div data-id="${node.id}">
          <div class="tree-folder-h" data-act="toggle" data-id="${node.id}" draggable="true" data-drag-id="${node.id}" data-drop="folder" data-drop-id="${node.id}">
            <span class="caret">${open ? "▼" : "▶"}</span>
            <span class="tree-name">${escapeHtml(node.name)}</span>
            <button class="icon-btn" data-act="menu" data-kind="folder" data-id="${node.id}">⋯</button>
          </div>
          ${open ? `<div class="tree-children">${renderNodes(node.children)}</div>` : ""}
        </div>`;
      }
      const active = node.id === state.activeId ? " active" : "";
      return `<div class="tree-item${active}" data-act="open" data-id="${node.id}" draggable="true" data-drag-id="${node.id}" data-drop="request" data-drop-id="${node.id}">
        <span class="method ${escapeHtml(node.method)}">${escapeHtml(node.method)}</span>
        <span class="tree-name">${escapeHtml(node.name)}</span>
        <button class="icon-btn" data-act="menu" data-kind="request" data-id="${node.id}">⋯</button>
      </div>`;
    })
    .join("");
}

let dragNodeId = null;

function clearDropIndicators() {
  document.querySelectorAll(".drop-before, .drop-after, .drop-into").forEach((el) => {
    el.classList.remove("drop-before", "drop-after", "drop-into");
  });
}

function dropPlacement(e, target) {
  const dropKind = target.dataset.drop;
  const dropId = target.dataset.dropId;
  if (dropKind === "collection") return { dropKind, dropId, placement: "into" };
  const rect = target.getBoundingClientRect();
  const offset = e.clientY - rect.top;
  if (dropKind === "folder") {
    if (offset < rect.height * 0.25) return { dropKind, dropId, placement: "before" };
    if (offset > rect.height * 0.75) return { dropKind, dropId, placement: "after" };
    return { dropKind, dropId, placement: "into" };
  }
  return { dropKind, dropId, placement: offset < rect.height / 2 ? "before" : "after" };
}

function moveNodeByDrop(dragId, dropId, placement) {
  const dragInfo = locateParentInfo(dragId);
  if (!dragInfo || dropId === dragId) return;
  const draggedNode = dragInfo.array[dragInfo.index];

  if (draggedNode.type === "folder" && isAncestor(draggedNode, dropId)) {
    toast("Can't move a folder into itself");
    return;
  }

  let destArray;
  let destIndex;
  if (placement === "into") {
    const container = locate(dropId)?.node;
    if (!container) return;
    container.children = container.children || [];
    destArray = container.children;
    destIndex = destArray.length;
  } else {
    const targetInfo = locateParentInfo(dropId);
    if (!targetInfo) return;
    destArray = targetInfo.array;
    destIndex = placement === "before" ? targetInfo.index : targetInfo.index + 1;
  }

  dragInfo.array.splice(dragInfo.index, 1);
  if (destArray === dragInfo.array && dragInfo.index < destIndex) destIndex -= 1;
  destArray.splice(Math.max(0, Math.min(destIndex, destArray.length)), 0, draggedNode);

  persist();
  renderTree();
  renderTabs();
}

function bindTreeDragDrop() {
  const tree = document.getElementById("tree");

  tree.addEventListener("dragstart", (e) => {
    const handle = e.target.closest("[data-drag-id]");
    if (!handle) return;
    dragNodeId = handle.dataset.dragId;
    handle.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", dragNodeId);
  });

  tree.addEventListener("dragover", (e) => {
    if (!dragNodeId) return;
    const target = e.target.closest("[data-drop]");
    if (!target || target.dataset.dropId === dragNodeId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    clearDropIndicators();
    const { placement } = dropPlacement(e, target);
    target.classList.add(`drop-${placement}`);
  });

  tree.addEventListener("dragleave", (e) => {
    const target = e.target.closest("[data-drop]");
    if (target && !target.contains(e.relatedTarget)) {
      target.classList.remove("drop-before", "drop-after", "drop-into");
    }
  });

  tree.addEventListener("drop", (e) => {
    if (!dragNodeId) return;
    const target = e.target.closest("[data-drop]");
    clearDropIndicators();
    const draggedId = dragNodeId;
    dragNodeId = null;
    if (!target || target.dataset.dropId === draggedId) return;
    e.preventDefault();
    const { dropId, placement } = dropPlacement(e, target);
    moveNodeByDrop(draggedId, dropId, placement);
  });

  tree.addEventListener("dragend", () => {
    clearDropIndicators();
    document.querySelectorAll(".dragging").forEach((el) => el.classList.remove("dragging"));
    dragNodeId = null;
  });
}

function renderTabs() {
  const el = document.getElementById("tabs");
  el.innerHTML = state.openIds
    .map((id) => {
      const loc = locate(id);
      if (!loc) return "";
      const req = loc.node;
      const active = id === state.activeId ? " active" : "";
      return `<div class="tab${active}" data-act="tab" data-id="${id}">
        <span class="method ${req.method}">${req.method}</span>
        <span>${escapeHtml(req.name)}</span>
        <button class="x" data-act="close-tab" data-id="${id}">×</button>
      </div>`;
    })
    .join("");
}

function renderEnvSelect() {
  const sel = document.getElementById("env-select");
  const current = state.workspace.active_environment_id;
  sel.innerHTML = (state.workspace.environments || [])
    .map(
      (env) =>
        `<option value="${env.id}" ${env.id === current ? "selected" : ""}>${escapeHtml(env.name)}</option>`
    )
    .join("");
}

function openRequest(id) {
  if (!state.openIds.includes(id)) state.openIds.push(id);
  state.activeId = id;
  renderTree();
  renderTabs();
  loadEditor();
  renderResponse();
}

function closeTab(id) {
  state.openIds = state.openIds.filter((item) => item !== id);
  if (state.activeId === id) state.activeId = state.openIds[state.openIds.length - 1] || null;
  renderTabs();
  loadEditor();
  renderResponse();
}

function renderKv(tbodyId, rows, kind) {
  const tbody = document.getElementById(tbodyId);
  const list = rows && rows.length ? rows : [kv()];
  tbody.innerHTML = list
    .map(
      (row, index) => `<tr>
        <td><input type="checkbox" data-kv="${kind}" data-i="${index}" data-f="enabled" ${row.enabled ? "checked" : ""} /></td>
        <td><input type="text" data-kv="${kind}" data-i="${index}" data-f="key" value="${escapeHtml(row.key || "")}" /></td>
        <td><input type="text" data-kv="${kind}" data-i="${index}" data-f="value" value="${escapeHtml(row.value || "")}" /></td>
        <td><button type="button" class="del-row" data-del-kv="${kind}" data-i="${index}">×</button></td>
      </tr>`
    )
    .join("");
}

function ensureKvTail(rows) {
  if (!rows.length || rows[rows.length - 1].key || rows[rows.length - 1].value) {
    rows.push(kv());
    return true;
  }
  return false;
}

function showAuthBoxes(type) {
  for (const id of ["auth-none", "auth-bearer", "auth-basic", "auth-apikey"]) {
    document.getElementById(id).classList.toggle("hidden", id !== `auth-${type}`);
  }
}

function loadEditor() {
  const req = currentRequest();
  const empty = document.getElementById("builder-empty");
  const body = document.getElementById("builder-body");
  if (!req) {
    empty.classList.remove("hidden");
    body.classList.add("hidden");
    return;
  }
  empty.classList.add("hidden");
  body.classList.remove("hidden");
  skipEditorSync = true;
  document.getElementById("req-name").value = req.name || "";
  document.getElementById("req-method").value = req.method || "GET";
  document.getElementById("req-url").value = req.url || "";
  document.getElementById("body-type").value = req.body_type || "none";
  document.getElementById("req-body").value = req.body || "";
  document.getElementById("auth-type").value = req.auth_type || "none";
  const auth = { ...emptyAuth(), ...(req.auth || {}) };
  req.auth = auth;
  document.getElementById("auth-token").value = auth.token || "";
  document.getElementById("auth-user").value = auth.username || "";
  document.getElementById("auth-pass").value = auth.password || "";
  document.getElementById("auth-key").value = auth.api_key || "";
  document.getElementById("auth-value").value = auth.api_value || "";
  document.getElementById("auth-in").value = auth.api_in || "header";
  document.getElementById("pre-script").value = req.pre_request_script || "";
  document.getElementById("test-script").value = req.test_script || "";
  document.getElementById("mock-enabled").checked = Boolean(req.mock_enabled);
  document.getElementById("mock-status").value = req.mock_status ?? 200;
  document.getElementById("mock-delay").value = req.mock_delay_ms ?? 0;
  document.getElementById("mock-body").value = req.mock_body || "";
  document.getElementById("req-desc").value = req.description || "";
  if (!req.params) req.params = [kv()];
  if (!req.headers) req.headers = [kv()];
  ensureKvTail(req.params);
  ensureKvTail(req.headers);
  renderKv("params-body", req.params, "params");
  renderKv("headers-body", req.headers, "headers");
  showAuthBoxes(req.auth_type || "none");
  skipEditorSync = false;
}

function readEditor() {
  if (skipEditorSync) return;
  const req = currentRequest();
  if (!req) return;
  const prevName = req.name;
  const prevMethod = req.method;
  req.name = document.getElementById("req-name").value;
  req.method = document.getElementById("req-method").value;
  req.url = document.getElementById("req-url").value;
  req.body_type = document.getElementById("body-type").value;
  req.body = document.getElementById("req-body").value;
  req.auth_type = document.getElementById("auth-type").value;
  req.auth.token = document.getElementById("auth-token").value;
  req.auth.username = document.getElementById("auth-user").value;
  req.auth.password = document.getElementById("auth-pass").value;
  req.auth.api_key = document.getElementById("auth-key").value;
  req.auth.api_value = document.getElementById("auth-value").value;
  req.auth.api_in = document.getElementById("auth-in").value;
  req.pre_request_script = document.getElementById("pre-script").value;
  req.test_script = document.getElementById("test-script").value;
  req.mock_enabled = document.getElementById("mock-enabled").checked;
  req.mock_status = Number(document.getElementById("mock-status").value || 200);
  req.mock_delay_ms = Number(document.getElementById("mock-delay").value || 0);
  req.mock_body = document.getElementById("mock-body").value;
  req.description = document.getElementById("req-desc").value;
  persist();
  if (req.name !== prevName || req.method !== prevMethod) {
    renderTabs();
    renderTree();
  }
}

function statusClass(code) {
  if (!code) return "s-0";
  return `s-${String(code)[0]}`;
}

function renderResponse(requestId = state.activeId) {
  const data = state.responses[requestId];
  const meta = document.getElementById("resp-meta");
  const bodyEl = document.getElementById("resp-body");
  const headersEl = document.getElementById("resp-headers");
  const testsEl = document.getElementById("resp-tests");
  if (!data) {
    meta.innerHTML = `<span class="muted">Send a request to see the result</span>`;
    bodyEl.innerHTML = `<div class="muted pad">No response yet.</div>`;
    headersEl.innerHTML = "";
    testsEl.innerHTML = "";
    return;
  }
  if (data.error && !data.status) {
    meta.innerHTML = `<span class="badge s-0">ERR</span><span>${escapeHtml(data.error)}</span><span>${data.time_ms || 0} ms</span>`;
    bodyEl.innerHTML = `<pre>${escapeHtml(data.error)}</pre>`;
    headersEl.innerHTML = "";
    testsEl.innerHTML = renderTests(data.tests);
    return;
  }
  const size = data.size >= 1024 ? `${(data.size / 1024).toFixed(1)} KB` : `${data.size} B`;
  meta.innerHTML = `<span class="badge ${statusClass(data.status)}">${data.status} ${escapeHtml(data.reason || "")}</span>
    <span>${data.time_ms} ms</span><span>${size}</span>`;
  headersEl.innerHTML = (data.headers || [])
    .map(([k, v]) => `<div class="hdr-row"><span>${escapeHtml(k)}</span><span>${escapeHtml(v)}</span></div>`)
    .join("") || `<div class="muted pad">No headers</div>`;
  testsEl.innerHTML = renderTests(data.tests);
  renderBody(data);
}

function renderTests(tests) {
  if (!tests || !tests.length) return `<div class="muted pad">No tests ran. Add JavaScript in the Scripts tab.</div>`;
  const passed = tests.filter((t) => t.passed).length;
  return `<div class="pad">${passed}/${tests.length} passed</div>` + tests.map((t) =>
    `<div class="test-row ${t.passed ? "pass" : "fail"}">
      <strong>${t.passed ? "PASS" : "FAIL"}</strong>
      <span>${escapeHtml(t.name)}${t.error ? " — " + escapeHtml(t.error) : ""}</span>
    </div>`
  ).join("");
}

function renderBody(data) {
  const el = document.getElementById("resp-body");
  const text = data.body || "";
  if (state.bodyMode === "raw") {
    el.innerHTML = `<pre>${escapeHtml(text)}</pre>`;
    return;
  }
  if (state.bodyMode === "preview") {
    el.innerHTML = `<iframe class="preview" sandbox="allow-same-origin" srcdoc="${escapeHtml(text)}"></iframe>`;
    return;
  }
  try {
    el.innerHTML = jsonTreeHtml(text);
  } catch {
    el.innerHTML = `<pre>${escapeHtml(text)}</pre>`;
  }
}

function buildUrl(req, vars) {
  let url = interpolate(req.url, vars);
  const params = new URLSearchParams();
  for (const row of req.params || []) {
    if (row.enabled && row.key) params.append(interpolate(row.key, vars), interpolate(row.value || "", vars));
  }
  if (req.auth_type === "apikey" && req.auth.api_in === "query" && req.auth.api_key) {
    params.append(interpolate(req.auth.api_key, vars), interpolate(req.auth.api_value || "", vars));
  }
  const qs = params.toString();
  if (qs) url += (url.includes("?") ? "&" : "?") + qs;
  return url;
}

function encodePairs(text, vars) {
  const params = new URLSearchParams();
  const raw = text || "";
  const parts = raw.includes("\n") ? raw.split(/\r?\n/) : raw.split("&");
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const index = trimmed.indexOf("=");
    const key = interpolate(index >= 0 ? trimmed.slice(0, index) : trimmed, vars);
    const value = interpolate(index >= 0 ? trimmed.slice(index + 1) : "", vars);
    params.append(key, value);
  }
  return params.toString();
}

function encodeMultipart(text, vars) {
  const boundary = `----YosmanForm${Date.now().toString(16)}`;
  const parts = (text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  let body = "";
  for (const part of parts) {
    const index = part.indexOf("=");
    const key = interpolate(index >= 0 ? part.slice(0, index) : part, vars);
    const value = interpolate(index >= 0 ? part.slice(index + 1) : "", vars);
    body += `--${boundary}\r\nContent-Disposition: form-data; name="${key.replace(/"/g, '\\"')}"\r\n\r\n${value}\r\n`;
  }
  body += `--${boundary}--\r\n`;
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

function buildHeaders(req, vars) {
  const headers = {};
  for (const row of req.headers || []) {
    if (row.enabled && row.key) headers[interpolate(row.key, vars)] = interpolate(row.value || "", vars);
  }
  if (req.auth_type === "bearer" && req.auth.token) {
    headers.Authorization = `Bearer ${interpolate(req.auth.token, vars)}`;
  }
  if (req.auth_type === "basic") {
    const pair = `${interpolate(req.auth.username || "", vars)}:${interpolate(req.auth.password || "", vars)}`;
    headers.Authorization = `Basic ${btoa(pair)}`;
  }
  if (req.auth_type === "apikey" && req.auth.api_in === "header" && req.auth.api_key) {
    headers[interpolate(req.auth.api_key, vars)] = interpolate(req.auth.api_value || "", vars);
  }
  const contentTypeKey = Object.keys(headers).find((key) => key.toLowerCase() === "content-type");
  if (req.body_type === "json" && !contentTypeKey) {
    headers["Content-Type"] = "application/json";
  }
  if (req.body_type === "urlencoded") {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  }
  if (req.body_type === "formdata" && contentTypeKey) {
    delete headers[contentTypeKey];
  }
  return headers;
}

function buildBody(req, vars) {
  if (req.body_type === "none") return null;
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD") return null;
  if (req.body_type === "urlencoded") return encodePairs(req.body, vars);
  if (req.body_type === "formdata") return encodeMultipart(req.body, vars);
  return interpolate(req.body || "", vars);
}

async function executeRequest(req) {
  let vars = envMap();
  const pre = runUserScript(req.pre_request_script, {
    environment: vars,
    request: { method: req.method, url: req.url },
    response: {},
  });
  applyEnvUpdates(pre.env);
  vars = envMap();
  const settings = state.workspace.settings || {};
  const headers = buildHeaders(req, vars);
  let body = buildBody(req, vars);
  if (body && typeof body === "object" && body.contentType) {
    headers["Content-Type"] = body.contentType;
    body = body.body;
  }
  const payload = {
    method: req.method,
    url: buildUrl(req, vars),
    headers,
    body,
    timeout: settings.timeout || 30,
    follow_redirects: settings.follow_redirects !== false,
    verify: settings.verify_ssl !== false,
  };
  const result = await apiSend(payload);
  const tests = runUserScript(req.test_script, {
    environment: vars,
    request: payload,
    response: result,
  });
  applyEnvUpdates(tests.env);
  persist();
  const combined = { ...result, tests: tests.tests, logs: tests.logs, url: payload.url };
  state.workspace.history = [
    {
      id: uid("hist"),
      requestId: req.id,
      name: req.name,
      method: req.method,
      url: payload.url,
      status: result.status,
      time_ms: result.time_ms,
      at: new Date().toISOString(),
    },
    ...(state.workspace.history || []),
  ].slice(0, 80);
  return combined;
}

async function sendActive() {
  const req = currentRequest();
  if (!req || state.sending) return;
  readEditor();
  state.sending = true;
  const btn = document.getElementById("btn-send");
  btn.textContent = "Sending…";
  try {
    const result = await executeRequest(req);
    state.responses[req.id] = result;
    renderResponse(req.id);
    if (result.tests && result.tests.length) {
      document.querySelector('[data-rpanel="tests"]').click();
    }
  } catch (err) {
    state.responses[req.id] = { error: err.message, tests: [] };
    renderResponse(req.id);
  } finally {
    state.sending = false;
    btn.textContent = "Send";
  }
}

function setView(name) {
  state.view = name;
  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === name);
  });
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.id === `view-${name}`);
  });
  if (name === "runner") renderRunner();
  if (name === "docs") renderDocs();
  if (name === "mock") renderMock();
  if (name === "envs") renderEnvs();
}

function collectionOptions(selectId) {
  const sel = document.getElementById(selectId);
  sel.innerHTML = state.workspace.collections
    .map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
    .join("");
}

function flattenRequests(collection) {
  const list = [];
  walk(collection.children, (node) => {
    if (node.type === "request") list.push(node);
  });
  return list;
}

function renderRunner() {
  collectionOptions("runner-collection");
}

async function runSelectedCollection() {
  const id = document.getElementById("runner-collection").value;
  const collection = state.workspace.collections.find((c) => c.id === id);
  if (!collection) return;
  const requests = flattenRequests(collection);
  const box = document.getElementById("runner-results");
  const progress = document.getElementById("runner-progress");
  box.innerHTML = "";
  let passed = 0;
  let failed = 0;
  for (let i = 0; i < requests.length; i += 1) {
    const req = requests[i];
    progress.textContent = `Running ${i + 1}/${requests.length}: ${req.name}`;
    let result;
    try {
      result = await executeRequest(req);
    } catch (err) {
      result = { error: err.message, tests: [], status: null, time_ms: 0 };
    }
    state.responses[req.id] = result;
    const testFail = (result.tests || []).some((t) => !t.passed);
    const ok = result.status && result.status < 400 && !testFail && !result.error;
    if (ok) passed += 1;
    else failed += 1;
    box.innerHTML += `<article class="run-card">
      <div class="run-head">
        <div><span class="method ${req.method}">${req.method}</span> <strong>${escapeHtml(req.name)}</strong></div>
        <div class="resp-meta">
          <span class="badge ${statusClass(result.status)}">${result.status || "ERR"}</span>
          <span>${result.time_ms || 0} ms</span>
          <span>${ok ? "passed" : "failed"}</span>
        </div>
      </div>
      <div class="muted">${escapeHtml(result.url || req.url)}</div>
      ${renderTests(result.tests)}
    </article>`;
  }
  progress.textContent = `Finished — ${passed} passed, ${failed} failed`;
}

function renderDocs() {
  collectionOptions("docs-collection");
  const id = document.getElementById("docs-collection").value;
  const collection = state.workspace.collections.find((c) => c.id === id);
  const out = document.getElementById("docs-output");
  if (!collection) {
    out.innerHTML = "";
    return;
  }
  const env = activeEnv();
  let html = `<h1>${escapeHtml(collection.name)}</h1>
    <p>${escapeHtml(collection.description || "")}</p>
    <p class="muted">Active environment: ${escapeHtml(env?.name || "none")}</p>`;
  walk(collection.children, (node) => {
    if (node.type === "folder") {
      html += `<h2>${escapeHtml(node.name)}</h2>`;
      return;
    }
    if (node.type !== "request") return;
    html += `<article class="docs-endpoint">
      <div><span class="method ${node.method}">${node.method}</span> <strong>${escapeHtml(node.name)}</strong></div>
      <code class="url">${escapeHtml(node.url)}</code>
      <p>${escapeHtml(node.description || "No description.")}</p>
      ${node.auth_type && node.auth_type !== "none" ? `<p>Auth: ${escapeHtml(node.auth_type)}</p>` : ""}
      ${node.body_type !== "none" && node.body ? `<pre>${escapeHtml(node.body)}</pre>` : ""}
      ${node.test_script ? `<p class="muted">Includes automated tests.</p>` : ""}
      <button type="button" class="btn small try-btn" data-try="${node.id}">Open in builder</button>
    </article>`;
  });
  out.innerHTML = html;
}

function renderMock() {
  const board = document.getElementById("mock-board");
  board.innerHTML = state.workspace.collections
    .map((col) => {
      const routes = [];
      walk(col.children, (node) => {
        if (node.type === "request" && node.mock_enabled) routes.push(node);
      });
      const base = `${location.origin}/mock/${col.id}`;
      return `<article class="mock-card">
        <h3>${escapeHtml(col.name)}</h3>
        <p>Base URL <code>${escapeHtml(base)}</code>
          <button type="button" class="btn small ghost" data-copy="${escapeHtml(base)}">Copy</button></p>
        ${
          routes.length
            ? routes
                .map((r) => {
                  const path = mockPathHint(r.url, col.id);
                  return `<div class="hdr-row">
                    <span class="method ${r.method}">${r.method}</span>
                    <span><code>${escapeHtml(base + path)}</code> → ${r.mock_status}
                      <button class="btn small ghost" data-try="${r.id}">Try</button></span>
                  </div>`;
                })
                .join("")
            : `<p class="muted">No mocked requests. Enable Mock on a request in the builder.</p>`
        }
      </article>`;
    })
    .join("");
}

function mockPathHint(url, collectionId) {
  const interpolated = interpolate(url, envMap());
  try {
    const parsed = new URL(interpolated, location.origin);
    const prefix = `/mock/${collectionId}`;
    let path = parsed.pathname;
    if (path.startsWith(prefix)) path = path.slice(prefix.length) || "/";
    return path.startsWith("/") ? path : `/${path}`;
  } catch {
    return "/";
  }
}

function renderEnvs() {
  const list = document.getElementById("env-list");
  const selected = state.selectedEnvId || state.workspace.active_environment_id;
  state.selectedEnvId = selected;
  list.innerHTML = (state.workspace.environments || [])
    .map(
      (env) =>
        `<li class="${env.id === selected ? "active" : ""}" data-env="${env.id}">${escapeHtml(env.name)}${
          env.id === state.workspace.active_environment_id ? " · active" : ""
        }</li>`
    )
    .join("");
  const env = state.workspace.environments.find((e) => e.id === selected);
  if (!env) return;
  document.getElementById("env-name").value = env.name;
  if (!env.variables.length) env.variables.push(kv());
  const last = env.variables[env.variables.length - 1];
  if (last.key || last.value) env.variables.push(kv());
  renderKv("env-vars", env.variables, "env");
}

function currentEnv() {
  return state.workspace.environments.find((e) => e.id === state.selectedEnvId);
}

function renderHistory() {
  const list = document.getElementById("history-list");
  const items = state.workspace.history || [];
  list.innerHTML = items.length
    ? items
        .map(
          (h) => `<div class="hist-item" data-hist="${h.requestId}">
            <div><span class="method ${h.method}">${h.method}</span> ${escapeHtml(h.name)}
              <span class="badge ${statusClass(h.status)}">${h.status || "ERR"}</span></div>
            <div class="hist-url">${escapeHtml(h.url)}</div>
          </div>`
        )
        .join("")
    : `<p class="muted pad">No requests sent yet.</p>`;
}

function hideMenu() {
  document.getElementById("ctx-menu").classList.add("hidden");
}

function showMenu(x, y, kind, id) {
  const menu = document.getElementById("ctx-menu");
  const items = [];
  if (kind === "collection") {
    items.push(["New request", "new-req"], ["New folder", "new-folder"], ["Import cURL", "import-curl"], ["Rename", "rename"], ["Export", "export"], ["Delete", "delete"]);
  } else if (kind === "folder") {
    items.push(["New request", "new-req"], ["Import cURL", "import-curl"], ["Rename", "rename"], ["Delete", "delete"]);
  } else {
    items.push(["Duplicate", "dup"], ["Save as…", "save-as"], ["Copy as cURL", "copy-curl"], ["Rename", "rename"], ["Delete", "delete"]);
  }
  menu.innerHTML = items
    .map(([label, act]) => `<button data-ctx="${act}" data-kind="${kind}" data-id="${id}">${label}</button>`)
    .join("");
  menu.style.left = `${Math.min(x, window.innerWidth - 200)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - 180)}px`;
  menu.classList.remove("hidden");
}

function addRequestTo(targetId, kind) {
  const req = emptyRequest();
  if (kind === "collection") {
    const col = state.workspace.collections.find((c) => c.id === targetId);
    col.children.push(req);
  } else {
    const loc = locate(targetId);
    if (loc.node.type === "folder") {
      loc.node.children = loc.node.children || [];
      loc.node.children.push(req);
    }
  }
  persist();
  openRequest(req.id);
}

function handleContext(act, kind, id) {
  if (act === "new-req") addRequestTo(id, kind);
  if (act === "import-curl") openCurlModal("", { id, kind });
  if (act === "new-folder") {
    const name = prompt("Folder name", "Folder");
    if (!name) return;
    const folder = { id: uid("fld"), type: "folder", name, children: [] };
    const col = state.workspace.collections.find((c) => c.id === id);
    col.children.push(folder);
    persist();
    renderTree();
  }
  if (act === "rename") {
    const loc = kind === "collection"
      ? { node: state.workspace.collections.find((c) => c.id === id) }
      : locate(id);
    const name = prompt("Name", loc.node.name);
    if (!name) return;
    loc.node.name = name;
    persist();
    renderTree();
    renderTabs();
    if (currentRequest()?.id === id) loadEditor();
  }
  if (act === "dup") {
    const loc = locate(id);
    const copy = JSON.parse(JSON.stringify(loc.node));
    copy.id = uid("req");
    copy.name = `${copy.name} copy`;
    loc.collection.children.push(copy);
    persist();
    openRequest(copy.id);
  }
  if (act === "export") {
    const col = state.workspace.collections.find((c) => c.id === id);
    download(`${col.name}.yosman.json`, JSON.stringify(col, null, 2));
  }
  if (act === "save-as") {
    const loc = locate(id);
    if (loc && loc.node.type === "request") openSaveAsModal(loc.node);
  }
  if (act === "copy-curl") {
    const loc = locate(id);
    if (loc && loc.node.type === "request") copyRequestAsCurl(loc.node);
  }
  if (act === "delete") {
    if (!confirm("Delete this item?")) return;
    if (kind === "collection") {
      state.workspace.collections = state.workspace.collections.filter((c) => c.id !== id);
    } else {
      for (const col of state.workspace.collections) removeNode(col.children, id);
    }
    state.openIds = state.openIds.filter((item) => item !== id);
    if (state.activeId === id) state.activeId = state.openIds[0] || null;
    persist();
    renderTree();
    renderTabs();
    loadEditor();
  }
}

function download(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function applyImportedFile(data, filename = "") {
  if (isPostmanCollection(data)) {
    const imported = importPostmanCollection(data);
    const taken = state.workspace.collections.map((col) => col.name);
    imported.collection.name = uniqueImportedName(imported.collection.name, taken);
    state.workspace.collections.push(imported.collection);
    if (imported.environment) {
      const envNames = state.workspace.environments.map((env) => env.name);
      imported.environment.name = uniqueImportedName(imported.environment.name, envNames);
      state.workspace.environments.push(imported.environment);
      state.workspace.active_environment_id = imported.environment.id;
      state.selectedEnvId = imported.environment.id;
    }
    const first = [];
    walk(imported.collection.children, (node) => {
      if (node.type === "request" && !first.length) first.push(node.id);
    });
    if (first[0]) openRequest(first[0]);
    toast(`Imported Postman collection: ${imported.collection.name} (${imported.requestCount} requests)`);
    return;
  }
  if (isPostmanEnvironment(data)) {
    const env = importPostmanEnvironment(data);
    env.name = uniqueImportedName(
      env.name,
      state.workspace.environments.map((item) => item.name)
    );
    state.workspace.environments.push(env);
    state.workspace.active_environment_id = env.id;
    state.selectedEnvId = env.id;
    toast(`Imported Postman environment: ${env.name}`);
    return;
  }
  if (data.collections) {
    state.workspace = data;
    toast("Imported Yosman workspace");
    return;
  }
  if (data.children && data.name) {
    data.id = uid("col");
    state.workspace.collections.push(data);
    toast(`Imported collection: ${data.name}`);
    return;
  }
  throw new Error(
    filename
      ? `Unrecognized file: ${filename}. Export a Postman Collection v2.1 JSON.`
      : "Unrecognized file. Export a Postman Collection v2.1 JSON."
  );
}

function curlTargets() {
  const targets = [];
  for (const collection of state.workspace.collections) {
    targets.push({ id: collection.id, kind: "collection", label: collection.name });
    walk(collection.children, (node) => {
      if (node.type === "folder") {
        targets.push({ id: node.id, kind: "folder", label: `${collection.name} / ${node.name}` });
      }
    });
  }
  return targets;
}

function populateTargetSelect(select, selectedValue) {
  const targets = curlTargets();
  select.innerHTML = targets
    .map(
      (item) =>
        `<option value="${item.kind}:${item.id}" ${`${item.kind}:${item.id}` === selectedValue ? "selected" : ""}>${escapeHtml(item.label)}</option>`
    )
    .join("");
  return targets;
}

function openCurlModal(command = "", target = null) {
  if (!curlTargets().length) {
    state.workspace.collections.push({
      id: uid("col"),
      name: "Imported cURL",
      description: "",
      children: [],
    });
    persist();
    renderTree();
  }
  const nextTargets = curlTargets();
  const loc = state.activeId ? locate(state.activeId) : null;
  const selected = target
    ? `${target.kind}:${target.id}`
    : loc
      ? `collection:${loc.collection.id}`
      : `${nextTargets[0].kind}:${nextTargets[0].id}`;
  populateTargetSelect(document.getElementById("curl-target"), selected);
  document.getElementById("curl-input").value = command || "";
  document.getElementById("curl-modal").classList.remove("hidden");
  document.getElementById("curl-input").focus();
}

function closeCurlModal() {
  document.getElementById("curl-modal").classList.add("hidden");
}

function insertRequestNode(req, targetValue) {
  const [kind, id] = String(targetValue || "").split(":");
  if (kind === "folder") {
    const loc = locate(id);
    if (!loc || loc.node.type !== "folder") throw new Error("Folder not found");
    loc.node.children = loc.node.children || [];
    loc.node.children.push(req);
  } else {
    const collection =
      state.workspace.collections.find((col) => col.id === id) || state.workspace.collections[0];
    if (!collection) throw new Error("No collection to import into");
    collection.children.push(req);
  }
  persist();
  renderTree();
  setView("builder");
  openRequest(req.id);
}

function importCurlCommand() {
  const command = document.getElementById("curl-input").value;
  const req = parseCurl(command);
  insertRequestNode(req, document.getElementById("curl-target").value);
  closeCurlModal();
  toast(`Imported cURL: ${req.method} ${req.name}`);
}

async function copyRequestAsCurl(req) {
  if (!req) return;
  const command = requestToCurl(req, envMap());
  try {
    await navigator.clipboard.writeText(command);
    toast("Copied as cURL");
  } catch {
    toast("Couldn't copy — clipboard unavailable");
  }
}

let saveAsSourceId = null;

function openSaveAsModal(node) {
  if (!curlTargets().length) {
    toast("Create a collection first");
    return;
  }
  saveAsSourceId = node.id;
  const parentInfo = locateParentInfo(node.id);
  const defaultTarget = parentInfo
    ? `${parentInfo.parentNode.type === "folder" ? "folder" : "collection"}:${parentInfo.parentNode.id}`
    : null;
  const targets = populateTargetSelect(document.getElementById("saveas-target"), defaultTarget);
  if (!defaultTarget && targets[0]) {
    document.getElementById("saveas-target").value = `${targets[0].kind}:${targets[0].id}`;
  }
  const nameInput = document.getElementById("saveas-name");
  nameInput.value = `${node.name} copy`;
  document.getElementById("saveas-modal").classList.remove("hidden");
  nameInput.focus();
  nameInput.select();
}

function closeSaveAsModal() {
  document.getElementById("saveas-modal").classList.add("hidden");
  saveAsSourceId = null;
}

function confirmSaveAs() {
  const loc = saveAsSourceId ? locate(saveAsSourceId) : null;
  if (!loc || loc.node.type !== "request") {
    closeSaveAsModal();
    return;
  }
  const name = document.getElementById("saveas-name").value.trim();
  if (!name) {
    toast("Enter a name");
    return;
  }
  const targetValue = document.getElementById("saveas-target").value;
  const copy = JSON.parse(JSON.stringify(loc.node));
  copy.id = uid("req");
  copy.name = name;
  try {
    insertRequestNode(copy, targetValue);
    closeSaveAsModal();
    toast(`Saved as "${name}"`);
  } catch (err) {
    toast(err.message);
  }
}

function bind() {
  const methodSel = document.getElementById("req-method");
  methodSel.innerHTML = METHODS.map((m) => `<option>${m}</option>`).join("");

  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.addEventListener("click", () => setView(btn.dataset.view));
  });
  document.getElementById("env-select").addEventListener("change", (e) => {
    state.workspace.active_environment_id = e.target.value;
    persist();
  });
  document.getElementById("tree-search").addEventListener("input", (e) => {
    state.search = e.target.value;
    renderTree();
  });
  document.getElementById("tree").addEventListener("click", (e) => {
    const menuBtn = e.target.closest("[data-act='menu']");
    if (menuBtn) {
      e.preventDefault();
      e.stopPropagation();
      const rect = menuBtn.getBoundingClientRect();
      showMenu(rect.left, rect.bottom + 4, menuBtn.dataset.kind, menuBtn.dataset.id);
      return;
    }
    const target = e.target.closest("[data-act]");
    if (!target) return;
    const { act, id } = target.dataset;
    if (act === "toggle") {
      if (state.collapsed.has(id)) state.collapsed.delete(id);
      else state.collapsed.add(id);
      renderTree();
    }
    if (act === "open") openRequest(id);
  });
  bindTreeDragDrop();
  document.getElementById("tabs").addEventListener("click", (e) => {
    const close = e.target.closest("[data-act='close-tab']");
    if (close) {
      e.stopPropagation();
      closeTab(close.dataset.id);
      return;
    }
    const tab = e.target.closest("[data-act='tab']");
    if (tab) openRequest(tab.dataset.id);
  });
  document.getElementById("btn-send").addEventListener("click", sendActive);
  document.getElementById("btn-save").addEventListener("click", () => persist(true).then(() => toast("Workspace saved")));
  document.getElementById("btn-save-as").addEventListener("click", () => {
    const req = currentRequest();
    if (req) openSaveAsModal(req);
  });
  document.getElementById("btn-copy-curl").addEventListener("click", () => copyRequestAsCurl(currentRequest()));
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      sendActive();
    }
  });

  document.getElementById("req-subtabs").addEventListener("click", (e) => {
    const tab = e.target.closest(".subtab");
    if (!tab) return;
    document.querySelectorAll("#req-subtabs .subtab").forEach((t) => t.classList.toggle("active", t === tab));
    document.querySelectorAll(".req-editor .panel").forEach((p) => p.classList.toggle("active", p.id === `panel-${tab.dataset.panel}`));
  });
  document.getElementById("resp-subtabs").addEventListener("click", (e) => {
    const tab = e.target.closest(".subtab");
    if (!tab) return;
    document.querySelectorAll("#resp-subtabs .subtab").forEach((t) => t.classList.toggle("active", t === tab));
    document.getElementById("resp-body").classList.toggle("hidden", tab.dataset.rpanel !== "body");
    document.getElementById("resp-headers").classList.toggle("hidden", tab.dataset.rpanel !== "headers");
    document.getElementById("resp-tests").classList.toggle("hidden", tab.dataset.rpanel !== "tests");
    document.getElementById("resp-toolbar").classList.toggle("hidden", tab.dataset.rpanel !== "body");
  });
  document.getElementById("resp-toolbar").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-body-mode]");
    if (!chip) return;
    state.bodyMode = chip.dataset.bodyMode;
    document.querySelectorAll("#resp-toolbar .chip").forEach((c) => c.classList.toggle("active", c === chip));
    const data = state.responses[state.activeId];
    if (data) renderBody(data);
  });
  document.getElementById("resp-body").addEventListener("click", (e) => {
    const toggle = e.target.closest("[data-j-toggle]");
    if (!toggle) return;
    toggle.closest(".j-node")?.classList.toggle("collapsed");
  });

  const editorRoot = document.getElementById("builder-body");
  editorRoot.addEventListener("input", (e) => {
    if (e.target.dataset.kv) {
      const req = currentRequest();
      if (!req) return;
      const field = e.target.dataset.kv;
      const rows = field === "env" ? currentEnv().variables : req[field];
      const row = rows[Number(e.target.dataset.i)];
      const key = e.target.dataset.f;
      row[key] = key === "enabled" ? e.target.checked : e.target.value;
      const grew = field === "env" ? ensureKvTail(currentEnv().variables) : ensureKvTail(req[field]);
      persist();
      if (grew) {
        const i = e.target.dataset.i;
        const f = e.target.dataset.f;
        if (field === "env") renderKv("env-vars", currentEnv().variables, "env");
        else renderKv(`${field}-body`, req[field], field);
        document.querySelector(`[data-kv="${field}"][data-i="${i}"][data-f="${f}"]`)?.focus();
      }
      return;
    }
    readEditor();
    if (e.target.id === "auth-type") showAuthBoxes(e.target.value);
  });
  editorRoot.addEventListener("change", (e) => {
    if (e.target.dataset.kv && e.target.dataset.f === "enabled") {
      editorRoot.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (e.target.id === "auth-type") {
      readEditor();
      showAuthBoxes(e.target.value);
    }
    if (e.target.id === "body-type" || e.target.id === "req-method") readEditor();
  });
  editorRoot.addEventListener("click", (e) => {
    const del = e.target.closest("[data-del-kv]");
    if (!del) return;
    const kind = del.dataset.delKv;
    const index = Number(del.dataset.i);
    if (kind === "env") {
      currentEnv().variables.splice(index, 1);
      persist();
      renderEnvs();
      return;
    }
    const req = currentRequest();
    req[kind].splice(index, 1);
    ensureKvTail(req[kind]);
    persist();
    renderKv(`${kind}-body`, req[kind], kind);
  });

  document.getElementById("btn-pretty-json").addEventListener("click", () => {
    try {
      document.getElementById("req-body").value = JSON.stringify(
        JSON.parse(document.getElementById("req-body").value),
        null,
        2
      );
      readEditor();
    } catch {
      toast("Body is not valid JSON");
    }
  });

  document.getElementById("btn-new-collection").addEventListener("click", () => {
    const name = prompt("Collection name", "New collection");
    if (!name) return;
    const req = emptyRequest("Untitled");
    state.workspace.collections.push({
      id: uid("col"),
      name,
      description: "",
      children: [req],
    });
    persist();
    renderTree();
    openRequest(req.id);
  });
  document.getElementById("btn-export-ws").addEventListener("click", () => {
    download("yosman-workspace.json", JSON.stringify(state.workspace, null, 2));
  });
  document.getElementById("btn-import").addEventListener("click", () => {
    document.getElementById("import-file").click();
  });
  document.getElementById("btn-import-curl").addEventListener("click", () => openCurlModal());
  document.getElementById("btn-close-curl").addEventListener("click", closeCurlModal);
  document.getElementById("btn-cancel-curl").addEventListener("click", closeCurlModal);
  document.getElementById("btn-curl-import").addEventListener("click", () => {
    try {
      importCurlCommand();
    } catch (err) {
      toast(err.message);
    }
  });
  document.getElementById("curl-input").addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      try {
        importCurlCommand();
      } catch (err) {
        toast(err.message);
      }
    }
    if (e.key === "Escape") closeCurlModal();
  });
  document.getElementById("curl-modal").addEventListener("click", (e) => {
    if (e.target.id === "curl-modal") closeCurlModal();
  });
  document.getElementById("btn-close-saveas").addEventListener("click", closeSaveAsModal);
  document.getElementById("btn-cancel-saveas").addEventListener("click", closeSaveAsModal);
  document.getElementById("btn-saveas-confirm").addEventListener("click", confirmSaveAs);
  document.getElementById("saveas-name").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      confirmSaveAs();
    }
    if (e.key === "Escape") closeSaveAsModal();
  });
  document.getElementById("saveas-modal").addEventListener("click", (e) => {
    if (e.target.id === "saveas-modal") closeSaveAsModal();
  });
  document.getElementById("req-url").addEventListener("paste", (e) => {
    const text = e.clipboardData?.getData("text") || "";
    if (!looksLikeCurl(text)) return;
    e.preventDefault();
    const loc = state.activeId ? locate(state.activeId) : null;
    openCurlModal(text, loc ? { id: loc.collection.id, kind: "collection" } : null);
  });
  document.getElementById("import-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      applyImportedFile(data, file.name);
      persist(true);
      renderAll();
    } catch (err) {
      toast(err.message);
    }
    e.target.value = "";
  });

  document.getElementById("btn-run-col").addEventListener("click", runSelectedCollection);
  document.getElementById("docs-collection").addEventListener("change", renderDocs);
  document.getElementById("btn-print-docs").addEventListener("click", () => window.print());
  document.getElementById("docs-output").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-try]");
    if (!btn) return;
    setView("builder");
    openRequest(btn.dataset.try);
  });
  document.getElementById("mock-board").addEventListener("click", (e) => {
    const copy = e.target.closest("[data-copy]");
    if (copy) {
      navigator.clipboard.writeText(copy.dataset.copy);
      toast("Copied mock URL");
    }
    const tryBtn = e.target.closest("[data-try]");
    if (tryBtn) {
      setView("builder");
      openRequest(tryBtn.dataset.try);
    }
  });

  document.getElementById("btn-new-env").addEventListener("click", () => {
    const env = { id: uid("env"), name: "New environment", variables: [kv("baseUrl", "http://localhost:3000")] };
    state.workspace.environments.push(env);
    state.selectedEnvId = env.id;
    persist();
    renderEnvs();
    renderEnvSelect();
  });
  document.getElementById("env-list").addEventListener("click", (e) => {
    const li = e.target.closest("[data-env]");
    if (!li) return;
    state.selectedEnvId = li.dataset.env;
    renderEnvs();
  });
  document.getElementById("env-name").addEventListener("input", (e) => {
    const env = currentEnv();
    if (!env) return;
    env.name = e.target.value;
    persist();
    renderEnvSelect();
    const li = document.querySelector(`#env-list [data-env="${env.id}"]`);
    if (li) {
      li.textContent = `${env.name}${env.id === state.workspace.active_environment_id ? " · active" : ""}`;
    }
  });
  document.getElementById("env-vars").addEventListener("input", (e) => {
    if (!e.target.dataset.kv) return;
    const env = currentEnv();
    const row = env.variables[Number(e.target.dataset.i)];
    const key = e.target.dataset.f;
    row[key] = key === "enabled" ? e.target.checked : e.target.value;
    const grew = ensureKvTail(env.variables);
    persist();
    if (grew) renderKv("env-vars", env.variables, "env");
  });
  document.getElementById("env-vars").addEventListener("click", (e) => {
    const del = e.target.closest("[data-del-kv='env']");
    if (!del) return;
    currentEnv().variables.splice(Number(del.dataset.i), 1);
    persist();
    renderEnvs();
  });
  document.getElementById("btn-del-env").addEventListener("click", () => {
    if (state.workspace.environments.length < 2) {
      toast("Keep at least one environment");
      return;
    }
    if (!confirm("Delete this environment?")) return;
    const id = state.selectedEnvId;
    state.workspace.environments = state.workspace.environments.filter((e) => e.id !== id);
    if (state.workspace.active_environment_id === id) {
      state.workspace.active_environment_id = state.workspace.environments[0].id;
    }
    state.selectedEnvId = state.workspace.active_environment_id;
    persist();
    renderEnvs();
    renderEnvSelect();
  });

  document.getElementById("btn-history").addEventListener("click", () => {
    renderHistory();
    document.getElementById("history-drawer").classList.remove("hidden");
    document.getElementById("drawer-backdrop").classList.remove("hidden");
  });
  document.getElementById("btn-close-history").addEventListener("click", closeHistory);
  document.getElementById("drawer-backdrop").addEventListener("click", closeHistory);
  document.getElementById("history-list").addEventListener("click", (e) => {
    const item = e.target.closest("[data-hist]");
    if (!item) return;
    closeHistory();
    setView("builder");
    openRequest(item.dataset.hist);
  });

  document.getElementById("ctx-menu").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-ctx]");
    if (!btn) return;
    handleContext(btn.dataset.ctx, btn.dataset.kind, btn.dataset.id);
    hideMenu();
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#ctx-menu") && !e.target.closest("[data-act='menu']")) hideMenu();
  });

  const splitter = document.getElementById("splitter");
  const sidebar = document.getElementById("sidebar");
  splitter.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const onMove = (ev) => {
      sidebar.style.width = `${Math.max(200, Math.min(480, ev.clientX))}px`;
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  });
}

function closeHistory() {
  document.getElementById("history-drawer").classList.add("hidden");
  document.getElementById("drawer-backdrop").classList.add("hidden");
}

function renderAll() {
  renderEnvSelect();
  renderTree();
  renderTabs();
  loadEditor();
  renderResponse();
}

function hideSplash() {
  const splash = document.getElementById("splash");
  if (!splash) return;
  splash.classList.add("fade");
  setTimeout(() => splash.remove(), 500);
}

async function init() {
  bind();
  try {
    state.workspace = await apiGetWorkspace();
    const first = [];
    walk(state.workspace.collections[0]?.children || [], (n) => {
      if (n.type === "request" && !first.length) first.push(n.id);
    });
    if (first[0]) {
      state.openIds = [first[0]];
      state.activeId = first[0];
    }
    renderAll();
  } catch (err) {
    toast(err.message);
  } finally {
    setTimeout(hideSplash, 800);
  }
}

init();
