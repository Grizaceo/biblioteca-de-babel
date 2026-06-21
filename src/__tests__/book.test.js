import { describe, it, expect, beforeAll } from 'vitest';
import { createBook } from '../book.js';
import { BOOK_WIDTH, BOOK_HEIGHT, BOOK_DEPTH } from '../constants.js';

// jsdom no implementa canvas.getContext('2d'), así que mockeamos
// las funciones que usa generateSpineTexture en book.js
function mockCanvasContext() {
  const ctx = {
    clearRect: () => {},
    fillRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    fillText: () => {},
    __canvas: null,
  };
  // Props que Three.js o el código setean como strings/números
  ['fillStyle', 'strokeStyle', 'font', 'textAlign', 'lineWidth'].forEach(p => {
    Object.defineProperty(ctx, p, {
      get: () => '',
      set: () => {},
    });
  });
  // Mock getContext en el prototype del canvas
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

describe('createBook', () => {
  it('retorna un THREE.Group con hijos', () => {
    const book = createBook(0);
    expect(book.type).toBe('Group');
    expect(book.children.length).toBeGreaterThanOrEqual(2);
  });

  it('contiene un Mesh con geometría BoxGeometry', () => {
    const book = createBook(0);
    const meshes = book.children.filter(c => c.type === 'Mesh');
    expect(meshes.length).toBeGreaterThanOrEqual(1);
    const spine = meshes[0];
    expect(spine.geometry.type).toBe('BoxGeometry');
  });

  it('libros distintos tienen colores de lomo diferentes', () => {
    const colors = new Set();
    for (let i = 0; i < 20; i++) {
      const book = createBook(i);
      const meshes = book.children.filter(c => c.type === 'Mesh');
      const colorHex = meshes[0].material.color.getHex();
      colors.add(colorHex);
    }
    expect(colors.size).toBeGreaterThanOrEqual(2);
  });

  it('el lomo tiene dimensiones coherentes con BOOK_DEPTH * 0.15', () => {
    const book = createBook(0);
    const spine = book.children.find(c => c.type === 'Mesh');
    const geom = spine.geometry;
    expect(geom.parameters.width).toBeGreaterThan(BOOK_DEPTH * 0.10);
    expect(geom.parameters.width).toBeLessThan(BOOK_DEPTH * 0.20);
    expect(geom.parameters.height).toBeGreaterThan(BOOK_HEIGHT * 0.8);
    expect(geom.parameters.height).toBeLessThan(BOOK_HEIGHT * 1.2);
    expect(geom.parameters.depth).toBeCloseTo(BOOK_WIDTH, 2);
  });
});
