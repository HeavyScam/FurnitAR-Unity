import * as THREE from 'three';

const INCH = 0.0254;
const WIDTH = 0.13;
const STEP = 192; // texture pixels per labelled unit

// One ribbon whose texture is redrawn for the current length.
export class Tape {
  constructor() {
    this.group = new THREE.Group();
    this.canvas = document.createElement('canvas');
    this.canvas.height = 96;
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, WIDTH),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false, depthTest: false }),
    );
    const hook = new THREE.MeshBasicMaterial({ color: 0xc53a29, toneMapped: false, depthTest: false });
    const dot = new THREE.SphereGeometry(0.022, 20, 14);
    this.a = new THREE.Mesh(dot, hook);
    this.b = new THREE.Mesh(dot, hook);
    // Drawn over everything so the floor never cuts through the numerals.
    for (const m of [this.mesh, this.a, this.b]) m.renderOrder = 10;
    this.group.add(this.mesh, this.a, this.b);
    this.start = new THREE.Vector3();
    this.end = new THREE.Vector3();
    this.clear();
  }

  clear() {
    this.length = 0;
    this.group.visible = false;
  }

  set(a, b, metric) {
    this.start.copy(a);
    this.end.copy(b);
    this.length = a.distanceTo(b);
    this.group.visible = this.length > 0.005;
    this.a.position.copy(a);
    this.b.position.copy(b);
    this.redraw(metric);
  }

  redraw(metric) {
    if (!this.group.visible) return;
    const unit = metric ? 0.1 : INCH * 6; // a label every 10 cm or 6 in
    const label = metric ? 10 : 6;
    const div = metric ? 10 : 6;
    const px = Math.min(STEP, 4096 / (this.length / unit)); // stay inside texture limits
    const w = Math.max(8, Math.round((this.length / unit) * px));
    const c = this.canvas;
    c.width = w;
    const g = c.getContext('2d');
    g.fillStyle = '#ffcb1f';
    g.fillRect(0, 0, w, c.height);
    g.fillStyle = '#16222b';
    for (let i = 0; i * (px / div) <= w; i++) {
      const major = i % div === 0;
      const half = i % (div / 2) === 0;
      g.fillRect(i * (px / div) - 1, 0, major ? 5 : 3, major ? 46 : half ? 34 : 22);
    }
    if (px > 60) {
      g.font = '600 46px "Barlow Semi Condensed", "Arial Narrow", sans-serif';
      g.textAlign = 'right';
      for (let i = 1; i * px <= w; i++) g.fillText(String(i * label), i * px - 8, 88);
    }
    this.mesh.material.map?.dispose();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    this.mesh.material.map = t;
    this.mesh.material.needsUpdate = true;
  }

  // Twist the ribbon about its own length so its printed side faces the viewer.
  face(camera) {
    if (!this.group.visible) return;
    const x = this.end.clone().sub(this.start).normalize();
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    if (x.dot(right) < 0) x.negate(); // numerals always read left to right
    const mid = this.start.clone().add(this.end).multiplyScalar(0.5);
    const look = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld).sub(mid);
    const z = look.addScaledVector(x, -look.dot(x)).normalize();
    const y = new THREE.Vector3().crossVectors(z, x);
    this.mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    this.mesh.scale.x = this.length;
    this.mesh.position.copy(mid);
  }
}
