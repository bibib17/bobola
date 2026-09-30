# ⚡ BolaBola League

**Game Sepak Bola Meja Fisika Turn-Based Simultan (Inspirasi: Bobble League)**  
*HTML5 Canvas • Pure Vanilla ES Modules • Procedural Spring Physics 60 FPS • WebSockets Multiplayer*

---

## 🎮 Fitur Utama

- **Fisika Pegas Prosedural 60 FPS (Zero Skeletal Drag)**: Kepala koin berguncang dinamis dengan hukum elastisitas Hooke dan redaman inersia tanpa memberatkan CPU/GPU.
- **8 Karakter Koin Simbolik & Jersey Dinamis**:
  - **Tim Merah (The Strikers)** vs **Tim Biru (The Rovers)**.
  - Warna jersey dan glow panah otomatis berganti sesuai tim yang dibela.
  - 8 Roster Unik: Rocco (#8), Ziggy (#5), Milo (#6), Boris (#7), Kiki (#3), Trixie (#1), Spike (#4), Ollie (#2).
- **Kontrol Bidik Fleksibel**:
  - **Mode Tarik dari Pemain (Direct Push)** & **Mode Ketapel (Inverted Slingshot)**.
  - Kuadratik akselerasi: makin jauh ditarik, kecepatan melesat semakin kencang (+90% max boost).
  - Multi-Aim Solo: kendalikan dan arahkan semua 4 koin tim secara bebas sebelum menekan READY.
  - Finger Offset 35px & haptic vibration feedback untuk smartphone.
- **Sistem Power Buff Acak (Spawn 1 per 1)**:
  - 🛡️ *Tahan Tabrakan Lawan (Iron Body)*
  - 🌀 *Tendangan Melengkung (Banana Curve Shot)*
  - ⚡ *Kebal Halangan (Ghost Phase)*
  - 🚀 *More Speed (Nitro Rocket +75%)*
  - 🎯 *More Akurasi (Laser Guide Beam)*
  - 🧱 *Obstacle Penghalang (Deploy Bumper Rintangan)*
  - Efek diterapkan di giliran berikutnya pada koin yang mengambil buff!
- **3 Mode Permainan**:
  1. 🤖 **Solo Match vs AI**: Lawan 7 bot cerdas dengan kalkulasi taktis gawang dan bek.
  2. 👥 **Pass & Play (2 Pemain)**: Main berdua bergantian di 1 layar HP/Tablet/Laptop.
  3. 🌐 **Online Room (Multiplayer)**: Ruang tunggu lobby interaktif, slot tim Merah vs Biru, pemilihan koin bersama teman via WebSockets.
- **Auto-Landscape Smart Adaptation**: Tampilan kompak proporsional dengan proteksi otomatis rotasi layar.

---

## 🚀 Cara Menjalankan

### 1. Main Lokal / Singleplayer
Cukup buka `index.html` langsung di browser Anda atau gunakan local server apa saja (Live Server, XAMPP, Nginx).

### 2. Jalankan Server Multiplayer (Node.js)
```bash
node server.js
```
Server akan aktif di `http://localhost:3000`.

---

## 🌐 Deploy ke Cloud (Render / Railway)

1. Push repository ini ke GitHub.
2. Buat Web Service di **Render.com** atau **Railway.app**.
3. Set Start Command: `node server.js`.
4. Domain online langsung siap dimainkan bersama teman dari seluruh dunia!

---
Lisensi: MIT
