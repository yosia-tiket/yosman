from __future__ import annotations

import json
from typing import Any

from yosman.paths import DATA_DIR, WORKSPACE_FILE


def kv(key: str, value: str, enabled: bool = True) -> dict[str, Any]:
    return {"key": key, "value": value, "enabled": enabled}


def request(
    req_id: str,
    name: str,
    method: str,
    url: str,
    *,
    params: list | None = None,
    headers: list | None = None,
    body_type: str = "none",
    body: str = "",
    auth_type: str = "none",
    auth: dict | None = None,
    pre_request_script: str = "",
    test_script: str = "",
    description: str = "",
    mock_enabled: bool = False,
    mock_status: int = 200,
    mock_delay_ms: int = 0,
    mock_body: str = "",
    mock_headers: list | None = None,
) -> dict[str, Any]:
    return {
        "id": req_id,
        "type": "request",
        "name": name,
        "method": method,
        "url": url,
        "params": params or [],
        "headers": headers or [kv("Accept", "application/json")],
        "body_type": body_type,
        "body": body,
        "auth_type": auth_type,
        "auth": auth
        or {
            "token": "",
            "username": "",
            "password": "",
            "api_key": "",
            "api_value": "",
            "api_in": "header",
        },
        "pre_request_script": pre_request_script,
        "test_script": test_script,
        "description": description,
        "mock_enabled": mock_enabled,
        "mock_status": mock_status,
        "mock_delay_ms": mock_delay_ms,
        "mock_body": mock_body,
        "mock_headers": mock_headers or [kv("Content-Type", "application/json")],
    }


def folder(folder_id: str, name: str, children: list[dict]) -> dict[str, Any]:
    return {"id": folder_id, "type": "folder", "name": name, "children": children}


