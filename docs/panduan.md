# Panduan Yosman

Referensi fitur. Untuk instalasi lihat [Getting started](getting-started.md). Untuk alur langkah demi langkah lihat [Tutorial](tutorial.md).

## Builder

Editor request aktif.

| Kontrol | Keterangan |
| --- | --- |
| Nama | Label di tab dan sidebar |
| Method | GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS |
| URL | Boleh berisi `{{variabel}}` |
| **Send** | Kirim request (`Ctrl+Enter`) |
| **Saved** | Workspace disimpan otomatis; tombol ini memaksa simpan |

### Tab request

**Params** — query string. Baris yang tidak dicentang tidak dikirim.

**Auth**

| Tipe | Perilaku |
| --- | --- |
| No Auth | Tidak menambah kredensial |
| Bearer Token | Header `Authorization: Bearer …` |
| Basic Auth | Header Basic (username/password) |
| API Key | Header atau query, sesuai **Add to** |

**Headers** — pasangan key/value. Content-Type diisi otomatis untuk JSON, urlencoded, dan multipart.

**Body**

| Tipe | Kapan dipakai |
| --- | --- |
| None | GET/HEAD, atau tanpa payload |
| JSON | Object/array; tombol **Format JSON** merapikan |
| Raw | Teks bebas |
| x-www-form-urlencoded | Satu `key=value` per baris |
| multipart/form-data | Satu `key=value` per baris, dikirim sebagai multipart |

**Scripts** — JavaScript pre-request dan tes. Lihat bagian [Tes](#tes-javascript).

**Mock** — status, delay (ms), dan body yang dikembalikan mock server jika diaktifkan.

**Description** — teks yang muncul di tampilan Docs.

### Panel response

- Badge status berwarna (2xx hijau, 3xx biru, 4xx kuning, 5xx merah)
- Waktu (ms) dan ukuran body
- **Pretty / Raw / Preview** — Preview merender HTML di iframe terisolasi
- **Headers** — semua header response
- **Tests** — hasil `pm.test`

## Collections

Struktur pohon: collection → folder → request.

Klik kanan:

| Item | Aksi |
| --- | --- |
| Collection | New request, New folder, Import cURL, Rename, Export, Delete |
| Folder | New request, Import cURL, Rename, Delete |
| Request | Duplicate, Rename, Delete |

Pencarian di sidebar memfilter nama, method, dan URL.

## Environments

Tampilan **Environments**: daftar set variabel. Environment aktif dipilih di header.

Nama variabel hanya huruf, angka, dan underscore yang umum; dipanggil sebagai `{{baseUrl}}`.

Collection yang diimport dari Postman sering membawa `baseUrl` — Yosman membuat environment `{nama collection} vars` dan mengaktifkannya.

## Runner

Menjalankan **semua request** dalam collection, urutan DFS (folder lalu isinya). Pre-request dan tes ikut dieksekusi. Variabel yang di-set skrip berlaku untuk request berikutnya dalam run yang sama.

## Docs

Dokumentasi dibangun dari nama, method, URL, description, auth, body contoh, dan apakah ada tes. **Print / save PDF** memakai dialog cetak sistem.

## Mock server

Selama Yosman berjalan, mock tersedia di:

```
http://127.0.0.1:<port>/mock/<collection-id>/<path>
```

`<port>` sama dengan port jendela (biasanya 8765, atau berikutnya jika sedang dipakai).

Matching: method HTTP + path URL request (setelah interpolasi `{{origin}}` / `{{baseUrl}}`). Segmen `{{variabel}}` atau `:id` diperlakukan sebagai wildcard.

Delay dibatasi maksimal 10 detik.

## Import dan export

### Postman Collection v2.1

File `*.postman_collection.json`. Folder, request, header, query, auth, body, event scripts, variabel collection, dan saved example (→ mock) diimpor. Collection tidak menimpa workspace yang ada; ditambahkan di sidebar.

### Postman Environment

File dengan `_postman_variable_scope: environment` atau daftar `values`.

### cURL

Mendukung flag umum: `-X` / `--request`, `-H` / `--header`, `-d` / `--data` / `--data-raw`, `--data-urlencode`, `-F` / `--form`, `--json`, `-u` / `--user`, `--oauth2-bearer`, `-G`, `-I`, `--url`, plus line continuation `\`, `` ` ``, dan `^`.

### Workspace Yosman

**Export workspace** menghasilkan JSON berisi semua collection dan environment. Import file yang sama menimpa workspace saat ini.

## Tes JavaScript

Objek `pm`:

```javascript
pm.test("nama", function () { ... });
pm.expect(nilai).to.equal(x);
pm.response.code
pm.response.responseTime
pm.response.json()
pm.response.text()
pm.response.headers
pm.environment.get("key")
pm.environment.set("key", "value")
```

Skrip berjalan di sandbox browser (bukan di server). Jangan mengandalkan `fetch` ke host sewenang-wenang dari skrip tes; kirim HTTP lewat request Yosman.

## Shortcut

| Kunci | Aksi |
| --- | --- |
| `Ctrl+Enter` | Kirim request aktif, atau import di dialog cURL |
| `Esc` | Tutup dialog cURL |

## Data dan log

| Path | Isi |
| --- | --- |
| `~/.yosman/workspace.json` | Collection, environment, history |
| `~/.yosman/yosman.log` | Log jika app gagal menulis ke konsol |
| `~/.yosman/webview2/` | Data WebView2 di Windows (cache jendela) |

(Windows: ganti `~` dengan `%USERPROFILE%`.)

Menghapus `workspace.json` mengembalikan collection contoh saat aplikasi dibuka lagi.

## Build executable

**macOS**

```bash
./build.sh
```

Hasil: `dist/Yosman.app`.

**Windows**

```powershell
.\build.bat
```

Hasil: `dist\Yosman.exe` (satu file). Python dan folder project tidak diperlukan di mesin tujuan.

## Troubleshooting

**Jendela tidak muncul** — pastikan WebView2 terpasang (komponen Edge). Cek `yosman.log`.

**Request timeout / gagal SSL** — API tujuan harus reachable dari PC Anda. Mock Lab tidak butuh internet.

**Import Postman gagal** — export sebagai Collection v2.1 JSON, bukan v2.0 dump atau HTML.

**Port 8765 dipakai** — Yosman memilih port bebas berikutnya (sampai 8794). URL mock di tampilan Mock selalu menampilkan origin yang benar.

**cURL tidak ter-parse** — perintah harus diawali `curl` atau `curl.exe`. Tempel utuh, termasuk quote.
