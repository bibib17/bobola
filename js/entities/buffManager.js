/**
 * Sistem Buff & Power-Up Lapangan - BolaBola Pro Edition
 * Mengatur spawn acak 1 per 1 di lapangan, deteksi pengambilan oleh koin,
 * penerapan efek buff di TURN BERIKUTNYA, dan simulasi fisik mekanik tiap buff:
 * - HEAVY_SHIELD   : Tahan tabrakan lawan (massa x6, kebal recoil)
 * - CURVE_KICK     : Tendangan melengkung (banana curve shot ke sudut gawang)
 * - GHOST_PHASE    : Kebal halangan (menembus koin lawan & rintangan)
 * - NITRO_SPEED    : Kecepatan super roket (+75% speed boost & jejak api)
 * - LASER_ACCURACY : Super akurasi (garis bidik laser tak terbatas & auto-assist)
 * - SPAWN_OBSTACLE : Menaruh tiang bumper halangan neon di arena
 */

export const BUFF_DEFINITIONS = [
  {
    id: 'HEAVY_SHIELD',
    name: 'Tahan Tabrakan',
    shortName: 'SHIELD',
    icon: '🛡️',
    color: '#10B981',
    secondaryColor: '#6EE7B7',
    glowColor: 'rgba(16, 185, 129, 0.45)',
    desc: 'Massa koin x6, kebal dorongan lawan & memantulkan lawan terpental!'
  },
  {
    id: 'CURVE_KICK',
    name: 'Tendangan Melengkung',
    shortName: 'CURVE',
    icon: '🌪️',
    color: '#8B5CF6',
    secondaryColor: '#C4B5FD',
    glowColor: 'rgba(139, 92, 246, 0.45)',
    desc: 'Saat menendang bola, bola melengkung tajam (banana shot) ke sudut gawang!'
  },
  {
    id: 'GHOST_PHASE',
    name: 'Kebal Halangan',
    shortName: 'GHOST',
    icon: '👻',
    color: '#06B6D4',
    secondaryColor: '#67E8F9',
    glowColor: 'rgba(6, 182, 212, 0.45)',
    desc: 'Koin menembus rintangan & koin lawan tanpa kehilangan laju kecepatan!'
  },
  {
    id: 'NITRO_SPEED',
    name: 'More Speed',
    shortName: 'NITRO',
    icon: '⚡',
    color: '#F59E0B',
    secondaryColor: '#FDE68A',
    glowColor: 'rgba(245, 158, 11, 0.45)',
    desc: 'Kecepatan luncur koin bertambah +75% dengan semburan roket nitro!'
  },
  {
    id: 'LASER_ACCURACY',
    name: 'More Akurasi',
    shortName: 'LASER',
    icon: '🎯',
    color: '#EC4899',
    secondaryColor: '#F472B6',
    glowColor: 'rgba(236, 72, 153, 0.45)',
    desc: 'Garis bidik laser prediktif ultra-panjang + auto-assist sudut gawang!'
  },
  {
    id: 'SPAWN_OBSTACLE',
    name: 'Obstacle Penghalang',
    shortName: 'BARRIER',
    icon: '🧱',
    color: '#EA580C',
    secondaryColor: '#FED7AA',
    glowColor: 'rgba(234, 88, 12, 0.45)',
    desc: 'Memasang tiang bumper magnetik halangan yang memantulkan bola & musuh!'
  }
];

export class BuffManager {
  constructor({ width = 960, height = 540, soundFX = null } = {}) {
    this.width = width;
    this.height = height;
    this.soundFX = soundFX;

    // Hanya 1 item buff yang muncul di lapangan pada satu waktu
    this.activeBuffItem = null;

    // Daftar rintangan penghalang yang dipasang koin di arena
    this.deployedObstacles = [];

    // Partikel visual untuk efek buff
    this.particles = [];

    // Inisialisasi spawn buff pertama
    this.spawnRandomBuff();
  }

