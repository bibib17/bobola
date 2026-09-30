/**
 * Kontrol Slingshot & Touch Aiming - BolaBola Pro
 * Sistem kontrol sentuh responsif & presisi tinggi untuk smartphone mobile & desktop:
 * - Menggunakan delta jarak relatif dari titik sentuh pertama (zero phantom jump).
 * - Area sentuh koin luas (hitbox cerdas berbasis jarak terdekat).
 * - Dukungan Direct Push & Inverted Slingshot.
 * - Multi-touch safety (identifikasi sentuhan unik).
 * - Dukungan auto-transform saat mode landscape dipaksa via CSS.
 */
export class SlingshotController {
  constructor({
    canvas,
    getEntities,
    soundFX,
    onAimChange,
    onSelectCharacter,
    aimMode = 'DIRECT', // Default: Direct Push (dorong ke arah tembakan)
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
    this.touchStart = { x: 0, y: 0 };
    this.dragCurrent = { x: 0, y: 0 };
    this.activeTouchId = null;

    this.maxPower = 180; // Jarak tarikan maksimal
    this.DEADZONE = 6;   // Deadzone kecil agar tap biasa tidak mengacaukan arah
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
      this.activeTouchId = null;
      this.selectedChar = null;
    }
  }

  getCanvasCoords(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: 0, y: 0 };

    const appContainer = document.getElementById('game-wrapper');
    const isForced = appContainer && appContainer.classList.contains('forced-landscape');

    if (isForced) {
      // Un-rotate -90deg rotation jika mode paksa putar aktif
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const offX = clientX - cx;
      const offY = clientY - cy;

      const unrotX = offY;
      const unrotY = -offX;

      const scaleX = this.virtualWidth / rect.height;
      const scaleY = this.virtualHeight / rect.width;

      return {
        x: Math.max(0, Math.min(this.virtualWidth, (this.virtualWidth / 2) + unrotX * scaleX)),
        y: Math.max(0, Math.min(this.virtualHeight, (this.virtualHeight / 2) + unrotY * scaleY))
      };
    }

    // Koordinat normal layar
    const scaleX = this.virtualWidth / rect.width;
    const scaleY = this.virtualHeight / rect.height;

    return {
      x: Math.max(0, Math.min(this.virtualWidth, (clientX - rect.left) * scaleX)),
      y: Math.max(0, Math.min(this.virtualHeight, (clientY - rect.top) * scaleY))
    };
  }

  bindEvents() {
    // === MOUSE EVENTS (DESKTOP) ===
    this.canvas.addEventListener('mousedown', (e) => {
      this.handleStart(e.clientX, e.clientY);
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        this.handleMove(e.clientX, e.clientY);
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.handleEnd();
      }
    });

    // === TOUCH EVENTS (SMARTPHONE MOBILE) ===
    this.canvas.addEventListener('touchstart', (e) => {
      if (this.isControlsLocked) return;
      if (e.changedTouches.length > 0 && this.activeTouchId === null) {
        const t = e.changedTouches[0];
        const started = this.handleStart(t.clientX, t.clientY);
        if (started) {
          this.activeTouchId = t.identifier;
        }
        if (e.cancelable) e.preventDefault();
      }
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (!this.isDragging || this.activeTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === this.activeTouchId) {
          this.handleMove(t.clientX, t.clientY);
          if (e.cancelable) e.preventDefault();
          break;
        }
      }
    }, { passive: false });

    const handleTouchDone = (e) => {
      if (!this.isDragging || this.activeTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === this.activeTouchId) {
          this.activeTouchId = null;
          this.handleEnd();
          break;
        }
      }
    };

    window.addEventListener('touchend', handleTouchDone);
    window.addEventListener('touchcancel', handleTouchDone);
  }

  handleStart(clientX, clientY) {
    if (this.isControlsLocked) return false;

    const pos = this.getCanvasCoords(clientX, clientY);
    const entities = this.getEntities();

    // Deteksi tim pemain aktif
    const userChar = entities.find(e => e.isUser);
    const userTeam = userChar ? userChar.team : (this.selectedChar ? this.selectedChar.team : 'RED');

    // Cari karakter tim yang paling dekat dengan titik sentuhan jari
    let closestChar = null;
    let minDistance = Infinity;
    const touchRadiusThreshold = 75; // Hitbox sentuhan jari luas & nyaman di HP (radius ~75px virtual)

    for (let char of entities) {
      if (char.team === userTeam) {
        const dist = Math.hypot(pos.x - char.x, pos.y - char.y);
        if (dist <= char.radius + touchRadiusThreshold && dist < minDistance) {
          minDistance = dist;
          closestChar = char;
        }
      }
    }

    if (closestChar) {
      // Jadikan karakter ini sebagai karakter aktif
      if (!closestChar.isUser) {
        entities.forEach(e => {
          if (e.team === closestChar.team) e.isUser = false;
        });
        closestChar.isUser = true;
      }

      this.selectedChar = closestChar;
      this.isDragging = true;
      this.touchStart = { x: pos.x, y: pos.y };
      this.dragCurrent = { x: pos.x, y: pos.y };
      this.hasTriggeredMaxHaptic = false;

      if (this.onSelectCharacter) this.onSelectCharacter(closestChar);
      if (this.soundFX) this.soundFX.playBoing(1.1);

      return true;
    }

    return false;
  }

  handleMove(clientX, clientY) {
    if (!this.isDragging || !this.selectedChar || this.isControlsLocked) return;

    const pos = this.getCanvasCoords(clientX, clientY);
    this.dragCurrent = pos;

    // Hitung jarak dan arah geseran jari secara murni dari titik awal sentuh (relative delta)
    const deltaX = this.dragCurrent.x - this.touchStart.x;
    const deltaY = this.dragCurrent.y - this.touchStart.y;
    const rawDistance = Math.hypot(deltaX, deltaY);

    if (rawDistance >= this.DEADZONE) {
      let aimX = deltaX;
      let aimY = deltaY;

      if (this.aimMode === 'SLINGSHOT') {
        // Mode Ketapel: Tarik mundur ke belakang, bidik maju ke depan
        aimX = -deltaX;
        aimY = -deltaY;
      }

      const angle = Math.atan2(aimY, aimX);
      const power = Math.min(rawDistance, this.maxPower);

      this.selectedChar.aimAngle = angle;
      this.selectedChar.aimPower = power;
      this.selectedChar.facingAngle = angle;
      this.selectedChar.isAiming = true;

      // Haptic micro-vibration saat mencapai tenaga maksimal
      if (power >= this.maxPower && !this.hasTriggeredMaxHaptic) {
        this.hasTriggeredMaxHaptic = true;
        if (this.soundFX) this.soundFX.triggerHaptic(35);
      } else if (power < this.maxPower * 0.85) {
        this.hasTriggeredMaxHaptic = false;
      }

      if (this.onAimChange) {
        this.onAimChange(this.selectedChar);
      }
    }
  }

  handleEnd() {
    if (!this.isDragging || !this.selectedChar) return;

    this.isDragging = false;
    this.activeTouchId = null;

    // Jika tarikan jari sangat kecil (< 10px), anggap sebagai tap biasa (bukan drag bidik)
    if (this.selectedChar.aimPower < 10) {
      this.selectedChar.isAiming = false;
      this.selectedChar.aimPower = 0;
    }
  }

  setSelectedCharacter(char) {
    this.selectedChar = char;
  }
}
