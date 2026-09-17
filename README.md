# Yosman

**REST easy with Yosman.**

Yosman is a desktop API studio for designing, sending, testing, documenting, and mocking HTTP requests — without writing a backend first.

It opens as an application window (not a browser tab). Collections are stored in your user folder.

## Documentation

| Document | Contents |
| --- | --- |
| [Getting started](docs/getting-started.md) | Install, open the app, send your first request |
| [Tutorial](docs/tutorial.md) | Full workflow: collections, environments, tests, import, mocks |
| [Guide](docs/guide.md) | Reference for every feature, shortcuts, and data locations |

## Features

- **Request testing** — GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS. Inspect status, timing, headers, and JSON / XML / HTML bodies.
- **Collections & workflows** — Group requests into collections and folders. Run suites in order with Runner.
- **Environments** — Development, staging, production. Use `{{baseUrl}}`, `{{token}}`, and other variables in URLs, headers, and bodies.
- **Automated tests** — JavaScript per request with `pm.test` and `pm.expect`.
- **Docs & mocks** — Auto-generated docs from collections, plus a mock server in the same process.
- **Import** — Postman Collection v2.1, Postman Environment, and cURL commands.

## Run

Fastest path:
- **Windows:** double-click `dist\Yosman.exe` (Windows 10/11 + WebView2)
- **macOS:** double-click `dist/Yosman.app` (macOS 11+; built-in WebKit)

From source (Python 3.10+):

```bash
cd /path/to/yosman
python3 -m venv .venv
source .venv/bin/activate   # Windows: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python run.py
```

Or `./yosman.sh` (macOS/Linux) / double-click `yosman.bat` (Windows).

Rebuild:
- **macOS:** `./build.sh` → `dist/Yosman.app` and `dist/Yosman-macOS-<arch>.zip`
- **Windows:** `.\build.bat` → `dist\Yosman.exe`

## Share the macOS build with someone else

`./build.sh` ad-hoc signs `dist/Yosman.app` (so it runs on your own Mac) and packages it as `dist/Yosman-macOS-<arch>.zip`. Send that zip to whoever needs it — no Python install required on their end.

This build isn't notarized by Apple (that needs a paid $99/yr Apple Developer Program membership), so the first time the recipient opens it, Gatekeeper will warn that it's from an unidentified developer. They only need to do this once:

- **Right-click (or Control-click) `Yosman.app` → Open → Open** in the confirmation dialog, or
- In Terminal: `xattr -cr /path/to/Yosman.app`, then double-click normally.

After that first approval, it opens like any other app.