  /**
   * Spawn 1 item buff acak di area lapangan yang aman
   */
  spawnRandomBuff(entities = [], ball = null) {
    // Pilih buff acak dari 6 jenis
    const randomDef = BUFF_DEFINITIONS[Math.floor(Math.random() * BUFF_DEFINITIONS.length)];

    // Batas lapangan aman (jauh dari jaring gawang dan sudut mati)
    const minX = 220;
    const maxX = this.width - 220;
    const minY = 120;
    const maxY = this.height - 120;

    let posX = minX + Math.random() * (maxX - minX);
    let posY = minY + Math.random() * (maxY - minY);

    // Pastikan tidak langsung menimpa bola atau koin
    let attempts = 0;
    while (attempts < 12) {
      let isTooClose = false;
      if (ball && Math.hypot(posX - ball.x, posY - ball.y) < 70) isTooClose = true;
      for (let char of entities) {
        if (Math.hypot(posX - char.x, posY - char.y) < 65) {
          isTooClose = true;
          break;
        }
      }
      if (!isTooClose) break;
      posX = minX + Math.random() * (maxX - minX);
      posY = minY + Math.random() * (maxY - minY);
      attempts++;
    }

    this.activeBuffItem = {
      x: posX,
      y: posY,
      baseY: posY,
      radius: 20,
      def: randomDef,
      active: true,
      floatOffset: 0,
      glowPulse: 0,
      rotation: 0
    };
  }

  /**
   * Update per frame: animasi floating orb buff, deteksi sentuhan koin, dan rintangan
   */
  update(dt, entities, ball, addCallout) {
    // 1. Update Animasi Item Buff di Lapangan
    if (this.activeBuffItem && this.activeBuffItem.active) {
      const item = this.activeBuffItem;
      item.glowPulse += dt * 3.2;
      item.rotation += dt * 1.5;
      item.floatOffset = Math.sin(Date.now() * 0.005) * 5;
      item.y = item.baseY + item.floatOffset;

      // Cek tabrakan koin dengan item buff
      for (let char of entities) {
        const dist = Math.hypot(char.x - item.x, char.y - item.y);
        if (dist < char.radius + item.radius) {
          this.claimBuff(char, item, addCallout);
          break;
        }
      }
    }

    // 2. Update Efek Partikel Buff Manager
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // 3. Update & Tabrakan dengan Rintangan Deployed Obstacles
    this.updateObstacleCollisions(dt, entities, ball);

    // 4. Update Jejak Nitro pada Koin yang Sedang Bergerak
    entities.forEach(char => {
      if (char.activeBuff && char.activeBuff.id === 'NITRO_SPEED') {
        const speed = Math.hypot(char.vx, char.vy);
        if (speed > 40 && Math.random() > 0.3) {
          const backAngle = Math.atan2(char.vy, char.vx) + Math.PI;
          this.particles.push({
            x: char.x + Math.cos(backAngle) * char.radius,
            y: char.y + Math.sin(backAngle) * char.radius,
            vx: (Math.random() - 0.5) * 30,
            vy: (Math.random() - 0.5) * 30,
            color: Math.random() > 0.5 ? '#F59E0B' : '#EF4444',
            radius: 3 + Math.random() * 3,
            life: 0.3
          });
        }
      }
    });
  }

  /**
   * Koin mengambil buff: Disimpan sebagai 'pendingBuff' untuk diterapkan di TURN BERIKUTNYA!
   */
  claimBuff(char, item, addCallout) {
    item.active = false;

    // Koin menyimpan buff sebagai 'pending' (aktif giliran depan)
    char.pendingBuff = { ...item.def };

    if (this.soundFX) {
      if (typeof this.soundFX.playBuffCollect === 'function') {
        this.soundFX.playBuffCollect();
      } else {
        this.soundFX.playZap();
      }
      this.soundFX.triggerHaptic(40);
    }

    // Callout teks floating pengumuman
    if (addCallout) {
      addCallout(
        char.x,
        char.y - 32,
        `✨ ${char.def.name} DAPAT ${item.def.icon} ${item.def.name.toUpperCase()}! (Turn Depan)`,
        item.def.color
      );
    }

    // Semburan partikel kembang api buff
    for (let i = 0; i < 24; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 120;
      this.particles.push({
        x: item.x,
        y: item.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: i % 2 === 0 ? item.def.color : '#FFFFFF',
        radius: 2 + Math.random() * 3,
        life: 0.45
      });
    }
  }

