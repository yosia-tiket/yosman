# Yosman guide

Feature reference. For installation see [Getting started](getting-started.md). For a step-by-step walkthrough see the [Tutorial](tutorial.md).

## Builder

The active request editor.

| Control | Description |
| --- | --- |
| Name | Label in the tab and sidebar |
| Method | GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS |
| URL | May contain `{{variables}}` |
| **Send** | Send the request (`Ctrl+Enter`) |
| **Saved** | The workspace autosaves; this button forces a save |

### Request tabs

**Params** — query string. Unchecked rows are not sent.

**Auth**

| Type | Behavior |
| --- | --- |
| No Auth | Does not add credentials |
| Bearer Token | `Authorization: Bearer …` header |
| Basic Auth | Basic header (username/password) |
| API Key | Header or query, per **Add to** |

**Headers** — key/value pairs. Content-Type is set automatically for JSON, urlencoded, and multipart.

**Body**

| Type | When to use |
| --- | --- |
| None | GET/HEAD, or no payload |
| JSON | Object/array; **Format JSON** pretty-prints |
| Raw | Free-form text |
| x-www-form-urlencoded | One `key=value` per line |
| multipart/form-data | One `key=value` per line, sent as multipart |

**Scripts** — JavaScript pre-request and tests. See [Tests](#javascript-tests).

**Mock** — status, delay (ms), and body returned by the mock server when enabled.

**Description** — text shown in the Docs view.

### Response panel

- Colored status badge (2xx green, 3xx blue, 4xx yellow, 5xx red)
- Timing (ms) and body size
- **Pretty / Raw / Preview** — Preview renders HTML in an isolated iframe
- **Headers** — all response headers
- **Tests** — `pm.test` results

## Collections

Tree structure: collection → folder → request.

Right-click:

| Item | Actions |
| --- | --- |
| Collection | New request, New folder, Import cURL, Rename, Export, Delete |
| Folder | New request, Import cURL, Rename, Delete |
| Request | Duplicate, Rename, Delete |

Sidebar search filters name, method, and URL.

## Environments

The **Environments** view lists variable sets. The active environment is chosen in the header.

Variable names are letters, digits, and common underscores; reference them as `{{baseUrl}}`.

Collections imported from Postman often carry `baseUrl` — Yosman creates an environment `{collection name} vars` and activates it.

## Runner

Runs **all requests** in a collection in DFS order (folder, then contents). Pre-request scripts and tests run too. Variables set by scripts apply to later requests in the same run.

## Docs

Docs are built from name, method, URL, description, auth, sample body, and whether tests exist. **Print / save PDF** uses the system print dialog.

## Mock server

While Yosman is running, mocks are available at:

```
http://127.0.0.1:<port>/mock/<collection-id>/<path>
```

`<port>` matches the window port (usually 8765, or the next free one if that is taken).

Matching: HTTP method + request URL path (after interpolating `{{origin}}` / `{{baseUrl}}`). `{{variable}}` or `:id` segments are treated as wildcards.

Delay is capped at 10 seconds.

## Import and export

### Postman Collection v2.1

`*.postman_collection.json` files. Folders, requests, headers, query, auth, body, event scripts, collection variables, and saved examples (→ mock) are imported. Collections do not overwrite the existing workspace; they are added in the sidebar.

### Postman Environment

Files with `_postman_variable_scope: environment` or a `values` list.

### cURL

Supports common flags: `-X` / `--request`, `-H` / `--header`, `-d` / `--data` / `--data-raw`, `--data-urlencode`, `-F` / `--form`, `--json`, `-u` / `--user`, `--oauth2-bearer`, `-G`, `-I`, `--url`, plus line continuations `\`, `` ` ``, and `^`.

### Yosman workspace

**Export workspace** produces JSON with all collections and environments. Importing the same file overwrites the current workspace.

## JavaScript tests

The `pm` object:

```javascript
pm.test("name", function () { ... });
pm.expect(value).to.equal(x);
pm.response.code
pm.response.responseTime
pm.response.json()
pm.response.text()
pm.response.headers
pm.response.to.have.status(200);       // chai-http style response assertions
pm.response.to.be.ok;                  // 2xx
pm.response.to.have.header("Content-Type");
pm.environment.get("key")
pm.environment.set("key", "value")
pm.collectionVariables.get("key")      // scoped to the request's collection
pm.collectionVariables.set("key", "value")
pm.variables.get("key")                // reads environment, falling back to collection scope
```

`pm.expect(...)` supports chai's common BDD chain: language words (`to`, `be`, `have`, `and`, `not`, ...), property assertions (`.true`, `.false`, `.null`, `.undefined`, `.exist`, `.empty`, `.NaN`), and methods (`.equal`, `.eql`, `.a`/`.an`, `.above`, `.below`, `.least`, `.most`, `.within`, `.include`/`.contain`, `.property`, `.length`/`.lengthOf`, `.match`, `.string`, `.instanceOf`).

Collection variables set in one request's scripts are available (via `{{name}}` and `pm.collectionVariables.get`) in later requests from the same collection — handy for stashing a token from a login call. They're saved on the collection and persist with the workspace. Environment variables of the same name take precedence.

Scripts run in a browser sandbox (not on the server). Do not rely on `fetch` to arbitrary hosts from test scripts; send HTTP through Yosman requests.

## Shortcuts

| Key | Action |
| --- | --- |
| `Ctrl+Enter` | Send the active request, or import in the cURL dialog |
| `Esc` | Close the cURL dialog |

## Data and logs

| Path | Contents |
| --- | --- |
| `~/.yosman/workspace.json` | Collections, environments, history |
| `~/.yosman/yosman.log` | Log if the app cannot write to the console |
| `~/.yosman/webview2/` | WebView2 data on Windows (window cache) |

(Windows: replace `~` with `%USERPROFILE%`.)

Deleting `workspace.json` restores the sample collections the next time the app opens.

## Build executable

**macOS**

```bash
./build.sh
```

Output: `dist/Yosman.app`.

**Windows**

```powershell
.\build.bat
```

Output: `dist\Yosman.exe` (single file). Python and the project folder are not required on the target machine.

## Troubleshooting

**Window does not appear** — ensure WebView2 is installed (Edge component) on Windows. Check `yosman.log`.

**Request timeout / SSL failure** — the target API must be reachable from your machine. Mock Lab does not need internet.

**Postman import fails** — export as Collection v2.1 JSON, not a v2.0 dump or HTML.

**Port 8765 in use** — Yosman picks the next free port (up to 8794). The mock URL in the Mock view always shows the correct origin.

**cURL does not parse** — the command must start with `curl` or `curl.exe`. Paste it whole, including quotes.
