/**
 * Sistem Otomatisasi Landscape (Horizontal) di Mobile & Fullscreen Manager
 * Mendukung iOS Safari (iPhone/iPad), Android Chrome, dan Desktop Browser.
 */
export class OrientationManager {
  constructor({ shieldElementId = 'orientation-shield', forceRotateBtnId = 'btn-force-rotate', fullscreenBtnId = 'btn-fullscreen' } = {}) {
    this.shield = document.getElementById(shieldElementId);
    this.forceRotateBtn = document.getElementById(forceRotateBtnId);
    this.fullscreenBtn = document.getElementById(fullscreenBtnId);
    this.gameWrapper = document.getElementById('game-wrapper');

    this.isForceRotated = false;
    this.isPseudoFullscreen = false;
    this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    this.init();
  }

  init() {
    this.bindEvents();
    this.checkOrientation();

    // Auto-listen fullscreen changes from browser native
    const onFsChange = () => this.updateFullscreenButtonState();
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    document.addEventListener('mozfullscreenchange', onFsChange);
    document.addEventListener('MSFullscreenChange', onFsChange);

    // Coba lock orientasi otomatis saat ada sentuhan pertama
    const handleFirstGesture = () => {
      this.lockOrientationLandscape();
      window.removeEventListener('click', handleFirstGesture);
      window.removeEventListener('touchstart', handleFirstGesture);
    };

    window.addEventListener('click', handleFirstGesture, { once: true });
    window.addEventListener('touchstart', handleFirstGesture, { once: true });
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      this.checkOrientation();
    });

    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.checkOrientation();
        this.scrollSafariAddressBar();
      }, 150);
    });

    if (this.forceRotateBtn) {
      this.forceRotateBtn.addEventListener('click', () => {
        this.toggleForceRotate();
      });
    }

    if (this.fullscreenBtn) {
      this.fullscreenBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleFullscreen();
      });
    }
  }

  scrollSafariAddressBar() {
    // Membantu menyembunyikan address bar di iOS Safari saat dalam mode landscape
    try {
      window.scrollTo(0, 1);
      setTimeout(() => window.scrollTo(0, 0), 50);
    } catch (e) {}
  }

  lockOrientationLandscape() {
    try {
      if (screen.orientation && typeof screen.orientation.lock === 'function') {
        screen.orientation.lock('landscape').catch(() => {
          // Normal jika browser mobile membatasi lock tanpa izin khusus
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

    if (this.gameWrapper) {
      if (this.isForceRotated) {
        this.gameWrapper.classList.add('forced-landscape');
      } else {
        this.gameWrapper.classList.remove('forced-landscape');
      }
    }

    this.checkOrientation();
    window.dispatchEvent(new Event('resize'));
  }

  getNativeFullscreenElement() {
    return document.fullscreenElement ||
           document.webkitFullscreenElement ||
           document.mozFullScreenElement ||
           document.msFullscreenElement ||
           null;
  }

  isFullscreenActive() {
    return !!this.getNativeFullscreenElement() || this.isPseudoFullscreen;
  }

  toggleFullscreen() {
    const docEl = document.documentElement;
    const reqFullscreen = docEl.requestFullscreen ||
                          docEl.webkitRequestFullscreen ||
                          docEl.webkitRequestFullScreen ||
                          docEl.mozRequestFullScreen ||
                          docEl.msRequestFullscreen;

    const exitFullscreen = document.exitFullscreen ||
                           document.webkitExitFullscreen ||
                           document.mozCancelFullScreen ||
                           document.msExitFullscreen;

    // 1. Jika sedang dalam Fullscreen Aktif -> Keluar (Exit)
    if (this.isFullscreenActive()) {
      if (this.getNativeFullscreenElement() && exitFullscreen) {
        try {
          const res = exitFullscreen.call(document);
          if (res && res.catch) res.catch(() => {});
        } catch (e) {}
      }

      this.disablePseudoFullscreen();
      this.updateFullscreenButtonState();
      return;
    }

    // 2. Jika di iOS iPhone (Safari / Chrome iOS tidak mendukung Element.requestFullscreen)
    // Gunakan mode Pseudo-Fullscreen Immersive (Perbesaran Penuh + Scroll Bar Minimizer)
    if (this.isIOS || !reqFullscreen) {
      this.enablePseudoFullscreen();
      this.updateFullscreenButtonState();
      return;
    }

    // 3. Browser Desktop / Android dengan dukungan Fullscreen API
    try {
      const promise = reqFullscreen.call(docEl);
      if (promise && typeof promise.then === 'function') {
        promise.then(() => {
          this.lockOrientationLandscape();
          this.updateFullscreenButtonState();
        }).catch((err) => {
          console.warn('Native Fullscreen ditolak/gagal, beralih ke Fallback Pseudo-Fullscreen:', err);
          this.enablePseudoFullscreen();
          this.updateFullscreenButtonState();
        });
      } else {
        this.lockOrientationLandscape();
        this.updateFullscreenButtonState();
      }
    } catch (err) {
      console.warn('Error saat eksekusi Fullscreen, beralih ke Pseudo-Fullscreen:', err);
      this.enablePseudoFullscreen();
      this.updateFullscreenButtonState();
    }
  }

  enablePseudoFullscreen() {
    this.isPseudoFullscreen = true;
    document.documentElement.classList.add('pseudo-fullscreen-active');
    document.body.classList.add('pseudo-fullscreen-active');
    if (this.gameWrapper) {
      this.gameWrapper.classList.add('pseudo-fullscreen');
    }

    this.scrollSafariAddressBar();
    this.lockOrientationLandscape();

    // Trigger update ukuran canvas
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 100);
  }

  disablePseudoFullscreen() {
    this.isPseudoFullscreen = false;
    document.documentElement.classList.remove('pseudo-fullscreen-active');
    document.body.classList.remove('pseudo-fullscreen-active');
    if (this.gameWrapper) {
      this.gameWrapper.classList.remove('pseudo-fullscreen');
    }

    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 100);
  }

  updateFullscreenButtonState() {
    if (!this.fullscreenBtn) return;

    const isActive = this.isFullscreenActive();
    if (isActive) {
      this.fullscreenBtn.classList.add('active');
      this.fullscreenBtn.setAttribute('title', 'Kecilkan Layar (Esc)');
      this.fullscreenBtn.innerHTML = '🗗';
    } else {
      this.fullscreenBtn.classList.remove('active');
      this.fullscreenBtn.setAttribute('title', 'Layar Penuh (Fullscreen)');
      this.fullscreenBtn.innerHTML = '⛶';
    }
  }
}
