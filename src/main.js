// Babel Three.js — Main entry point
// Biblioteca de Babel en 3D: hexágonos infinitos con pozo central

import * as THREE from 'three';
import { FPSCamera } from './camera.js';
import { createHexRoom, hexToWorld, createHexGrid } from './hexagon.js';
import { flickerLamps } from './lamp.js';
import {
  HEX_RADIUS, HEX_HEIGHT, VISIBLE_FLOORS,
  CENTER_HOLE_RADIUS,
  COLORS,
} from './constants.js';

// ─── Setup renderer ───
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.8;
document.body.appendChild(renderer.domElement);

// ─── Scene ───
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0a); // casi negro
scene.fog = new THREE.FogExp2(0x0a0a0a, 0.012); // niebla para profundidad infinita

// ─── Camera ───
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200);
const fps = new FPSCamera(camera, renderer.domElement);

// ─── Lights ───
// Luz ambiental: suficiente para ver formas sin matar el detalle
const ambientLight = new THREE.AmbientLight(0x404060, 0.4);
scene.add(ambientLight);

// Luz direccional desde arriba (pozo)
const topLight = new THREE.DirectionalLight(0xffd78f, 0.8);
topLight.position.set(0, 30, 0);
scene.add(topLight);

// Luz desde abajo (misterio tenue desde el pozo inferior)
const bottomLight = new THREE.DirectionalLight(0x4a3a6a, 0.3);
bottomLight.position.set(0, -30, 0);
scene.add(bottomLight);

// ─── Torre de hexágonos ───
const hexGrid = createHexGrid(1); // 7 hexágonos por piso
const allLamps = [];
const allStairTriggers = [];

for (let f = -VISIBLE_FLOORS; f <= VISIBLE_FLOORS; f++) {
  const yPos = f * HEX_HEIGHT;

  for (const pos of hexGrid) {
    const { x, z } = hexToWorld(pos.q, pos.r);
    const withLights = (pos.q === 0 && pos.r === 0 && Math.abs(f) <= 1); // solo luces en hexágono central de los 3 pisos del medio
    const { group, lamps, stairTriggers } = createHexRoom(x, z, yPos, withLights);
    scene.add(group);
    allStairTriggers.push(...stairTriggers);

    // Si es el piso central, también agregamos el techo del piso de arriba
    // para que no se vea el "cielo abierto" desde el piso 0
    if (f === 0) {
      // Piso del hexágono superior (sutil, translúcido)
      const ceilingRing = new THREE.Mesh(
        new THREE.RingGeometry(CENTER_HOLE_RADIUS, HEX_RADIUS, 6),
        new THREE.MeshStandardMaterial({
          color: COLORS.floor,
          transparent: true,
          opacity: 0.15,
          roughness: 0.9,
          side: THREE.DoubleSide,
        })
      );
      ceilingRing.rotation.x = Math.PI / 2;
      ceilingRing.position.set(x, HEX_HEIGHT, z);
      scene.add(ceilingRing);
    }

    allLamps.push(...lamps);
  }
}

// Pasar triggers de escaleras a la cámara
fps.setStairTriggers(allStairTriggers);

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

// ─── Window resize ───
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Game loop ───
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  fps.update(delta);

  // Parpadeo de las lámparas de aceite
  flickerLamps(allLamps, elapsed);

  renderer.render(scene, camera);
}

animate();

// ─── CSS ───
const style = document.createElement('style');
style.textContent = `
  body { margin: 0; overflow: hidden; background: #0a0a0a; }
  canvas { display: block; cursor: none; }
  #info {
    position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
    color: #8b7355; font-family: 'Space Mono', monospace; font-size: 14px;
    letter-spacing: 0.1em; text-align: center;
    opacity: 0.6; pointer-events: none;
    text-shadow: 0 0 4px rgba(0,0,0,0.8);
  }
`;
document.head.appendChild(style);
document.head.innerHTML += '<link href="https://fonts.googleapis.com/css2?family=Space+Mono&display=swap" rel="stylesheet">';

const info = document.createElement('div');
info.id = 'info';
info.textContent = 'La Biblioteca de Babel — Haz click para explorar | WASD + Mouse | Shift = correr';
document.body.appendChild(info);
