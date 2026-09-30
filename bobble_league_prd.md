# Product Requirement Document (PRD) & Game Flow Analysis
**Game Target:** Physics-Based Turn-Based Tabletop Soccer (Multiplayer 2 Tim, 4–8 Pemain)  
**Referensi Utama:** *Bobble League*  
**Versi Dokumen:** v4.1 (Mobile Auto-Landscape & Compact Responsive Specifications)  
**Platform Sasaran:** Web Browser (HTML5/WebGL/WebSockets) & Discord Activity / Desktop

---

## 1. Visi Produk & Ringkasan Konsep

Game ini adalah permainan sepak bola meja (*tabletop soccer*) berbasis fisika dan bergiliran serentak (*simultaneous turn-based*), di mana pertandingan dimainkan oleh **2 Tim** (Tim Merah vs Tim Biru) dengan total **4 hingga 8 pemain manusia secara online**.

### Konsep Karakter Nyata (*Distinct Characters*):
Bukan bidak atau pion generik seragam, lapangan diisi oleh **8 karakter unik** berwujud figurin mainan *bobblehead* dengan kepribadian, bentuk wajah, aksesoris, dan siluet yang berbeda-beda. Semua karakter mengenakan jersey seragam sepak bola resmi yang **warnanya berubah secara dinamis (Merah atau Biru)** sesuai tim yang mereka bela dalam pertandingan.

![Konsep 8 Karakter Bobble League](/C:/Users/alhab/.gemini/antigravity-ide/brain/9691a524-c843-4fc2-9703-0a0dc506e34a/bobble_characters_design_1790736932213.jpg)

---

## 2. Desain 8 Karakter Unik (Roster Pemain)

Setiap karakter memiliki identitas visual kuat, siluet khas agar mudah dikenali dari sudut kamera atas (*isometric top-down*), serta gaya pegas goyang leher (*wobble spring*) yang unik:

| No | Nama Karakter | Spesies / Arketipe | Ciri Visual & Aksesoris | Sifat & Ekspresi | Rekomendasi Posisi Taktis |
| :-: | :--- | :--- | :--- | :--- | :--- |
| **1** | **Rocco** | Badak (*Rhino*) | Cula badak tumpul, *headband* merah/oranye tebal di dahi, anting hidung bulat. | Garang, tahan benturan, mata fokus. | **Anchor / Kiper / Bek Penahan** |
| **2** | **Ziggy** | Kelinci (*Rabbit*) | Telinga panjang elastis, kacamata olahraga (*sport goggles*) di dahi. | Ceria, enerjik, lidah menjulur sedikit. | **Striker / Penyerang Kilat** |
| **3** | **Milo** | Rubah (*Fox*) | Moncong runcing khas, bandana segitiga terikat di leher. | Licik, analitis, senyum penuh taktik sudut. | **Midfielder / Pembuat Assist** |
| **4** | **Boris** | Beruang (*Grizzly*) | Badan gempal kekar, plester luka silang di hidung, bulu dada tebal. | Kalem, intimidatif, tidak goyah ditabrak. | **Defender / Palang Pintu** |
| **5** | **Kiki** | Monyet (*Monkey*) | Rambut mohawk api oranye, telinga lebar, sarung tangan sporty. | Usil, lincah, ekspresi tersenyum lepas. | **Winger / Penyerang Sayap** |
| **6** | **Trixie** | Kucing (*Bengal Cat*) | Telinga runcing tegak, *sweatband* biru di dahi, mata kucing tajam. | Anggun, cepat bereaksi terhadap pantulan. | **Winger / Pemburu Rebound** |
| **7** | **Spike** | Babi Hutan (*Boar*) | Sepasang taring tumpul melengkung, rambut duri mohawk hitam punk. | Agresif, gemar *body check* menghalau lawan. | **Enforcer / Gelandang Bertahan** |
| **8** | **Ollie** | Burung Hantu (*Owl*) | Mata bulat besar dengan kacamata aviator bulat, bulu rapi. | Bijak, kalkulatif, membaca seluruh meja. | **Playmaker / Pengatur Formasi** |

---

## 3. Sistem Jersey Dinamis (Dynamic Team Kits)

Karakter tidak terikat permanen pada satu warna. Sistem material/shader secara otomatis menyesuaikan warna jersey pemain saat masuk ke dalam tim:

