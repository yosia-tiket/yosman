function postmanText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.content || "";
}

function isPostmanCollection(data) {
  if (!data || typeof data !== "object") return false;
  if (data.collection && isPostmanCollection(data.collection)) return true;
  const schema = String(data.info?.schema || "");
  if (schema.includes("postman.com") && schema.includes("collection")) return true;
  return Boolean(data.info?.name && Array.isArray(data.item));
}

function isPostmanEnvironment(data) {
  if (!data || typeof data !== "object") return false;
  if (data._postman_variable_scope === "environment") return true;
  return Array.isArray(data.values) && data.name && !data.item && !data.collections && !data.info;
}

function uniqueImportedName(name, taken) {
  if (!taken.includes(name)) return name;
  let index = 2;
  while (taken.includes(`${name} (${index})`)) index += 1;
  return `${name} (${index})`;
}

function postmanUrl(url) {
  if (!url) return { url: "", params: [] };
  if (typeof url === "string") {
    const qIndex = url.indexOf("?");
    const base = qIndex >= 0 ? url.slice(0, qIndex) : url;
    const params = [];
    if (qIndex >= 0) {
      const search = new URLSearchParams(url.slice(qIndex + 1));
      for (const [key, value] of search.entries()) params.push(kv(key, value));
    }
    return { url: base, params };
  }
  const params = (url.query || []).map((row) => kv(row.key || "", row.value || "", !row.disabled));
  let pathUrl = (url.raw || "").split("?")[0];
  if (!params.length && url.raw && url.raw.includes("?")) {
    const search = new URLSearchParams(url.raw.slice(url.raw.indexOf("?") + 1));
    for (const [key, value] of search.entries()) params.push(kv(key, value));
  }
  if (!pathUrl) {
    const host = Array.isArray(url.host) ? url.host.join(".") : url.host || "";
    const path = Array.isArray(url.path) ? url.path.join("/") : url.path || "";
    const protocol = url.protocol ? `${url.protocol.replace(/:$/, "")}://` : "";
    pathUrl = host ? `${protocol}${host}${path ? `/${path}` : ""}` : `/${path}`;
  }
  return { url: pathUrl, params };
}

function postmanHeaders(headers) {
  return (headers || [])
    .filter((row) => row && row.key)
    .map((row) => kv(row.key, row.value || "", !row.disabled));
}

function postmanAuth(auth) {
  const result = { auth_type: "none", auth: emptyAuth() };
  if (!auth || auth.type === "noauth") return result;
  const list = (key) => (Array.isArray(auth[key]) ? auth[key] : []);
  const pick = (key, name) => list(key).find((row) => row.key === name)?.value || "";
  if (auth.type === "bearer") {
    result.auth_type = "bearer";
    result.auth.token = pick("bearer", "token") || (typeof auth.bearer === "string" ? auth.bearer : "");
  } else if (auth.type === "basic") {
    result.auth_type = "basic";
    result.auth.username = pick("basic", "username");
    result.auth.password = pick("basic", "password");
  } else if (auth.type === "apikey") {
    result.auth_type = "apikey";
    result.auth.api_key = pick("apikey", "key");
    result.auth.api_value = pick("apikey", "value");
    result.auth.api_in = pick("apikey", "in") === "query" ? "query" : "header";
  }
  return result;
}

function postmanScripts(events) {
  const pre = [];
  const tests = [];
  for (const event of events || []) {
    const exec = event?.script?.exec;
    const code = Array.isArray(exec) ? exec.join("\n") : exec || "";
    if (!code.trim()) continue;
    if (event.listen === "prerequest") pre.push(code);
    if (event.listen === "test") tests.push(code);
  }
  return {
    pre_request_script: pre.join("\n\n"),
    test_script: tests.join("\n\n"),
  };
}

function pairsToBody(rows) {
  return (rows || [])
    .filter((row) => row && row.key && !row.disabled && row.type !== "file")
    .map((row) => `${row.key}=${row.value ?? ""}`)
    .join("\n");
}

