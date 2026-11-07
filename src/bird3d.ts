import * as THREE from 'three';

export interface Bird3DPalette {
  body: number;
  belly: number;
  wing: number;
  beak: number;
  leg: number;
  cheek: number;
}

export const SONGBIRD_PALETTE: Bird3DPalette = {
  body: 0x00b4a0,
  belly: 0xffd166,
  wing: 0xf3722c,
  beak: 0xffa31a,
  leg: 0xf08c28,
  cheek: 0xff758f,
};

const mat = (color: number, rough = 0.62) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.02 });

function ellipsoid(rx: number, ry: number, rz: number, material: THREE.Material, seg = 40) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75)), material);
  m.scale.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Wing: a flattened, curved ellipsoid with layered primary feathers (real geometry). */
function buildWing(p: Bird3DPalette, side: 1 | -1) {
  const g = new THREE.Group();
  const wMat = mat(p.wing, 0.7);
  const dark = mat(new THREE.Color(p.wing).multiplyScalar(0.62).getHex(), 0.75);

  const covert = ellipsoid(0.62, 0.34, 0.12, wMat);
  covert.position.set(-0.28, 0, 0);
  g.add(covert);

  for (let i = 0; i < 6; i++) {
    const len = 0.7 + i * 0.08;
    const feather = ellipsoid(len * 0.5, 0.075, 0.035, i % 2 ? dark : wMat, 20);
    feather.position.set(-0.78 - i * 0.05, 0.18 - i * 0.075, -0.01 * i);
    feather.rotation.z = -0.08 - i * 0.05;
    g.add(feather);
  }
  g.position.set(0.0, 0.05, side * 0.62);
  g.rotation.y = side * 0.14;
  g.rotation.x = side * 0.05;
  return g;
}

/** Builds a fully modelled 3D songbird facing +X, feet at y = 0. */
export function buildSongbird(p: Bird3DPalette = SONGBIRD_PALETTE) {
  const root = new THREE.Group();
  const bird = new THREE.Group();
  root.add(bird);

  const bodyM = mat(p.body, 0.55);
  const bellyM = mat(p.belly, 0.7);

  // Torso (egg-shaped) + belly
  const torso = ellipsoid(1.0, 0.88, 0.82, bodyM, 56);
  torso.position.set(0, 1.25, 0);
  bird.add(torso);
  const belly = ellipsoid(0.82, 0.7, 0.72, bellyM, 48);
  belly.position.set(0.18, 1.05, 0);
  bird.add(belly);

  // Head
  const head = ellipsoid(0.86, 0.8, 0.8, bodyM, 48);
  head.position.set(0.7, 2.05, 0);
  bird.add(head);
  const cheekL = ellipsoid(0.12, 0.09, 0.05, mat(p.cheek, 0.8), 16);
  cheekL.position.set(1.15, 1.9, 0.62);
  const cheekR = cheekL.clone();
  cheekR.position.z = -0.62;
  bird.add(cheekL, cheekR);

  // Crown crest feathers
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.5 - i * 0.07, 12), mat(p.wing, 0.7));
    c.position.set(0.45 - i * 0.14, 2.82 - i * 0.03, 0);
    c.rotation.z = 0.2 + i * 0.28;
    c.castShadow = true;
    bird.add(c);
  }

  // Beak: upper & lower mandible cones with real volume
  const beakM = mat(p.beak, 0.4);
  const upper = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 24), beakM);
  upper.rotation.z = -Math.PI / 2;
  upper.position.set(1.95, 2.0, 0);
  upper.scale.set(1, 1, 0.9);
  const lower = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.58, 20), mat(0xe0870d, 0.45));
  lower.rotation.z = -Math.PI / 2;
  lower.position.set(1.85, 1.8, 0);
  upper.castShadow = lower.castShadow = true;
  bird.add(upper, lower);

  // Eyes: glossy sphere + iris + pupil + catchlight on both sides
  for (const s of [1, -1]) {
    const eye = new THREE.Group();
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.24, 28, 20), mat(0xffffff, 0.15));
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 16), mat(0x78350f, 0.2));
    iris.position.x = 0.1;
    iris.scale.x = 0.55;
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.115, 20, 14), mat(0x050505, 0.1));
    pupil.position.x = 0.15;
    pupil.scale.x = 0.5;
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    glint.position.set(0.22, 0.07, -0.04);
    eye.add(white, iris, pupil, glint);
    eye.position.set(1.28, 2.2, s * 0.5);
    eye.rotation.y = -s * 0.5;
    bird.add(eye);
  }

  // Tail: fan of tapered feathers
  for (let i = -2; i <= 2; i++) {
    const f = ellipsoid(0.62, 0.05, 0.12, i % 2 ? mat(p.wing, 0.7) : mat(p.body, 0.6), 20);
    f.position.set(-1.15, 1.0 + Math.abs(i) * -0.03, i * 0.13);
    f.rotation.z = 0.35 + Math.abs(i) * 0.04;
    f.rotation.y = i * 0.1;
    bird.add(f);
  }

  // Legs & gripping toes
  const legM = mat(p.leg, 0.5);
  for (const s of [1, -1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.62, 12), legM);
    leg.position.set(0.1, 0.38, s * 0.3);
    leg.castShadow = true;
    bird.add(leg);
    for (const a of [-0.3, 0, 0.3]) {
      const toe = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.34, 6, 10), legM);
      toe.rotation.z = Math.PI / 2;
      toe.rotation.y = a;
      toe.position.set(0.3, 0.04, s * 0.3 + Math.sin(a) * 0.15);
      toe.castShadow = true;
      bird.add(toe);
    }
    const hallux = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.22, 6, 10), legM);
    hallux.rotation.z = Math.PI / 2;
    hallux.position.set(-0.15, 0.04, s * 0.3);
    bird.add(hallux);
  }

  const wingR = buildWing(p, 1);
  const wingL = buildWing(p, -1);
  wingR.position.set(-0.1, 1.45, 0.72);
  wingL.position.set(-0.1, 1.45, -0.72);
  bird.add(wingR, wingL);

  return { root, bird, wingR, wingL };
}

export function makeStudio(width: number, height: number, transparent = true) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: transparent, preserveDrawingBuffer: true });
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xdff3ff, 0x6b5a3a, 1.05));
  const sun = new THREE.DirectionalLight(0xfff1d0, 2.6);
  sun.position.set(-4, 7, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -4;
  sun.shadow.camera.right = 4;
  sun.shadow.camera.top = 4;
  sun.shadow.camera.bottom = -4;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x9fd8ff, 1.0);
  rim.position.set(5, 3, -5);
  scene.add(rim);

  const ground = new THREE.Mesh(new THREE.CircleGeometry(4, 48), new THREE.ShadowMaterial({ opacity: 0.28 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 100);
  camera.position.set(0, 2.4, 9.5);
  camera.lookAt(0, 1.55, 0);

  return { renderer, scene, camera };
}

/** Renders a real-3D turntable of the model (yaw 0..2π) into canvases usable as Phaser textures. */
export function renderTurntable(
  model: THREE.Object3D,
  frames = 24,
  size = 256
): HTMLCanvasElement[] {
  const { renderer, scene, camera } = makeStudio(size, size);
  scene.add(model);
  const out: HTMLCanvasElement[] = [];
  for (let i = 0; i < frames; i++) {
    model.rotation.y = (i / frames) * Math.PI * 2;
    renderer.render(scene, camera);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    c.getContext('2d')!.drawImage(renderer.domElement, 0, 0);
    out.push(c);
  }
  renderer.dispose();
  return out;
}
