/**
 * Sistem Otomatisasi Landscape (Horizontal) di Mobile & Fullscreen Manager
 */
export class OrientationManager {
  constructor({ shieldElementId = 'orientation-shield', forceRotateBtnId = 'btn-force-rotate', fullscreenBtnId = 'btn-fullscreen' } = {}) {
    this.shield = document.getElementById(shieldElementId);
    this.forceRotateBtn = document.getElementById(forceRotateBtnId);
    this.fullscreenBtn = document.getElementById(fullscreenBtnId);
    this.isForceRotated = false;

    this.init();
  }

  init() {
    this.bindEvents();
    this.checkOrientation();

    // Coba lock orientasi otomatis saat ada sentuhan pertama
    const handleFirstGesture = () => {
      this.lockOrientationLandscape();
      window.removeEventListener('click', handleFirstGesture);
      window.removeEventListener('touchstart', handleFirstGesture);
    };

    window.addEventListener('click', handleFirstGesture);
    window.addEventListener('touchstart', handleFirstGesture);
  }

  bindEvents() {
    window.addEventListener('resize', () => this.checkOrientation());
    window.addEventListener('orientationchange', () => this.checkOrientation());

    if (this.forceRotateBtn) {
      this.forceRotateBtn.addEventListener('click', () => {
        this.toggleForceRotate();
      });
    }

    if (this.fullscreenBtn) {
      this.fullscreenBtn.addEventListener('click', () => {
        this.toggleFullscreen();
      });
    }
  }

  lockOrientationLandscape() {
    try {
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {
          // Biasanya membutuhkan izin/fullscreen pada beberapa browser mobile
        });
      }
    } catch (e) {}
  }

  checkOrientation() {
    const isPortrait = window.innerHeight > window.innerWidth;

    if (this.shield) {
      if (isPortrait && !this.isForceRotated) {
        this.shield.classList.remove('hidden');
      } else {
        this.shield.classList.add('hidden');
      }
    }
  }

  toggleForceRotate() {
    this.isForceRotated = !this.isForceRotated;
    const appContainer = document.getElementById('game-wrapper');

    if (appContainer) {
      if (this.isForceRotated) {
        appContainer.classList.add('forced-landscape');
      } else {
        appContainer.classList.remove('forced-landscape');
      }
    }
    this.checkOrientation();
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        this.lockOrientationLandscape();
      }).catch(err => {
        console.warn('Fullscreen request rejected', err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }
}
