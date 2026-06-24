// Babel Three.js — Main entry point
// Biblioteca de Babel en 3D: hexágonos infinitos con pozo central
//
// Arquitectura:
//   FloorPool — pre-asigna todos los pisos con LOD por distancia.
//   No se crean/destruyen grupos en runtime: se recicla visibilidad.
//   Culling vertical por frustum+pitch para mantener 60 FPS en cualquier dirección.

import * as THREE from 'three';
import { FPSCamera } from './camera.js';
import { createHexGrid, worldToHex } from './geometry.js';
import { flickerLamps } from './lamp.js';
import { FloorPool } from './floorpool.js';
import {
  HEX_RADIUS, HEX_HEIGHT,
  CENTER_HOLE_RADIUS,
  PLAYER_HEIGHT,
} from './constants.js';
import { HUD } from './hud.js';
import { BookInspector } from './bookInspector.js';

// ─── Setup renderer ───
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
// Exposure se ajusta DESPUÉS de las luces — ver bloque "Lights" abajo.
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

// ─── Scene ───
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0a); // casi negro
// Niebla más suave — antes 0.012 (tragaba las salas contiguas).
// 0.004 deja ver ~5 hexes a la redonda antes de diluir, manteniendo el
// sentido de infinito de la Biblioteca pero permitiendo orientarse.
scene.fog = new THREE.FogExp2(0x141008, 0.004);

// ─── Camera ───
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200);
const fpsCamera = new FPSCamera(camera, renderer.domElement);

// ─── Lights ───
// Iluminación borgiana: penumbra cálida. La Biblioteca es tenebrosa, no
// oscura total. Subimos ambient + hemisphere para que el player NUNCA quede
// a ciegas: incluso en salas sin lámparas individuales (la mayoría del pool)
// siempre hay luz tenue suficiente para orientarse. Las lámparas de aceite
// con PointLight dan calidez/puntualidad a las salas iluminadas.
const ambientLight = new THREE.AmbientLight(0x6a5840, 0.9); // base cálida
scene.add(ambientLight);

// Hemisphere: simulamos la "luz del techo invisible" de cada sala —
// tenue, ligeramente fría arriba y cálida abajo para diferenciar
// piso/techo. Se combina con el ambient para evitar el efecto plano.
const hemiLight = new THREE.HemisphereLight(0x7a6048, 0x3a2820, 0.55);
hemiLight.position.set(0, 50, 0);
scene.add(hemiLight);

// Tope direccional bajado — antes 0.8 saturaba las caras superiores.
// Ahora 0.3 marca la dirección vertical sin quemar el techo.
const topLight = new THREE.DirectionalLight(0xffd78f, 0.3);
topLight.position.set(0, 30, 0);
scene.add(topLight);

const bottomLight = new THREE.DirectionalLight(0x4a3a6a, 0.15);
bottomLight.position.set(0, -30, 0);
scene.add(bottomLight);

// ─── FloorPool — gestor de pisos con LOD + pool de objetos ───
// Pool de grupos pre-asignados: nunca se crean/destruyen en runtime.
// Cada piso se asigna con LOD según distancia al centro.
// ─── Instancia del pool ───
const hexGrid = createHexGrid(1);
const floorPool = new FloorPool(scene, hexGrid);

// Pasar triggers de escaleras a la cámara
fpsCamera.setStairTriggers(floorPool.getStairTriggers());

// Inyectar fuente de colisionadores — el pool los calcula on-demand desde
// el hex del player (anillo 1 = 7 hexes) usando physics.collidersForArea.
fpsCamera.getColliders = () => floorPool.getCollidersAt(
  camera.position.x,
  camera.position.z,
);

// ─── Suelo invisible (para no caer al vacío) ───
const groundRing = new THREE.Mesh(
  new THREE.RingGeometry(CENTER_HOLE_RADIUS, HEX_RADIUS * 3, 64),
  new THREE.MeshStandardMaterial({
    color: 0x1a0a0a,
    roughness: 1,
    transparent: true,
    opacity: 0.1,
    side: THREE.DoubleSide,
  })
);
groundRing.rotation.x = -Math.PI / 2;
groundRing.position.y = -0.05;
scene.add(groundRing);

// ─── HUD borgiano ───
const hud = new HUD();

// ─── Inspector de libros (raycaster + modal DOM) ───
const bookInspector = new BookInspector(scene, camera, floorPool.bookWalls);

// Click izquierdo mientras el puntero está bloqueado → inspecciona libro.
// Sin lock, el listener de FPSCamera pide el lock.
// Si el modal ya está abierto, el listener del overlay se encarga.
document.addEventListener('click', () => {
  if (!document.pointerLockElement) return;
  if (bookInspector.isOpen()) return;
  bookInspector.inspectFromCenter();
});

// Cerrar el modal devuelve el control: pide pointer lock de nuevo.
const _origClose = bookInspector.close.bind(bookInspector);
bookInspector.close = () => {
  _origClose();
  // Re-pedir pointer lock al cerrar el modal (UX de "volver al juego").
  // Pequeño delay para que el navegador no ignore el request por el click
  // sintético que disparó el cierre.
  setTimeout(() => renderer.domElement.requestPointerLock(), 50);
};

// ─── FPS smoothing (EMA) ───
let fpsSmooth = 60;
const FPS_ALPHA = 0.08;

// ─── Window resize ───
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Detección de escaleras para HUD ───
const stairTriggers = floorPool.getStairTriggers();

function checkNearStair(cameraPos) {
  const triggerRadius = 2.8; // más generoso que el trigger real (1.6) para avisar antes
  const floorY = cameraPos.y - PLAYER_HEIGHT;
  const halfTrigger = 1.6; // radio real de activación en stairTransition.js

  for (const t of stairTriggers) {
    const dx = cameraPos.x - t.worldX;
    const dz = cameraPos.z - t.worldZ;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > triggerRadius) continue;
    const floorDist = Math.abs(floorY - t.worldY);
    if (floorDist > 0.5) continue;
    return { near: dist <= halfTrigger, dir: t.direction };
  }
  return { near: false, dir: 0 };
}

// ─── Game loop ───
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  // Saltar frames con delta anormal (tab-switch, first frame)
  if (delta > 0.1) {
    renderer.render(scene, camera);
    return;
  }

  // Actualizar cámara (movimiento + gravedad + escaleras)
  fpsCamera.update(delta);

  // FPS smoothing
  const instantFps = 1 / delta;
  fpsSmooth += (instantFps - fpsSmooth) * FPS_ALPHA;

  // Parpadeo de lámparas
  flickerLamps(floorPool.getLamps(), elapsed);

  // Culling vertical por frustum
  floorPool.updateVisibility(camera);

  // Render
  renderer.render(scene, camera);

  // ─── HUD update (después del render) ───
  const playerFloor = Math.round((camera.position.y - PLAYER_HEIGHT) / HEX_HEIGHT);
  const hex = worldToHex(camera.position.x, camera.position.z);
  const stair = checkNearStair(camera.position);

  hud.update(
    playerFloor,
    hex.q, hex.r,
    Math.round(fpsSmooth),
    stair.near,
    stair.dir,
  );
}

animate();
