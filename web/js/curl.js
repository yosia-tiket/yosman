function looksLikeCurl(text) {
  return /^\s*curl(\.exe)?(\s|$)/i.test(String(text || ""));
}

function normalizeCurlSource(text) {
  let source = String(text || "").trim();
  source = source.replace(/^\s*curl\.exe\b/i, "curl");
  source = source.replace(/\\\r?\n/g, " ");
  source = source.replace(/`\r?\n/g, " ");
  source = source.replace(/\^\r?\n/g, " ");
  return source.trim();
}

function tokenizeCurl(source) {
  const tokens = [];
  let index = 0;
  const length = source.length;

  const skipSpaces = () => {
    while (index < length && /\s/.test(source[index])) index += 1;
  };

  while (index < length) {
    skipSpaces();
    if (index >= length) break;
    if (source[index] === "$" && (source[index + 1] === "'" || source[index + 1] === '"')) {
      index += 1;
    }
    const quote = source[index] === "'" || source[index] === '"' ? source[index] : null;
    if (quote) {
      index += 1;
      let token = "";
      while (index < length) {
        const char = source[index];
        if (quote === "'" && char === "'") {
          index += 1;
          break;
        }
        if (quote === '"' && char === "\\") {
          const next = source[index + 1];
          if (next === '"' || next === "\\" || next === "$" || next === "`") {
            token += next;
            index += 2;
            continue;
          }
          if (next === "n") {
            token += "\n";
            index += 2;
            continue;
          }
          if (next === "t") {
            token += "\t";
            index += 2;
            continue;
          }
        }
        if (quote === '"' && char === '"') {
          index += 1;
          break;
        }
        token += char;
        index += 1;
      }
      tokens.push(token);
      continue;
    }
    let token = "";
    while (index < length && !/\s/.test(source[index])) {
      if (source[index] === "\\" && index + 1 < length) {
        token += source[index + 1];
        index += 2;
        continue;
      }
      token += source[index];
      index += 1;
    }
    if (token) tokens.push(token);
  }
  return tokens;
}

function splitHeader(value) {
  const index = value.indexOf(":");
  if (index < 0) return { key: value.trim(), value: "" };
  return { key: value.slice(0, index).trim(), value: value.slice(index + 1).trim() };
}

function splitPair(value) {
  const index = String(value).indexOf("=");
  if (index < 0) return { key: value, value: "" };
  return { key: value.slice(0, index), value: value.slice(index + 1) };
}

function urlPartsFromCurl(rawUrl) {
  const raw = String(rawUrl || "").trim().replace(/^<|>$/g, "");
  const qIndex = raw.indexOf("?");
  const url = qIndex >= 0 ? raw.slice(0, qIndex) : raw;
  const params = [];
  if (qIndex >= 0) {
    const search = new URLSearchParams(raw.slice(qIndex + 1));
    for (const [key, value] of search.entries()) params.push(kv(key, value));
  }
  return { url, params };
}

function nameFromCurlUrl(url) {
  const path = String(url || "").split("?")[0];
  try {
    const parsed = new URL(path.replace(/\{\{[^}]+\}\}/g, "x"));
    const parts = parsed.pathname.split("/").filter(Boolean);
    return decodeURIComponent(parts[parts.length - 1] || parsed.hostname || "cURL request");
  } catch {
    const parts = path.split("/").filter(Boolean);
    return parts[parts.length - 1] || "cURL request";
  }
}