def default_workspace() -> dict[str, Any]:
    list_posts_tests = (
        'pm.test("Status is 200", function () {\n'
        "  pm.expect(pm.response.code).to.equal(200);\n"
        "});\n\n"
        'pm.test("Body is a JSON array", function () {\n'
        "  const data = pm.response.json();\n"
        "  pm.expect(Array.isArray(data)).to.equal(true);\n"
        "  pm.expect(data.length).to.be.above(0);\n"
        "});\n\n"
        'pm.test("Responds quickly", function () {\n'
        "  pm.expect(pm.response.responseTime).to.be.below(4000);\n"
        "});\n"
    )
    one_post_tests = (
        'pm.test("Status is 200", function () {\n'
        "  pm.expect(pm.response.code).to.equal(200);\n"
        "});\n\n"
        'pm.test("Post has expected shape", function () {\n'
        "  const post = pm.response.json();\n"
        '  pm.expect(post).to.have.property("id");\n'
        '  pm.expect(post).to.have.property("title");\n'
        '  pm.expect(post).to.have.property("body");\n'
        "});\n"
    )
    create_post_tests = (
        'pm.test("Created with 201", function () {\n'
        "  pm.expect(pm.response.code).to.equal(201);\n"
        "});\n\n"
        'pm.test("Echoes the title", function () {\n'
        "  const post = pm.response.json();\n"
        '  pm.expect(post.title).to.equal("Yosman demo");\n'
        "});\n"
    )
    mock_users_tests = (
        'pm.test("Mock users list", function () {\n'
        "  pm.expect(pm.response.code).to.equal(200);\n"
        "  const users = pm.response.json();\n"
        "  pm.expect(Array.isArray(users)).to.equal(true);\n"
        '  pm.expect(users[0]).to.have.property("email");\n'
        "});\n"
    )

    placeholder = {
        "id": "col_placeholder",
        "name": "JSONPlaceholder",
        "description": (
            "Public demo API for learning request testing. "
            "Switch environments to change the base URL."
        ),
        "children": [
            folder(
                "fld_posts",
                "Posts",
                [
                    request(
                        "req_list_posts",
                        "List posts",
                        "GET",
                        "{{baseUrl}}/posts",
                        description="Return the first page of posts from JSONPlaceholder.",
                        test_script=list_posts_tests,
                    ),
                    request(
                        "req_get_post",
                        "Get post",
                        "GET",
                        "{{baseUrl}}/posts/{{postId}}",
                        description="Fetch a single post by `postId` from the active environment.",
                        test_script=one_post_tests,
                    ),
                    request(
                        "req_create_post",
                        "Create post",
                        "POST",
                        "{{baseUrl}}/posts",
                        body_type="json",
                        body='{\n  "title": "Yosman demo",\n  "body": "Sent from the Yosman API studio.",\n  "userId": 1\n}',
                        headers=[
                            kv("Accept", "application/json"),
                            kv("Content-Type", "application/json"),
                        ],
                        description="Create a post. JSONPlaceholder fakes persistence and returns 201.",
                        test_script=create_post_tests,
                    ),
                    request(
                        "req_update_post",
                        "Update post",
                        "PUT",
                        "{{baseUrl}}/posts/{{postId}}",
                        body_type="json",
                        body='{\n  "id": 1,\n  "title": "Updated by Yosman",\n  "body": "Full replacement payload.",\n  "userId": 1\n}',
                        headers=[
                            kv("Accept", "application/json"),
                            kv("Content-Type", "application/json"),
                        ],
                        description="Replace an existing post with a full JSON body.",
                    ),
                    request(
                        "req_delete_post",
                        "Delete post",
                        "DELETE",
                        "{{baseUrl}}/posts/{{postId}}",
                        description="Delete a post. JSONPlaceholder returns an empty 200 response.",
                    ),
                ],
            ),
            folder(
                "fld_comments",
                "Comments",
                [
                    request(
                        "req_comments",
                        "Comments for a post",
                        "GET",
                        "{{baseUrl}}/posts/{{postId}}/comments",
                        description="Nested resource example using the `postId` environment variable.",
                    ),
                ],
            ),
        ],
    }

    mock_users_body = json.dumps(
        [
            {"id": 1, "name": "Ada Lovelace", "email": "ada@yosman.dev"},
            {"id": 2, "name": "Grace Hopper", "email": "grace@yosman.dev"},
        ],
        indent=2,
    )
    mock_user_body = json.dumps(
        {"id": 1, "name": "Ada Lovelace", "email": "ada@yosman.dev", "role": "engineer"},
        indent=2,
    )
    mock_created = json.dumps(
        {"id": 3, "name": "New User", "email": "new@yosman.dev", "created": True},
        indent=2,
    )

    mock_lab = {
        "id": "col_mock",
        "name": "Mock Lab",
        "description": (
            "These requests hit Yosman's built-in mock server — no backend required. "
            "Open the Mock view and send against {{origin}}/mock/col_mock."
        ),
        "children": [
            request(
                "req_mock_users",
                "List mock users",
                "GET",
                "{{origin}}/mock/col_mock/users",
                description="Served by Yosman mock routing. Useful before a real API exists.",
                test_script=mock_users_tests,
                mock_enabled=True,
                mock_status=200,
                mock_delay_ms=120,
                mock_body=mock_users_body,
            ),
            request(
                "req_mock_user",
                "Get mock user",
                "GET",
                "{{origin}}/mock/col_mock/users/1",
                description="Path matching example for a single resource.",
                mock_enabled=True,
                mock_status=200,
                mock_body=mock_user_body,
            ),
            request(
                "req_mock_create",
                "Create mock user",
                "POST",
                "{{origin}}/mock/col_mock/users",
                body_type="json",
                body='{\n  "name": "New User",\n  "email": "new@yosman.dev"\n}',
                headers=[
                    kv("Accept", "application/json"),
                    kv("Content-Type", "application/json"),
                ],
                description="Returns a canned 201 created payload from the mock server.",
                mock_enabled=True,
                mock_status=201,
                mock_body=mock_created,
            ),
        ],
    }

    return {
        "collections": [placeholder, mock_lab],
        "environments": [
            {
                "id": "env_dev",
                "name": "Development",
                "variables": [
                    kv("baseUrl", "https://jsonplaceholder.typicode.com"),
                    kv("postId", "1"),
                    kv("apiKey", "dev-key-change-me"),
                    kv("token", ""),
                ],
            },
            {
                "id": "env_staging",
                "name": "Staging",
                "variables": [
                    kv("baseUrl", "https://jsonplaceholder.typicode.com"),
                    kv("postId", "2"),
                    kv("apiKey", "staging-key-change-me"),
                    kv("token", ""),
                ],
            },
            {
                "id": "env_prod",
                "name": "Production",
                "variables": [
                    kv("baseUrl", "https://jsonplaceholder.typicode.com"),
                    kv("postId", "1"),
                    kv("apiKey", ""),
                    kv("token", ""),
                ],
            },
        ],
        "active_environment_id": "env_dev",
        "history": [],
        "settings": {"timeout": 30, "follow_redirects": True, "verify_ssl": True},
    }


