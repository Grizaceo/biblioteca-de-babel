// Genera la geometría de un hexágono borgiano
// 4 paredes con estantes + 2 vestíbulos con escaleras + baranda interior + pozo central

import * as THREE from 'three';
import { createSpiralStaircase } from './staircase.js';
import { addLampsToHex } from './lamp.js';
import { createBook } from './book.js';
import {
  HEX_RADIUS, HEX_HEIGHT, WALL_THICKNESS,
  RAILING_HEIGHT, CENTER_HOLE_RADIUS,
  SHELF_DEPTH, SHELF_HEIGHT, SHELF_Y_BOTTOM,
  SHELF_SPACING, NUM_SHELVES_PER_WALL,
  BOOKS_PER_SHELF, BOOK_WIDTH, BOOK_HEIGHT, BOOK_DEPTH,
  COLORS, FLOOR_OFFSET,
} from './constants.js';

// Esquina del hexágono: puntos en el plano XZ
function hexCorner(centerX, centerZ, radius, i) {
  const angle = (Math.PI / 3) * i - Math.PI / 6;
  return new THREE.Vector3(
    centerX + radius * Math.cos(angle),
    0,
    centerZ + radius * Math.sin(angle),
  );
}

// Devuelve los 6 vértices de un hexágono
function hexCorners(cx, cz, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) pts.push(hexCorner(cx, cz, r, i));
  return pts;
}

// Materiales compartidos (instanciados una vez)
const floorMat = new THREE.MeshStandardMaterial({ color: COLORS.floor, roughness: 0.9, metalness: 0.0 });
const wallMat = new THREE.MeshStandardMaterial({ color: COLORS.wall, roughness: 0.8, metalness: 0.0 });
const railingMat = new THREE.MeshStandardMaterial({ color: COLORS.railing, roughness: 0.6, metalness: 0.3 });
const railMat = new THREE.MeshStandardMaterial({ color: COLORS.railing_rail, roughness: 0.5, metalness: 0.4 });
const shelfMat = new THREE.MeshStandardMaterial({ color: COLORS.shelf, roughness: 0.7, metalness: 0.1 });
const bookMat = new THREE.MeshStandardMaterial({ color: COLORS.book_spine });
const bookPageMat = new THREE.MeshStandardMaterial({ color: COLORS.book_page });

