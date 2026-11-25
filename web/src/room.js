import * as THREE from 'three';

function planks() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d');
  const rows = 8;
  const h = c.height / rows;
  for (let r = 0; r < rows; r++) {
    for (let x = -((r * 337) % 512), n = 0; x < c.width; x += 512, n++) {
      g.fillStyle = `hsl(31 34% ${62 + ((r * 5 + (n % 2) * 3) % 8)}%)`;
      g.fillRect(x, r * h, 512, h);
      g.strokeStyle = 'rgba(70,45,20,.08)';
      for (let i = 0; i < 7; i++) {
        const y = r * h + ((i * 37 + r * 11) % h);
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + 512, y);
        g.stroke();
      }
      g.fillStyle = 'rgba(60,38,18,.4)';
      g.fillRect(x, r * h, 2, h);
    }
    g.fillStyle = 'rgba(60,38,18,.35)';
    g.fillRect(0, r * h, c.width, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(9, 9);
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createRoom(scene) {
  const group = new THREE.Group();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xcbb79c, 2.1));
  const sun = new THREE.DirectionalLight(0xfff4dc, 2.2);
  sun.position.set(-3, 4.5, 3.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.035;
  sun.shadow.radius = 6;
  Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 4, bottom: -4, near: 0.5, far: 14 });
  scene.add(sun);

  const back = -1.6;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 26).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: planks(), roughness: 0.75 }),
  );
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 12),
    new THREE.MeshLambertMaterial({ color: 0xc9d5da }),
  );
  wall.position.set(0, 6, back);
  floor.receiveShadow = wall.receiveShadow = true;
  const skirt = new THREE.Mesh(
    new THREE.BoxGeometry(40, 0.11, 0.03),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }),
  );
  skirt.position.set(0, 0.055, back + 0.015);
  group.add(floor, wall, skirt);
  scene.add(group);

  // Where furniture may stand; the camera's view is narrower than the floor.
  return { group, floor, surfaces: [floor, wall], bounds: { x: 2.6, back: back + 0.03, front: 1.6 } };
}
