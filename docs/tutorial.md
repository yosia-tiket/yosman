# Yosman tutorial

This tutorial follows a real workflow: send a request, use variables, write tests, import from Postman/cURL, run a collection, then turn on mocks.

Assumption: Yosman is already open. If not, read [Getting started](getting-started.md).

---

## 1. Send a GET and read the response

1. Open **JSONPlaceholder → Posts → List posts**.
2. Click **Send**.
3. In the Response panel, the **Body** tab shows formatted JSON. **Headers** shows HTTP headers. **Tests** shows script results.

Switch to **Get post**. Its URL is `{{baseUrl}}/posts/{{postId}}`. The Development environment sets `postId` to `1`, so the request goes to `/posts/1`.

---

## 2. Switch environments

In the top right, change **Env** from Development to **Staging**.

`postId` in Staging is `2`. Send **Get post** again — the id in the response should be `2`.

Open the **Environments** view to add variables such as `token` or `apiKey`. Use them with `{{name}}` in URLs, query strings, headers, and bodies.

Built-in variables (no need to define them):

| Variable | Value |
| --- | --- |
| `{{origin}}` | Yosman origin, e.g. `http://127.0.0.1:8765` |
| `{{$timestamp}}` | Unix time |
| `{{$isoTimestamp}}` | ISO-8601 time |
| `{{$guid}}` | Random UUID |
| `{{$randomInt}}` | Integer 0–999 |

---

## 3. Create your own request

1. Click **+** in the sidebar and name the collection, e.g. `My API`.
2. An empty request opens. Fill in:
   - Method: `POST`
   - URL: `{{baseUrl}}/posts`
   - **Body** tab: choose **JSON**, then:

```json
{
  "title": "From Yosman",
  "body": "A request I built myself",
  "userId": 1
}
```

3. Use the **Auth** tab if needed: Bearer, Basic, or API Key.
4. **Send**. JSONPlaceholder returns `201` and echoes the body.

Right-click a collection for **New folder**, **New request**, rename, or delete.

---

## 4. Write automated tests

Open the **Scripts** tab on the request. Example tests:

```javascript
pm.test("Status is 201", function () {
  pm.expect(pm.response.code).to.equal(201);
});

pm.test("Echoes the title", function () {
  const body = pm.response.json();
  pm.expect(body).to.have.property("title");
  pm.expect(body.title).to.equal("From Yosman");
});

pm.test("Fast enough", function () {
  pm.expect(pm.response.responseTime).to.be.below(4000);
});
```

Pre-request scripts (left panel in Scripts) run **before** the request is sent:

```javascript
pm.environment.set("stamp", Date.now());
```

After **Send**, the **Tests** tab in Response shows PASS/FAIL.

Supported assertions: `.to.equal`, `.to.eql`, `.to.be.ok()`, `.to.be.true()`, `.to.be.above`, `.to.be.below`, `.to.have.property`, `.to.include`, `.to.be.a("string")`, plus `.not`.

---

## 5. Run an entire collection

1. Open **Runner**.
2. Select the **JSONPlaceholder** collection.
3. Click **Run collection**.

Yosman executes each request in order: pre-request → send → tests. Result cards show status, timing, and tests per request.

Use this as a smoke test before switching the environment to production.

---

## 6. Import a Postman collection

1. In the sidebar click **↑**.
2. Choose a `*.postman_collection.json` file (e.g. a Collection v2.1 export from Postman).
3. The collection appears in the sidebar. If the file has `variable` entries (e.g. `baseUrl`), Yosman creates a new environment and activates it.

What gets mapped: nested folders, method, URL, query, headers, auth, JSON/urlencoded/form-data body, test scripts, and saved examples (become mocks).

`*.postman_environment.json` files can be imported from the same button.

---

## 7. Import from cURL

Three ways:

- The **cURL** button in the sidebar
- Right-click a collection/folder → **Import cURL**
- Paste a command that starts with `curl` into the URL field

Example:

```bash
curl --location "https://jsonplaceholder.typicode.com/posts/1" \
  --header "Accept: application/json"
```

Click **Import request**. Method, URL, query, headers, body, and Bearer/Basic auth are filled in.

In the import dialog, `Ctrl+Enter` imports, `Esc` closes.

---

## 8. Mock an API before the backend exists

The **Mock Lab** collection is ready to go.

1. Open the **Mock** view.
2. Copy the base URL, shaped like `http://127.0.0.1:<port>/mock/col_mock`.
3. Open **List mock users** in the Builder and click **Send**.

A `200` response with fictional users comes from Yosman, not another server.

For your own requests:

1. Open the **Mock** tab on the request.
2. Check **Enable mock**.
3. Set status, delay (optional), and body.
4. The mock path follows the request URL path after `/mock/<collection-id>/`.

Frontends or mobile apps can point at that mock URL while Yosman is running.

---

## 9. Interactive docs

1. Open **Docs**.
2. Select a collection.
3. Each endpoint shows method, URL, description, sample body, and an **Open in builder** button.

**Print / save PDF** uses the system print dialog — on Windows choose "Microsoft Print to PDF" for a PDF file.

Fill in the **Description** tab on each request so the docs are useful for your team.

---

## 10. History and export

- **History** (top right) — recently sent requests. Click an item to reopen it.
- **Export workspace** at the bottom of the sidebar — backup of all collections + environments.
- Right-click a collection → **Export** — one collection (Yosman JSON).

---

## Next

See the [Guide](guide.md) for request tabs, auth types, body formats, and shortcuts.
