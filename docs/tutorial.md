# Tutorial Yosman

Tutorial ini mengikuti satu alur kerja nyata: kirim request, pakai variabel, tulis tes, import dari Postman/cURL, jalankan collection, lalu hidupkan mock.

Asumsi: Yosman sudah terbuka. Jika belum, baca [Getting started](getting-started.md).

---

## 1. Kirim GET dan baca response

1. Buka **JSONPlaceholder → Posts → List posts**.
2. Klik **Send**.
3. Di panel Response, tab **Body** menampilkan JSON yang di-format. **Headers** menampilkan header HTTP. **Tests** menampilkan hasil skrip.

Ganti ke **Get post**. URL-nya `{{baseUrl}}/posts/{{postId}}`. Environment Development mengisi `postId` dengan `1`, jadi request menuju `/posts/1`.

---

## 2. Ganti environment

Di kanan atas, ganti **Env** dari Development ke **Staging**.

`postId` di Staging bernilai `2`. Kirim **Get post** lagi — id di response harus `2`.

Buka tampilan **Environments** untuk menambah variabel, misalnya `token` atau `apiKey`. Variabel dipakai dengan sintaks `{{nama}}` di URL, query, header, dan body.

Variabel bawaan (tidak perlu didefinisikan):

| Variabel | Isi |
| --- | --- |
| `{{origin}}` | Origin Yosman, misalnya `http://127.0.0.1:8765` |
| `{{$timestamp}}` | Unix time |
| `{{$isoTimestamp}}` | Waktu ISO-8601 |
| `{{$guid}}` | UUID acak |
| `{{$randomInt}}` | Integer 0–999 |

---

## 3. Buat request sendiri

1. Klik **+** di sidebar, beri nama collection misalnya `My API`.
2. Request kosong terbuka. Isi:
   - Method: `POST`
   - URL: `{{baseUrl}}/posts`
   - Tab **Body**: pilih **JSON**, lalu:

```json
{
  "title": "Dari Yosman",
  "body": "Request buatan sendiri",
  "userId": 1
}
```

3. Tab **Auth** jika perlu: Bearer, Basic, atau API Key.
4. **Send**. JSONPlaceholder mengembalikan `201` dan men-echo body.

Klik kanan collection untuk **New folder**, **New request**, rename, atau hapus.

---

## 4. Tulis tes otomatis

Buka tab **Scripts** pada request. Contoh tes:

```javascript
pm.test("Status is 201", function () {
  pm.expect(pm.response.code).to.equal(201);
});

pm.test("Echoes the title", function () {
  const body = pm.response.json();
  pm.expect(body).to.have.property("title");
  pm.expect(body.title).to.equal("Dari Yosman");
});

pm.test("Cukup cepat", function () {
  pm.expect(pm.response.responseTime).to.be.below(4000);
});
```

Pre-request (panel kiri di Scripts) berjalan **sebelum** request dikirim:

```javascript
pm.environment.set("stamp", Date.now());
```

Setelah **Send**, tab **Tests** di Response menampilkan PASS/FAIL.

Assertion yang didukung: `.to.equal`, `.to.eql`, `.to.be.ok()`, `.to.be.true()`, `.to.be.above`, `.to.be.below`, `.to.have.property`, `.to.include`, `.to.be.a("string")`, plus `.not`.

---

## 5. Jalankan seluruh collection

1. Buka **Runner**.
2. Pilih collection **JSONPlaceholder**.
3. Klik **Run collection**.

Yosman mengeksekusi setiap request berurutan: pre-request → kirim → tes. Kartu hasil menampilkan status, waktu, dan tes per request.

Pakai ini sebagai smoke test sebelum ganti environment ke production.

---

## 6. Import collection Postman

1. Di sidebar klik **↑**.
2. Pilih file `*.postman_collection.json` (contoh: export Collection v2.1 dari Postman).
3. Collection muncul di sidebar. Jika file punya `variable` (misalnya `baseUrl`), Yosman membuat environment baru dan mengaktifkannya.

Yang ikut ter-map: folder bersarang, method, URL, query, header, auth, body JSON/urlencoded/form-data, skrip tes, dan contoh response (jadi mock).

File `*.postman_environment.json` juga bisa diimport dari tombol yang sama.

---

## 7. Import dari cURL

Tiga cara:

- Tombol **cURL** di sidebar
- Klik kanan collection/folder → **Import cURL**
- Tempel perintah yang diawali `curl` ke kolom URL

Contoh:

```bash
curl --location "https://jsonplaceholder.typicode.com/posts/1" \
  --header "Accept: application/json"
```

Klik **Import request**. Method, URL, query, header, body, dan Bearer/Basic auth ikut terisi.

Di dialog import, `Ctrl+Enter` mengimpor, `Esc` menutup.

---

## 8. Mock API sebelum backend jadi

Collection **Mock Lab** sudah siap.

1. Buka tampilan **Mock**.
2. Salin base URL, bentuknya `http://127.0.0.1:<port>/mock/col_mock`.
3. Buka **List mock users** di Builder, klik **Send**.

Response `200` berisi daftar user fiktif — dilayani Yosman, bukan server lain.

Untuk request Anda sendiri:

1. Buka tab **Mock** pada request.
2. Centang **Enable mock**.
3. Isi status, delay (opsional), dan body.
4. Path mock mengikuti path URL request setelah `/mock/<id-collection>/`.

Frontend atau mobile bisa menunjuk ke URL mock itu selama Yosman masih berjalan.

---

## 9. Dokumentasi interaktif

1. Buka **Docs**.
2. Pilih collection.
3. Tiap endpoint menampilkan method, URL, deskripsi, contoh body, dan tombol **Open in builder**.

**Print / save PDF** memakai dialog cetak Windows — pilih "Microsoft Print to PDF" untuk file PDF.

Isi tab **Description** pada tiap request agar dokumentasi bermanfaat untuk tim.

---

## 10. History dan export

- **History** (kanan atas) — request yang baru dikirim. Klik item untuk membukanya lagi.
- **Export workspace** di kaki sidebar — cadangan seluruh collection + environment.
- Klik kanan collection → **Export** — satu collection (JSON Yosman).

---

## Lanjut

Lihat [Panduan](panduan.md) untuk daftar tab request, tipe auth, format body, dan shortcut.
