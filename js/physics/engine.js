import { BuffManager } from '../entities/buffManager.js';

/**
 * Physics Engine untuk Arena Meja Sepak Bola - BolaBola Stadium Pro
 * Mengatur tabrakan lingkaran, pantulan bumper membulat, LED advertising board, dan sistem Buff Lapangan.
 */
export class PhysicsEngine {
  constructor({ width = 960, height = 540, soundFX = null } = {}) {
    this.width = width;
    this.height = height;
    this.soundFX = soundFX;

    // Sistem Buff Lapangan Dinamis (Spawn 1 per 1, Berfungsi di Turn Berikutnya)
    this.buffManager = new BuffManager({
      width: this.width,
      height: this.height,
      soundFX: this.soundFX
    });

    // Dimensi Arena Dalam (Bumper Meja Dioptimalkan Penuh Layar)
    this.padding = 24;
    this.rinkLeft = this.padding;
    this.rinkRight = this.width - this.padding;
    this.rinkTop = 14;
    this.rinkBottom = this.height - 14;
    this.cornerRadius = 48;

    // Dimensi Gawang
    this.goalWidth = 24;
    this.goalHeight = 160;
    this.goalTop = (this.height - this.goalHeight) / 2;
    this.goalBottom = this.goalTop + this.goalHeight;

    // Power-Up Kotak Petir di Tengah Atas
    this.powerCube = {
      x: this.width / 2,
      y: this.height / 2 - 110,
      baseY: this.height / 2 - 110,
      size: 44,
      active: true,
      respawnTimer: 0,
      glowPulse: 0,
      floatOffset: 0
    };

    // Partikel Efek Ledakan / Shockwave
    this.particles = [];
    this.callouts = [];
    this.ledMarqueeOffset = 0;
  }

  getBounds() {
    return {
      left: this.rinkLeft + 27,
      right: this.rinkRight - 27,
      top: this.rinkTop + 27,
      bottom: this.rinkBottom - 27
    };
  }

  addCallout(x, y, text, color = '#FACC15') {
    this.callouts.push({
      x,
      y,
      text,
      color,
      life: 1.2,
      maxLife: 1.2,
      vy: -35
    });
  }

