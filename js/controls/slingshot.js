/**
 * Kontrol Slingshot & Aiming - BolaBola Pro
 * Mendukung mode Tarik Ketapel (Slingshot Pull-back) dan Dorong Langsung (Direct Push),
 * serta Finger Offset (35px) untuk layar sentuh HP smartphone.
 */
export class SlingshotController {
  constructor({
    canvas,
    getEntities,
    soundFX,
    onAimChange,
    onSelectCharacter,
    aimMode = 'DIRECT', // Default: Arah gerak ditarik langsung dari pemain
    virtualWidth = 960,
    virtualHeight = 540
  }) {
    this.canvas = canvas;
    this.getEntities = getEntities;
    this.soundFX = soundFX;
    this.onAimChange = onAimChange;
    this.onSelectCharacter = onSelectCharacter;
    this.aimMode = aimMode;
    this.virtualWidth = virtualWidth;
    this.virtualHeight = virtualHeight;

    this.selectedChar = null;
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.dragCurrent = { x: 0, y: 0 };

    this.FINGER_OFFSET_Y = 35; // Geser 35px ke atas agar jari tidak menutupi panah
    this.maxPower = 180; // Jarak tarikan panah lebih jauh & bertenaga tinggi
    this.hasTriggeredMaxHaptic = false;
    this.isControlsLocked = false;

    this.bindEvents();
  }

  setAimMode(mode) {
    this.aimMode = mode;
  }

  setLock(locked) {
    this.isControlsLocked = locked;
    if (locked) {
      this.isDragging = false;
      this.selectedChar = null;
    }
  }

  getCanvasCoords(clientX, clientY, isTouch = false) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: 0, y: 0 };

    // Konversi langsung dari piksel layar client ke koordinat virtual lapangan 960x540
    const scaleX = this.virtualWidth / rect.width;
    const scaleY = this.virtualHeight / rect.height;

    const offsetY = isTouch ? this.FINGER_OFFSET_Y : 0;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top - offsetY) * scaleY
    };
  }

  bindEvents() {
    // === MOUSE EVENTS (DESKTOP) ===
    this.canvas.addEventListener('mousedown', (e) => this.handleStart(e.clientX, e.clientY, false));
    window.addEventListener('mousemove', (e) => this.handleMove(e.clientX, e.clientY, false));
    window.addEventListener('mouseup', () => this.handleEnd());

    // === TOUCH EVENTS (SMARTPHONE MOBILE) ===
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        const t = e.touches[0];
        this.handleStart(t.clientX, t.clientY, true);
        e.preventDefault();
      }
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (this.isDragging && e.touches.length > 0) {
        const t = e.touches[0];
        this.handleMove(t.clientX, t.clientY, true);
        e.preventDefault();
      }
    }, { passive: false });

    window.addEventListener('touchend', () => this.handleEnd());
    window.addEventListener('touchcancel', () => this.handleEnd());
  }

  handleStart(clientX, clientY, isTouch) {
    if (this.isControlsLocked) return;

    const pos = this.getCanvasCoords(clientX, clientY, isTouch);
    const entities = this.getEntities();

    // Deteksi tim pemain aktif secara dinamis
    const userChar = entities.find(e => e.isUser);
    const userTeam = userChar ? userChar.team : (this.selectedChar ? this.selectedChar.team : 'RED');

    // 1. Cek apakah pemain menyentuh karakter miliknya atau karakter manapun di timnya
    for (let char of entities) {
      const isMyTeam = char.team === userTeam;
      if (isMyTeam) {
        const dist = Math.hypot(pos.x - char.x, pos.y - char.y);
        if (dist <= char.radius + 30) {
          // Jadikan karakter ini sebagai karakter aktif
          if (!char.isUser) {
            entities.forEach(e => {
              if (e.team === char.team) e.isUser = false;
            });
            char.isUser = true;
          }
          this.selectedChar = char;
          this.isDragging = true;
          this.dragStart = { x: char.x, y: char.y };
          this.dragCurrent = { x: pos.x, y: pos.y };
          this.hasTriggeredMaxHaptic = false;

          if (this.onSelectCharacter) this.onSelectCharacter(char);
          if (this.soundFX) this.soundFX.playBoing(1.2);
          return;
        }
      }
    }
  }

  handleMove(clientX, clientY, isTouch) {
    if (!this.isDragging || !this.selectedChar || this.isControlsLocked) return;

    const pos = this.getCanvasCoords(clientX, clientY, isTouch);
    this.dragCurrent = pos;

    let dx, dy;
    if (this.aimMode === 'SLINGSHOT') {
      // Slingshot: Tarik ke belakang berlawanan arah laju tembakan
      dx = this.dragStart.x - this.dragCurrent.x;
      dy = this.dragStart.y - this.dragCurrent.y;
    } else {
      // Direct Aim: Dorong mouse ke depan menuju target
      dx = this.dragCurrent.x - this.dragStart.x;
      dy = this.dragCurrent.y - this.dragStart.y;
    }

    const distance = Math.hypot(dx, dy);

    // Panah HANYA muncul jika pemain benar-benar menarik melebihi batas 10px (bukan klik diam)
    if (distance >= 10) {
      const power = Math.min(distance, this.maxPower);
      const angle = Math.atan2(dy, dx);

      this.selectedChar.aimAngle = angle;
      this.selectedChar.aimPower = power;
      this.selectedChar.facingAngle = angle;
      this.selectedChar.isAiming = true;

      // Getaran haptic mikro saat mencapai daya maksimal
      if (power >= this.maxPower && !this.hasTriggeredMaxHaptic) {
        this.hasTriggeredMaxHaptic = true;
        if (this.soundFX) this.soundFX.triggerHaptic(30);
      } else if (power < this.maxPower * 0.88) {
        this.hasTriggeredMaxHaptic = false;
      }

      if (this.onAimChange) {
        this.onAimChange(this.selectedChar);
      }
    } else {
      // Jika ditarik kembali ke tengah, hilangkan panah bidikan
      this.selectedChar.isAiming = false;
      this.selectedChar.aimPower = 0;
    }
  }

  handleEnd() {
    if (!this.isDragging || !this.selectedChar) return;

    this.isDragging = false;
    // Jika tarikan kurang dari 12px (hanya tap tanpa drag), jangan tampilkan panah
    if (this.selectedChar.aimPower < 12) {
      this.selectedChar.isAiming = false;
      this.selectedChar.aimPower = 0;
    }
  }

  setSelectedCharacter(char) {
    this.selectedChar = char;
  }
}