// Crea un hexágono (una galería) completo
// Devuelve { group, lamps } para el parpadeo en el game loop
export function createHexRoom(centerX, centerZ, floorY, withLights = false) {
  const group = new THREE.Group();
  group.position.set(centerX, floorY, centerZ);

  const outer = hexCorners(0, 0, HEX_RADIUS);
  const inner = hexCorners(0, 0, CENTER_HOLE_RADIUS);

  // 1. PISO: hexágono anular (outer - inner)
  const floorGeom = createHexRing(outer, inner);
  const floor = new THREE.Mesh(floorGeom, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  group.add(floor);

  // 2. PAREDES: 4 con estantes, 2 para escaleras (paredes 1 y 4, opuestas)
  const STAIRCASE_WALLS = [1, 4]; // índices de paredes para vestíbulos
  for (let i = 0; i < 6; i++) {
    const p1 = outer[i];
    const p2 = outer[(i + 1) % 6];

    if (STAIRCASE_WALLS.includes(i)) {
      // Vestíbulo: pared simple con arco (sin estantes)
      addVestibuleWall(group, p1, p2, i);
    } else {
      // Galería: pared con estantes y libros
      addWallWithShelves(group, p1, p2, i);
    }
  }

  // 3. BARANDA alrededor del pozo (6 lados)
  addRailing(group, inner);

  // 4. ESCALERAS en los vestíbulos
  // Pared 1 = subir, Pared 4 = bajar
  const stairWall1 = outer[1].clone().lerp(outer[2], 0.5);
  const stairWall4 = outer[4].clone().lerp(outer[5], 0.5);
  // Desplazar hacia adentro
  const inward = 0.4;
  const toCenter1 = new THREE.Vector3(-stairWall1.x, 0, -stairWall1.z).normalize().multiplyScalar(inward);
  const toCenter4 = new THREE.Vector3(-stairWall4.x, 0, -stairWall4.z).normalize().multiplyScalar(inward);

  const stairUp = createSpiralStaircase(
    stairWall1.x + toCenter1.x,
    stairWall1.z + toCenter1.z,
    0, 1 // sube
  );
  group.add(stairUp);

  const stairDown = createSpiralStaircase(
    stairWall4.x + toCenter4.x,
    stairWall4.z + toCenter4.z,
    0, -1 // baja
  );
  group.add(stairDown);

  // Trigger zones invisibles para subir/bajar
  const stairTriggers = [];
  const sx1 = stairWall1.x + toCenter1.x;
  const sz1 = stairWall1.z + toCenter1.z;
  const sx4 = stairWall4.x + toCenter4.x;
  const sz4 = stairWall4.z + toCenter4.z;

  // Trigger UP (en mundiales — se usan con camera.position absoluto)
  stairTriggers.push({
    worldX: centerX + sx1,
    worldZ: centerZ + sz1,
    worldY: floorY,
    direction: 1, // sube
    label: `up_f${floorY}_${centerX.toFixed(0)}_${centerZ.toFixed(0)}`,
  });
  // Trigger DOWN
  stairTriggers.push({
    worldX: centerX + sx4,
    worldZ: centerZ + sz4,
    worldY: floorY,
    direction: -1, // baja
    label: `down_f${floorY}_${centerX.toFixed(0)}_${centerZ.toFixed(0)}`,
  });

  // Marcadores visuales: losas en el piso (sutiles)
  const markerMat = new THREE.MeshStandardMaterial({ color: 0x5c4a3a, transparent: true, opacity: 0.3 });
  for (const t of stairTriggers) {
    const marker = new THREE.Mesh(
      new THREE.CircleGeometry(0.6, 12),
      markerMat,
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(
      t.worldX - centerX,
      0.02,
      t.worldZ - centerZ,
    );
    group.add(marker);

    // Flecha decorativa (un cono pequeño)
    const arrowDir = t.direction > 0 ? 1 : -1;
    const arrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.15, 0.25, 4),
      new THREE.MeshStandardMaterial({ color: 0x8b7355, emissive: 0x4a3520, emissiveIntensity: 0.1 }),
    );
    arrow.rotation.x = arrowDir > 0 ? 0 : Math.PI;
    arrow.position.set(
      t.worldX - centerX,
      0.15,
      t.worldZ - centerZ,
    );
    group.add(arrow);
  }

  // 5. LÁMPARAS DE ACEITE
  const lamps = addLampsToHex(group, CENTER_HOLE_RADIUS + 0.5, HEX_HEIGHT, withLights);

  return { group, lamps, stairTriggers };
}

// Crea un anillo hexagonal (para piso/techo)
function createHexRing(outerPts, innerPts) {
  const shape = new THREE.Shape();
  // Contorno exterior
  shape.moveTo(outerPts[0].x, outerPts[0].z);
  for (let i = 1; i < 6; i++) shape.lineTo(outerPts[i].x, outerPts[i].z);
  shape.lineTo(outerPts[0].x, outerPts[0].z);

  // Hueco interior (en orden inverso)
  const hole = new THREE.Path();
  hole.moveTo(innerPts[0].x, innerPts[0].z);
  for (let i = 1; i < 6; i++) hole.lineTo(innerPts[i].x, innerPts[i].z);
  hole.lineTo(innerPts[0].x, innerPts[0].z);
  shape.holes.push(hole);

  const geom = new THREE.ShapeGeometry(shape);
  return geom;
}