function looksJsonBody(text) {
  return /^\s*[{\[]/.test(String(text || ""));
}

function parseCurl(command) {
  if (!looksLikeCurl(command)) {
    throw new Error("Paste a curl command starting with curl");
  }
  const tokens = tokenizeCurl(normalizeCurlSource(command));
  if (!tokens.length) throw new Error("Could not parse that curl command");

  const skipBare = new Set([
    "-s", "--silent", "-S", "--show-error", "-v", "--verbose", "-L", "--location",
    "--compressed", "-k", "--insecure", "-i", "--include", "-f", "--fail",
    "--fail-with-body", "--http1.0", "--http1.1", "--http2", "--location-trusted",
    "-g", "--globoff", "-#", "--progress-bar", "--remote-name", "-O", "--remote-header-name",
    "-J", "--create-dirs", "--tlsv1.2", "--tlsv1.3",
  ]);
  const skipArg = new Set([
    "-o", "--output", "-D", "--dump-header", "--connect-timeout", "--max-time", "-m",
    "--retry", "--unix-socket", "--interface", "-w", "--write-out", "-K", "--config",
    "--proxy", "-x", "--cert", "--key", "--cacert", "--pass", "--connect-to",
    "--resolve", "--dns-servers", "-E", "--max-redirs", "--retry-delay",
    "--engine", "--ciphers", "--tlsuser", "--tlspassword",
  ]);

  let method = "";
  let rawUrl = "";
  let forceGet = false;
  const headers = [];
  const dataParts = [];
  const urlencParts = [];
  const formParts = [];
  let jsonBody = "";
  let user = "";
  let bearer = "";
  let cookie = "";
  let userAgent = "";
  let referer = "";

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === "curl" || /^curl\.exe$/i.test(token)) continue;

    const eq = token.indexOf("=");
    const flag = eq > 1 && token.startsWith("--") ? token.slice(0, eq) : token;
    const attached = eq > 1 && token.startsWith("--") ? token.slice(eq + 1) : null;
    const arg = () => {
      if (attached != null) return attached;
      index += 1;
      if (index >= tokens.length) return "";
      return tokens[index];
    };

    if (skipBare.has(flag)) continue;
    if (skipArg.has(flag)) {
      if (attached == null) index += 1;
      continue;
    }

    if (token.startsWith("-X") && token.length > 2 && token !== "-X") {
      method = token.slice(2).toUpperCase();
      continue;
    }
    if (flag === "-X" || flag === "--request") {
      method = String(arg()).toUpperCase();
      continue;
    }
    if (flag === "-I" || flag === "--head") {
      method = "HEAD";
      continue;
    }
    if (flag === "-G" || flag === "--get") {
      forceGet = true;
      continue;
    }
    if (flag === "--url") {
      rawUrl = arg();
      continue;
    }
    if (flag === "-H" || flag === "--header") {
      const parsed = splitHeader(arg());
      if (parsed.key) headers.push(kv(parsed.key, parsed.value));
      continue;
    }
    if (flag === "-A" || flag === "--user-agent") {
      userAgent = arg();
      continue;
    }
    if (flag === "-e" || flag === "--referer") {
      referer = arg();
      continue;
    }
    if (flag === "-d" || flag === "--data" || flag === "--data-raw" || flag === "--data-binary" || flag === "--data-ascii") {
      dataParts.push(arg());
      continue;
    }
    if (flag === "--data-urlencode") {
      urlencParts.push(arg());
      continue;
    }
    if (flag === "-F" || flag === "--form" || flag === "--form-string") {
      formParts.push(arg());
      continue;
    }
    if (flag === "--json") {
      jsonBody = arg();
      continue;
    }
    if (flag === "-u" || flag === "--user") {
      user = arg();
      continue;
    }
    if (flag === "--oauth2-bearer") {
      bearer = arg();
      continue;
    }
    if (flag === "-b" || flag === "--cookie") {
      cookie = arg();
      continue;
    }
    if (token.startsWith("http://") || token.startsWith("https://") || token.startsWith("{{") || token.startsWith("/")) {
      rawUrl = token;
      continue;
    }
  }

  if (!rawUrl) throw new Error("No URL found in the curl command");

  const request = emptyRequest(nameFromCurlUrl(rawUrl));
  const urlInfo = urlPartsFromCurl(rawUrl);
  request.url = urlInfo.url;
  request.params = urlInfo.params.length ? urlInfo.params : [kv()];

  if (userAgent && !headers.some((row) => row.key.toLowerCase() === "user-agent")) {
    headers.push(kv("User-Agent", userAgent));
  }
  if (referer && !headers.some((row) => row.key.toLowerCase() === "referer")) {
    headers.push(kv("Referer", referer));
  }
  if (cookie && !headers.some((row) => row.key.toLowerCase() === "cookie")) {
    headers.push(kv("Cookie", cookie));
  }

  const contentType = headers.find((row) => row.key.toLowerCase() === "content-type")?.value || "";
  if (jsonBody) {
    request.body_type = "json";
    request.body = jsonBody;
    if (!contentType) headers.push(kv("Content-Type", "application/json"));
    if (!headers.some((row) => row.key.toLowerCase() === "accept")) headers.push(kv("Accept", "application/json"));
    if (!method) method = "POST";
  } else if (formParts.length) {
    request.body_type = "formdata";
    request.body = formParts
      .filter((part) => !part.includes("@") || part.includes(";type="))
      .map((part) => (part.startsWith("@") ? "" : part))
      .filter(Boolean)
      .join("\n");
    if (!method) method = "POST";
  } else if (urlencParts.length || (dataParts.length && /urlencoded/i.test(contentType))) {
    const lines = [...urlencParts, ...dataParts].flatMap((part) =>
      String(part).includes("&") && !String(part).includes("\n") ? part.split("&") : [part]
    );
    request.body_type = "urlencoded";
    request.body = lines.join("\n");
    if (!method) method = forceGet ? "GET" : "POST";
  } else if (dataParts.length) {
    const body = dataParts.join("&");
    if (looksJsonBody(body) || /json/i.test(contentType)) {
      request.body_type = "json";
      request.body = body;
    } else if (body.includes("=") && !body.trim().startsWith("{")) {
      request.body_type = "urlencoded";
      request.body = body.includes("&") && !body.includes("\n") ? body.split("&").join("\n") : body;
    } else {
      request.body_type = "raw";
      request.body = body;
    }
    if (!method) method = forceGet ? "GET" : "POST";
  }

  if (forceGet && request.body && request.body_type === "urlencoded") {
    for (const line of request.body.split("\n")) {
      const pair = splitPair(line);
      if (pair.key) request.params.push(kv(pair.key, pair.value));
    }
    request.body = "";
    request.body_type = "none";
    method = method || "GET";
  }

  const authHeader = headers.find((row) => row.key.toLowerCase() === "authorization");
  if (bearer) {
    request.auth_type = "bearer";
    request.auth.token = bearer;
  } else if (authHeader && /^bearer\s+/i.test(authHeader.value)) {
    request.auth_type = "bearer";
    request.auth.token = authHeader.value.replace(/^bearer\s+/i, "");
  } else if (authHeader && /^basic\s+/i.test(authHeader.value)) {
    request.auth_type = "basic";
    try {
      const decoded = atob(authHeader.value.replace(/^basic\s+/i, ""));
      const split = decoded.indexOf(":");
      request.auth.username = split >= 0 ? decoded.slice(0, split) : decoded;
      request.auth.password = split >= 0 ? decoded.slice(split + 1) : "";
    } catch {
      request.auth_type = "none";
    }
  } else if (user) {
    request.auth_type = "basic";
    const split = user.indexOf(":");
    request.auth.username = split >= 0 ? user.slice(0, split) : user;
    request.auth.password = split >= 0 ? user.slice(split + 1) : "";
  }

  request.headers = headers.filter((row) => {
    if (row.key.toLowerCase() === "authorization" && request.auth_type !== "none") return false;
    return true;
  });
  if (!request.headers.length) request.headers = [kv("Accept", "application/json")];

  request.method = (method || "GET").toUpperCase();
  request.description = "Imported from cURL";
  return request;
}