  /**
   * Dipanggil saat pergantian ronde / turn baru:
   * Mengaktifkan pendingBuff menjadi activeBuff untuk turn ini!
   * Dan spawn 1 buff baru jika lapangan sedang kosong.
   */
  onTurnAdvanced(turnNumber, entities, ball, addCallout) {
    // 1. Proses transisi buff untuk seluruh koin
    entities.forEach(char => {
      // Jika koin sebelumnya memiliki buff aktif, kurangi durasi atau hapus setelah turn selesai
      if (char.activeBuff) {
        if (char.buffTurnsRemaining) {
          char.buffTurnsRemaining--;
          if (char.buffTurnsRemaining <= 0) {
            char.activeBuff = null;
          }
        } else {
          char.activeBuff = null;
        }
      }

      // Aktifkan pending buff menjadi activeBuff di turn ini!
      if (char.pendingBuff) {
        char.activeBuff = { ...char.pendingBuff };
        char.pendingBuff = null;
        char.buffTurnsRemaining = 1; // Berlaku untuk 1 turn

        if (addCallout) {
          addCallout(
            char.x,
            char.y - 35,
            `🔥 ${char.activeBuff.icon} ${char.activeBuff.name.toUpperCase()} AKTIF! 🔥`,
            char.activeBuff.color
          );
        }

        if (this.soundFX && typeof this.soundFX.playBuffActivate === 'function') {
          this.soundFX.playBuffActivate();
        }

        // Efek semburan aura aktivasi
        for (let i = 0; i < 16; i++) {
          const angle = (i / 16) * Math.PI * 2;
          this.particles.push({
            x: char.x + Math.cos(angle) * char.radius,
            y: char.y + Math.sin(angle) * char.radius,
            vx: Math.cos(angle) * 70,
            vy: Math.sin(angle) * 70,
            color: char.activeBuff.color,
            radius: 3,
            life: 0.4
          });
        }
      }
    });

    // 2. Kurangi durasi rintangan penghalang deployed obstacles
    for (let i = this.deployedObstacles.length - 1; i >= 0; i--) {
      this.deployedObstacles[i].turnsRemaining--;
      if (this.deployedObstacles[i].turnsRemaining <= 0) {
        // Hancurkan rintangan dengan partikel
        const obs = this.deployedObstacles[i];
        for (let j = 0; j < 12; j++) {
          const a = Math.random() * Math.PI * 2;
          this.particles.push({
            x: obs.x,
            y: obs.y,
            vx: Math.cos(a) * 80,
            vy: Math.sin(a) * 80,
            color: obs.color,
            radius: 3,
            life: 0.35
          });
        }
        this.deployedObstacles.splice(i, 1);
      }
    }

    // 3. Jamin aturan: spawn 1 per 1! Jika di lapangan belum ada item buff, spawn 1 yang baru!
    if (!this.activeBuffItem || !this.activeBuffItem.active) {
      this.spawnRandomBuff(entities, ball);
    }
  }