def load_workspace() -> dict[str, Any]:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not WORKSPACE_FILE.exists():
        data = default_workspace()
        save_workspace(data)
        return data
    with WORKSPACE_FILE.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def save_workspace(data: dict[str, Any]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = WORKSPACE_FILE.with_suffix(".json.tmp")
    with tmp.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2)
    tmp.replace(WORKSPACE_FILE)


def walk_nodes(nodes: list[dict[str, Any]]):
    for node in nodes or []:
        yield node
        if node.get("type") == "folder":
            yield from walk_nodes(node.get("children") or [])


def find_collection(workspace: dict[str, Any], collection_id: str) -> dict[str, Any] | None:
    for collection in workspace.get("collections") or []:
        if collection.get("id") == collection_id:
            return collection
    return None


def pathname_from_url(url: str) -> str:
    from urllib.parse import urlparse

    parsed = urlparse(url)
    path = parsed.path or "/"
    if not path.startswith("/"):
        path = "/" + path
    return path.rstrip("/") or "/"


def request_path_template(url: str) -> str:
    """Turn a stored URL into a pathname, treating {{vars}} as wildcards later."""
    cleaned = url.strip()
    if cleaned.startswith("{{origin}}"):
        cleaned = "http://placeholder.local" + cleaned[len("{{origin}}") :]
    else:
        first = cleaned.split("/", 1)[0]
        if "{{" in first:
            rest = cleaned.split("/", 1)[1] if "/" in cleaned else ""
            cleaned = "http://placeholder.local/" + rest
    try:
        return pathname_from_url(cleaned)
    except Exception:
        return "/"


def strip_mock_prefix(path: str, collection_id: str) -> str:
    prefix = f"/mock/{collection_id}"
    if path.startswith(prefix):
        path = path[len(prefix) :] or "/"
    return path.rstrip("/") or "/"


def match_mock_request(
    collection: dict[str, Any], method: str, path: str
) -> dict[str, Any] | None:
    incoming = strip_mock_prefix(path.rstrip("/") or "/", collection.get("id") or "")
    method = method.upper()
    candidates: list[tuple[int, dict]] = []
    for node in walk_nodes(collection.get("children") or []):
        if node.get("type") != "request":
            continue
        if not node.get("mock_enabled"):
            continue
        if str(node.get("method", "GET")).upper() != method:
            continue
        template = strip_mock_prefix(
            request_path_template(str(node.get("url") or "")),
            collection.get("id") or "",
        )
        if _path_matches(template, incoming):
            score = 1000 - template.count("{{") - template.count("*")
            if template == incoming:
                score += 100
            candidates.append((score, node))
    if not candidates:
        return None
    candidates.sort(key=lambda item: item[0], reverse=True)
    return candidates[0][1]


def _path_matches(template: str, incoming: str) -> bool:
    t_parts = [p for p in template.strip("/").split("/") if p != ""]
    i_parts = [p for p in incoming.strip("/").split("/") if p != ""]
    if len(t_parts) != len(i_parts):
        return False
    for t, i in zip(t_parts, i_parts):
        if t in {"*", ":id"} or t.startswith("{{") or t.startswith(":"):
            continue
        if t != i:
            return False
    return True
