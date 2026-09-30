/**
 * Procedural Spring Dynamics Engine (Hooke's Law with Damping)
 * Digunakan untuk animasi goyang kepala bobblehead 60 FPS yang sangat ringan.
 * F = -k * x - c * v
 */
export class WobbleSpring {
  constructor({ stiffness = 120, damping = 7.5, mass = 1.0 } = {}) {
    this.k = stiffness;       // Kekakuan pegas
    this.c = damping;         // Peredam getaran
    this.m = mass;            // Massa kepala
    this.angle = 0;           // Rotasi goyang kepala (radian)
    this.velocity = 0;        // Kecepatan sudut
    this.target = 0;          // Sudut istirahat normal (0 radian)
    this.offsetX = 0;         // Translasi lateral pegas (X)
    this.velocityX = 0;
    this.offsetY = 0;         // Translasi vertikal pegas (Y)
    this.velocityY = 0;
    this.idleTimer = Math.random() * 10;
  }

  update(dt) {
    // 1. Idle breathing subtle oscillation jika sedang tidak bergerak
    this.idleTimer += dt * 2.5;
    const idleTargetAngle = Math.sin(this.idleTimer) * 0.035;

    // 2. Angular Spring (Goyangan Rotasi Kepala)
    const springTorque = -this.k * (this.angle - (this.target + idleTargetAngle)) - this.c * this.velocity;
    const angularAccel = springTorque / this.m;
    this.velocity += angularAccel * dt;
    this.angle += this.velocity * dt;

    // 3. Linear Springs (Pergeseran X dan Y saat inersia/tabrakan)
    const forceX = -this.k * this.offsetX - this.c * this.velocityX;
    const forceY = -this.k * this.offsetY - this.c * this.velocityY;
    this.velocityX += (forceX / this.m) * dt;
    this.velocityY += (forceY / this.m) * dt;
    this.offsetX += this.velocityX * dt;
    this.offsetY += this.velocityY * dt;
  }

  /**
   * Menambahkan impuls benturan ke kepala (misal saat tabrakan bola/dinding/karakter)
   * @param {number} impactAngle Sudut arah datangnya benturan
   * @param {number} force Besaran gaya impuls
   */
  applyImpact(impactAngle, force) {
    const factor = Math.min(force * 0.08, 12.0);
    this.velocity += (Math.random() > 0.5 ? 1 : -1) * factor * 1.5;
    this.velocityX += Math.cos(impactAngle) * factor * 1.8;
    this.velocityY += Math.sin(impactAngle) * factor * 1.8;
  }

  /**
   * Efek tertinggal inersia saat karakter meluncur kencang
   */
  applyDrift(vx, vy) {
    const speed = Math.hypot(vx, vy);
    if (speed > 10) {
      const moveAngle = Math.atan2(vy, vx);
      // Kepala condong ke belakang berlawanan arah laju
      this.offsetX = -Math.cos(moveAngle) * Math.min(speed * 0.03, 8);
      this.offsetY = -Math.sin(moveAngle) * Math.min(speed * 0.03, 8);
    }
  }

  reset() {
    this.angle = 0;
    this.velocity = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.velocityX = 0;
    this.velocityY = 0;
  }
}