  /**
   * Koin dengan buff SPAWN_OBSTACLE menaruh rintangan bumper di lapangan
   */
  deployObstacle(char, addCallout) {
    // Taruh rintangan di posisi awal koin sebelum melesat
    const obs = {
      x: char.x,
      y: char.y,
      radius: 20,
      team: char.team,
      turnsRemaining: 2,
      pulse: 0,
      color: char.team === 'RED' ? '#EF4444' : '#3B82F6'
    };

    this.deployedObstacles.push(obs);

    if (this.soundFX) this.soundFX.playBounce();
    if (addCallout) {
      addCallout(obs.x, obs.y - 25, '🧱 BARRIER DEPLOYED! 🛡️', '#EA580C');
    }

    // Partikel pemasangan rintangan
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      this.particles.push({
        x: obs.x,
        y: obs.y,
        vx: Math.cos(a) * 60,
        vy: Math.sin(a) * 60,
        color: '#EA580C',
        radius: 3,
        life: 0.35
      });
    }
  }

  /**
   * Fisika tabrakan bola & koin dengan tiang rintangan deployed obstacles
   */
  updateObstacleCollisions(dt, entities, ball) {
    if (this.deployedObstacles.length === 0) return;

    this.deployedObstacles.forEach(obs => {
      obs.pulse += dt * 4;

      // 1. Tabrakan Bola vs Rintangan
      if (ball) {
        const dx = ball.x - obs.x;
        const dy = ball.y - obs.y;
        const dist = Math.hypot(dx, dy);
        const minDist = ball.radius + obs.radius;

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;
          ball.x += nx * overlap;
          ball.y += ny * overlap;

          // Pantulan elastis tinggi
          const speed = Math.hypot(ball.vx, ball.vy);
          const dot = ball.vx * nx + ball.vy * ny;
          ball.vx = (ball.vx - 2 * dot * nx) * 1.15;
          ball.vy = (ball.vy - 2 * dot * ny) * 1.15;

          if (this.soundFX) this.soundFX.playPostClang();
        }
      }

      // 2. Tabrakan Koin vs Rintangan
      entities.forEach(char => {
        // Jika koin memiliki buff GHOST_PHASE, koin menembus rintangan tanpa tertahan!
        if (char.activeBuff && char.activeBuff.id === 'GHOST_PHASE') return;

        const dx = char.x - obs.x;
        const dy = char.y - obs.y;
        const dist = Math.hypot(dx, dy);
        const minDist = char.radius + obs.radius;

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;
          char.x += nx * overlap;
          char.y += ny * overlap;

          const dot = char.vx * nx + char.vy * ny;
          char.vx = (char.vx - 2 * dot * nx) * 0.95;
          char.vy = (char.vy - 2 * dot * ny) * 0.95;

          if (char.spring) char.spring.applyImpact(Math.atan2(ny, nx), 90);
          if (this.soundFX) this.soundFX.playBounce();
        }
      });
    });
  }

  /**
   * Reset saat gol terjadi atau pertandingan dimulai ulang
   */
  resetOnGoal() {
    this.deployedObstacles = [];
    if (!this.activeBuffItem || !this.activeBuffItem.active) {
      this.spawnRandomBuff();
    }
  }

  /**
   * Render item buff mengambang di lapangan dan tiang rintangan
   */
  render(ctx) {
    // 1. Render Rintangan Bumper Deployed Obstacles
    this.deployedObstacles.forEach(obs => {
      ctx.save();
      ctx.translate(obs.x, obs.y);

      // Bayangan
      ctx.beginPath();
      ctx.arc(0, 4, obs.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
      ctx.fill();

      // Outer Neon Shield Ring
      const p = 1 + Math.sin(obs.pulse) * 0.12;
      ctx.beginPath();
      ctx.arc(0, 0, obs.radius * p, 0, Math.PI * 2);
      ctx.strokeStyle = '#EA580C';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Core Silinder Neon
      ctx.beginPath();
      ctx.arc(0, 0, obs.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#C2410C';
      ctx.fill();
      ctx.strokeStyle = '#FED7AA';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Ikon Rintangan
      ctx.font = '14px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🧱', 0, 1);

      ctx.restore();
    });

    // 2. Render Partikel Buff
    this.particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    });

    // 3. Render 1 Item Buff Aktif di Lapangan
    if (this.activeBuffItem && this.activeBuffItem.active) {
      const item = this.activeBuffItem;
      const def = item.def;
      const pulse = 1 + Math.sin(item.glowPulse) * 0.15;

      ctx.save();
      ctx.translate(item.x, item.y);

      // Bayangan di tanah
      ctx.beginPath();
      ctx.ellipse(0, 22 - item.floatOffset, 16, 6, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
      ctx.fill();

      // Pendaran Cahaya Neon Lingkaran Luar
      const glowGrad = ctx.createRadialGradient(0, 0, 8, 0, 0, item.radius * 2.2 * pulse);
      glowGrad.addColorStop(0, def.glowColor);
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, item.radius * 2.2 * pulse, 0, Math.PI * 2);
      ctx.fill();

      // Cincin Berputar dengan Garis Putus-Putus
      ctx.save();
      ctx.rotate(item.rotation);
      ctx.beginPath();
      ctx.arc(0, 0, item.radius + 6, 0, Math.PI * 2);
      ctx.strokeStyle = def.secondaryColor;
      ctx.lineWidth = 2.2;
      ctx.setLineDash([8, 6]);
      ctx.stroke();
      ctx.restore();

      // Bola Inti Kristal Buff (Core Orb)
      const coreGrad = ctx.createRadialGradient(-4, -4, 2, 0, 0, item.radius);
      coreGrad.addColorStop(0, '#FFFFFF');
      coreGrad.addColorStop(0.4, def.secondaryColor);
      coreGrad.addColorStop(1, def.color);

      ctx.beginPath();
      ctx.arc(0, 0, item.radius, 0, Math.PI * 2);
      ctx.fillStyle = coreGrad;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.2;
      ctx.stroke();

      // Ikon Simbol Buff di Tengah
      ctx.font = 'bold 16px "Segoe UI Emoji", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.icon, 0, 1);

      // Label Teks Mengambang di Atas Orb (Jelas Terbaca oleh Pemain)
      const labelText = `${def.icon} ${def.name.toUpperCase()}`;
      ctx.font = 'bold 10px Fredoka, Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const textW = ctx.measureText(labelText).width;

      const badgeY = -item.radius - 14;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 1.5;

      const px = 6, py = 2.5;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(-textW / 2 - px, badgeY - 7 - py, textW + px * 2, 14 + py * 2, 5);
      } else {
        ctx.rect(-textW / 2 - px, badgeY - 7 - py, textW + px * 2, 14 + py * 2);
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(labelText, 0, badgeY);

      ctx.restore();
    }
  }

  /**
   * Render Aura & Indikator Buff pada Masing-Masing Koin
   */
  renderCoinBuffVisuals(ctx, char) {
    // 1. Indikator 'Pending Buff' (Dapat buff, aktif di turn depan)
    if (char.pendingBuff) {
      const pDef = char.pendingBuff;
      ctx.save();
      ctx.translate(char.x, char.y);

      // Cincin energi berputar lembut
      const orbitAngle = Date.now() * 0.003;
      const orbitDist = char.radius + 8;
      const ox = Math.cos(orbitAngle) * orbitDist;
      const oy = Math.sin(orbitAngle) * orbitDist;

      ctx.beginPath();
      ctx.arc(ox, oy, 7, 0, Math.PI * 2);
      ctx.fillStyle = pDef.color;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.font = 'bold 9px "Segoe UI Emoji", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pDef.icon, ox, oy);

      // Pill kecil: (Turn Depan)
      ctx.font = 'bold 9px Fredoka, Outfit, sans-serif';
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = pDef.color;
      ctx.lineWidth = 1;
      const pendingTxt = `Next: ${pDef.icon}`;
      const tw = ctx.measureText(pendingTxt).width;
      ctx.beginPath();
      ctx.rect(-tw / 2 - 4, char.radius + 14, tw + 8, 14);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(pendingTxt, 0, char.radius + 21);

      ctx.restore();
    }

    // 2. Indikator 'Active Buff' (Sedang Aktif di Turn Ini)
    if (char.activeBuff) {
      const aDef = char.activeBuff;
      const pulse = 1 + Math.sin(Date.now() * 0.006) * 0.12;

      ctx.save();
      ctx.translate(char.x, char.y);

      // Aura pendaran warna buff di sekeliling koin
      ctx.beginPath();
      ctx.arc(0, 0, (char.radius + 6) * pulse, 0, Math.PI * 2);
      ctx.strokeStyle = aDef.color;
      ctx.lineWidth = 3.5;
      ctx.shadowColor = aDef.color;
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Badge Floating Status Buff Aktif di Atas Koin
      const badgeY = -char.radius - 22;
      const badgeText = `${aDef.icon} ${aDef.name.toUpperCase()}`;
      ctx.font = 'bold 10px Fredoka, Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const bw = ctx.measureText(badgeText).width;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = aDef.color;
      ctx.lineWidth = 1.8;

      const px = 7, py = 3;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(-bw / 2 - px, badgeY - 8 - py, bw + px * 2, 16 + py * 2, 6);
      } else {
        ctx.rect(-bw / 2 - px, badgeY - 8 - py, bw + px * 2, 16 + py * 2);
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(badgeText, 0, badgeY);

      ctx.restore();
    }
  }
}
