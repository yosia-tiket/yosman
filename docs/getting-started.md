# Getting started

Short steps to open Yosman and send your first request.

## What you need

- **macOS 11+** (built-in WebKit) or **Windows 10/11** (+ Edge WebView2)
- To run from source: **Python 3.10+**

No account required. No internet needed to open the app. Internet is only required when a request targets a public API.

## Option 1 — Executable (most portable)

**macOS**

1. Open `dist/Yosman.app` (or copy it to Applications).
2. The first launch may take a few extra seconds.
3. The `{Y}` splash appears briefly, then the studio opens.

If macOS blocks an unsigned/un-notarized app: right-click → **Open**, or allow Yosman in System Settings → Privacy & Security.

**Windows**

1. Copy `dist\Yosman.exe` anywhere (USB, Desktop, another PC).
2. Double-click the file.
3. The first launch may take a few extra seconds (the file unpacks to a temp folder).
4. The `{Y}` splash appears briefly, then the studio opens.

You do not need Python on the target machine.

## Option 2 — From source

In the project folder:

```bash
python3 -m venv .venv
source .venv/bin/activate   # Windows PowerShell: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python run.py
```

Or `./yosman.sh` (macOS/Linux) / double-click `yosman.bat` (Windows).

Browser mode (optional):

```bash
python run.py --web
```

## Window map

After the splash disappears, you see:

| Area | Role |
| --- | --- |
| **Left sidebar** | Collections, folders, requests |
| **Builder** | Method, URL, params, headers, body, auth, scripts |
| **Response** | Status, timing, body, headers, test results |
| **Env** (top right) | Active environment: Development / Staging / Production |
| **Runner / Docs / Mock / Environments** | Other views in the top navigation |

Sidebar buttons:

- **+** — new collection
- **↑** — import a Postman file or Yosman workspace
- **cURL** — paste a curl command into a request

## First request (2 minutes)

Yosman ships with a sample collection, **JSONPlaceholder**.

1. In the sidebar open **JSONPlaceholder → Posts → List posts**.
2. Make sure Env in the header is **Development**.
3. Click **Send** (or `Ctrl+Enter`).
4. The Response panel shows `200 OK`, a JSON array, and passing tests.

The request URL uses a variable: `{{baseUrl}}/posts`. Its value comes from the active environment (`https://jsonplaceholder.typicode.com`).

If it fails:

- Check your internet connection.
- Try the **Mock Lab** collection — those requests are served by Yosman itself, with no external API.

## Where data is stored

The workspace (collections, environments, history) lives at:

```
~/.yosman/workspace.json
```

(Windows: `%USERPROFILE%\.yosman\workspace.json`)

This file stays even if you move the app. Error logs (if any) are at `~/.yosman/yosman.log`.

## Next

Follow the [Tutorial](tutorial.md) for Postman import, automated tests, and the mock server. Full reference is in the [Guide](guide.md).
