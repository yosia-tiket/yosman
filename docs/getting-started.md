# Getting started

Langkah singkat untuk membuka Yosman dan mengirim request pertama.

## Yang Anda butuhkan

- **macOS 11+** (WebKit bawaan) atau **Windows 10/11** (+ Edge WebView2)
- Untuk menjalankan dari source: **Python 3.10+**

Tidak perlu akun, tidak perlu internet untuk membuka aplikasi. Internet hanya diperlukan jika request-nya menuju API publik.

## Opsi 1 — File executable (paling portable)

**macOS**

1. Buka `dist/Yosman.app` (atau salin ke Applications).
2. Launch pertama bisa beberapa detik lebih lama.
3. Splash `{Y}` muncul sebentar, lalu studio terbuka.

Kalau macOS menolak app yang belum di-notarize: klik kanan → **Open**, atau di System Settings → Privacy & Security izinkan Yosman.

**Windows**

1. Salin `dist\Yosman.exe` ke folder mana saja (USB, Desktop, PC lain).
2. Double-click file tersebut.
3. Launch pertama bisa beberapa detik lebih lama (file di-unpack ke temp).
4. Splash `{Y}` muncul sebentar, lalu studio terbuka.

Tidak perlu menginstal Python di mesin tujuan.

## Opsi 2 — Dari source

Di folder project:

```bash
python3 -m venv .venv
source .venv/bin/activate   # Windows PowerShell: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python run.py
```

Atau `./yosman.sh` (macOS/Linux) / double-click `yosman.bat` (Windows).

Mode browser (opsional):

```bash
python run.py --web
```

## Peta jendela

Setelah splash hilang, Anda melihat:

| Bagian | Fungsi |
| --- | --- |
| **Sidebar kiri** | Collection, folder, request |
| **Builder** | Editor method, URL, params, headers, body, auth, script |
| **Response** | Status, waktu, body, header, hasil tes |
| **Env** (kanan atas) | Environment aktif: Development / Staging / Production |
| **Runner / Docs / Mock / Environments** | Tampilan lain di navigasi atas |

Tombol sidebar:

- **+** — collection baru
- **↑** — import file Postman atau workspace Yosman
- **cURL** — tempel perintah curl menjadi request

## Request pertama (2 menit)

Yosman sudah berisi collection contoh **JSONPlaceholder**.

1. Di sidebar buka **JSONPlaceholder → Posts → List posts**.
2. Pastikan Env di header adalah **Development**.
3. Klik **Send** (atau `Ctrl+Enter`).
4. Panel Response menampilkan `200 OK`, JSON array, dan tes yang lulus.

URL request memakai variabel: `{{baseUrl}}/posts`. Nilainya diisi dari environment aktif (`https://jsonplaceholder.typicode.com`).

Kalau gagal:

- Periksa koneksi internet.
- Coba collection **Mock Lab** — request itu dilayani Yosman sendiri, tanpa API eksternal.

## Di mana data disimpan

Workspace (collection, environment, history) ada di:

```
~/.yosman/workspace.json
```

(Windows: `%USERPROFILE%\.yosman\workspace.json`)

File ini tetap ada meski Anda memindahkan app. Log error (jika ada) ada di `~/.yosman/yosman.log`.

## Lanjut

Ikuti [Tutorial](tutorial.md) untuk import Postman, tes otomatis, dan mock server. Referensi lengkap ada di [Panduan](panduan.md).
