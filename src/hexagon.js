// Genera la geometría de un hexágono borgiano
// 4 paredes con estantes + 2 vestíbulos con escaleras + baranda interior + pozo central
//
// LOD levels:
//   0 = full (paredes con estantes + libros + baranda + escaleras + lámparas)
//   1 = medium (paredes con estantes vacíos + baranda + escaleras + lámparas, sin libros)
//   2 = low (paredes lisas + piso + escaleras, sin estantes, baranda ni lámparas)

import * as THREE from 'three';
import { createSpiralStaircase } from './staircase.js';
import { addLampsToHex } from './lamp.js';
import { createBookWall } from './bookshelf.js';
import { hexCorners, createHexRing, worldToHex } from './geometry.js';
import {
  HEX_RADIUS, HEX_HEIGHT, WALL_THICKNESS,
  CENTER_HOLE_RADIUS,
  SHELF_DEPTH, SHELF_HEIGHT, SHELF_Y_BOTTOM,
  SHELF_SPACING, NUM_SHELVES_PER_WALL,
  COLORS,
} from './constants.js';

// Materiales
const floorMat = new THREE.MeshStandardMaterial({ color: COLORS.floor, roughness: 0.9, metalness: 0.0 });
const wallMat = new THREE.MeshStandardMaterial({ color: COLORS.wall, roughness: 0.8, metalness: 0.0 });
const railingMat = new THREE.MeshStandardMaterial({ color: COLORS.railing, roughness: 0.5, metalness: 0.4 });
const railMat = new THREE.MeshStandardMaterial({ color: COLORS.railing_rail, roughness: 0.4, metalness: 0.5 });
const railBaseMat = new THREE.MeshStandardMaterial({ color: 0x3a3028, roughness: 0.9, metalness: 0.0 });
const shelfMat = new THREE.MeshStandardMaterial({ color: COLORS.shelf, roughness: 0.7, metalness: 0.1 });
// Espejo del zaguán: vidrio azogado oscuro. Sin envMap se ve casi negro con los
// reflejos especulares de las lámparas — atmósfera de espejo en penumbra.
const mirrorMat = new THREE.MeshStandardMaterial({
  color: 0x222d33, roughness: 0.08, metalness: 1.0, emissive: 0x0a0e12, emissiveIntensity: 0.4,
});
const mirrorFrameMat = new THREE.MeshStandardMaterial({ color: 0x6b5030, roughness: 0.5, metalness: 0.4 });
const markerMat = new THREE.MeshStandardMaterial({
  color: 0x7a5a3a, transparent: true, opacity: 0.4, emissive: 0x4a3520, emissiveIntensity: 0.15,
});
const arrowMat = new THREE.MeshStandardMaterial({
  color: 0x8b7355, emissive: 0x6b5030, emissiveIntensity: 0.2,
});

// ─── Geometrías invariantes ────────────────────────────────────────────────
// Las 91 salas son idénticas (radio/altura constantes), así que toda geometría
// que no depende de la posición se construye UNA vez y se comparte; sólo la
// transform vive en cada Mesh. Sigue el mismo patrón que los materiales.
const EDGE = HEX_RADIUS;                              // lado del hexágono regular
const SHARED_OUTER = hexCorners(0, 0, HEX_RADIUS);
const SHARED_INNER = hexCorners(0, 0, CENTER_HOLE_RADIUS);
const ringGeom = createHexRing(SHARED_OUTER, SHARED_INNER); // piso y techo
const glowRingGeom = createHexRing(
  hexCorners(0, 0, CENTER_HOLE_RADIUS + 0.6),
  hexCorners(0, 0, CENTER_HOLE_RADIUS + 0.1),
);
const wallGeom = new THREE.BoxGeometry(WALL_THICKNESS, HEX_HEIGHT, EDGE);
const shelfGeom = new THREE.BoxGeometry(SHELF_DEPTH, SHELF_HEIGHT, EDGE * 0.85);
const vestSideGeom = new THREE.BoxGeometry(WALL_THICKNESS, HEX_HEIGHT, EDGE * 0.2);
const vestArchGeom = new THREE.BoxGeometry(WALL_THICKNESS, HEX_HEIGHT * 0.2, EDGE * 0.5);
const vestStepGeom = new THREE.BoxGeometry(WALL_THICKNESS + 0.2, 0.1, 0.5);
const mirrorFrameGeom = new THREE.BoxGeometry(0.05, HEX_HEIGHT * 0.6 + 0.12, EDGE * 0.2);
const mirrorGlassGeom = new THREE.BoxGeometry(0.04, HEX_HEIGHT * 0.6, EDGE * 0.17);
const railPostGeom = new THREE.CylinderGeometry(0.08, 0.1, 1.2, 8);
const railBarGeom = new THREE.CylinderGeometry(0.02, 0.02, 1.0, 4);
const railRailGeom = new THREE.BoxGeometry(0.08, 0.06, 1);
const markerGeom = new THREE.CircleGeometry(0.75, 12);
const arrowGeom = new THREE.ConeGeometry(0.2, 0.35, 4);

