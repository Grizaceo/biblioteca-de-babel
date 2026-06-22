// Estantería instanciada — pobla un muro con los 32 libros por anaquel
// ("cada anaquel encierra treinta y dos libros") usando un único InstancedMesh.
//
// Sin instancing, 4 muros × 5 anaqueles × 32 libros = 640 libros por hexágono,
// que multiplicados por las decenas de salas visibles harían inviable el
// framerate. Con InstancedMesh cada muro es un solo draw call de 160 libros,
// permitiendo respetar la cifra canónica del cuento sin perder fluidez.

import * as THREE from 'three';
import { SPINE_COLORS, generateSpineTexture } from './book.js';
import {
  NUM_SHELVES_PER_WALL, BOOKS_PER_SHELF,
  SHELF_HEIGHT, SHELF_Y_BOTTOM, SHELF_SPACING, SHELF_DEPTH,
  BOOK_WIDTH, BOOK_HEIGHT,
} from './constants.js';

// Nº de libros que un muro instanciado contiene (5 anaqueles × 32 libros = 160).
export const BOOKS_PER_WALL = NUM_SHELVES_PER_WALL * BOOKS_PER_SHELF;

// Geometría unitaria compartida por todos los muros: profundidad y grosor fijos,
// altura = 1 (se escala por instancia para variar el alto de cada libro).
const bookGeom = new THREE.BoxGeometry(SHELF_DEPTH * 0.7, 1, BOOK_WIDTH * 0.92);

// PRNG determinista (mulberry32): mismo muro ⇒ misma disposición en cada arranque.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const _m = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();

// El color va por instancia (instanceColor), así que el material solo depende de
// la textura. Se cachea por textura: a lo sumo unos pocos materiales en escena.
const _matCache = new Map();
function wallMaterial(wallIndex) {
  const tex = generateSpineTexture(wallIndex);
  let mat = _matCache.get(tex);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.78, metalness: 0.04 });
    _matCache.set(tex, mat);
  }
  return mat;
}

/**
 * Crea un muro de libros instanciado, listo para añadirse a un `shelfGroup`
 * (posicionado en el centro del muro y rotado según su ángulo). Los lomos miran
 * hacia el interior de la sala (eje local −X, hacia el pozo).
 *
 * @param {number} wallLength - Longitud del muro (mismo valor que la pared).
 * @param {number} wallIndex - Índice de muro (0-5); fija textura y semilla.
 * @param {number} inwardOffset - Desplazamiento local X hacia el interior
 *   (negativo), donde se apoyan anaqueles y libros.
 * @param {object} [meta={}] - Metadata del muro. Se guarda en `mesh.userData`
 *   para que el raycaster pueda identificar el hex/piso/wall al hacer click.
 *   Forma esperada: { hexQ, hexR, floorIdx, wallIdx, booksPerShelf, shelvesPerWall }
 * @returns {THREE.InstancedMesh} Malla instanciada con BOOKS_PER_WALL libros.
 */
export function createBookWall(wallLength, wallIndex, inwardOffset, meta = {}) {
  const usableLen = wallLength * 0.85;
  const spacing = (usableLen - BOOK_WIDTH) / BOOKS_PER_SHELF;

  const mesh = new THREE.InstancedMesh(bookGeom, wallMaterial(wallIndex), BOOKS_PER_WALL);
  const rng = mulberry32(wallIndex * 0x9e3779b1 + 1);

  let i = 0;
  for (let s = 0; s < NUM_SHELVES_PER_WALL; s++) {
    const shelfTop = SHELF_Y_BOTTOM + s * SHELF_SPACING + SHELF_HEIGHT / 2;

    for (let b = 0; b < BOOKS_PER_SHELF; b++) {
      const heightVar = 0.82 + rng() * 0.28;          // alto variable por libro
      const bookH = BOOK_HEIGHT * heightVar;
      const bookZ = -usableLen / 2 + (b + 0.5) * spacing;

      // Algunos libros ligeramente inclinados o sacados (vida en la estantería).
      const lean = rng() < 0.10 ? (rng() - 0.5) * 0.28 : 0;
      const pull = rng() < 0.06 ? -0.05 : 0;

      _pos.set(inwardOffset + pull, shelfTop + bookH / 2, bookZ);
      _euler.set(0, 0, lean);
      _quat.setFromEuler(_euler);
      _scale.set(1, bookH, 1);
      _m.compose(_pos, _quat, _scale);
      mesh.setMatrixAt(i, _m);

      // Color del lomo: paleta determinista + leve jitter de luminosidad.
      _color.setHex(SPINE_COLORS[Math.floor(rng() * SPINE_COLORS.length)]);
      const k = 0.85 + rng() * 0.3;
      _color.multiplyScalar(k);
      mesh.setColorAt(i, _color);

      i++;
    }
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.computeBoundingSphere(); // bounding correcto para frustum culling

  // Metadata para el raycaster — identifica la posición (hex q,r,floor, wall)
  // de este InstancedMesh. El instanceId del raycaster da shelf/bookIndex.
  mesh.userData = {
    isBookWall: true,
    hexQ: meta.hexQ ?? 0,
    hexR: meta.hexR ?? 0,
    floorIdx: meta.floorIdx ?? 0,
    wallIdx: meta.wallIdx ?? wallIndex,
    booksPerShelf: meta.booksPerShelf ?? BOOKS_PER_SHELF,
    shelvesPerWall: meta.shelvesPerWall ?? NUM_SHELVES_PER_WALL,
  };
  return mesh;
}
