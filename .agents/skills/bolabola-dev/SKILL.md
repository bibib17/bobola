---
name: bolabola-dev
description: >-
  Panduan dan cheatsheet rekayasa lengkap untuk mengembangkan game BolaBola (game sepak bola meja berbasis fisika turn-based simultan bergaya Bobble League).
  Gunakan skill ini saat mengimplementasikan fitur, arsitektur fisika, 8 karakter unik bobblehead dengan jersey dinamis (Merah vs Biru), animasi pegas prosedural 60 FPS yang ringan, kontrol sentuh slingshot mobile, otomatisasi orientasi landscape, dan sinkronisasi multiplayer 4-8 pemain.
---

# BolaBola Game Development Skill & Runbook

Skill ini memuat instruksi, formula matematika, arsitektur kode, dan pola desain untuk membangun **BolaBola** — game turn-based physics tabletop soccer multiplayer (2 Tim, 4–8 Pemain) yang dioptimasi untuk Mobile (Auto-Landscape) dan Desktop.

Dokumen PRD acuan lengkap: [bobble_league_prd.md](../../bobble_league_prd.md).

---

## 1. Arsitektur Proyek & Tech Stack

```text
bolabola/
├── .agents/skills/bolabola-dev/SKILL.md  # Skill ini
├── bobble_league_prd.md                 # PRD Master
├── index.html                           # Entry point game
├── css/
│   └── style.css                        # Styling kompak, safe areas, overlay rotasi
├── js/
│   ├── main.js                          # Inisialisasi game loop & canvas
│   ├── physics/
│   │   ├── engine.js                    # Simulasi fisika meja, bumper, & bola
│   │   └── spring.js                    # Formula Hooke's Law leher karakter
│   ├── entities/
│   │   ├── character.js                 # 8 Karakter & sistem shader jersey dinamis
│   │   └── ball.js                      # Fisika & pantulan bola
│   ├── controls/
│   │   ├── slingshot.js                 # Kontrol bidik sentuh (finger offset) & mouse
│   │   └── orientation.js               # Auto-landscape & fullscreen API
│   └── network/
│       └── turnManager.js               # State machine turn simultan & lock-in
└── assets/
    └── images/                          # Tekstur & sprite karakter
```

---

## 2. Modul Fisika Pegas Prosedural (Procedural Wobble)