// Base de piedra corrida de la baranda (anillo hexagonal alrededor del pozo).
// Invariante (radio = CENTER_HOLE_RADIUS); se triangula una sola vez.
const railBaseGeom = (() => {
  try {
    const hexPath = (PathCtor, r) => {
      const p = new PathCtor();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const x = r * Math.cos(a), y = r * Math.sin(a);
        if (i === 0) p.moveTo(x, y); else p.lineTo(x, y);
      }
      p.closePath();
      return p;
    };
    const shape = hexPath(THREE.Shape, CENTER_HOLE_RADIUS + 0.1);
    shape.holes.push(hexPath(THREE.Path, CENTER_HOLE_RADIUS - 0.05));
    return new THREE.ShapeGeometry(shape);
  } catch (e) {
    return null;
  }
})();

/**
 * Construye una galería hexágonal completa: piso, paredes con estantes,
 * vestíbulos con escaleras, baranda interior y lámparas.
 *
 * @param {number} centerX - Posición X del centro del hexágono
 * @param {number} centerZ - Posición Z del centro del hexágono
 * @param {number} floorY - Altura del piso (eje Y)
 * @param {boolean} [withLights=false] - Si true, las lámparas emiten luz real
 * @param {number} [lod=0] - Nivel de detalle: 0=full, 1=medium, 2=low
 * @returns {{ group: THREE.Group, lamps: Array, stairTriggers: Array }}
 *   group: el grupo 3D completo; lamps: para animación de parpadeo;
 *   stairTriggers: zonas de trigger para subir/bajar de piso
 */
