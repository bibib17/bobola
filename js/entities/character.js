import { WobbleSpring } from '../physics/spring.js';
import { spriteManager } from './spriteManager.js';

export const TEAM_COLORS = {
  RED: {
    id: 'RED',
    name: 'The Strikers',
    primary: '#E02424',
    secondary: '#FEF2F2',
    accent: '#F59E0B',
    dark: '#991B1B',
    arrowGrad: ['#EF4444', '#F97316'],
    glow: 'rgba(239, 68, 68, 0.45)',
    border: '#B91C1C'
  },
  BLUE: {
    id: 'BLUE',
    name: 'The Rovers',
    primary: '#1D4ED8',
    secondary: '#EFF6FF',
    accent: '#06B6D4',
    dark: '#1E3A8A',
    arrowGrad: ['#3B82F6', '#06B6D4'],
    glow: 'rgba(59, 130, 246, 0.45)',
    border: '#1E40AF'
  }
};

export const CHARACTER_DEFS = {
  ROCCO: {
    id: 'rocco',
    key: 'ROCCO',
    name: 'Rocco',
    symbol: '🦏',
    iconName: 'Cula Badak',
    species: 'Rhino (Badak)',
    role: 'Kiper / Palang Pintu',
    stats: { speed: 68, spring: 65, weight: 95, control: 75 },
    desc: 'Koin pelindung berbobot tebal, cula badak baja, dan stabilitas kiper.',
    springConfig: { stiffness: 90, damping: 10.0, mass: 1.2 },
    skinColor: '#8E9AA8',
    accentColor: '#EF4444'
  },
  ZIGGY: {
    id: 'ziggy',
    key: 'ZIGGY',
    name: 'Ziggy',
    symbol: '⚡',
    iconName: 'Kilat Petir',
    species: 'Rabbit (Kelinci)',
    role: 'Striker / Penyerang Kilat',
    stats: { speed: 96, spring: 95, weight: 65, control: 88 },
    desc: 'Koin kilat dengan akselerasi maksimal dan tembakan pantul tajam.',
    springConfig: { stiffness: 160, damping: 6.0, mass: 0.9 },
    skinColor: '#FFF1E6',
    accentColor: '#F97316'
  },
  MILO: {
    id: 'milo',
    key: 'MILO',
    name: 'Milo',
    symbol: '🎯',
    iconName: 'Target Presisi',
    species: 'Fox (Rubah)',
    role: 'Midfielder / Pembuat Assist',
    stats: { speed: 88, spring: 85, weight: 74, control: 94 },
    desc: 'Koin pengatur ritme dengan akurasi passing dan sudut pantul presisi.',
    springConfig: { stiffness: 130, damping: 8.0, mass: 1.0 },
    skinColor: '#E06D28',
    accentColor: '#38BDF8'
  },
  BORIS: {
    id: 'boris',
    key: 'BORIS',
    name: 'Boris',
    symbol: '🛡️',
    iconName: 'Perisai Baja',
    species: 'Bear (Beruang)',
    role: 'Bek / Palang Pintu',
    stats: { speed: 62, spring: 55, weight: 98, control: 70 },
    desc: 'Koin benteng kokoh, daya tolak benturan tinggi, dan sulit ditembus.',
    springConfig: { stiffness: 80, damping: 12.0, mass: 1.3 },
    skinColor: '#784725',
    accentColor: '#FBBF24'
  },
  KIKI: {
    id: 'kiki',
    key: 'KIKI',
    name: 'Kiki',
    symbol: '🔥',
    iconName: 'Api Menyala',
    species: 'Monkey (Monyet)',
    role: 'Winger / Penyerang Sayap',
    stats: { speed: 92, spring: 90, weight: 70, control: 86 },
    desc: 'Koin api berkecepatan tinggi untuk manuver serangan sayap mematikan.',
    springConfig: { stiffness: 150, damping: 7.0, mass: 0.95 },
    skinColor: '#9A5B32',
    accentColor: '#EA580C'
  },
  TRIXIE: {
    id: 'trixie',
    key: 'TRIXIE',
    name: 'Trixie',
    symbol: '🐾',
    iconName: 'Cakar Kucing',
    species: 'Cat (Kucing Bengal)',
    role: 'Winger / Pemburu Rebound',
    stats: { speed: 90, spring: 88, weight: 72, control: 90 },
    desc: 'Koin lincah penyambar rebound dengan pantulan elastis.',
    springConfig: { stiffness: 140, damping: 7.0, mass: 0.95 },
    skinColor: '#94A3B8',
    accentColor: '#06B6D4'
  },
  SPIKE: {
    id: 'spike',
    key: 'SPIKE',
    name: 'Spike',
    symbol: '⚔️',
    iconName: 'Pedang Silang',
    species: 'Boar (Babi Hutan)',
    role: 'Enforcer / Gelandang Bertahan',
    stats: { speed: 82, spring: 75, weight: 88, control: 78 },
    desc: 'Koin penyeruduk agresif untuk merebut bola dan menyingkirkan lawan.',
    springConfig: { stiffness: 110, damping: 9.0, mass: 1.15 },
    skinColor: '#854D27',
    accentColor: '#18181B'
  },
  OLLIE: {
    id: 'ollie',
    key: 'OLLIE',
    name: 'Ollie',
    symbol: '👁️',
    iconName: 'Mata Taktis',
    species: 'Owl (Burung Hantu)',
    role: 'Playmaker / Pengatur Formasi',
    stats: { speed: 76, spring: 72, weight: 76, control: 96 },
    desc: 'Koin visioner pengatur skema lapangan dengan kontrol tembakan tinggi.',
    springConfig: { stiffness: 100, damping: 9.0, mass: 1.0 },
    skinColor: '#A16207',
    accentColor: '#CA8A04'
  }
};