  update(dt, entities, ball, onGoalCallback) {
    this.updateParticles(dt);
    this.updateCallouts(dt);
    this.ledMarqueeOffset += dt * 38; // Animasi marquee LED ribbon

    // 1. Update Buff Manager (Floating Buff Item, Deteksi Pengambilan, Deployed Barriers, Jejak Nitro)
    this.buffManager.update(dt, entities, ball, (x, y, text, color) => this.addCallout(x, y, text, color));

    // 2. Update Posisi Karakter & Bola
    entities.forEach(e => {
      e.x += e.vx * dt;
      e.y += e.vy * dt;

      // Gesekan lantai meja
      const charFriction = Math.pow(0.978, dt * 60);
      e.vx *= charFriction;
      e.vy *= charFriction;

      if (Math.hypot(e.vx, e.vy) < 2) {
        e.vx = 0;
        e.vy = 0;
      }
    });

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // 3. Tabrakan Antar Karakter (Bobble vs Bobble)
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        this.resolveCircleCollision(entities[i], entities[j]);
      }
    }

    // 4. Tabrakan Karakter vs Bola
    entities.forEach(char => {
      this.resolveCircleCollision(char, ball, true);
    });

    // 5. Batas Dinding & Deteksi Gol
    this.handleEntityWallCollision(ball, true, onGoalCallback);
    entities.forEach(char => {
      this.handleEntityWallCollision(char, false);
    });
  }

  resolveCircleCollision(a, b, isBall = false) {
    // EFEK BUFF: GHOST_PHASE (Kebal Halangan & Tembus Koin Musuh)
    if (!isBall) {
      if ((a.activeBuff && a.activeBuff.id === 'GHOST_PHASE') || (b.activeBuff && b.activeBuff.id === 'GHOST_PHASE')) {
        return; // Melewati koin lain tanpa tertahan atau terpental
      }
    }

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    const minDist = a.radius + b.radius;

    if (dist < minDist && dist > 0.001) {
      // Normal vector
      const nx = dx / dist;
      const ny = dy / dist;

      // Pisahkan posisi agar tidak saling tembus (penetration resolution)
      const overlap = (minDist - dist) * 0.52;
      a.x -= nx * overlap;
      a.y -= ny * overlap;
      b.x += nx * overlap;
      b.y += ny * overlap;

      // EFEK BUFF: HEAVY_SHIELD (Tahan Tabrakan Lawan)
      let massA = a.mass || 1.0;
      let massB = b.mass || 1.0;
      const isShieldA = (!isBall && a.activeBuff && a.activeBuff.id === 'HEAVY_SHIELD');
      const isShieldB = (!isBall && b.activeBuff && b.activeBuff.id === 'HEAVY_SHIELD');

      if (isShieldA) massA *= 6.0;
      if (isShieldB) massB *= 6.0;

      // Kecepatan relatif sepanjang normal
      const kx = a.vx - b.vx;
      const ky = a.vy - b.vy;
      const p = 2 * (nx * kx + ny * ky) / (massA + massB);

      // Koefisien elastisitas pantulan
      const restitution = isBall ? 1.28 : 0.95;

      a.vx -= p * massB * nx * restitution;
      a.vy -= p * massB * ny * restitution;
      b.vx += p * massA * nx * restitution;
      b.vy += p * massA * ny * restitution;

      // Redam hentakan recoil bagi pemegang perisai
      if (isShieldA) {
        a.vx *= 0.25;
        a.vy *= 0.25;
        this.addCallout(a.x, a.y - 20, '🛡️ SHIELD DEFLECTION!', '#10B981');
      }
      if (isShieldB) {
        b.vx *= 0.25;
        b.vy *= 0.25;
        this.addCallout(b.x, b.y - 20, '🛡️ SHIELD DEFLECTION!', '#10B981');
      }

      // EFEK BUFF: CURVE_KICK (Tendangan Melengkung)
      if (isBall && a.activeBuff && a.activeBuff.id === 'CURVE_KICK') {
        const curveDir = (b.y < 270) ? 290 : -290;
        b.applyCurve(curveDir, 1.8);
        this.addCallout(b.x, b.y - 25, '🌪️ BANANA CURVE SHOT!', '#8B5CF6');
        if (this.soundFX) this.soundFX.playBoing(1.7);
      }

      // Impuls goyang pada kepala karakter & reaksi ekspresi
      const impactForce = Math.hypot(kx, ky);
      const impactAngle = Math.atan2(ny, nx);

      if (a.spring) {
        a.spring.applyImpact(impactAngle + Math.PI, impactForce);
        if (a.triggerImpactReaction) a.triggerImpactReaction(impactForce);
      }
      if (b.spring) {
        b.spring.applyImpact(impactAngle, impactForce);
        if (b.triggerImpactReaction) b.triggerImpactReaction(impactForce);
      }

      // Efek Partikel Percikan Benturan
      if (impactForce > 60) {
        const contactX = a.x + nx * a.radius;
        const contactY = a.y + ny * a.radius;
        for (let i = 0; i < 6; i++) {
          const spAngle = Math.random() * Math.PI * 2;
          const spSpeed = 30 + Math.random() * 80;
          this.particles.push({
            x: contactX,
            y: contactY,
            vx: Math.cos(spAngle) * spSpeed,
            vy: Math.sin(spAngle) * spSpeed,
            color: isBall ? '#FFFFFF' : '#FACC15',
            radius: 2 + Math.random() * 3,
            life: 0.35
          });
        }
      }

      // Efek Suara
      if (this.soundFX && impactForce > 20) {
        if (isBall) this.soundFX.playKick(impactForce * 0.02);
        else this.soundFX.playBoing(0.9 + Math.random() * 0.3);
      }
    }
  }

  handleEntityWallCollision(obj, isBall = false, onGoalCallback = null) {
    const left = this.rinkLeft + obj.radius;
    const right = this.rinkRight - obj.radius;
    const top = this.rinkTop + obj.radius;
    const bottom = this.rinkBottom - obj.radius;
    const bounciness = isBall ? 0.90 : 0.76;

    // Dinding Atas & Bawah
    if (obj.y < top) {
      obj.y = top;
      obj.vy = -obj.vy * bounciness;
      if (this.soundFX && Math.abs(obj.vy) > 15) this.soundFX.playBounce();
      if (obj.spring) obj.spring.applyImpact(Math.PI / 2, Math.abs(obj.vy));
      this.emitWallSparks(obj.x, top, 0, 1);
    } else if (obj.y > bottom) {
      obj.y = bottom;
      obj.vy = -obj.vy * bounciness;
      if (this.soundFX && Math.abs(obj.vy) > 15) this.soundFX.playBounce();
      if (obj.spring) obj.spring.applyImpact(-Math.PI / 2, Math.abs(obj.vy));
      this.emitWallSparks(obj.x, bottom, 0, -1);
    }

    // Deteksi Mulut Gawang
    const inGoalVertical = obj.y >= this.goalTop && obj.y <= this.goalBottom;

    // Sisi Kiri
    if (obj.x < left) {
      if (inGoalVertical && isBall) {
        // Bola masuk ke dalam ruang jaring gawang kiri
        const netBackLeft = this.rinkLeft - this.goalWidth + obj.radius;
        if (obj.x < netBackLeft) {
          obj.x = netBackLeft;
          obj.vx = -obj.vx * 0.25; // Redam benturan di jaring belakang
        }
        if (obj.y < this.goalTop + obj.radius) {
          obj.y = this.goalTop + obj.radius;
          obj.vy = Math.abs(obj.vy) * 0.3; // Redam di jaring atas
        } else if (obj.y > this.goalBottom - obj.radius) {
          obj.y = this.goalBottom - obj.radius;
          obj.vy = -Math.abs(obj.vy) * 0.3; // Redam di jaring bawah
        }

        // Gol tercatat saat seluruh bola melintasi garis gawang kiri (Tim Biru mencetak gol)
        if (obj.x + obj.radius < this.rinkLeft) {
          if (onGoalCallback) onGoalCallback('BLUE');
        }
      } else {
        if (isBall && (Math.abs(obj.y - this.goalTop) < 20 || Math.abs(obj.y - this.goalBottom) < 20)) {
          if (this.soundFX) this.soundFX.playPostClang();
          this.addCallout(obj.x + 35, obj.y, 'OFF THE POST! 🔔', '#FACC15');
        } else if (this.soundFX && Math.abs(obj.vx) > 15) {
          this.soundFX.playBounce();
        }
        obj.x = left;
        obj.vx = -obj.vx * bounciness;
        if (obj.spring) obj.spring.applyImpact(0, Math.abs(obj.vx));
        this.emitWallSparks(left, obj.y, 1, 0);
      }
    }

    // Sisi Kanan
    if (obj.x > right) {
      if (inGoalVertical && isBall) {
        // Bola masuk ke dalam ruang jaring gawang kanan
        const netBackRight = this.rinkRight + this.goalWidth - obj.radius;
        if (obj.x > netBackRight) {
          obj.x = netBackRight;
          obj.vx = -obj.vx * 0.25; // Redam benturan di jaring belakang
        }
        if (obj.y < this.goalTop + obj.radius) {
          obj.y = this.goalTop + obj.radius;
          obj.vy = Math.abs(obj.vy) * 0.3; // Redam di jaring atas
        } else if (obj.y > this.goalBottom - obj.radius) {
          obj.y = this.goalBottom - obj.radius;
          obj.vy = -Math.abs(obj.vy) * 0.3; // Redam di jaring bawah
        }

        // Gol tercatat saat seluruh bola melintasi garis gawang kanan (Tim Merah mencetak gol)
        if (obj.x - obj.radius > this.rinkRight) {
          if (onGoalCallback) onGoalCallback('RED');
        }
      } else {
        if (isBall && (Math.abs(obj.y - this.goalTop) < 20 || Math.abs(obj.y - this.goalBottom) < 20)) {
          if (this.soundFX) this.soundFX.playPostClang();
          this.addCallout(obj.x - 35, obj.y, 'OFF THE POST! 🔔', '#FACC15');
        } else if (this.soundFX && Math.abs(obj.vx) > 15) {
          this.soundFX.playBounce();
        }
        obj.x = right;
        obj.vx = -obj.vx * bounciness;
        if (obj.spring) obj.spring.applyImpact(Math.PI, Math.abs(obj.vx));
        this.emitWallSparks(right, obj.y, -1, 0);
      }
    }
  }

  emitWallSparks(x, y, nx, ny) {
    for (let i = 0; i < 4; i++) {
      const angle = Math.atan2(ny, nx) + (Math.random() - 0.5) * 1.5;
      const speed = 40 + Math.random() * 80;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: '#38BDF8',
        radius: 2 + Math.random() * 2,
        life: 0.3
      });
    }
  }

  checkPowerCubeCollision(char) {
    const cube = this.powerCube;
    const half = cube.size / 2;
    const nearestX = Math.max(cube.x - half, Math.min(char.x, cube.x + half));
    const nearestY = Math.max(cube.y - half, Math.min(char.y, cube.y + half));
    const dist = Math.hypot(char.x - nearestX, char.y - nearestY);

    if (dist < char.radius) {
      // Tabrakan dengan kotak petir!
      cube.active = false;
      cube.respawnTimer = 16;
      if (char.matchStats) char.matchStats.pickups++;

      // Dorongan kecepatan super
      const speed = Math.hypot(char.vx, char.vy);
      const angle = speed > 5 ? Math.atan2(char.vy, char.vx) : char.facingAngle;
      char.vx = Math.cos(angle) * Math.max(speed * 1.85, 420);
      char.vy = Math.sin(angle) * Math.max(speed * 1.85, 420);

      if (char.spring) char.spring.applyImpact(angle, 160);
      if (this.soundFX) {
        this.soundFX.playZap();
        this.soundFX.triggerHaptic(45);
      }
      this.addCallout(cube.x, cube.y - 25, '⚡ POWER BOOST! ⚡', '#38BDF8');

      // Buat percikan petir elektrik
      for (let i = 0; i < 28; i++) {
        const pAngle = Math.random() * Math.PI * 2;
        const pSpeed = 80 + Math.random() * 180;
        this.particles.push({
          x: cube.x,
          y: cube.y,
          vx: Math.cos(pAngle) * pSpeed,
          vy: Math.sin(pAngle) * pSpeed,
          color: ['#38BDF8', '#FACC15', '#FFFFFF'][Math.floor(Math.random() * 3)],
          radius: 3 + Math.random() * 4,
          life: 0.7
        });
      }
    }
  }

  updatePowerCube(dt) {
    if (!this.powerCube.active) {
      this.powerCube.respawnTimer -= dt;
      if (this.powerCube.respawnTimer <= 0) {
        this.powerCube.active = true;
      }
    } else {
      this.powerCube.glowPulse += dt * 3.5;
      // Efek melayang perlahan secara sinusoidal
      this.powerCube.floatOffset = Math.sin(Date.now() * 0.004) * 5;
      this.powerCube.y = this.powerCube.baseY + this.powerCube.floatOffset;
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  updateCallouts(dt) {
    for (let i = this.callouts.length - 1; i >= 0; i--) {
      const c = this.callouts[i];
      c.y += c.vy * dt;
      c.life -= dt;
      if (c.life <= 0) {
        this.callouts.splice(i, 1);
      }
    }
  }

  renderCallouts(ctx) {
    this.callouts.forEach(c => {
      ctx.save();
      const alpha = Math.min(1, c.life / (c.maxLife * 0.3));
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.font = '900 16px Fredoka, Outfit, sans-serif';
      ctx.fillStyle = c.color;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 8;
      ctx.fillText(c.text, c.x, c.y);
      ctx.restore();
    });
  }

  render(ctx) {
    // 1. Lapisan Kayu Eksterior Meja (Tabletop Wooden Bezel & Metallic Trim)
    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, this.width, this.height);

    // Bezel Kayu Walnut Luar
    const outerBezelGrad = ctx.createLinearGradient(0, 0, this.width, this.height);
    outerBezelGrad.addColorStop(0, '#1e1b4b');
    outerBezelGrad.addColorStop(0.5, '#0f172a');
    outerBezelGrad.addColorStop(1, '#020617');
    ctx.fillStyle = outerBezelGrad;
    ctx.beginPath();
    ctx.roundRect(10, 10, this.width - 20, this.height - 20, this.cornerRadius + 12);
    ctx.fill();

    // 2. LED Perimeter Ribbon Board (Running Tournament Text)
    this.renderLEDBoard(ctx);

    // 3. Lapangan Hijau Meja (Stadium Pitch Turf dengan Garis Potong Rumput)
    const rinkWidth = this.rinkRight - this.rinkLeft;
    const rinkHeight = this.rinkBottom - this.rinkTop;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(this.rinkLeft, this.rinkTop, rinkWidth, rinkHeight, this.cornerRadius);
    ctx.clip(); // Potong rumput agar pas di dalam bumper

    // Gradien Warna Rumput Meja
    const turfGrad = ctx.createLinearGradient(0, this.rinkTop, 0, this.rinkBottom);
    turfGrad.addColorStop(0, '#0284C7');
    turfGrad.addColorStop(1, '#0369A1');
    ctx.fillStyle = turfGrad;
    ctx.fillRect(this.rinkLeft, this.rinkTop, rinkWidth, rinkHeight);

    // Garis Jalur Rumput Bergantian (Alternating Pitch Stripes)
    const stripeCount = 14;
    const stripeWidth = rinkWidth / stripeCount;
    for (let i = 0; i < stripeCount; i++) {
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(this.rinkLeft + i * stripeWidth, this.rinkTop, stripeWidth, rinkHeight);
      }
    }

    // 4. Garis Marka Lapangan Sepak Bola
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 3.5;

    // Garis Tengah & Lingkaran Tengah
    ctx.beginPath();
    ctx.moveTo(this.width / 2, this.rinkTop);
    ctx.lineTo(this.width / 2, this.rinkBottom);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(this.width / 2, this.height / 2, 70, 0, Math.PI * 2);
    ctx.stroke();

    // Titik Tengah
    ctx.beginPath();
    ctx.arc(this.width / 2, this.height / 2, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    // Kotak Penalti Kiri
    ctx.strokeRect(this.rinkLeft, this.goalTop - 35, 115, this.goalHeight + 70);
    ctx.beginPath();
    ctx.arc(this.rinkLeft + 115, this.height / 2, 35, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();

    // Kotak Penalti Kanan
    ctx.strokeRect(this.rinkRight - 115, this.goalTop - 35, 115, this.goalHeight + 70);
    ctx.beginPath();
    ctx.arc(this.rinkRight - 115, this.height / 2, 35, Math.PI / 2, -Math.PI / 2);
    ctx.stroke();

    ctx.restore(); // Lepas klip lapangan

    // 5. Gawang Kiri & Kanan (Jaring 3D & Tiang Bercahaya)
    this.renderGoalNet(ctx, this.rinkLeft - this.goalWidth, this.goalTop, this.goalWidth, this.goalHeight, 'LEFT');
    this.renderGoalNet(ctx, this.rinkRight, this.goalTop, this.goalWidth, this.goalHeight, 'RIGHT');

    // 6. Bumper Tebal Meja (Outer Curved White Rails with Metallic Highlights)
    ctx.strokeStyle = '#F8FAFC';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.roundRect(this.rinkLeft, this.rinkTop, rinkWidth, rinkHeight, this.cornerRadius);
    ctx.stroke();

    // Kilau Glossy Bumper Rail
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(this.rinkLeft - 5, this.rinkTop - 5, rinkWidth + 10, rinkHeight + 10, this.cornerRadius + 4);
    ctx.stroke();

    // 7. Render Buff Manager (Item Buff Melayang & Rintangan Deployed Barriers)
    this.buffManager.render(ctx);

    // 8. Partikel Percikan Efek
    this.particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    });

    // 9. Floating Announcer Callouts
    this.renderCallouts(ctx);

    ctx.restore();
  }

  renderLEDBoard(ctx) {
    // Clean subtle glow accent along top perimeter
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.rinkLeft + this.cornerRadius, 4);
    ctx.lineTo(this.rinkRight - this.cornerRadius, 4);
    ctx.stroke();
    ctx.restore();
  }

  renderGoalNet(ctx, x, y, w, h, side) {
    ctx.save();
    // Kedalaman gawang gelap
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.fillRect(x, y, w, h);

    // Tiang gawang merah / biru beriluminasi
    ctx.strokeStyle = side === 'LEFT' ? '#EF4444' : '#3B82F6';
    ctx.lineWidth = 4.5;
    ctx.strokeRect(x, y, w, h);

    // Jala Gawang
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1.2;
    for (let gy = y + 14; gy < y + h; gy += 15) {
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x + w, gy);
      ctx.stroke();
    }
    for (let gx = x + 7; gx < x + w; gx += 9) {
      ctx.beginPath();
      ctx.moveTo(gx, y);
      ctx.lineTo(gx, y + h);
      ctx.stroke();
    }

    // Label GOAL Vertikal
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 13px Fredoka, Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(side === 'LEFT' ? x + 16 : x + 18, y + h / 2);
    ctx.rotate(side === 'LEFT' ? -Math.PI / 2 : Math.PI / 2);
    ctx.fillText('GOAL', 0, 5);
    ctx.restore();

    ctx.restore();
  }

  renderPowerCube(ctx) {
    const cube = this.powerCube;
    const pulse = 1 + Math.sin(cube.glowPulse) * 0.14;

    ctx.save();
    ctx.translate(cube.x, cube.y);

    // Bayangan Mengambang di Lantai
    ctx.beginPath();
    ctx.ellipse(0, 24 - cube.floatOffset, 18, 7, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
    ctx.fill();

    // Efek Cahaya Pijar Biru Neon
    const glow = ctx.createRadialGradient(0, 0, 10, 0, 0, cube.size * pulse);
    glow.addColorStop(0, 'rgba(56, 189, 248, 0.75)');
    glow.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, cube.size * pulse, 0, Math.PI * 2);
    ctx.fill();

    // Kotak Fisik Biru Neon 3D
    const half = cube.size / 2;
    ctx.fillStyle = '#0284C7';
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(-half, -half, cube.size, cube.size, 10);
    ctx.fill();
    ctx.stroke();

    // Ikon Petir Kuning Emas
    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.moveTo(3, -13);
    ctx.lineTo(-9, 2);
    ctx.lineTo(0, 2);
    ctx.lineTo(-3, 13);
    ctx.lineTo(9, -2);
    ctx.lineTo(0, -2);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  isAtRest(entities, ball) {
    const ballSpeed = Math.hypot(ball.vx, ball.vy);
    if (ballSpeed > 5) return false;

    for (let char of entities) {
      if (Math.hypot(char.vx, char.vy) > 5) return false;
    }
    return true;
  }
}
