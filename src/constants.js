// Parámetros del mundo borgiano.
//
// Las cifras marcadas como «canónicas» provienen literalmente de
// «La Biblioteca de Babel» (Jorge Luis Borges, 1941) y NO deben alterarse
// sin romper la fidelidad al cuento. Ver README §«Fidelidad al texto».

export const HEX_RADIUS = 5;          // radio del hexágono (centro a vértice)
export const HEX_HEIGHT = 6;          // altura del hexágono (de piso a techo)
export const WALL_THICKNESS = 0.2;
export const CENTER_HOLE_RADIUS = 2;  // radio del pozo de ventilación central

// ─── Estructura canónica del hexágono ────────────────────────────────────────
// "Veinte anaqueles, a cinco largos anaqueles por lado, cubren todos los lados
//  menos dos" → 4 muros con anaqueles (2 libres: zaguán + paso), 5 por muro.
export const SHELVED_WALLS = 4;          // canónico: "todos los lados menos dos"
export const NUM_SHELVES_PER_WALL = 5;   // canónico: "cinco largos anaqueles por lado"
export const SHELVES_PER_HEX = SHELVED_WALLS * NUM_SHELVES_PER_WALL; // = 20 ("Veinte anaqueles")

// "cada anaquel encierra treinta y dos libros de formato uniforme"
export const BOOKS_PER_SHELF = 32;       // canónico

// Contenido de cada libro (canónico) — usado en lomos, HUD e inscripciones.
export const PAGES_PER_BOOK   = 410;     // "cuatrocientas diez páginas"
export const LINES_PER_PAGE   = 40;      // "cuarenta renglones"
export const LETTERS_PER_LINE = 80;      // "unas ochenta letras de color negro"

// "El espacio, el punto, la coma, las veintidós letras del alfabeto son los
//  veinticinco símbolos suficientes" → alfabeto de 25 símbolos.
// 22 letras + espacio + punto + coma. Con estos 25 se escriben todos los libros.
export const ALPHABET = 'abcdefghijklmnopqrstuv .,';
//                       └──── 22 letras ────┘└┬┘
//                                   espacio · punto · coma  → 25 símbolos

// Dimensiones físicas de estantes y libros
export const SHELF_DEPTH = 0.4;
export const SHELF_HEIGHT = 0.25;
export const SHELF_Y_BOTTOM = 0.5;    // altura del primer estante
export const SHELF_SPACING = 0.6;     // espacio entre estantes
export const BOOK_WIDTH = 0.08;
export const BOOK_HEIGHT = 0.18;
export const BOOK_DEPTH = 0.3;

// ─── Lámparas ─────────────────────────────────────────────────────────────────
// "La luz procede de unas frutas esféricas que llevan el nombre de lámparas.
//  Hay dos en cada hexágono: transversales."
export const LAMPS_PER_HEX = 2;       // canónico

// Cámara
export const MOUSE_SENSITIVITY = 0.002;
export const MOVE_SPEED = 5;
export const PLAYER_HEIGHT = 1.4;

// LOD thresholds (distancia en pisos) — VISIBLE_FLOORS se define abajo como LOD_LOW_DIST
export const LOD_FULL_DIST   = 2;     // |dy| ≤ 2: detalle completo (con libros)
export const LOD_MEDIUM_DIST = 4;     // |dy| ≤ 4: sin libros, solo estantes
export const LOD_LOW_DIST    = 6;     // |dy| ≤ 6: solo estructura (paredes + piso)

// Pisos visibles = LOD_LOW_DIST — no se crean pisos que nunca se rendericen
export const VISIBLE_FLOORS = LOD_LOW_DIST;

// Colores borgianos (madera oscura, piedra, dorado)
export const COLORS = {
  floor: 0x3d2b1f,       // madera oscura
  wall: 0x5c4033,         // marrón piedra
  railing: 0x8b7355,      // bronce
  railing_rail: 0xa0895f, // baranda dorada
  shelf: 0x2c1810,        // estante caoba
  book_spine: 0x8b0000,   // rojo libro
  book_page: 0xf5deb3,    // páginas
};

// Cuántas galerías abarcar en X/Y para generar
export const GRID_RADIUS = 1; // 0 = solo la central; 1 = 7 hexágonos
