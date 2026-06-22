import { describe, it, expect, beforeAll } from 'vitest';
import { createBookWall, BOOKS_PER_WALL } from '../bookshelf.js';
import { NUM_SHELVES_PER_WALL, BOOKS_PER_SHELF } from '../constants.js';

// jsdom no implementa canvas.getContext('2d'); generateSpineTexture (book.js)
// lo usa al construir la textura del lomo.
function mockCanvasContext() {
  const ctx = {
    clearRect: () => {}, fillRect: () => {}, fillText: () => {},
    beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, stroke: () => {},
    textBaseline: 'top',
  };
  ['fillStyle', 'strokeStyle', 'font', 'textAlign', 'lineWidth'].forEach(p => {
    Object.defineProperty(ctx, p, { get: () => '', set: () => {} });
  });
  HTMLCanvasElement.prototype.getContext = () => ctx;
}

beforeAll(async () => {
  if (typeof document === 'undefined') {
    const jsdom = await import('jsdom');
    const dom = new jsdom.JSDOM('<!DOCTYPE html>');
    global.document = dom.window.document;
    global.HTMLCanvasElement = dom.window.HTMLCanvasElement;
  }
  mockCanvasContext();
});

describe('createBookWall', () => {
  it('BOOKS_PER_WALL = anaqueles × libros por anaquel (5 × 32 = 160)', () => {
    expect(BOOKS_PER_WALL).toBe(NUM_SHELVES_PER_WALL * BOOKS_PER_SHELF);
    expect(BOOKS_PER_WALL).toBe(160);
  });

  it('retorna un InstancedMesh con un libro por instancia', () => {
    const wall = createBookWall(8, 0, -0.3);
    expect(wall.isInstancedMesh).toBe(true);
    expect(wall.count).toBe(BOOKS_PER_WALL);
  });

  it('cuenta como Mesh (compatibilidad con filtros de escena)', () => {
    const wall = createBookWall(8, 2, -0.3);
    expect(wall.type).toBe('Mesh');
    expect(wall.isMesh).toBe(true);
  });

  it('asigna color por instancia (instanceColor poblado)', () => {
    const wall = createBookWall(8, 1, -0.3);
    expect(wall.instanceColor).toBeTruthy();
    expect(wall.instanceColor.count).toBe(BOOKS_PER_WALL);
  });

  it('es determinista: misma entrada ⇒ misma primera matriz', () => {
    const a = createBookWall(8, 3, -0.3);
    const b = createBookWall(8, 3, -0.3);
    expect(Array.from(a.instanceMatrix.array.slice(0, 16)))
      .toEqual(Array.from(b.instanceMatrix.array.slice(0, 16)));
  });

  it('tiene boundingSphere calculado (para frustum culling correcto)', () => {
    const wall = createBookWall(8, 0, -0.3);
    expect(wall.boundingSphere).toBeTruthy();
    expect(wall.boundingSphere.radius).toBeGreaterThan(0);
  });

  it('reutiliza el material entre muros del mismo índice (cache por textura)', () => {
    const a = createBookWall(8, 0, -0.3);
    const b = createBookWall(8, 0, -0.3);
    expect(a.material).toBe(b.material); // mismo material, no uno nuevo por muro
  });

  it('comparte la geometría base entre todos los muros', () => {
    const a = createBookWall(8, 0, -0.3);
    const b = createBookWall(8, 5, -0.3);
    expect(a.geometry).toBe(b.geometry);
  });
});
