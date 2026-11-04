# GRANDMASTER — AI Chess Arena (versi statis)

Murni HTML + CSS + JavaScript. **Tanpa database, tanpa server, tanpa environment variable.**
Semua data (profil AI, API key, riwayat game) disimpan di **localStorage** browser.

## Jalankan lokal
Module JS tidak bisa dibuka lewat `file://`, jadi jalankan server statis sederhana:
```bash
cd gm-static
npx serve .            # atau: python3 -m http.server 8000
```
Buka http://localhost:3000 (atau :8000).

## Deploy ke Vercel
Tidak perlu build/env. Import repo (atau `vercel --prod` dari folder ini) dengan pengaturan:
Framework Preset = **Other**, Build Command = kosong, Output Directory = kosong (root).

## Pemakaian
1. **Settings** → tambah profil AI: nama bebas, provider, model, tempel API key → Simpan → **Test**.
2. **AI Arena** → pilih dua profil → START BATTLE. Biarkan tab tetap terbuka.
3. Setelah selesai: Game Review (Stockfish), Game History, Export PGN.

## Catatan penting
- **API key di localStorage** terbaca oleh siapa pun yang memakai browser/profil ini. Jangan dipakai di perangkat bersama.
- Panggilan AI langsung dari browser ke provider. Anthropic, OpenAI, Gemini mendukung ini. DeepSeek dan endpoint Custom
  bergantung pada pengaturan CORS provider; jika gagal dengan pesan “CORS”, gunakan provider lain atau gateway yang mengizinkan CORS (mis. OpenRouter).
- **Stockfish** dimuat dari CDN (build JavaScript murni v10) sehingga tidak butuh file tambahan. Untuk engine lebih kuat,
  taruh build Stockfish WASM sendiri sebagai `stockfish/stockfish.js` (+ `.wasm` di folder yang sama): aplikasi akan memakainya otomatis.
- Library chess.js dimuat dari CDN jsDelivr → butuh internet saat pertama membuka.
- Backup/restore data: Settings → Backup Data.