function postmanBody(body) {
  if (!body || body.mode === "none") return { body_type: "none", body: "" };
  if (body.mode === "raw") {
    const text = body.raw || "";
    const language = body.options?.raw?.language || "";
    const looksJson = language === "json" || /^\s*[{\[]/.test(text);
    return { body_type: looksJson ? "json" : "raw", body: text };
  }
  if (body.mode === "urlencoded") {
    return { body_type: "urlencoded", body: pairsToBody(body.urlencoded) };
  }
  if (body.mode === "formdata") {
    return { body_type: "formdata", body: pairsToBody(body.formdata) };
  }
  if (body.mode === "graphql") {
    const graphql = body.graphql || {};
    let variables = graphql.variables || {};
    if (typeof variables === "string") {
      try {
        variables = JSON.parse(variables);
      } catch {
        variables = {};
      }
    }
    return {
      body_type: "json",
      body: JSON.stringify({ query: graphql.query || "", variables }, null, 2),
    };
  }
  return { body_type: "raw", body: body.raw || "" };
}

function postmanExample(examples) {
  const example = (examples || []).find((row) => row && (row.code || row.body)) || null;
  if (!example) {
    return { mock_enabled: false, mock_status: 200, mock_body: "", mock_headers: [kv("Content-Type", "application/json")] };
  }
  const headers = (example.header || [])
    .filter((row) => row?.key && !String(row.key).startsWith(":"))
    .map((row) => kv(row.key, String(row.value ?? ""), true));
  if (!headers.some((row) => row.key.toLowerCase() === "content-type")) {
    headers.unshift(kv("Content-Type", "application/json"));
  }
  return {
    mock_enabled: true,
    mock_status: Number(example.code || 200),
    mock_body: typeof example.body === "string" ? example.body : JSON.stringify(example.body || "", null, 2),
    mock_headers: headers.length ? headers : [kv("Content-Type", "application/json")],
  };
}

function convertPostmanItem(item, inherited) {
  const auth = item.auth || inherited.auth;
  const pre = [inherited.pre, postmanScripts(item.event).pre_request_script].filter(Boolean).join("\n\n");
  const test = [inherited.test, postmanScripts(item.event).test_script].filter(Boolean).join("\n\n");
  if (Array.isArray(item.item) && !item.request) {
    return {
      id: uid("fld"),
      type: "folder",
      name: item.name || "Folder",
      children: item.item
        .map((child) => convertPostmanItem(child, { auth, pre, test }))
        .filter(Boolean),
    };
  }
  const request = item.request;
  if (!request) return null;
  if (typeof request === "string") {
    const converted = emptyRequest(item.name || "Untitled");
    converted.url = request;
    converted.pre_request_script = pre;
    converted.test_script = test;
    return converted;
  }
  const urlInfo = postmanUrl(request.url);
  const bodyInfo = postmanBody(request.body);
  const authInfo = postmanAuth(auth);
  const example = postmanExample(item.response);
  const converted = emptyRequest(item.name || request.url?.raw || "Untitled");
  converted.method = String(request.method || "GET").toUpperCase();
  converted.url = urlInfo.url;
  converted.params = urlInfo.params.length ? urlInfo.params : [kv()];
  converted.headers = postmanHeaders(request.header);
  converted.body_type = bodyInfo.body_type;
  converted.body = bodyInfo.body;
  converted.auth_type = authInfo.auth_type;
  converted.auth = authInfo.auth;
  converted.pre_request_script = pre;
  converted.test_script = test;
  converted.description = postmanText(request.description || item.description);
  converted.mock_enabled = example.mock_enabled;
  converted.mock_status = example.mock_status;
  converted.mock_body = example.mock_body;
  converted.mock_headers = example.mock_headers;
  return converted;
}

function importPostmanCollection(data) {
  const source = data.collection && data.collection.info ? data.collection : data;
  const info = source.info || {};
  const scripts = postmanScripts(source.event);
  const children = (source.item || []).map((item) =>
    convertPostmanItem(item, {
      auth: source.auth,
      pre: scripts.pre_request_script,
      test: scripts.test_script,
    })
  );
  const collection = {
    id: uid("col"),
    name: info.name || "Imported collection",
    description: postmanText(info.description),
    children,
  };
  const variables = (source.variable || []).filter((row) => row && row.key);
  const environment = variables.length
    ? {
        id: uid("env"),
        name: `${collection.name} vars`,
        variables: variables.map((row) => kv(row.key, row.value || "", row.disabled !== true && row.enabled !== false)),
      }
    : null;
  let count = 0;
  walk(collection.children, (node) => {
    if (node.type === "request") count += 1;
  });
  return { collection, environment, requestCount: count };
}

function importPostmanEnvironment(data) {
  return {
    id: uid("env"),
    name: data.name || "Imported environment",
    variables: (data.values || []).map((row) => kv(row.key || "", row.value || "", row.enabled !== false)),
  };
}