export function createHexRoom(centerX, centerZ, floorY, withLights = false, lod = 0) {
  const group = new THREE.Group();
  group.position.set(centerX, floorY, centerZ);

  const outer = hexCorners(0, 0, HEX_RADIUS);
  const inner = hexCorners(0, 0, CENTER_HOLE_RADIUS);

  // Identidad axial del hex — necesaria para los libros (metadata del
  // raycaster). Computamos desde centerX/centerZ usando worldToHex.
  const { q: hexQ, r: hexR } = worldToHex(centerX, centerZ);
  const floorIdx = Math.round(floorY / HEX_HEIGHT);

  // 1. PISO: hexágono anular (outer - inner) — siempre presente
  const floor = new THREE.Mesh(ringGeom, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  group.add(floor);

  // 1b. TECHO: anillo hexágonal translúcido en el tope de la sala
  addCeiling(group, lod);

  // 2. PAREDES: 4 con estantes (LOD 0-1), 2 para escaleras (siempre)
  const STAIRCASE_WALLS = [1, 4];
  for (let i = 0; i < 6; i++) {
    const p1 = outer[i];
    const p2 = outer[(i + 1) % 6];

    if (STAIRCASE_WALLS.includes(i)) {
      // Vestíbulo con escaleras (siempre presente)
      addVestibuleWall(group, p1, p2, i, lod);
    } else if (lod <= 1) {
      // Galería con estantes; libros solo en LOD 0
      addWallWithShelves(group, p1, p2, i, lod === 0, {
        hexQ,
        hexR,
        floorIdx,
      });
    } else {
      // LOD 2: solo pared lisa, sin estantes
      addPlainWall(group, p1, p2);
    }
  }

  // 3. BARANDA alrededor del pozo — LOD 0-1
  if (lod <= 1) {
    addRailing(group, inner);
  }

  // 4. ESCALERAS en los vestíbulos — siempre (necesarias para gameplay)
  const stairWall1 = outer[1].clone().lerp(outer[2], 0.5);
  const stairWall4 = outer[4].clone().lerp(outer[5], 0.5);
  const inward = 0.4;
  const toCenter1 = new THREE.Vector3(-stairWall1.x, 0, -stairWall1.z).normalize().multiplyScalar(inward);
  const toCenter4 = new THREE.Vector3(-stairWall4.x, 0, -stairWall4.z).normalize().multiplyScalar(inward);

  const stairUp = createSpiralStaircase(
    stairWall1.x + toCenter1.x,
    stairWall1.z + toCenter1.z,
    0, 1, lod // sube
  );
  group.add(stairUp);

  const stairDown = createSpiralStaircase(
    stairWall4.x + toCenter4.x,
    stairWall4.z + toCenter4.z,
    0, -1, lod // baja
  );
  group.add(stairDown);

  // Trigger zones invisibles para subir/bajar
  const stairTriggers = [];
  const sx1 = stairWall1.x + toCenter1.x;
  const sz1 = stairWall1.z + toCenter1.z;
  const sx4 = stairWall4.x + toCenter4.x;
  const sz4 = stairWall4.z + toCenter4.z;

  stairTriggers.push({
    worldX: centerX + sx1,
    worldZ: centerZ + sz1,
    worldY: floorY,
    direction: 1,
    label: `up_f${floorY}_${centerX.toFixed(0)}_${centerZ.toFixed(0)}`,
  });
  stairTriggers.push({
    worldX: centerX + sx4,
    worldZ: centerZ + sz4,
    worldY: floorY,
    direction: -1,
    label: `down_f${floorY}_${centerX.toFixed(0)}_${centerZ.toFixed(0)}`,
  });

  // Marcadores visuales mejorados: losa + flecha + brillo (solo LOD 0-1)
  if (lod <= 1) {
    for (const t of stairTriggers) {
      // Losa circular más visible
      const marker = new THREE.Mesh(markerGeom, markerMat);
      marker.rotation.x = -Math.PI / 2;
      marker.position.set(
        t.worldX - centerX,
        0.02,
        t.worldZ - centerZ,
      );
      group.add(marker);

      // Flecha más grande con emisión
      const arrowDir = t.direction > 0 ? 1 : -1;
      const arrow = new THREE.Mesh(arrowGeom, arrowMat);
      arrow.rotation.x = arrowDir > 0 ? 0 : Math.PI;
      arrow.position.set(
        t.worldX - centerX,
        0.2,
        t.worldZ - centerZ,
      );
      group.add(arrow);
    }
  }

  // 5. LÁMPARAS DE ACEITE — LOD 0-1
  let lamps = [];
  if (lod <= 1) {
    lamps = addLampsToHex(group, CENTER_HOLE_RADIUS + 0.5, HEX_HEIGHT, withLights);
  }

  return { group, lamps, stairTriggers };
}

// ─── Pared lisa sin estantes (LOD 2)
function addPlainWall(group, p1, p2) {
  const dx = p2.x - p1.x;
  const dz = p2.z - p1.z;
  const wallAngle = Math.atan2(dx, dz);

  const wall = new THREE.Mesh(wallGeom, wallMat);

  const midX = (p1.x + p2.x) / 2;
  const midZ = (p1.z + p2.z) / 2;
  wall.position.set(midX, HEX_HEIGHT / 2, midZ);
  wall.rotation.y = wallAngle;
  group.add(wall);
}

// Agrega una pared con estantes y opcionalmente libros
function addWallWithShelves(group, p1, p2, wallIndex, addBooks = true, meta = {}) {
  const dx = p2.x - p1.x;
  const dz = p2.z - p1.z;
  const wallLength = Math.sqrt(dx * dx + dz * dz);
  const wallAngle = Math.atan2(dx, dz);

  // Pared sólida (geometría compartida)
  const wall = new THREE.Mesh(wallGeom, wallMat);

  const midX = (p1.x + p2.x) / 2;
  const midZ = (p1.z + p2.z) / 2;
  wall.position.set(midX, HEX_HEIGHT / 2, midZ);
  wall.rotation.y = wallAngle;
  group.add(wall);

  // ---- ESTANTES ----
  const shelfGroup = new THREE.Group();
  shelfGroup.position.set(midX, 0, midZ);
  shelfGroup.rotation.y = wallAngle;

  const inwardOffset = -WALL_THICKNESS / 2 - SHELF_DEPTH / 2;

  // ---- 5 anaqueles por muro (tablas horizontales) ----
  for (let s = 0; s < NUM_SHELVES_PER_WALL; s++) {
    const shelfY = SHELF_Y_BOTTOM + s * SHELF_SPACING;
    const shelf = new THREE.Mesh(shelfGeom, shelfMat);
    shelf.position.set(inwardOffset, shelfY, 0);
    shelfGroup.add(shelf);
  }

  // ---- LIBROS: 32 por anaquel, instanciados (un draw call por muro) ----
  if (addBooks) {
    shelfGroup.add(createBookWall(wallLength, wallIndex, inwardOffset, {
      hexQ: meta.hexQ ?? 0,
      hexR: meta.hexR ?? 0,
      floorIdx: meta.floorIdx ?? 0,
      wallIdx: wallIndex,
    }));
  }

  group.add(shelfGroup);
}

// Baranda completa alrededor del pozo central (materiales/geometrías compartidos)
function addRailing(group, innerPts) {

  // Base de piedra corrida (geometría compartida; null si la triangulación falló)
  if (railBaseGeom) {
    const base = new THREE.Mesh(railBaseGeom, railBaseMat);
    base.rotation.x = -Math.PI / 2;
    base.position.y = 0.02;
    group.add(base);
  }

  // Postes verticales (geometría compartida)
  for (let i = 0; i < 6; i++) {
    const post = new THREE.Mesh(railPostGeom, railingMat);
    post.position.set(innerPts[i].x, 0.6, innerPts[i].z);
    group.add(post);
  }

  // Barandas horizontales (3 niveles). railRailGeom tiene profundidad base 1 →
  // se escala con scale.z al largo del tramo (con depth=0 eran invisibles).
  for (let i = 0; i < 6; i++) {
    const p1 = innerPts[i];
    const p2 = innerPts[(i + 1) % 6];
    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;
    const len = Math.sqrt(dx * dx + dz * dz);
    const angle = Math.atan2(dx, dz);
    const midX = (p1.x + p2.x) / 2;
    const midZ = (p1.z + p2.z) / 2;

    for (const height of [0.2, 0.6, 1.0]) {
      const rail = new THREE.Mesh(railRailGeom, railMat);
      rail.scale.z = len - 0.12;
      rail.position.set(midX, height, midZ);
      rail.rotation.y = angle;
      group.add(rail);
    }
  }

  // Barrotes verticales entre postes (geometría compartida)
  for (let i = 0; i < 6; i++) {
    const p1 = innerPts[i];
    const p2 = innerPts[(i + 1) % 6];
    for (let b = 0; b < 2; b++) {
      const t = 0.25 + b * 0.5;
      const bx = p1.x + (p2.x - p1.x) * t;
      const bz = p1.z + (p2.z - p1.z) * t;
      const bar = new THREE.Mesh(railBarGeom, railingMat);
      bar.position.set(bx, 0.6, bz);
      group.add(bar);
    }
  }
}

// Pared de vestíbulo (con arco/puerta, sin estantes).
// "Una de las caras libres da a un angosto zaguán, que desemboca en otra
//  galería, idéntica a la primera y a todas." En el zaguán de subida (wallIndex
//  1) se cuelga el espejo borgiano (LOD 0-1).
function addVestibuleWall(group, p1, p2, wallIndex, lod = 0) {
  const dx = p2.x - p1.x;
  const dz = p2.z - p1.z;
  const wallLength = Math.sqrt(dx * dx + dz * dz);
  const wallAngle = Math.atan2(dx, dz);

  const midX = (p1.x + p2.x) / 2;
  const midZ = (p1.z + p2.z) / 2;

  // Vector unitario A LO LARGO del muro: con wallAngle = atan2(dx, dz), es
  // (sin(wallAngle), cos(wallAngle)) = (dx/L, dz/L). Las jambas se desplazan
  // sobre la línea del muro, dejando el vano en el centro.
  const alongX = Math.sin(wallAngle);
  const alongZ = Math.cos(wallAngle);

  const sideL = new THREE.Mesh(vestSideGeom, wallMat);
  sideL.position.set(
    midX + alongX * wallLength * 0.3,
    HEX_HEIGHT / 2,
    midZ + alongZ * wallLength * 0.3,
  );
  sideL.rotation.y = wallAngle;
  group.add(sideL);

  const sideR = new THREE.Mesh(vestSideGeom, wallMat);
  sideR.position.set(
    midX - alongX * wallLength * 0.3,
    HEX_HEIGHT / 2,
    midZ - alongZ * wallLength * 0.3,
  );
  sideR.rotation.y = wallAngle;
  group.add(sideR);

  const arch = new THREE.Mesh(vestArchGeom, wallMat);
  arch.position.set(midX, HEX_HEIGHT * 0.9, midZ);
  arch.rotation.y = wallAngle;
  group.add(arch);

  const step = new THREE.Mesh(vestStepGeom, floorMat);
  step.position.set(midX, 0.05, midZ);
  step.rotation.y = wallAngle;
  group.add(step);

  // "En el zaguán hay un espejo, que fielmente duplica las apariencias."
  // Un solo espejo por hexágono (zaguán de subida), montado en la jamba.
  if (wallIndex === 1 && lod <= 1) {
    addVestibuleMirror(group, midX, midZ, wallAngle, wallLength);
  }
}

// Espejo colgado en la jamba del zaguán, mirando hacia el interior de la sala.
function addVestibuleMirror(group, midX, midZ, wallAngle, wallLength) {
  // Jamba: desplazamiento a lo largo del muro (no diagonal).
  const alongX = Math.sin(wallAngle);
  const alongZ = Math.cos(wallAngle);
  const jambX = midX + alongX * wallLength * 0.3;
  const jambZ = midZ + alongZ * wallLength * 0.3;

  // Normal del muro = (cos(wallAngle), -sin(wallAngle)); se orienta hacia el
  // centro del hexágono para apoyar el espejo en la cara interior y paralelo.
  let inX = Math.cos(wallAngle);
  let inZ = -Math.sin(wallAngle);
  if (inX * midX + inZ * midZ > 0) { inX = -inX; inZ = -inZ; }

  const mirrorY = HEX_HEIGHT * 0.46;
  const offset = WALL_THICKNESS / 2 + 0.04;

  // Marco (ligeramente mayor, detrás del cristal)
  const frame = new THREE.Mesh(mirrorFrameGeom, mirrorFrameMat);
  frame.position.set(jambX + inX * (offset - 0.01), mirrorY, jambZ + inZ * (offset - 0.01));
  frame.rotation.y = wallAngle;
  group.add(frame);

  // Cristal azogado
  const glass = new THREE.Mesh(mirrorGlassGeom, mirrorMat);
  glass.position.set(jambX + inX * offset, mirrorY, jambZ + inZ * offset);
  glass.rotation.y = wallAngle;
  group.add(glass);
}

// ─── TECHO ─────────────────────────────────────────────────────
// Anillo hexagonal translúcido en el tope de cada sala.
// Hace que cada piso sea una "habitación cerrada" con el pozo central abierto.
// LOD 0-1: agrega un aro de resplandor tenue cerca del borde del pozo.

const ceilingMat = new THREE.MeshStandardMaterial({
  color: COLORS.floor,
  transparent: true,
  opacity: 0.20,
  roughness: 0.9,
  side: THREE.DoubleSide,
});

const glowMat = new THREE.MeshStandardMaterial({
  color: 0x8b7355,
  transparent: true,
  opacity: 0.10,
  roughness: 0.5,
  metalness: 0.2,
  side: THREE.DoubleSide,
  emissive: 0x6b5030,
  emissiveIntensity: 0.06,
});

function addCeiling(group, lod) {
  // Anillo de techo principal (translúcido) — geometría compartida con el piso
  const ceiling = new THREE.Mesh(ringGeom, ceilingMat);
  ceiling.rotation.x = -Math.PI / 2;
  ceiling.position.y = HEX_HEIGHT - 0.03; // justo bajo el piso de arriba
  group.add(ceiling);

  // Aro de resplandor alrededor del pozo (LOD 0-1)
  if (lod <= 1) {
    const glowRing = new THREE.Mesh(glowRingGeom, glowMat);
    glowRing.rotation.x = -Math.PI / 2;
    glowRing.position.y = HEX_HEIGHT - 0.02;
    group.add(glowRing);
  }
}

