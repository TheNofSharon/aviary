import * as THREE from 'three';
import { buildSongbird, makeStudio } from './bird3d';

const { renderer, scene, camera } = makeStudio(window.innerWidth, window.innerHeight);
renderer.setSize(window.innerWidth, window.innerHeight, false);
camera.aspect = window.innerWidth / window.innerHeight;
camera.updateProjectionMatrix();
document.body.appendChild(renderer.domElement);

const { root, bird, wingR, wingL } = buildSongbird();
scene.add(root);

let yaw = 0;
let pitch = 0.12;
let dist = 9.5;
let dragging = false;
let lastX = 0;
let lastY = 0;
let auto = true;

renderer.domElement.addEventListener('pointerdown', (e) => { dragging = true; auto = false; lastX = e.clientX; lastY = e.clientY; });
window.addEventListener('pointerup', () => { dragging = false; });
window.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  yaw += (e.clientX - lastX) * 0.01;
  pitch = Math.max(-0.4, Math.min(0.9, pitch + (e.clientY - lastY) * 0.005));
  lastX = e.clientX; lastY = e.clientY;
});
window.addEventListener('wheel', (e) => { dist = Math.max(5, Math.min(16, dist + e.deltaY * 0.01)); });
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  if (auto) yaw = t * 0.7;
  root.rotation.y = yaw;
  const flap = Math.sin(t * 6) * 0.5;
  wingR.rotation.x = 0.05 + flap;
  wingL.rotation.x = -0.05 - flap;
  bird.position.y = Math.sin(t * 6) * 0.04;
  bird.rotation.z = Math.sin(t * 1.3) * 0.02;
  camera.position.set(0, 1.55 + Math.sin(pitch) * dist, Math.cos(pitch) * dist);
  camera.lookAt(0, 1.55, 0);
  renderer.render(scene, camera);
});
