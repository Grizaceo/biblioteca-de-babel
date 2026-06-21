// Parámetros del mundo borgiano
export const HEX_RADIUS = 5;          // radio del hexágono (centro a vértice)
export const HEX_HEIGHT = 6;          // altura del hexágono (de piso a techo)
export const WALL_THICKNESS = 0.2;
export const CENTER_HOLE_RADIUS = 2;  // radio del pozo central

// Estantes
export const SHELF_DEPTH = 0.4;
export const SHELF_HEIGHT = 0.25;
export const SHELF_Y_BOTTOM = 0.5;    // altura del primer estante
export const SHELF_SPACING = 0.6;     // espacio entre estantes
export const NUM_SHELVES_PER_WALL = 6;
export const BOOKS_PER_SHELF = 8;
export const BOOK_WIDTH = 0.08;
export const BOOK_HEIGHT = 0.18;
export const BOOK_DEPTH = 0.3;

// Cámara
export const MOUSE_SENSITIVITY = 0.002;
export const MOVE_SPEED = 5;
export const PLAYER_HEIGHT = 1.4;

// Torre de hexágonos visibles
export const VISIBLE_FLOORS = 8;      // cuántos pisos renderizar arriba/abajo

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