// Agrega una pared con estantes y libros
function addWallWithShelves(group, p1, p2, wallIndex) {
  const dx = p2.x - p1.x;
  const dz = p2.z - p1.z;
  const wallLength = Math.sqrt(dx * dx + dz * dz);
  const wallAngle = Math.atan2(dx, dz); // ángulo en el plano XZ

  // Pared sólida
  const wallGeom = new THREE.BoxGeometry(WALL_THICKNESS, HEX_HEIGHT, wallLength);
  const wall = new THREE.Mesh(wallGeom, wallMat);

  // Posicionar la pared
  const midX = (p1.x + p2.x) / 2;
  const midZ = (p1.z + p2.z) / 2;
  wall.position.set(midX, HEX_HEIGHT / 2, midZ);
  wall.rotation.y = wallAngle;
  group.add(wall);

  // ---- ESTANTES ----
  // Los estantes van en la cara INTERIOR de la pared
  const shelfGroup = new THREE.Group();
  shelfGroup.position.set(midX, 0, midZ);
  shelfGroup.rotation.y = wallAngle;

  // Desplazamiento hacia adentro del hexágono
  const inwardOffset = -WALL_THICKNESS / 2 - SHELF_DEPTH / 2;

  for (let s = 0; s < NUM_SHELVES_PER_WALL; s++) {
    const shelfY = SHELF_Y_BOTTOM + s * SHELF_SPACING;

    // Estante (tabla horizontal)
    const shelfGeom = new THREE.BoxGeometry(SHELF_DEPTH, SHELF_HEIGHT, wallLength * 0.85);
    const shelf = new THREE.Mesh(shelfGeom, shelfMat);
    shelf.position.set(inwardOffset, shelfY, 0);
    shelfGroup.add(shelf);

    // ---- LIBROS DETALLADOS ----
    const spacing = (wallLength * 0.85 - BOOK_WIDTH) / BOOKS_PER_SHELF;
    for (let b = 0; b < BOOKS_PER_SHELF; b++) {
      const bookZ = -(wallLength * 0.85 / 2) + (b + 0.5) * spacing;
      const book = createBook(b + s * BOOKS_PER_SHELF + wallIndex * 31);
      book.position.set(
        inwardOffset,
        shelfY + SHELF_HEIGHT / 2,
        bookZ,
      );
      // Lomo hacia adentro de la sala (+X), páginas hacia la pared (-X)
      // createBook ya orienta el lomo a +X ✓
      shelfGroup.add(book);
    }
  }

  group.add(shelfGroup);
}

// Baranda completa alrededor del pozo central
function addRailing(group, innerPts) {
  const matBaluster = new THREE.MeshStandardMaterial({ color: COLORS.railing, roughness: 0.5, metalness: 0.4 });
  const matRail = new THREE.MeshStandardMaterial({ color: COLORS.railing_rail, roughness: 0.4, metalness: 0.5 });
  const matBase = new THREE.MeshStandardMaterial({ color: 0x3a3028, roughness: 0.9, metalness: 0.0 });

  // Base de piedra corrida (diferencia entre CENTER_HOLE_RADIUS y railing)
  const baseShape = new THREE.Shape();
  const railingRadius = innerPts[0].length(); // ≈ CENTER_HOLE_RADIUS
  const baseOuterR = railingRadius + 0.1;
  const baseInnerR = railingRadius - 0.05;
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const r = (i === 0) ? baseOuterR : baseOuterR;
    if (i === 0) baseShape.moveTo(r * Math.cos(angle), r * Math.sin(angle));
    else baseShape.lineTo(r * Math.cos(angle), r * Math.sin(angle));
  }
  baseShape.closePath();
  const holePath = new THREE.Path();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const r = (i === 0) ? baseInnerR : baseInnerR;
    if (i === 0) holePath.moveTo(r * Math.cos(angle), r * Math.sin(angle));
    else holePath.lineTo(r * Math.cos(angle), r * Math.sin(angle));
  }
  holePath.closePath();
  baseShape.holes.push(holePath);
  try {
    const baseGeom = new THREE.ShapeGeometry(baseShape);
    const base = new THREE.Mesh(baseGeom, matBase);
    base.rotation.x = -Math.PI / 2;
    base.position.y = 0.02;
    group.add(base);
  } catch(e) {
    // Fallback: simple anillo si falla la geometría
  }

  // Postes verticales en cada vértice (más gruesos)
  const postGeom = new THREE.CylinderGeometry(0.08, 0.1, 1.2, 8);
  for (let i = 0; i < 6; i++) {
    const post = new THREE.Mesh(postGeom, matBaluster);
    post.position.set(innerPts[i].x, 0.6, innerPts[i].z);
    group.add(post);
  }

  // Barandas horizontales (3 niveles: baja, media, alta) — más gruesas
  const railGeom = new THREE.BoxGeometry(0.08, 0.06, 0);
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
      const rail = new THREE.Mesh(railGeom, matRail);
      rail.scale.z = len - 0.12;
      rail.position.set(midX, height, midZ);
      rail.rotation.y = angle;
      group.add(rail);
    }
  }

  // Barrotes verticales entre cada par de postes (2 por lado)
  const barGeom = new THREE.CylinderGeometry(0.02, 0.02, 1.0, 4);
  for (let i = 0; i < 6; i++) {
    const p1 = innerPts[i];
    const p2 = innerPts[(i + 1) % 6];
    for (let b = 0; b < 2; b++) {
      const t = 0.25 + b * 0.5;
      const bx = p1.x + (p2.x - p1.x) * t;
      const bz = p1.z + (p2.z - p1.z) * t;
      const bar = new THREE.Mesh(barGeom, matBaluster);
      bar.position.set(bx, 0.6, bz);
      group.add(bar);
    }
  }
}

