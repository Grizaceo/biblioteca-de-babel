import { describe, it, expect, beforeAll } from 'vitest';
import { createHexRoom } from '../hexagon.js';
import { CENTER_HOLE_RADIUS, HEX_RADIUS } from '../constants.js';

// jsdom setup: book.js usa canvas.getContext('2d') en generateSpineTexture
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
  ['fillStyle', 'strokeStyle', 'font', 'textAlign', 'lineWidth'].forEach(p => {
    Object.defineProperty(ctx, p, {
      get: () => '',
      set: () => {},
    });
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

describe('createHexRoom', () => {
  it('retorna un objeto con group, lamps, stairTriggers', () => {
    const result = createHexRoom(0, 0, 0);
    expect(result).toHaveProperty('group');
    expect(result).toHaveProperty('lamps');
    expect(result).toHaveProperty('stairTriggers');
  });

  it('group es un THREE.Group con hijos', () => {
    const { group } = createHexRoom(0, 0, 0);
    expect(group.type).toBe('Group');
    expect(group.children.length).toBeGreaterThan(0);
  });

  it('group contiene al menos un Mesh', () => {
    const { group } = createHexRoom(0, 0, 0);
    const meshes = group.children.filter(c => c.type === 'Mesh');
    expect(meshes.length).toBeGreaterThanOrEqual(1);
  });

  it('stairTriggers tiene 2 entradas (una subida, una bajada por hexágono)', () => {
    const { stairTriggers } = createHexRoom(0, 0, 0);
    expect(stairTriggers.length).toBe(2);
  });

  it('stairTriggers tienen posiciones reales (worldX, worldY, worldZ)', () => {
    const { stairTriggers } = createHexRoom(5, 0, 3);
    for (const t of stairTriggers) {
      expect(typeof t.worldX).toBe('number');
      expect(typeof t.worldZ).toBe('number');
      expect(typeof t.worldY).toBe('number');
      expect(typeof t.direction).toBe('number');
    }
  });

  it('lamps está presente (puede ser array vacío en LOD alto)', () => {
    const { lamps } = createHexRoom(0, 0, 0);
    expect(Array.isArray(lamps)).toBe(true);
  });

  it('exactamente 2 lámparas por hexágono en LOD 0-1, 0 en LOD 2', () => {
    expect(createHexRoom(0, 0, 0, false, 0).lamps).toHaveLength(2);
    expect(createHexRoom(0, 0, 0, false, 1).lamps).toHaveLength(2);
    expect(createHexRoom(0, 0, 0, false, 2).lamps).toHaveLength(0);
  });

  it('un solo espejo (zaguán) en LOD 0, ninguno en LOD 2', () => {
    // El espejo usa material metálico (metalness 1); contamos esos meshes.
    const countMirror = (group) => {
      let n = 0;
      group.traverse((o) => {
        if (o.isMesh && o.material && o.material.metalness === 1.0) n++;
      });
      return n;
    };
    expect(countMirror(createHexRoom(0, 0, 0, false, 0).group)).toBe(1);
    expect(countMirror(createHexRoom(0, 0, 0, false, 2).group)).toBe(0);
  });

  it('el espejo queda DENTRO del hexágono (no flota fuera del muro)', () => {
    // Regresión: el offset diagonal lo dejaba a ~5.54 del centro (fuera del
    // vértice, radio 5). Correcto: apoyado en la cara interior del muro (< radio).
    const { group } = createHexRoom(0, 0, 0, false, 0);
    let glass = null;
    group.traverse((o) => {
      if (o.isMesh && o.material && o.material.metalness === 1.0) glass = o;
    });
    expect(glass).toBeTruthy();
    const dist = Math.hypot(glass.position.x, glass.position.z);
    expect(dist).toBeGreaterThan(0);
    expect(dist).toBeLessThan(HEX_RADIUS); // dentro del hexágono
  });

  it('salas distintas comparten la geometría invariante del piso', () => {
    // El piso (primer hijo) usa el anillo hexagonal compartido a nivel de módulo.
    const a = createHexRoom(0, 0, 0).group.children[0];
    const b = createHexRoom(20, 0, 30).group.children[0];
    expect(a.geometry).toBe(b.geometry); // mismo objeto geometry, no una copia
  });

  it('LOD 0 produce más objetos que LOD 2', () => {
    const r0 = createHexRoom(0, 0, 0, false, 0);
    const r2 = createHexRoom(0, 0, 0, false, 2);
    expect(r0.group.children.length).toBeGreaterThan(r2.group.children.length);
  });

  it('grupos en posiciones distintas no comparten position', () => {
    // createHexRoom(centerX, centerZ, floorY, withLights, lod)
    const a = createHexRoom(10, 0, 20);
    const b = createHexRoom(-5, 0, 15);
    expect(a.group.position.x).toBe(10);  // centerX
    expect(a.group.position.z).toBe(0);   // centerZ = z
    expect(b.group.position.x).toBe(-5);
    expect(b.group.position.z).toBe(0);
  });
});
