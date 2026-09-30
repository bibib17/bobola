/**
 * Entitas Bola Sepak Meja
 * Memiliki massa ringan, elastisitas tinggi, dan rotasi visual bergulir.
 */
export class Ball {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = 15;
    this.mass = 0.9;
    this.rotation = 0;
    this.trail = [];
    this.isCurving = false;
    this.curveForce = 0;
    this.curveTimer = 0;
  }

  applyCurve(forceY, duration = 2.0) {
    this.isCurving = true;
    this.curveForce = forceY;
    this.curveTimer = duration;
  }

  update(dt) {
    // 1. Efek Tendangan Melengkung (Banana Curve)
    if (this.isCurving) {
      this.vy += this.curveForce * dt;
      this.curveTimer -= dt;
      const curSpeed = Math.hypot(this.vx, this.vy);
      if (this.curveTimer <= 0 || curSpeed < 20) {
        this.isCurving = false;
      }
    }

    const speed = Math.hypot(this.vx, this.vy);

    // 2. Gesekan permukaan meja (rolling friction)
    const friction = Math.pow(0.982, dt * 60);
    this.vx *= friction;
    this.vy *= friction;

    // 3. Putaran visual bola saat bergerak
    if (speed > 1) {
      this.rotation += speed * dt * 0.25;
      
      // Catat jejak partikel laju cepat
      if (speed > 70 && Math.random() > 0.35) {
        this.trail.push({
          x: this.x,
          y: this.y,
          radius: this.radius * (0.4 + Math.random() * 0.4),
          alpha: 0.6,
          color: this.isCurving ? '#C084FC' : '#FFFFFF'
        });
      }
    } else {
      this.vx = 0;
      this.vy = 0;
    }

    // 4. Update partikel jejak
    for (let i = this.trail.length - 1; i >= 0; i--) {
      this.trail[i].alpha -= dt * 3.5;
      if (this.trail[i].alpha <= 0) {
        this.trail.splice(i, 1);
      }
    }
  }

  render(ctx) {
    // 1. Jejak Gerakan Cepat (Motion Trail)
    this.trail.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color === '#C084FC' 
        ? `rgba(192, 132, 252, ${p.alpha * 0.6})` 
        : `rgba(255, 255, 255, ${p.alpha * 0.4})`;
      ctx.fill();
    });

    ctx.save();
    ctx.translate(this.x, this.y);

    // 2. Bayangan Bola
    ctx.beginPath();
    ctx.ellipse(0, 7, this.radius + 1, this.radius * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
    ctx.fill();

    // 3. Lingkaran Dasar Bola Sepak
    ctx.rotate(this.rotation);
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = '#0F172A';
    ctx.stroke();

    // 4. Pola Pentagon Hitam Sepak Bola Klasik
    // Pentagon Tengah
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
      const px = Math.cos(angle) * 5.5;
      const py = Math.sin(angle) * 5.5;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = '#1E293B';
    ctx.fill();

    // Garis Penghubung ke Tepi
    for (let i = 0; i < 5; i++) {
      const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 5.5, Math.sin(angle) * 5.5);
      ctx.lineTo(Math.cos(angle) * this.radius, Math.sin(angle) * this.radius);
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = '#1E293B';
      ctx.stroke();
    }

    // 5. Kilau Cahaya 3D (Spherical Highlight)
    const highlight = ctx.createRadialGradient(-4, -5, 1, -2, -3, this.radius);
    highlight.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
    highlight.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    highlight.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = highlight;
    ctx.fill();

    ctx.restore();
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.rotation = 0;
    this.trail = [];
    this.isCurving = false;
    this.curveForce = 0;
  }
}
