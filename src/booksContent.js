// Contenido determinista de los libros de la Biblioteca.
//
// El cuento de Borges dice que la Biblioteca contiene "todas las
// combinaciones posibles" de los 25 símbolos del alfabeto canónico. Eso es
// físicamente imposible (10^18465 libros), pero el efecto narrativo — que
// cada libro tenga un contenido único, estable y en apariencia aleatorio —
// sí es modelable: una función determinista que, dada una posición
// (hex q,r,floor, wall, shelf, bookIndex), devuelve un contenido único.
//
// Características del modelo:
//   1. Determinismo: misma posición → mismo contenido en cada arranque.
//   2. Alfabeto canónico: solo los 25 símbolos del cuento (22 letras + esp + . + ,).
//   3. Densidad Borges: cada libro tiene 410 páginas × 40 renglones × 80 letras
//      (constantes canónicas) PERO solo materializamos páginas bajo demanda.
//   4. "Libros-catalogo": ~1% de los libros generan un título legible en
//      español, evocando los volúmenes donde los bibliotecarios creen ver
//      el catálogo de la Biblioteca. Borges: "Algunos bibliotecarios creen
//      haber encontrado el libro-catalogo".

import {
  ALPHABET, PAGES_PER_BOOK, LINES_PER_PAGE, LETTERS_PER_LINE,
  SHELVED_WALLS, NUM_SHELVES_PER_WALL, BOOKS_PER_SHELF,
} from './constants.js';

// ─── PRNG determinista (mulberry32) ─────────────────────────────────────────

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Hash de posición → semilla ─────────────────────────────────────────────

/**
 * Función hash rápida (FNV-1a 32-bit) que mezcla q, r, floor, wall, shelf
 * y bookIndex en una semilla de 32 bits. No es criptográfica — solo
 * necesitamos que posiciones distintas produzcan semillas distintas y que
 * la misma posición siempre dé la misma semilla.
 */
function hashPosition(q, r, floor, wall, shelf, bookIndex) {
  let h = 0x811c9dc5; // FNV offset basis
  const mix = (n) => {
    h ^= n & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (n >>> 8) & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (n >>> 16) & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (n >>> 24) & 0xff;
    h = Math.imul(h, 0x01000193);
  };
  // Bit-encode signed ints en unsigned (xor con 0x80000000 para q/r negativos)
  mix((q ^ 0x80000000) >>> 0);
  mix((r ^ 0x80000000) >>> 0);
  mix((floor ^ 0x80000000) >>> 0);
  mix(wall);
  mix(shelf);
  mix(bookIndex);
  return h >>> 0;
}

// ─── Generación de texto ────────────────────────────────────────────────────

/**
 * Genera una cadena de longitud `len` con símbolos del alfabeto canónico.
 * Usa la semilla `seed` (mulberry32). El resultado es determinista.
 */
export function generateText(seed, len) {
  const rng = mulberry32(seed);
  let out = '';
  for (let i = 0; i < len; i++) {
    out += ALPHABET[Math.floor(rng() * ALPHABET.length)];
  }
  return out;
}

/**
 * Genera una línea (80 caracteres) del alfabeto canónico, a partir de la
 * semilla del libro y el número de línea.
 */
export function generateLine(bookSeed, lineNumber) {
  // Cada línea usa una sub-semilla distinta: bookSeed XOR (lineNumber * PRIME)
  return generateText((bookSeed ^ Math.imul(lineNumber, 0x9e3779b1)) >>> 0, LETTERS_PER_LINE);
}

/**
 * Genera la página `n` de un libro (40 líneas de 80 caracteres). Devuelve
 * un array de strings, uno por línea. O(n) en memoria — solo materializamos
 * lo que el inspector va a mostrar.
 */
export function generatePage(q, r, floor, wall, shelf, bookIndex, pageNumber) {
  const bookSeed = hashPosition(q, r, floor, wall, shelf, bookIndex);
  const lines = [];
  const startLine = pageNumber * LINES_PER_PAGE;
  for (let i = 0; i < LINES_PER_PAGE; i++) {
    lines.push(generateLine(bookSeed, startLine + i));
  }
  return lines;
}

// ─── Identificación de libros ───────────────────────────────────────────────