Karakter **tidak menggunakan skeletal bone rig**. Semua animasi goyangan kepala boneka (*bobblehead*) dijalankan dengan komputasi matematis per (*Hooke's Law with Damping*):

### Formula Matematika:
$$F = -k \cdot x - c \cdot v$$
$$a = \frac{F}{m}$$
$$v_{new} = v + a \cdot \Delta t$$
$$x_{new} = x + v_{new} \cdot \Delta t$$

### Implementasi Snippet (`js/physics/spring.js`):
```javascript
export class WobbleSpring {
  constructor({ stiffness = 120, damping = 8, mass = 1.0 }) {
    this.k = stiffness;  // Kekakuan per (k)
    this.c = damping;    // Peredam getaran (c)
    this.m = mass;       // Bobot kepala
    this.angle = 0;      // Deviasi rotasi saat ini
    this.velocity = 0;   // Kecepatan sudut
    this.target = 0;     // Posisi netral istirahat
  }

  update(dt) {
    const force = -this.k * (this.angle - this.target) - this.c * this.velocity;
    const accel = force / this.m;
    this.velocity += accel * dt;
    this.angle += this.velocity * dt;
  }

  applyImpulse(impactForce) {
    this.velocity += impactForce / this.m;
  }
}
```

---

## 3. Roster 8 Karakter & Shader Jersey Dinamis

### Spesifikasi Karakter:
1. **Rocco (Badak):** Headband merah, cula tumpul, pegas berat ($k=90, c=10$).
2. **Ziggy (Kelinci):** Kacamata goggle, telinga panjang, pegas lentur ($k=160, c=6$).
3. **Milo (Rubah):** Bandana segitiga di leher, ekspresi senyum licik ($k=130, c=8$).
4. **Boris (Beruang):** Plester luka di hidung, siluet gempal, pegas kaku ($k=80, c=12$).
5. **Kiki (Monyet):** Mohawk api oranye, telinga lebar ($k=150, c=7$).
6. **Trixie (Kucing):** Sweatband dahi, mata tajam ($k=140, c=7$).
7. **Spike (Babi Hutan):** Taring melengkung, duri mohawk punk ($k=110, c=9$).
8. **Ollie (Burung Hantu):** Kacamata aviator bulat, mata besar ($k=100, c=9$).

### Logika Warna Jersey Dinamis:
```javascript
export const TEAM_PALETTES = {
  RED: {
    name: 'The Strikers',
    primary: '#E02424',
    secondary: '#FDF2F2',
    accent: '#F59E0B',
    vectorGradient: ['#EF4444', '#F97316'],
    baseDisc: '#991B1B'
  },
  BLUE: {
    name: 'The Rovers',
    primary: '#1D4ED8',
    secondary: '#EFF6FF',
    accent: '#06B6D4',
    vectorGradient: ['#3B82F6', '#06B6D4'],
    baseDisc: '#1E3A8A'
  }
};
```

---

## 4. Mekanisme Kontrol Slingshot & Finger Offset

Untuk mengatasi jari jempol yang menutupi anak panah bidikan di layar HP:

```javascript
export class SlingshotController {
  constructor(canvas, character) {
    this.canvas = canvas;
    this.target = character;
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.dragCurrent = { x: 0, y: 0 };
    this.FINGER_OFFSET_Y = 35; // Geser 35px di atas posisi jempol

    this.bindEvents();
  }

  getTouchPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const touch = e.touches[0] || e.changedTouches[0];
    return {
      x: touch.clientX - rect.left,
      y: (touch.clientY - rect.top) - this.FINGER_OFFSET_Y
    };
  }

  calculateVector() {
    const dx = this.dragStart.x - this.dragCurrent.x;
    const dy = this.dragStart.y - this.dragCurrent.y;
    const distance = Math.hypot(dx, dy);
    const maxPower = 120;
    const power = Math.min(distance, maxPower);
    const angle = Math.atan2(dy, dx);

    return { angle, power, normalized: power / maxPower };
  }
}
```

---

## 5. Sistem Otomatisasi Landscape (Horizontal) di Mobile

### File: `js/controls/orientation.js`
```javascript
export function enforceAutoLandscape() {
  // 1. Kunci orientasi jika didukung
  if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock('landscape').catch(() => {
      console.log('Auto-orientation lock not allowed without user gesture.');
    });
  }

  // 2. Deteksi status portrait/landscape
  const checkOrientation = () => {
    const isPortrait = window.innerHeight > window.innerWidth;
    const shield = document.getElementById('orientation-shield');
    if (shield) {
      shield.style.display = isPortrait ? 'flex' : 'none';
    }
  };

  window.addEventListener('resize', checkOrientation);
  window.addEventListener('orientationchange', checkOrientation);
  checkOrientation();
}
```

### Safe Area CSS di Mobile:
```css
/* Hindari poni kamera / notch dan sudut melengkung */
.game-container {
  padding-left: max(16px, env(safe-area-inset-left));
  padding-right: max(16px, env(safe-area-inset-right));
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}
```

---

## 6. Siklus Giliran Simultan & Protokol Multiplayer (2 Tim, 4-8 Pemain)

1. **Planning Phase (12 Detik):**
   - 8 pemain menerima event `START_PLANNING`.
   - Masing-masing pemain membidik bidak miliknya.
   - Pemain mengirim pesan input vektor ke WebSocket:
     `{ type: 'AIM_UPDATE', playerId, angle, force }`
   - Rekan satu tim saling melihat vektor bidikan teman (*intra-team visibility*).
   - Vektor tim lawan disembunyikan (*fog-of-aim*).
2. **Lock-In:**
   - Pemain menekan tombol `Ready [✓]`.
   - Jika ke-8 pemain sudah ready atau timer 12 detik habis, server mengunci turn.
3. **Resolution Phase (Eksekusi Serentak 3-4 Detik):**
   - Server memancarkan paket aksi tunggal:
     ```json
     {
       "turn": 1,
       "actions": [
         { "bobbleId": "P1_ROCCO", "angle": 0.45, "force": 80 },
         { "bobbleId": "P2_ZIGGY", "angle": 1.20, "force": 95 },
         ...
       ]
     }
     ```
   - Semua klien menjalankan simulasi fisika langkah demi langkah dengan *fixed delta-time* (60 Hz).
4. **Goal / End Turn Check:**
   - Cek apakah bola melewati garis gawang `x < goalLeft || x > goalRight`.
   - Jika gol: Putar selebrasi animasi kepala bobblehead, tambah skor, dan reset posisi formasi kick-off.
   - Jika tidak: Tambah giliran `turnCounter++` dan mulai planning turn berikutnya hingga target gol atau 90 turn tercapai.

---

## 7. Instruksi Bagi Agent Saat Mengembangkan Kode

Ketika diminta membuat atau memodifikasi kode proyek:
1. Selalu pastikan ukuran arena tetap **kompak dalam 1 layar tanpa scroll**.
2. Pertahankan **standarisasi diameter piringan (base disc)** agar karakter seimbang secara kompetitif.
3. Selalu uji bahwa tombol dan tarikan slingshot memiliki **offset jari** agar ramah layar sentuh HP.
4. Gunakan **warna dinamis Red vs Blue** untuk seragam dan piringan karakter.
