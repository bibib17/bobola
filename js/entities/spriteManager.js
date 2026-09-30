/**
 * BOLA BOLA LEAGUE - SPRITE MANAGER
 * Mengelola pemuatan, pemotongan melingkar (circular clipping),
 * dan caching canvas resolusi tinggi untuk 8 Karakter Koin (Tim Merah & Tim Biru).
 */

const CHAR_COORDINATES = {
  ROCCO:  { col: 0, row: 0 },
  ZIGGY:  { col: 1, row: 0 },
  MILO:   { col: 2, row: 0 },
  BORIS:  { col: 3, row: 0 },
  KIKI:   { col: 0, row: 1 },
  TRIXIE: { col: 1, row: 1 },
  SPIKE:  { col: 2, row: 1 },
  OLLIE:  { col: 3, row: 1 }
};

// Koordinat grid piksel presisi teruji dari spritesheet 1024x1024
const COLS_X = [156, 392, 628, 864];
const ROWS_Y = [174, 514];
const COIN_RADIUS = 106;

class SpriteManager {
  constructor() {
    this.isLoaded = false;
    this.isLoading = false;
    this.cache = {
      RED: {},
      BLUE: {}
    };

    this.sheetRed = null;
    this.sheetBlue = null;
    this._loadPromise = null;
  }

  /**
   * Mulai memuat spritesheet aset koin
   */
  load() {
    if (this.isLoaded) return Promise.resolve(true);
    if (this._loadPromise) return this._loadPromise;

    this.isLoading = true;

    this._loadPromise = Promise.all([
      this._loadImage('assets/images/coin_spritesheet_red.jpg'),
      this._loadImage('assets/images/coin_spritesheet_blue.jpg')
    ]).then(([imgRed, imgBlue]) => {
      this.sheetRed = imgRed;
      this.sheetBlue = imgBlue;
      this._buildCoinCaches();
      this.isLoaded = true;
      this.isLoading = false;
      return true;
    }).catch(err => {
      console.warn('[SpriteManager] Gagal memuat spritesheet, fallback ke procedural render:', err);
      this.isLoading = false;
      return false;
    });

    return this._loadPromise;
  }

  _loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(new Error(`Failed to load ${src}: ${e.message || 'Network error'}`));
      img.src = src;
    });
  }

  /**
   * Potong dan simpan setiap koin karakter ke dalam offscreen canvas melingkar
   */
  _buildCoinCaches() {
    const charKeys = Object.keys(CHAR_COORDINATES);
    const diameter = COIN_RADIUS * 2;
    const padding = 2;
    const canvasSize = diameter + padding * 2;

    for (const charKey of charKeys) {
      const coord = CHAR_COORDINATES[charKey];
      const cx = COLS_X[coord.col];
      const cy = ROWS_Y[coord.row];

      // 1. Potong Koin Tim Merah
      this.cache.RED[charKey] = this._createClippedCoinCanvas(
        this.sheetRed,
        cx,
        cy,
        COIN_RADIUS,
        canvasSize,
        padding,
        '#FBBF24'
      );

      // 2. Potong Koin Tim Biru
      this.cache.BLUE[charKey] = this._createClippedCoinCanvas(
        this.sheetBlue,
        cx,
        cy,
        COIN_RADIUS,
        canvasSize,
        padding,
        '#38BDF8'
      );
    }

    console.log('[SpriteManager] 8 Karakter sprite koin siap & tercache untuk Tim Merah dan Tim Biru.');
  }

  _createClippedCoinCanvas(sheetImg, cx, cy, r, size, pad, rimGlowColor) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const center = size / 2;

    ctx.save();
    // Path melingkar sempurna untuk clipping
    ctx.beginPath();
    ctx.arc(center, center, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // Gambar potongan dari spritesheet
    ctx.drawImage(
      sheetImg,
      cx - r,
      cy - r,
      r * 2,
      r * 2,
      pad,
      pad,
      r * 2,
      r * 2
    );
    ctx.restore();

    // Haluskan tepian logam melingkar (subtle metallic rim bevel stroke)
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, r - 0.5, 0, Math.PI * 2);
    ctx.strokeStyle = rimGlowColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    return canvas;
  }

  /**
   * Ambil sprite canvas karakter koin
   * @param {string} charKey ROCCO, ZIGGY, MILO, dll
   * @param {string} team 'RED' | 'BLUE'
   * @returns {HTMLCanvasElement|null}
   */
  getSprite(charKey, team = 'RED') {
    if (!this.isLoaded) return null;
    const teamKey = team === 'BLUE' ? 'BLUE' : 'RED';
    return (this.cache[teamKey] && this.cache[teamKey][charKey]) || null;
  }
}

export const spriteManager = new SpriteManager();