export class Character {
  constructor({
    charKey = 'ROCCO',
    team = 'RED',
    x = 0,
    y = 0,
    number = 1,
    playerName = 'Player',
    isUser = false
  }) {
    this.charKey = charKey;
    this.def = CHARACTER_DEFS[charKey] || CHARACTER_DEFS.ROCCO;
    this.team = team; // 'RED' | 'BLUE'
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = 27; // Standar radius lingkaran koin fisik
    this.mass = this.def.springConfig.mass * 2.2;

    this.number = number;
    this.playerName = playerName;
    this.isUser = isUser;
    this.facingAngle = team === 'RED' ? 0 : Math.PI;

    // Vektor bidikan fase perencanaan
    this.aimAngle = 0;
    this.aimPower = 0;
    this.isAiming = false;
    this.isReady = false;

    // Modul pegas getaran benturan koin
    this.spring = new WobbleSpring(this.def.springConfig);

    // Status Efek Buff (Diperoleh turn ini, aktif di turn depan)
    this.pendingBuff = null;
    this.activeBuff = null;
    this.buffTurnsRemaining = 0;

    // Animasi kilau & ekspresi
    this.tiltAngle = 0;
    this.expression = 'NORMAL';
    this.expressionTimer = 0;

    // Statistik pertandingan internal
    this.matchStats = {
      shots: 0,
      goals: 0,
      tackles: 0,
      pickups: 0
    };
  }

  setTeam(team) {
    this.team = team;
    this.facingAngle = team === 'RED' ? 0 : Math.PI;
  }

  setCharDef(charKey) {
    this.charKey = charKey;
    this.def = CHARACTER_DEFS[charKey] || CHARACTER_DEFS.ROCCO;
    this.spring = new WobbleSpring(this.def.springConfig);
    this.mass = this.def.springConfig.mass * 2.2;
  }

  update(dt) {
    // 1. Update getaran pegas koin saat benturan
    this.spring.update(dt);

    // 2. Update gerakan & arah hadap koin saat meluncur
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > 5) {
      this.facingAngle = Math.atan2(this.vy, this.vx);
      this.tiltAngle = Math.min(speed * 0.003, 0.25);
    } else {
      this.tiltAngle = 0;
    }

