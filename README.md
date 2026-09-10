# Yosman

**REST easy with Yosman.**

Yosman adalah API studio desktop untuk merancang, mengirim, menguji, mendokumentasikan, dan mem-mock HTTP request — tanpa harus menulis backend dulu.

Buka jendela aplikasi (bukan tab browser). Collection tersimpan di folder pengguna Anda.

## Dokumentasi

| Dokumen | Isi |
| --- | --- |
| [Getting started](docs/getting-started.md) | Instal, buka aplikasi, kirim request pertama |
| [Tutorial](docs/tutorial.md) | Alur kerja lengkap: collection, environment, tes, import, mock |
| [Panduan](docs/panduan.md) | Referensi semua fitur, shortcut, dan lokasi data |

## Fitur

- **Request testing** — GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS. Lihat status, waktu, header, dan body JSON / XML / HTML.
- **Collections & workflows** — Kelompokkan request ke collection dan folder. Jalankan suite berurutan di Runner.
- **Environments** — Development, staging, production. Pakai `{{baseUrl}}`, `{{token}}`, dan variabel lain di URL, header, dan body.
- **Automated tests** — JavaScript di tiap request dengan `pm.test` dan `pm.expect`.
- **Docs & mocks** — Dokumentasi otomatis dari collection, plus mock server di proses yang sama.
- **Import** — Postman Collection v2.1, Postman Environment, dan perintah cURL.

## Jalankan

Cara paling cepat:
- **Windows:** double-click `dist\Yosman.exe` (Windows 10/11 + WebView2)
- **macOS:** double-click `dist/Yosman.app` (macOS 11+; WebKit bawaan)

Dari source (Python 3.10+):

```bash
cd /path/to/yosman
python3 -m venv .venv
source .venv/bin/activate   # Windows: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python run.py
```

Atau `./yosman.sh` (macOS/Linux) / double-click `yosman.bat` (Windows).

Build ulang:
- **macOS:** `./build.sh` → `dist/Yosman.app`
- **Windows:** `.\build.bat` → `dist\Yosman.exe`