```
[ Pilihan Karakter: misal "Ziggy Si Kelinci" ]
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
 [ Masuk Tim Merah ]    [ Masuk Tim Biru ]
  - Baju: Merah Scarlet   - Baju: Biru Royal
  - Aksen: Garis Putih    - Aksen: Garis Putih
  - Base Ring: Merah      - Base Ring: Biru
  - Glow Vektor: Oranye   - Glow Vektor: Cyan
```

1. **Palet Tim Merah (*The Strikers*):**
   - **Warna Utama Jersey:** Merah Scarlet (#E02424) dengan aksen kerah putih/kuning emas.
   - **Piringan Dudukan (Base Disc):** Merah dengan nomor punggung putih menyala.
   - **Vektor Panah Bidikan:** Gradien Merah ke Oranye terang.
2. **Palet Tim Biru (*The Rovers*):**
   - **Warna Utama Jersey:** Biru Royal (#1D4ED8) dengan aksen kerah putih/cyan elektrik.
   - **Piringan Dudukan (Base Disc):** Biru dengan nomor punggung putih menyala.
   - **Vektor Panah Bidikan:** Gradien Biru ke Cyan terang.
3. **Pembeda Pemain Aktif (Current Player Glow):**
   - Karakter yang sedang dikendalikan oleh pemain lokal diberi cincin cahaya emas berdenyut (*pulsing gold highlight ring*) pada alas piringannya, sehingga pemain tidak akan pernah tertukar dengan rekan setimnya.

---

## 4. Alur Permainan (Multiplayer Game Flow 4–8 Pemain)

```mermaid
flowchart TD
    A[Lobby: Host Membuat Room] --> B[Pemain 1 s/d 8 Bergabung via Browser/Discord]
    B --> C[Pemilihan Tim: Tim Merah vs Tim Biru]
    C --> D[Pemilihan Karakter: Pilih 1 dari 8 Karakter Unik]
    D --> D1[Jersey Karakter Otomatis Berubah Warna Tim]
    D1 --> E[Formasi & Kick-off: Bola di Tengah]

    subgraph TurnCycle ["Siklus Turn Simultan (1 - 90 Turns)"]
        E --> F[1. Planning Phase - Timer 12 Detik]
        
        subgraph TeamCoordination ["Koordinasi & Kerahasiaan"]
            F --> F1[8 Pemain Tarik Vektor Panah pada Karakter Sendiri]
            F1 --> F2[Rekan Setim Bisa Melihat Panah Teman]
            F1 -.->|DISSEMBUNYIKAN| F3[Tim Lawan TIDAK BISA Melihat Panah]
            F2 --> F4[Pemain Klik Tombol Ready ✓]
        end
        
        F4 --> G{Semua Pemain Ready ATAU Waktu 12s Habis?}
        G -- Ya --> H[2. Resolution Phase / Aksi Fisika Serentak]
        
        H --> H1[Semua Bidak Meluncur Bersamaan]
        H1 --> H2[Animasi Leher Goyang (Spring Wobble) & Tabrakan Objek]
        H2 --> H3[Semua Bidak & Bola Berhenti]
        
        H3 --> I{Apakah Bola Masuk Gawang?}
        
        I -- Ya --> J[GOL! Selebrasi Karakter & Update Skor]
        J --> K{Kondisi Menang Tercapai? e.g. 3 Gol}
        K -- Belum --> L[Reset Formasi Lapangan]
        L --> F
        
        I -- Tidak --> M{Batas 90 Turn Habis?}
        M -- Tidak --> N[Turn Counter +1]
        N --> F
    end

    K -- Ya --> O[Pertandingan Berakhir]
    M -- Ya --> P{Skor Imbang?}
    P -- Ya --> Q[Sudden Death: 1 Gol Terakhir Menentu]
    Q --> F
    P -- Tidak --> O
    
    O --> R[Layar Skor Akhir: Pose Menang/Kalah Karakter & MVP]
```

---

## 5. Sistem Animasi Prosedural yang Ringan & Smooth (60 FPS Cross-Platform)

Untuk memastikan game berjalan **sangat mulus (60 FPS) tanpa lag di HP entry-level maupun laptop tanpa VGA dedicated**, animasi **TIDAK menggunakan sistem tulang/skeletal rig yang berat**, melainkan **Sistem Pegas Prosedural (Procedural Spring Dynamics)**:

### 5.1 Fisika Leher Pegas (Hooke's Law + Damping)
Kepala karakter terhubung ke badan melalui formula matematika per sederhana:
$$F = -k \cdot x - c \cdot v$$
- $k$ (*Stiffness*): Tingkat kekakuan per (misal: Ziggy memiliki $k$ tinggi/lentur, Boris memiliki $k$ rendah/stabil).
- $c$ (*Damping*): Peredam goyangan agar kepala berhenti bergoyang secara natural setelah 3–5 getaran.
- **Beban CPU/GPU:** Hanya membutuhkan kurang dari **0.05 milidetik per frame** untuk seluruh 8 karakter, hemat baterai ponsel hingga 90% dibanding skeletal animation.

### 5.2 Gerakan Inersia Saat Meluncur & Menabrak
1. **Fase Meluncur (*Launch Drift*):** Kepala karakter condong ke belakang berlawanan arah laju karena hambatan angin (*aerodynamic drag*).
2. **Fase Benturan (*Impact Snap*):** Saat mengenai bola atau dinding, kepala terhentak ke depan secara instan (*snap*), lalu membal ke belakang dengan efek getar elastis.
3. **Fase Diam (*Idle Breathing*):** Kepala bergoyang pelan secara sinusoidal ($sin(t)$) memberi ilusi bahwa karakter hidup dan bernapas saat menunggu turn.

### 5.3 Interpolasi Sudut Bidikan (Smooth Slerp)
Saat pemain menarik garis panah dengan jempol atau mouse, arah hadap badan karakter berputar secara halus menggunakan *Spherical Linear Interpolation (Slerp)* tanpa patah-patah.

---

## 6. Desain Responsif & Antarmuka Kompak (Otomatis Landscape di Mobile)

Game dirancang dengan filosofi **"Zero-Scroll Compact Landscape"**: seluruh arena sepak bola meja membentang horizontal dari gawang kiri ke gawang kanan, persis proporsional dengan layar lanskap ponsel dan monitor desktop.

```
================ LAYOUT DESKTOP / TABLET (WIDESCREEN 16:9) ================
+-------------------------------------------------------------------------+
| [⚡] [ SKOR: 2 ] [TIM MERAH]      [ 14/90 TURNS ]      [TIM BIRU] [ 1 ] [⚙]|
+-------------------------------------------------------------------------+
|                                                                         |
|                          ARENA SEPAK BOLA MEJA                          |
|    [GOAL]                                                     [GOAL]    |
|                (P1) ->          (BOLA)          <- (P5)                 |
|                                                                         |
+-------------------------------------------------------------------------+
| [TIM MERAH ROSTER]          [ ==== 00:08s ==== ]      [TIM BIRU ROSTER] |
|                             [ KUNCI BIDIKAN ✓ ]                         |
+-------------------------------------------------------------------------+

============== LAYOUT SMARTPHONE LANDSCAPE (KOMPAK 19.5:9 / 20:9) ===========
+-------------------------------------------------------------------------+
| (⚡) [2] MERAH           [ T: 14/90 ] [⏱ 08s]           BIRU [1]   (⚙) |
|   +---------------------------------------------------------------+     |
| G |                           ARENA                               | G   |
| O |        (P1) ->            (⚽)             <- (P2)             | O   |
| A |                                                               | A   |
| L +---------------------------------------------------------------+ L   |
| [P1✓ P2✓ P3.. P4✓]             [ READY ✓ ]          [P5✓ P6.. P7✓ P8✓]  |
+-------------------------------------------------------------------------+
```

### 6.1 Sistem Otomatisasi Landscape (Horizontal Mode) di Mobile
Game secara otomatis memastikan pengguna bermain dalam mode horizontal melalui 3 lapis perlindungan teknis:

1. **Screen Orientation Lock API:**
   - Saat game dimuat atau saat pemain melakukan tap pertama (*user interaction*), game langsung mengeksekusi:
     ```javascript
     if (screen.orientation && screen.orientation.lock) {
       screen.orientation.lock('landscape').catch(() => {});
     }
     ```
   - Secara otomatis memutar layar HP menjadi mendatar/horizontal.
2. **Fullscreen Immersive Integration:**
   - Menyembunyikan address bar browser mobile (`document.documentElement.requestFullscreen()`) sehingga game memenuhi 100% layar tanpa gangguan tombol browser.
3. **Smart Orientation Fallback Shield (Overlay "Putar Ponsel"):**
   - Jika pengguna mengunci rotasi otomatis di pengaturan sistem HP (Portrait Lock aktif):
     - Sistem mendeteksi `window.innerHeight > window.innerWidth`.
     - Tampil layar ramah animasi: **"Silakan Putar Ponsel Anda ke Mode Horizontal / Landscape 🔄"** dengan ikon animasi smartphone yang berputar 90 derajat.
     - Disediakan opsi tombol: *"Paksa Putar Otomatis (CSS Rotated Landscape)"* yang merotasi tampilan game 90 derajat secara internal tanpa memaksa setelan OS pemain.
4. **Safe Area Insets (Anti-Notch & Dynamic Island):**
   - Menggunakan CSS variable: `padding-left: max(16px, env(safe-area-inset-left))` dan `padding-right: max(16px, env(safe-area-inset-right))` agar gawang kiri dan kanan tidak terpotong oleh lekukan poni kamera atau sudut layar membulat.

### 6.2 Ergonomi Kontrol Sentuh Smartphone (Mobile-First Touch)
1. **Finger-Offset Aiming:**
   - Titik sentuh dan pangkal panah digeser dengan *offset* 35 pixel di atas jempol. Mata pemain tetap bebas melihat sudut dan panjang panah dengan presisi tanpa terhalang jari.
2. **Thumb-Zone Placement:**
   - Tombol Kunci Bidikan `[ READY ✓ ]` diletakkan di bagian bawah tengah/kanan dengan ukuran besar (**54x54 pixel**) yang sangat mudah ditekan dengan satu jempol tangan kanan saat memegang ponsel horizontal dengan dua tangan.
3. **Haptic Feedback (Getar Mikro):**
   - Ponsel memberikan getaran halus (*light vibration*) saat panah mencapai kekuatan maksimal dan saat terjadi benturan gol.

### 6.3 Kontrol Fleksibel di Desktop
- **Mouse Drag-and-Release:** Tarik mouse ke belakang untuk membidik layaknya ketapel (*slingshot*) atau dorong ke depan sesuai preferensi pemain di menu pengaturan.
- **Keyboard Shortcuts:**
  - `Spasi`: Kunci Bidikan / Konfirmasi Ready `[✓]`.
  - `Tab`: Tampilkan papan detail performa pemain / statistik.
  - `M`: Mute / Nyalakan efek suara.

---

## 7. Optimasi Performa & Ukuran Aset (Tech Benchmarks)

| Parameter | Target Spesifikasi | Strategi Teknis |
| :--- | :--- | :--- |
| **Orientasi Layar** | **Otomatis Landscape (Horizontal)** | `screen.orientation.lock('landscape')` + CSS smart rotation fallback. |
| **Frame Rate** | **60 FPS Konstan** | WebGL hardware acceleration + Procedural spring dynamics tanpa skeletal rig. |
| **Ukuran Bundle Awal** | **< 8 MB** | Tekstur terkompresi (WebP/KTX2) dan model 3D bergaya low-poly minimalis. |
| **Waktu Pemuatan (*Load Time*)** | **< 2 Detik** | Caching browser via Service Worker, game langsung jalan tanpa perlu instalasi. |
| **Konsumsi Memori RAM** | **< 150 MB** | Menjaga memori tetap dingin sehingga ponsel entry-level tidak mengalami *force close*. |
| **Draw Calls per Frame** | **< 25 draw calls** | Instanced mesh rendering untuk arena, bumper, dan piringan karakter. |

---

## 8. Ringkasan Eksekutif

Dengan integrasi **Otomatis Horizontal di Smartphone**, **8 Karakter Unik berjersey dinamis**, **Animasi Prosedural Ringan 60 FPS**, dan **Desain Kompak Zero-Scroll**, game ini siap memberikan pengalaman bermain ala konsol portabel langsung dari browser ponsel maupun monitor komputer desktop.
