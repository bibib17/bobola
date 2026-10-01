/**
 * BolaBola League - Mobile UX & Player Career Manager
 * Fitur Produk Mobile:
 * 1. Web Share API & Deep Linking (WhatsApp, Telegram, Discord)
 * 2. Mobile Quick Emotes / Floating Reactions System
 * 3. Player Profile, Rank Progression, & Offline LocalStorage
 * 4. Micro Toast Notification System
 */

export class MobileUXManager {
  constructor({ soundFX, getGameInstance } = {}) {
    this.soundFX = soundFX;
    this.getGameInstance = getGameInstance;

    this.profile = this.loadProfile();
    this.activeEmotes = []; // Array of floating emote animations
    this.toastTimeout = null;

    this.init();
  }

  init() {
    this.createToastElement();
    this.createEmoteWheelUI();
    this.updateProfileUI();
  }

  // === LOCAL PERSISTENCE & CAREER PROGRESSION ===
  loadProfile() {
    try {
      const saved = localStorage.getItem('bolabola_player_profile');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {}

    return {
      name: 'Player 1',
      matches: 0,
      wins: 0,
      goals: 0,
      buffsTaken: 0,
      favoriteChar: 'ZIGGY',
      streak: 0,
      level: 1,
      xp: 0
    };
  }

  saveProfile() {
    try {
      localStorage.setItem('bolabola_player_profile', JSON.stringify(this.profile));
      this.updateProfileUI();
    } catch (e) {}
  }

  recordMatchResult({ isWin = false, goalsScored = 0, buffsTaken = 0 } = {}) {
    this.profile.matches += 1;
    if (isWin) {
      this.profile.wins += 1;
      this.profile.streak += 1;
      this.profile.xp += 100;
    } else {
      this.profile.streak = 0;
      this.profile.xp += 35;
    }

    this.profile.goals += goalsScored;
    this.profile.buffsTaken += buffsTaken;
    this.profile.xp += goalsScored * 25 + buffsTaken * 10;

    // Hitung level baru (setiap 250 XP = 1 Level)
    const newLevel = Math.floor(this.profile.xp / 250) + 1;
    if (newLevel > this.profile.level) {
      this.profile.level = newLevel;
      this.showToast(`🎉 NAIK LEVEL! Level ${newLevel} (${this.getRankTitle()})`);
      if (this.soundFX) this.soundFX.playFanfare();
    }

    this.saveProfile();
  }

  getRankTitle() {
    const lvl = this.profile.level;
    if (lvl >= 10) return '⚡ Legendary Captain';
    if (lvl >= 7) return '🏆 Master Playmaker';
    if (lvl >= 4) return '⚽ Pro Striker';
    if (lvl >= 2) return '⭐ Rising Star';
    return '🌱 Rookie Player';
  }

  updateProfileUI() {
    const rankEl = document.getElementById('user-rank-badge');
    if (rankEl) {
      rankEl.textContent = `Lv.${this.profile.level} ${this.getRankTitle()}`;
    }
  }

  // === NATIVE WEB SHARE API (WHATSAPP, TELEGRAM, SOSMED) ===
  async shareRoom(roomId) {
    const origin = window.location.origin + window.location.pathname;
    const shareUrl = `${origin}?room=${roomId}`;
    const shareText = `⚡ Ayo tanding bola meja di BolaBola League! Masuk ke Room [${roomId}]:\n${shareUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'BolaBola League - Main Bersama!',
          text: `Ayo main bareng sepak bola meja simultan di Room: ${roomId}`,
          url: shareUrl
        });
        if (this.soundFX) this.soundFX.triggerHaptic('light');
        return;
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Navigator share error:', err);
        }
      }
    }

    // Fallback Clipboard Copy
    try {
      await navigator.clipboard.writeText(shareUrl);
      this.showToast('📋 Link Room berhasil disalin! Bagikan ke temanmu.');
      if (this.soundFX) this.soundFX.triggerHaptic('light');
    } catch (e) {
      prompt('Salin link room ini untuk teman:', shareUrl);
    }
  }

  // === TOAST NOTIFICATION SYSTEM ===
  createToastElement() {
    if (document.getElementById('mobile-toast-container')) return;

    const toast = document.createElement('div');
    toast.id = 'mobile-toast-container';
    toast.className = 'mobile-toast-container hidden';
    toast.innerHTML = `<div id="mobile-toast-content" class="mobile-toast-content"></div>`;
    document.body.appendChild(toast);
  }

  showToast(message, duration = 2800) {
    const toast = document.getElementById('mobile-toast-container');
    const content = document.getElementById('mobile-toast-content');
    if (!toast || !content) return;

    if (this.toastTimeout) clearTimeout(this.toastTimeout);

    content.textContent = message;
    toast.classList.remove('hidden');
    toast.classList.add('visible');

    this.toastTimeout = setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.classList.add('hidden'), 250);
    }, duration);
  }

  // === MOBILE QUICK EMOTES / REACTION WHEEL ===
  createEmoteWheelUI() {
    if (document.getElementById('emote-bar-container')) return;

    const bar = document.createElement('div');
    bar.id = 'emote-bar-container';
    bar.className = 'emote-bar-container hidden';

    const emojis = ['⚽', '🔥', '👏', '😱', '⚡', '🛡️'];
    bar.innerHTML = emojis.map(emo => `
      <button class="emote-btn" data-emoji="${emo}">${emo}</button>
    `).join('');

    document.getElementById('game-wrapper')?.appendChild(bar);

    bar.addEventListener('click', (e) => {
      const btn = e.target.closest('.emote-btn');
      if (!btn) return;
      const emoji = btn.dataset.emoji;
      this.triggerEmote(emoji);
    });
  }

  toggleEmoteBar(show) {
    const bar = document.getElementById('emote-bar-container');
    if (!bar) return;
    if (show !== undefined) {
      if (show) bar.classList.remove('hidden');
      else bar.classList.add('hidden');
    } else {
      bar.classList.toggle('hidden');
    }
  }

  triggerEmote(emoji, customPos = null) {
    if (this.soundFX) {
      this.soundFX.playBoing(1.4);
      this.soundFX.triggerHaptic('light');
    }

    const game = this.getGameInstance ? this.getGameInstance() : null;
    let spawnX = 480;
    let spawnY = 270;

    if (customPos) {
      spawnX = customPos.x;
      spawnY = customPos.y;
    } else if (game && game.characters) {
      const userChar = game.characters.find(c => c.isUser);
      if (userChar) {
        spawnX = userChar.x;
        spawnY = userChar.y - 45;
      }
    }

    this.activeEmotes.push({
      emoji,
      x: spawnX,
      y: spawnY,
      startY: spawnY,
      alpha: 1.0,
      scale: 0.6,
      createdAt: performance.now(),
      duration: 1600
    });

    // Broadcast emote jika dalam mode online multiplayer
    if (game && game.gameMode === 'ONLINE' && game.network) {
      game.network.send({
        type: 'EMOTE',
        emoji,
        x: spawnX,
        y: spawnY
      });
    }

    // Auto hide emote bar
    this.toggleEmoteBar(false);
  }

  updateAndRenderEmotes(ctx, now) {
    if (this.activeEmotes.length === 0) return;

    ctx.save();
    for (let i = this.activeEmotes.length - 1; i >= 0; i--) {
      const item = this.activeEmotes[i];
      const elapsed = now - item.createdAt;
      const progress = Math.min(1, elapsed / item.duration);

      if (progress >= 1) {
        this.activeEmotes.splice(i, 1);
        continue;
      }

      // Animasi float up & pop scale
      const floatY = item.startY - (progress * 55);
      const currentScale = progress < 0.2 ? (0.6 + progress * 3.5) : (1.3 - (progress - 0.2) * 0.4);
      const alpha = progress > 0.75 ? (1 - (progress - 0.75) / 0.25) : 1;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(item.x, floatY);
      ctx.scale(currentScale, currentScale);

      // Emote Bubble Background
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();

      ctx.lineWidth = 2;
      ctx.strokeStyle = '#38bdf8';
      ctx.stroke();

      // Emoji text
      ctx.font = '22px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.emoji, 0, 1);

      ctx.restore();
    }
    ctx.restore();
  }
}