    // 3. Update timer ekspresi selebrasi / getar
    if (this.expressionTimer > 0) {
      this.expressionTimer -= dt;
      if (this.expressionTimer <= 0) {
        this.expression = 'NORMAL';
      }
    }
  }

  triggerImpactReaction(force) {
    if (force > 100) {
      this.expression = 'DIZZY';
      this.expressionTimer = 0.6;
      this.matchStats.tackles++;
    }
  }

  triggerGoalJoy() {
    this.expression = 'JOY';
    this.expressionTimer = 2.4;
    if (this.spring) {
      this.spring.applyImpact(Math.random() * Math.PI * 2, 70);
    }
  }

  render(ctx) {
    const palette = TEAM_COLORS[this.team];

    ctx.save();
    ctx.translate(this.x, this.y);

    // 1. Bayangan Dudukan Koin 3D (Dynamic Drop Shadow)
    ctx.beginPath();
    ctx.ellipse(0, 8, this.radius + 3, this.radius * 0.58, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
    ctx.fill();

    // 2. Micro-goyangan Pegas 3D saat tabrakan/klik
    const sprX = this.spring ? this.spring.offsetX * 0.35 : 0;
    const sprY = this.spring ? this.spring.offsetY * 0.35 : 0;
    const sprRot = this.spring ? this.spring.angle * 0.06 : 0;

    ctx.save();
    ctx.translate(sprX, sprY);
    if (sprRot !== 0) ctx.rotate(sprRot);

    // 3. Render Sprite Karakter Koin Bersimbol
    const sprite = spriteManager.getSprite(this.charKey, this.team);
    if (sprite) {
      const drawSize = this.radius * 2;
      ctx.drawImage(sprite, -this.radius, -this.radius, drawSize, drawSize);

      // Kilau Kaca Glossy 3D (Curved Specular Glint Reflection)
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, this.radius - 3, Math.PI * 1.05, Math.PI * 1.95);
      ctx.quadraticCurveTo(0, 3, -(this.radius - 3), 0);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.fill();
      ctx.restore();
    } else {
      // Fallback prosedural jika sprite sedang dimuat
      this._renderProceduralCoin(ctx, palette);
    }

    // 4. Sorot Cincin Emas Berdenyut jika koin pemain pengguna aktif
    if (this.isUser) {
      const pulse = 1 + Math.sin(Date.now() * 0.008) * 0.12;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 6 * pulse, 0, Math.PI * 2);
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 3.5;
      ctx.setLineDash([6, 4]);
      ctx.lineDashOffset = -(Date.now() * 0.02) % 10;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 5. Indikator Arah Hadap Koin (Direction Notch Pip)
    const notchR = this.radius - 2.5;
    const nx = Math.cos(this.facingAngle) * notchR;
    const ny = Math.sin(this.facingAngle) * notchR;
    ctx.beginPath();
    ctx.arc(nx, ny, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = palette.dark;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.restore(); // Tutup save transform pegas

    // 6. Label Nama Pemain & Status Centang Ready
    ctx.save();
    ctx.translate(0, this.radius + 14);
    ctx.font = 'bold 11px Outfit, Poppins, sans-serif';
    ctx.textAlign = 'center';

    const label = `${this.playerName} #${this.number}`;
    const textWidth = ctx.measureText(label).width;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(-textWidth / 2 - 9, -10, textWidth + 18, 19, 9);
    ctx.fill();
    ctx.strokeStyle = this.isUser ? '#FACC15' : 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Teks nama
    ctx.fillStyle = this.isReady ? '#4ADE80' : '#F8FAFC';
    ctx.fillText(label, 0, 3);

    // Ikon status centang jika ready
    if (this.isReady) {
      ctx.fillStyle = '#22C55E';
      ctx.beginPath();
      ctx.arc(textWidth / 2 + 13, -1, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    ctx.restore();

    // 7. Render Efek Buff (Pending di Turn Depan & Aktif di Turn Ini)
    this.renderBuffIndicators(ctx);

    ctx.restore();
  }

  renderBuffIndicators(ctx) {
    // 1. Pending Buff (Diperoleh turn ini, aktif di turn depan)
    if (this.pendingBuff) {
      const pDef = this.pendingBuff;
      const orbitAngle = Date.now() * 0.0035;
      const orbitDist = this.radius + 8;
      const ox = Math.cos(orbitAngle) * orbitDist;
      const oy = Math.sin(orbitAngle) * orbitDist;

      ctx.save();
      ctx.beginPath();
      ctx.arc(ox, oy, 7.5, 0, Math.PI * 2);
      ctx.fillStyle = pDef.color;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      ctx.font = 'bold 9px "Segoe UI Emoji", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pDef.icon, ox, oy);

      // Pill kecil: Next: [Icon]
      const label = `Next: ${pDef.icon}`;
      ctx.font = 'bold 9px Fredoka, Outfit, sans-serif';
      const tw = ctx.measureText(label).width;
      const by = this.radius + 20;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = pDef.color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.rect(-tw / 2 - 4, by - 6, tw + 8, 13);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(label, 0, by);
      ctx.restore();
    }

    // 2. Active Buff (Sedang aktif di turn ini!)
    if (this.activeBuff) {
      const aDef = this.activeBuff;
      const pulse = 1 + Math.sin(Date.now() * 0.006) * 0.12;

      ctx.save();
      // Aura pendaran warna buff di sekeliling koin
      ctx.beginPath();
      ctx.arc(0, 0, (this.radius + 6) * pulse, 0, Math.PI * 2);
      ctx.strokeStyle = aDef.color;
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // Badge Floating Status Buff Aktif di Atas Koin
      const badgeY = -this.radius - 18;
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

  /**
   * Fallback Prosedural Render Koin jika Sprite Belum Siap
   */
  _renderProceduralCoin(ctx, palette) {
    // Tepian Bevel Koin Logam Bergerigi
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    const rimGrad = ctx.createLinearGradient(-this.radius, -this.radius, this.radius, this.radius);
    rimGrad.addColorStop(0, '#FFFFFF');
    rimGrad.addColorStop(0.35, palette.primary);
    rimGrad.addColorStop(0.75, palette.dark);
    rimGrad.addColorStop(1, '#0F172A');
    ctx.fillStyle = rimGrad;
    ctx.fill();
    ctx.lineWidth = 2.8;
    ctx.strokeStyle = palette.primary;
    ctx.stroke();

    // Gerigi Logam Halus di Keliling Koin
    const notches = 16;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.3;
    for (let i = 0; i < notches; i++) {
      const a = (i * Math.PI * 2) / notches;
      const r1 = this.radius - 2.8;
      const r2 = this.radius - 0.6;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
      ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
      ctx.stroke();
    }

    // Permukaan Utama Koin
    ctx.beginPath();
    ctx.arc(0, 0, this.radius - 4, 0, Math.PI * 2);
    const faceGrad = ctx.createRadialGradient(0, -4, 2, 0, 0, this.radius - 4);
    if (this.team === 'RED') {
      faceGrad.addColorStop(0, '#EF4444');
      faceGrad.addColorStop(0.55, '#DC2626');
      faceGrad.addColorStop(1, '#991B1B');
    } else {
      faceGrad.addColorStop(0, '#38BDF8');
      faceGrad.addColorStop(0.55, '#2563EB');
      faceGrad.addColorStop(1, '#1E3A8A');
    }
    ctx.fillStyle = faceGrad;
    ctx.fill();

    // Cincin Dalam Beraksen Emas / Putih
    ctx.beginPath();
    ctx.arc(0, 0, this.radius - 6, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Simbol Emoji
    this.renderCoinSymbol(ctx);

    // Kilau Kaca Glossy 3D
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, this.radius - 4, Math.PI * 1.05, Math.PI * 1.95);
    ctx.quadraticCurveTo(0, 3, -(this.radius - 4), 0);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.fill();
    ctx.restore();
  }

  /**
   * Render Simbol Ikon di Atas Koin
   */
  renderCoinSymbol(ctx) {
    const symbol = this.def.symbol || '⚡';

    ctx.save();
    // Ikon Simbol Besar di Tengah Koin
    ctx.font = '17px "Segoe UI Emoji", "Apple Color Emoji", Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = 4;
    ctx.fillText(symbol, 0, -3);
    ctx.shadowBlur = 0;

    // Nomor Punggung Mini di Bawah Simbol
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 10px Fredoka, Outfit, sans-serif';
    ctx.fillText(`#${this.number}`, 0, 11);
    ctx.restore();
  }

  /**
   * Render Panah Arah Gerak yang Ditarik dari Pemain
   */
  renderAimArrow(ctx, bounds = { left: 65, right: 895, top: 65, bottom: 475 }) {
    if (!this.isAiming || this.aimPower < 5) return;

    const palette = TEAM_COLORS[this.team];
    const maxPower = 180;
    const powerRatio = Math.min(this.aimPower / maxPower, 1.0);

    // Panjang panah mengikuti jarak tarikan pemain: makin jauh ditarik, makin panjang panahnya!
    const arrowLen = this.radius + 15 + this.aimPower * 0.95;

    // 1. Gambar Garis Prediksi Taktis Pantulan Dinding
    if (this.isUser && powerRatio > 0.1) {
      this.renderTrajectoryGuide(ctx, bounds, powerRatio, palette);
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.aimAngle);

    // Garis Panah Bertahap Dinamis Ditarik Langsung dari Tepi Koin
    const grad = ctx.createLinearGradient(this.radius, 0, arrowLen, 0);
    grad.addColorStop(0, palette.arrowGrad[0]);
    grad.addColorStop(1, palette.arrowGrad[1]);

    ctx.strokeStyle = grad;
    // Semakin panjang panah, garis semakin tebal bertenaga (5px hingga 10px)
    ctx.lineWidth = 5.0 + powerRatio * 5.0;
    ctx.lineCap = 'round';

    // Garis putus-putus beranimasi maju lebih cepat saat tarikan semakin kuat
    const animSpeed = 0.03 + powerRatio * 0.05;
    const offset = -(Date.now() * animSpeed) % 16;
    ctx.setLineDash([10, 6]);
    ctx.lineDashOffset = offset;

    ctx.beginPath();
    ctx.moveTo(this.radius + 4, 0);
    ctx.lineTo(arrowLen, 0);
    ctx.stroke();

    // Kepala Panah (Arrowhead) di Ujung Tarikan - membesar proporsional dengan panjang
    const headSize = 10 + powerRatio * 7;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(arrowLen + headSize, 0);
    ctx.lineTo(arrowLen - 4, -headSize * 0.65);
    ctx.lineTo(arrowLen, 0);
    ctx.lineTo(arrowLen - 4, headSize * 0.65);
    ctx.closePath();
    ctx.fillStyle = palette.arrowGrad[1];
    ctx.fill();

    // Glow aura di kepala panah saat daya tinggi (tarikan jauh)
    if (powerRatio > 0.45) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(arrowLen + headSize * 0.5, 0, 8 + powerRatio * 12, 0, Math.PI * 2);
      ctx.fillStyle = palette.glow;
      ctx.fill();
      ctx.restore();
    }

    // Cincin Indikator Kekuatan Daya Tarik di sekeliling koin
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 6, 0, Math.PI * 2 * powerRatio);
    ctx.strokeStyle = palette.arrowGrad[1];
    ctx.lineWidth = 3.5 + powerRatio * 2.0;
    ctx.stroke();

    ctx.restore();

    // Indikator Kecepatan Dinamis (Pill Badge) yang selalu tegak dan mudah dibaca
    if (powerRatio > 0.18) {
      const badgeDist = Math.min(arrowLen * 0.65, arrowLen - 20);
      const bx = this.x + Math.cos(this.aimAngle) * badgeDist;
      const by = this.y + Math.sin(this.aimAngle) * badgeDist - 18;

      const pct = Math.round(powerRatio * 100);
      const isMax = pct >= 98;
      let text = isMax ? '⚡ MAX SPEED!' : `🚀 ${pct}% SPEED`;
      let badgeBg = isMax ? 'rgba(239, 68, 68, 0.92)' : 'rgba(15, 23, 42, 0.88)';
      let badgeBorder = isMax ? '#FEE2E2' : palette.arrowGrad[1];

      // Kustomisasi teks jika memiliki buff aktif
      if (this.activeBuff && this.activeBuff.id === 'NITRO_SPEED') {
        text = `🚀 NITRO +75%! (${pct}%)`;
        badgeBg = 'rgba(245, 158, 11, 0.95)';
        badgeBorder = '#FDE68A';
      } else if (this.activeBuff && this.activeBuff.id === 'LASER_ACCURACY') {
        text = `🎯 LASER SIGHT (${pct}%)`;
        badgeBg = 'rgba(236, 72, 153, 0.95)';
        badgeBorder = '#FBCFE8';
      } else if (this.activeBuff && this.activeBuff.id === 'CURVE_KICK') {
        text = `🌪️ BANANA CURVE (${pct}%)`;
        badgeBg = 'rgba(139, 92, 246, 0.95)';
        badgeBorder = '#DDD6FE';
      }

      ctx.save();
      ctx.font = 'bold 11px Fredoka, Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const textWidth = ctx.measureText(text).width;

      // Pill Background
      const px = 7, py = 3;
      ctx.fillStyle = badgeBg;
      ctx.strokeStyle = badgeBorder;
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(bx - textWidth / 2 - px, by - 8 - py, textWidth + px * 2, 16 + py * 2, 6);
      } else {
        ctx.rect(bx - textWidth / 2 - px, by - 8 - py, textWidth + px * 2, 16 + py * 2);
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(text, bx, by);
      ctx.restore();
    }
  }

  /**
   * Render Garis Prediksi Pantulan Meja (Dotted Billiard-Style Trajectory)
   */
  renderTrajectoryGuide(ctx, bounds, powerRatio, palette) {
    const x0 = this.x;
    const y0 = this.y;
    let dx = Math.cos(this.aimAngle);
    let dy = Math.sin(this.aimAngle);

    // Buff LASER_ACCURACY: laser ultra-panjang menjangkau seluruh gawang
    const isLaser = (this.activeBuff && this.activeBuff.id === 'LASER_ACCURACY');
    const maxDist = isLaser ? 880 : (80 + powerRatio * 420);

    let tx = Infinity;
    let ty = Infinity;

    if (dx > 0.001) tx = (bounds.right - x0) / dx;
    else if (dx < -0.001) tx = (bounds.left - x0) / dx;

    if (dy > 0.001) ty = (bounds.bottom - y0) / dy;
    else if (dy < -0.001) ty = (bounds.top - y0) / dy;

    const tHit = Math.min(tx, ty);

    ctx.save();
    ctx.lineWidth = isLaser ? 3.5 : (2.2 + powerRatio * 1.2);
    ctx.setLineDash(isLaser ? [14, 5] : [6, 5]);
    ctx.lineDashOffset = -(Date.now() * (isLaser ? 0.06 : 0.035)) % 19;
    ctx.strokeStyle = isLaser ? '#EC4899' : palette.glow;

    if (tHit < maxDist && tHit > 0) {
      // Segmen Pertama (Menuju Dinding Bumper)
      const x1 = x0 + dx * tHit;
      const y1 = y0 + dy * tHit;

      ctx.beginPath();
      ctx.moveTo(x0 + dx * (this.radius + 15), y0 + dy * (this.radius + 15));
      ctx.lineTo(x1, y1);
      ctx.stroke();

      // Titik Pantulan di Dinding
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(x1, y1, isLaser ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = isLaser ? '#F472B6' : palette.accent;
      ctx.fill();

      // Segmen Kedua (Memantul dari Dinding)
      let rdx = tx < ty ? -dx : dx;
      let rdy = ty < tx ? -dy : dy;
      const remainDist = (maxDist - tHit) * (isLaser ? 0.95 : 0.65);
      const x2 = x1 + rdx * remainDist;
      const y2 = y1 + rdy * remainDist;

      ctx.setLineDash(isLaser ? [10, 4] : [4, 4]);
      ctx.strokeStyle = isLaser ? 'rgba(236, 72, 153, 0.7)' : 'rgba(255, 255, 255, 0.35)';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Reticle Target di Ujung Laser
      if (isLaser) {
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(x2, y2, 8, 0, Math.PI * 2);
        ctx.strokeStyle = '#EC4899';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    } else {
      // Garis Bebas Langsung
      const x1 = x0 + dx * maxDist;
      const y1 = y0 + dy * maxDist;

      ctx.beginPath();
      ctx.moveTo(x0 + dx * (this.radius + 15), y0 + dy * (this.radius + 15));
      ctx.lineTo(x1, y1);
      ctx.stroke();

      if (isLaser) {
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(x1, y1, 8, 0, Math.PI * 2);
        ctx.strokeStyle = '#EC4899';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}