// Pared de vestíbulo (con arco/puerta, sin estantes)
function addVestibuleWall(group, p1, p2, wallIndex) {
  const dx = p2.x - p1.x;
  const dz = p2.z - p1.z;
  const wallLength = Math.sqrt(dx * dx + dz * dz);
  const wallAngle = Math.atan2(dx, dz);

  const midX = (p1.x + p2.x) / 2;
  const midZ = (p1.z + p2.z) / 2;

  // Pared lateral izquierda
  const sideGeom = new THREE.BoxGeometry(WALL_THICKNESS, HEX_HEIGHT, wallLength * 0.2);
  const sideL = new THREE.Mesh(sideGeom, wallMat);
  sideL.position.set(
    midX + Math.cos(wallAngle + Math.PI/2) * wallLength * 0.3,
    HEX_HEIGHT / 2,
    midZ + Math.sin(wallAngle + Math.PI/2) * wallLength * 0.3,
  );
  sideL.rotation.y = wallAngle;
  group.add(sideL);

  const sideR = new THREE.Mesh(sideGeom, wallMat);
  sideR.position.set(
    midX - Math.cos(wallAngle + Math.PI/2) * wallLength * 0.3,
    HEX_HEIGHT / 2,
    midZ - Math.sin(wallAngle + Math.PI/2) * wallLength * 0.3,
  );
  sideR.rotation.y = wallAngle;
  group.add(sideR);

  // Dintel (arco superior)
  const archGeom = new THREE.BoxGeometry(WALL_THICKNESS, HEX_HEIGHT * 0.2, wallLength * 0.5);
  const arch = new THREE.Mesh(archGeom, wallMat);
  arch.position.set(midX, HEX_HEIGHT * 0.9, midZ);
  arch.rotation.y = wallAngle;
  group.add(arch);

  // Escalón de entrada (para marcar el vestíbulo)
  const stepGeom = new THREE.BoxGeometry(WALL_THICKNESS + 0.2, 0.1, 0.5);
  const step = new THREE.Mesh(stepGeom, floorMat);
  step.position.set(midX, 0.05, midZ);
  step.rotation.y = wallAngle;
  group.add(step);
}

// Coordenadas hexagonales axiales a cartesianas
export function hexToWorld(q, r) {
  const x = HEX_RADIUS * 1.5 * q;
  const z = HEX_RADIUS * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
  return { x, z };
}

// Genera un grid de hexágonos alrededor del centro
export function createHexGrid(radius) {
  const positions = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      if (Math.abs(q + r) > radius) continue; // filtro axial
      positions.push({ q, r });
    }
  }
  return positions;
}