/**
 * Convierte (hexQ, hexR, floor, wall, shelf, bookIndex) en un ID estable
 * y legible, útil para debugging, HUD y persistencia.
 *   "hex(0,0)f0/w2/s4/b17"
 *   "hex(-1,2)f3/w0/s1/b0"
 */
export function bookId(q, r, floor, wall, shelf, bookIndex) {
  return `hex(${q},${r})f${floor}/w${wall}/s${shelf}/b${bookIndex}`;
}

/**
 * Dado el instanceId de un InstancedMesh y los metadatos del muro
 * (hexQ, hexR, floorIdx, wallIdx, booksPerShelf, shelvesPerWall),
 * devuelve {wall, shelf, bookIndex}.
 *
 * Layout del InstancedMesh (ver createBookWall en bookshelf.js):
 *   for s in 0..NUM_SHELVES_PER_WALL:
 *     for b in 0..BOOKS_PER_SHELF:
 *       instanceId = s * BOOKS_PER_SHELF + b
 */
export function instanceToBook(instanceId) {
  const shelf = Math.floor(instanceId / BOOKS_PER_SHELF);
  const bookIndex = instanceId % BOOKS_PER_SHELF;
  return { wall: -1, shelf, bookIndex }; // wall se llena desde el userData del mesh
}

/**
 * El "número total de libros" en una sala: 4 muros × 5 anaqueles × 32 libros
 * = 640 (canónico: "cada uno de cuyos anaqueles encierra treinta y dos libros
 * de formato uniforme; cada libro encierra cuatrocientas diez páginas; cada
 * página, cuarenta renglones; cada renglón, unas ochenta letras de color
 * negro"). Solo 4 muros tienen estantes (los otros dos son vestíbulos).
 */
export const BOOKS_PER_HEX = SHELVED_WALLS * NUM_SHELVES_PER_WALL * BOOKS_PER_SHELF;

// ─── "Libros-catalogo" — 1% tienen título legible ──────────────────────────

// Palabras castellanas plausibles para un título de libro-catalogo.
// Mantengo la lista corta — son los fragmentos que "los bibliotecarios creen
// haber encontrado". NO es una lengua real: Borges dice que estos libros
// "contienen una sola línea" o "un solo nombre".
const CATALOG_WORDS = [
  'dios', 'biblioteca', 'hexagono', 'infinito', 'catalogo',
  'laberinto', 'pozo', 'galeria', 'pagina', 'alfabeto',
  'nombre', 'espejo', 'escalera', 'suelo', 'letra',
  'volumen', 'indice', 'anaquel', 'estante', 'sabiduria',
];

/**
 * Determina si un libro es "especial" (libro-catalogo, ~1% de los casos)
 * y devuelve un título plausible. Devuelve null si no es especial.
 */
export function maybeTitle(q, r, floor, wall, shelf, bookIndex) {
  const seed = hashPosition(q, r, floor, wall, shelf, bookIndex);
  // Probabilidad ~1%: usa el primer byte de la semilla (256 valores, 0 → título)
  if ((seed >>> 24) !== 0) return null;
  // Título: 2-4 palabras del catálogo, separadas por espacio (canónico: "espacio")
  const rng = mulberry32(seed ^ 0xdeadbeef);
  const wordCount = 2 + Math.floor(rng() * 3); // 2..4
  const words = [];
  for (let i = 0; i < wordCount; i++) {
    words.push(CATALOG_WORDS[Math.floor(rng() * CATALOG_WORDS.length)]);
  }
  return words.join(' ');
}

/**
 * Descriptor completo de un libro en una posición. Útil para el modal DOM:
 * no genera las 410 páginas — solo las primeras N si se piden.
 */
export function describeBook(q, r, floor, wall, shelf, bookIndex, pageCount = 1) {
  const id = bookId(q, r, floor, wall, shelf, bookIndex);
  const title = maybeTitle(q, r, floor, wall, shelf, bookIndex);
  const pages = [];
  for (let p = 0; p < pageCount; p++) {
    pages.push(generatePage(q, r, floor, wall, shelf, bookIndex, p));
  }
  return {
    id,
    title,
    pages,
    location: { q, r, floor, wall, shelf, bookIndex },
    canonic: {
      pagesPerBook: PAGES_PER_BOOK,
      linesPerPage: LINES_PER_PAGE,
      lettersPerLine: LETTERS_PER_LINE,
      alphabet: ALPHABET.length, // 25
    },
  };
}