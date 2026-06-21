import { describe, it, expect } from 'vitest';
import {
  HEX_RADIUS, HEX_HEIGHT, WALL_THICKNESS,
  CENTER_HOLE_RADIUS, SHELF_DEPTH, SHELF_HEIGHT,
  SHELF_Y_BOTTOM, SHELF_SPACING, NUM_SHELVES_PER_WALL,
  BOOKS_PER_SHELF, BOOK_WIDTH, BOOK_HEIGHT, BOOK_DEPTH,
  MOUSE_SENSITIVITY, MOVE_SPEED, PLAYER_HEIGHT,
  VISIBLE_FLOORS, COLORS, GRID_RADIUS,
} from '../constants.js';

describe('constants', () => {
  it('todas las dimensiones son números positivos', () => {
    const dims = [
      ['HEX_RADIUS', HEX_RADIUS],
      ['HEX_HEIGHT', HEX_HEIGHT],
      ['WALL_THICKNESS', WALL_THICKNESS],
      ['CENTER_HOLE_RADIUS', CENTER_HOLE_RADIUS],
      ['SHELF_DEPTH', SHELF_DEPTH],
      ['SHELF_HEIGHT', SHELF_HEIGHT],
      ['SHELF_Y_BOTTOM', SHELF_Y_BOTTOM],
      ['SHELF_SPACING', SHELF_SPACING],
      ['NUM_SHELVES_PER_WALL', NUM_SHELVES_PER_WALL],
      ['BOOKS_PER_SHELF', BOOKS_PER_SHELF],
      ['BOOK_WIDTH', BOOK_WIDTH],
      ['BOOK_HEIGHT', BOOK_HEIGHT],
      ['BOOK_DEPTH', BOOK_DEPTH],
      ['MOUSE_SENSITIVITY', MOUSE_SENSITIVITY],
      ['MOVE_SPEED', MOVE_SPEED],
      ['PLAYER_HEIGHT', PLAYER_HEIGHT],
      ['VISIBLE_FLOORS', VISIBLE_FLOORS],
      ['GRID_RADIUS', GRID_RADIUS],
    ];
    for (const [name, val] of dims) {
      expect(val, `${name} debería ser > 0`).toBeGreaterThan(0);
    }
  });

  it('CENTER_HOLE_RADIUS es menor que HEX_RADIUS (el pozo cabe dentro)', () => {
    expect(CENTER_HOLE_RADIUS).toBeLessThan(HEX_RADIUS);
  });

  it('BOOK_DIMENSION son coherentes', () => {
    // El libro no es más ancho que alto ni más alto que profundo
    expect(BOOK_WIDTH).toBeLessThan(BOOK_HEIGHT);
    expect(BOOK_HEIGHT).toBeLessThan(BOOK_DEPTH);
  });

  it('COLORS tiene todos los keys esperados', () => {
    const expectedKeys = [
      'floor', 'wall', 'railing', 'railing_rail',
      'shelf', 'book_spine', 'book_page',
    ];
    for (const key of expectedKeys) {
      expect(COLORS).toHaveProperty(key);
      expect(Number.isInteger(COLORS[key])).toBe(true);
    }
    expect(Object.keys(COLORS).length).toBe(expectedKeys.length);
  });

  it('NUM_SHELVES_PER_WALL * SHELF_SPACING cabe dentro de HEX_HEIGHT', () => {
    const totalShelfHeight = NUM_SHELVES_PER_WALL * SHELF_SPACING + SHELF_Y_BOTTOM;
    // Debe caber dentro del hexágono dejando espacio para el techo
    expect(totalShelfHeight).toBeLessThan(HEX_HEIGHT * 0.9);
  });

  it('PLAYER_HEIGHT es menor que HEX_HEIGHT (el jugador cabe en la habitación)', () => {
    expect(PLAYER_HEIGHT).toBeLessThan(HEX_HEIGHT);
  });
});
