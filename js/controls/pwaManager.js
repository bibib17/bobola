/**
 * BolaBola League - PWA & Device Install Manager
 * Mengatur registrasi Service Worker, Prompt PWA Android/Desktop, dan Panduan Install iOS Safari.
 */
export class PWAManager {
  constructor({
    installBtnId = 'btn-pwa-install',
    installBtnSettingsId = 'btn-pwa-install-settings',
    iosModalId = 'ios-install-modal',
    closeIosModalBtnId = 'btn-close-ios-install'
  } = {}) {
    this.installBtn = document.getElementById(installBtnId);
    this.installBtnSettings = document.getElementById(installBtnSettingsId);
    this.iosModal = document.getElementById(iosModalId);
    this.closeIosModalBtn = document.getElementById(closeIosModalBtnId);

    this.deferredPrompt = null;
    this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    this.isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

    this.init();
  }

  init() {
    this.registerServiceWorker();
    this.bindEvents();
    this.updateButtonVisibility();
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((reg) => {
            console.log('[PWA] Service Worker registered with scope:', reg.scope);
          })
          .catch((err) => {
            console.warn('[PWA] Service Worker registration failed:', err);
          });
      });
    }
  }

  bindEvents() {
    // Tangkap event install prompt native (Android Chrome & Desktop)
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallButtons(true);
    });

    // Tangkap saat aplikasi berhasil diinstal
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] BolaBola League berhasil diinstal di perangkat!');
      this.deferredPrompt = null;
      this.showInstallButtons(false);
    });

    const handleInstallClick = (e) => {
      e.preventDefault();
      this.triggerInstallFlow();
    };

    if (this.installBtn) {
      this.installBtn.addEventListener('click', handleInstallClick);
    }
    if (this.installBtnSettings) {
      this.installBtnSettings.addEventListener('click', handleInstallClick);
    }

    if (this.closeIosModalBtn && this.iosModal) {
      this.closeIosModalBtn.addEventListener('click', () => {
        this.iosModal.classList.add('hidden');
      });
    }
  }

  updateButtonVisibility() {
    // Jika sudah terpasang (standalone), sembunyikan tombol instal
    if (this.isStandalone) {
      this.showInstallButtons(false);
      return;
    }

    // Di iOS atau jika prompt tersedia, tampilkan tombol instal
    if (this.isIOS || this.deferredPrompt) {
      this.showInstallButtons(true);
    }
  }

  showInstallButtons(show) {
    if (this.installBtn) {
      if (show && !this.isStandalone) {
        this.installBtn.classList.remove('hidden');
      } else {
        this.installBtn.classList.add('hidden');
      }
    }
    if (this.installBtnSettings) {
      if (show && !this.isStandalone) {
        this.installBtnSettings.classList.remove('hidden');
      } else {
        this.installBtnSettings.classList.add('hidden');
      }
    }
  }

  async triggerInstallFlow() {
    if (this.isStandalone) {
      alert('BolaBola League sudah terpasang di perangkat Anda!');
      return;
    }

    // 1. Android & Desktop Chrome / Chromium
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      console.log(`[PWA] Pilihan user: ${outcome}`);
      if (outcome === 'accepted') {
        this.deferredPrompt = null;
        this.showInstallButtons(false);
      }
      return;
    }

    // 2. iOS Safari (iPhone / iPad)
    if (this.isIOS) {
      if (this.iosModal) {
        this.iosModal.classList.remove('hidden');
      } else {
        alert("📲 Cara Pasang di iPhone/iPad:\n1. Ketuk ikon Bagikan (Share 📤) di Safari.\n2. Gulir ke bawah lalu pilih 'Tambah ke Layar Utama' (Add to Home Screen ➕).");
      }
      return;
    }

    // 3. Browser lain tanpa direct prompt
    alert("📲 Cara Pasang Game:\nBuka menu browser Anda (titik 3 di pojok) lalu pilih 'Pasang Aplikasi' atau 'Tambahkan ke Layar Utama'.");
  }
}
