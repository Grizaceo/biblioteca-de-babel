// Libros detallados — paleta de colores, geometría con lomo, páginas y textura
// de "texto" tomada del alfabeto canónico de 25 símbolos del cuento.
// El libro se orienta con el lomo hacia +X, páginas a -X.
import * as THREE from 'three';
import { BOOK_WIDTH, BOOK_HEIGHT, BOOK_DEPTH, ALPHABET } from './constants.js';

// Paleta de lomos (cuero, pergamino oscuro, tintes apagados). Compartida con la
// estantería instanciada (bookshelf.js) para una apariencia coherente.
export const SPINE_COLORS = [
  0x8b2500, 0x2c1810, 0x3b2f2f, 0x1a2e1a,
  0x1a1a3e, 0x2c1a30, 0x3a2a1a, 0x1a1a1a,
  0x5c3a1a, 0x3a2a00, 0x4a2020, 0x202040,
];

const spineTextureCache = new Map();

// PRNG determinista (mulberry32) — misma semilla ⇒ mismo lomo en cada arranque.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Genera (y cachea) la textura de un lomo: base de pergamino claro, bandas
 * doradas y renglones de glifos tomados del ALFABETO de 25 símbolos.
 * La base es clara a propósito para multiplicarse bien con el color del lomo
 * (material.color en createBook, o instanceColor en la estantería instanciada).
 * @param {number} variant - Índice; el resultado se cachea por `variant % 8`.
 * @returns {THREE.CanvasTexture}
 */
export function generateSpineTexture(variant) {
  const key = variant % 8;
  if (spineTextureCache.has(key)) return spineTextureCache.get(key);

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Base clara para que el color del lomo "tiña" la textura al multiplicar.
  ctx.fillStyle = '#d9c9a6';
  ctx.fillRect(0, 0, 128, 256);

  // Bandas doradas (nervios del lomo)
  ctx.fillStyle = 'hsla(45, 55%, 42%, 0.9)';
  ctx.fillRect(8, 18, 112, 4);
  ctx.fillRect(8, 30, 112, 2);
  ctx.fillRect(8, 226, 112, 2);
  ctx.fillRect(8, 234, 112, 4);

  // Renglones de glifos del alfabeto canónico: "todas las combinaciones" de los
  // 25 símbolos. Tinta tenue para no saturar; legible de cerca, textura de lejos.
  const rng = mulberry32(variant * 2654435761 + 17);
  ctx.font = 'bold 13px "Courier New", monospace';
  ctx.textBaseline = 'top';
  const charsPerRow = 8;
  for (let row = 0; row < 13; row++) {
    let line = '';
    for (let c = 0; c < charsPerRow; c++) {
      line += ALPHABET[Math.floor(rng() * ALPHABET.length)];
    }
    const ink = 18 + Math.floor(rng() * 22);
    ctx.fillStyle = `rgba(${ink},${ink},${ink},0.78)`;
    ctx.fillText(line, 12, 46 + row * 13);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  spineTextureCache.set(key, texture);
  return texture;
}

/**
 * Crea un libro detallado con lomo texturizado, páginas y cantos dorados.
 * Usado para inspección cercana y como referencia; las estanterías pobladas
 * usan la versión instanciada (bookshelf.js) por rendimiento.
 * @param {number} [bookIndex=0] - Índice para variar color y altura
 * @returns {THREE.Group} Grupo con meshes del libro (lomo, páginas, cantos)
 */
export function createBook(bookIndex = 0) {
  const group = new THREE.Group();

  const seed = (bookIndex * 7 + 3) % SPINE_COLORS.length;
  const color = SPINE_COLORS[seed];
  const heightVar = 0.85 + (bookIndex % 3) * 0.075;
  const tiltVar = (bookIndex % 5 === 0) ? 0.04 : (bookIndex % 7 === 0) ? -0.03 : 0;
  const actualHeight = BOOK_HEIGHT * heightVar;

  const spineMat = new THREE.MeshStandardMaterial({
    color, roughness: 0.7, metalness: 0.1,
    map: generateSpineTexture(bookIndex),
  });
  const pageMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e0, roughness: 0.9 });
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.8 });

  // Lomo (cara +X)
  const spine = new THREE.Mesh(
    new THREE.BoxGeometry(BOOK_DEPTH * 0.15, actualHeight, BOOK_WIDTH),
    spineMat,
  );
  spine.position.set(BOOK_DEPTH * 0.425, actualHeight / 2, 0);
  group.add(spine);

  // Cuerpo (páginas)
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(BOOK_DEPTH * 0.7, actualHeight * 0.92, BOOK_WIDTH * 0.85),
    pageMat,
  );
  body.position.set(0, actualHeight * 0.46, 0);
  group.add(body);

  // Borde frontal (cara -X)
  const frontEdge = new THREE.Mesh(
    new THREE.BoxGeometry(BOOK_DEPTH * 0.05, actualHeight * 0.92, BOOK_WIDTH),
    edgeMat,
  );
  frontEdge.position.set(-BOOK_DEPTH * 0.425, actualHeight * 0.46, 0);
  group.add(frontEdge);

  // Ribetes dorados
  if (bookIndex % 3 === 0) {
    const bandMat = new THREE.MeshStandardMaterial({ color: 0xc8a050, roughness: 0.3, metalness: 0.6 });
    const bandGeom = new THREE.BoxGeometry(BOOK_DEPTH * 0.02, 0.02, BOOK_WIDTH * 1.05);
    const b1 = new THREE.Mesh(bandGeom, bandMat);
    b1.position.set(BOOK_DEPTH * 0.43, actualHeight * 0.15, 0);
    group.add(b1);
    const b2 = new THREE.Mesh(bandGeom, bandMat);
    b2.position.set(BOOK_DEPTH * 0.43, actualHeight * 0.85, 0);
    group.add(b2);
  }

  // Inclinación
  if (tiltVar !== 0) {
    group.rotation.x = tiltVar;
  }

  // Sobre-saliente
  if (bookIndex % 7 === 0) {
    group.position.x = 0.02;
  }

  return group;
}
