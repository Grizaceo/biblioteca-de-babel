// Libros detallados — paleta de colores, geometría con lomo, páginas, textura de "texto"
// El libro se orienta con el lomo hacia +X, páginas a -X
import * as THREE from 'three';
import { BOOK_WIDTH, BOOK_HEIGHT, BOOK_DEPTH } from './constants.js';

const SPINE_COLORS = [
  0x8b2500, 0x2c1810, 0x3b2f2f, 0x1a2e1a,
  0x1a1a3e, 0x2c1a30, 0x3a2a1a, 0x1a1a1a,
  0x5c3a1a, 0x3a2a00, 0x4a2020, 0x202040,
];

const spineTextureCache = new Map();

function generateSpineTexture(variant) {
  const key = variant % 8;
  if (spineTextureCache.has(key)) return spineTextureCache.get(key);

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 128, 256);

  // Líneas decorativas doradas (simulan letras y dorado en el lomo)
  ctx.strokeStyle = `hsla(45, 40%, ${50 + (variant % 3) * 15}%, 0.7)`;
  ctx.fillStyle = `hsla(45, 30%, 45%, 0.5)`;
  ctx.fillRect(10, 20, 108, 2);
  ctx.fillRect(10, 30, 108, 1);

  for (let i = 0; i < 12 + variant % 8; i++) {
    const y = 55 + i * (14 + (variant % 3));
    const lineWidth = 30 + (variant * 7 + i * 13) % 71;
    const xOffset = (variant * 3 + i * 7) % 20;
    ctx.fillStyle = `hsla(45, 20%, ${60 + (variant * 5 + i * 11) % 30}%, ${0.3 + (variant * 7 + i * 3) % 5 * 0.1})`;
    ctx.fillRect(15 + xOffset, y, lineWidth, 1);
  }

  ctx.fillRect(10, 200, 108, 1);
  ctx.fillRect(10, 210, 108, 2);

  const texture = new THREE.CanvasTexture(canvas);
  spineTextureCache.set(key, texture);
  return texture;
}

// Crea un libro como grupo de meshes
// bookIndex define color/altura/textura determinista
// return: THREE.Group con el libro de pie, lomo hacia +X
/**
 * Crea un libro detallado con lomo texturizado, páginas y cantos dorados.
 * Cada índice produce un color de lomo pseudoaleatorio.
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
