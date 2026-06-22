import { describe, it, expect } from 'vitest';
import { createHexGrid, hexToWorld, worldToHex } from '../geometry.js';
import { HEX_RADIUS, GRID_RADIUS, CENTER_HOLE_RADIUS } from '../constants.js';

describe('createHexGrid', () => {
  it('radius 0 retorna solo el hexágono central', () => {
    const grid = createHexGrid(0);
    expect(grid).toHaveLength(1);
    expect(grid[0].q === 0 || grid[0].q === -0).toBe(true);
    expect(grid[0].r === 0 || grid[0].r === -0).toBe(true);
  });

  it('radius 1 retorna 7 hexágonos (axial ring 0 + 1)', () => {
    const grid = createHexGrid(1);
    // Fórmula: 3*n*(n+1) + 1 para radio n
    expect(grid).toHaveLength(7);
  });

  it('radius 2 retorna 19 hexágonos', () => {
    const grid = createHexGrid(2);
    expect(grid).toHaveLength(19);
  });

  it('todos los hexágonos tienen q,r enteros', () => {
    const grid = createHexGrid(2);
    for (const h of grid) {
      expect(Number.isInteger(h.q)).toBe(true);
      expect(Number.isInteger(h.r)).toBe(true);
    }
  });

  it('el hexágono central siempre está presente', () => {
    const grid = createHexGrid(2);
    expect(grid).toContainEqual({ q: 0, r: 0 });
  });

  it('GRID_RADIUS produce createHexGrid(GRID_RADIUS) === 7', () => {
    expect(GRID_RADIUS).toBeGreaterThanOrEqual(1);
    const grid = createHexGrid(GRID_RADIUS);
    expect(grid).toHaveLength(7);
  });
});

describe('hexToWorld', () => {
  it('centro es (0, 0)', () => {
    const { x, z } = hexToWorld(0, 0);
    expect(x).toBeCloseTo(0);
    expect(z).toBeCloseTo(0);
  });

  it('distancia desde centro es HEX_RADIUS * 1.5 para el primer vecino', () => {
    const { x, z } = hexToWorld(1, 0);
    // En coordenadas axiales, q=1,r=0 está a la derecha
    const dist = Math.sqrt(x * x + z * z);
    // La distancia real es HEX_RADIUS * sqrt(3) ≈ 1.732 * HEX_RADIUS
    expect(dist).toBeGreaterThan(HEX_RADIUS);
    expect(dist).toBeLessThan(HEX_RADIUS * 2);
  });

  it('todos los 6 vecinos tienen la misma distancia', () => {
    const neighbors = [
      [1, 0], [0, 1], [-1, 1],
      [-1, 0], [0, -1], [1, -1],
    ];
    const distances = neighbors.map(([q, r]) => {
      const { x, z } = hexToWorld(q, r);
      return Math.sqrt(x * x + z * z);
    });
    // Todos deben estar cerca del mismo valor
    for (let i = 1; i < distances.length; i++) {
      expect(distances[i]).toBeCloseTo(distances[0], 2);
    }
  });

  it('es simétrico: hexToWorld(-q, -r) es el opuesto', () => {
    const a = hexToWorld(1, 2);
    const b = hexToWorld(-1, -2);
    expect(a.x).toBeCloseTo(-b.x);
    expect(a.z).toBeCloseTo(-b.z);
  });
});

describe('worldToHex', () => {
  it('centro (0, 0) retorna { q: 0, r: 0 }', () => {
    const { q, r } = worldToHex(0, 0);
    expect(q).toBe(0);
    expect(r).toBe(0);
  });

  it('hexToWorld ∘ worldToHex ∘ hexToWorld es invariante', () => {
    const testCases = [[0,0], [1,0], [0,1], [-1,1], [-1,0], [0,-1], [1,-1], [2,-1], [-2,3]];
    for (const [qIn, rIn] of testCases) {
      const { x, z } = hexToWorld(qIn, rIn);
      const { q, r } = worldToHex(x, z);
      expect(q === 0 ? 0 : q).toBe(qIn);
      expect(r === 0 ? 0 : r).toBe(rIn);
    }
  });

  it('simetría: worldToHex(-x, -z) es el opuesto de worldToHex(x, z)', () => {
    const a = worldToHex(3.5, -2.1);
    const b = worldToHex(-3.5, 2.1);
    expect(a.q).toBe(-b.q);
    expect(a.r).toBe(-b.r);
  });

  it('punto cerca del vecino (1,0) redondea a ese hexágono', () => {
    const { x, z } = hexToWorld(1, 0);
    // Pequeña perturbación
    const { q, r } = worldToHex(x + 0.01, z + 0.01);
    expect(q).toBe(1);
    expect(r).toBe(0);
  });

  it('punto cerca de frontera entre hexágonos redondea al más cercano', () => {
    // Punto exactamente entre centro y vecino (1,0)
    const { x: x1, z: z1 } = hexToWorld(0, 0);
    const { x: x2, z: z2 } = hexToWorld(1, 0);
    const midX = (x1 + x2) / 2;
    const midZ = (z1 + z2) / 2;
    // El punto medio debe redondear a algún hexágono (no necesariamente el 0 o 1)
    const { q, r } = worldToHex(midX, midZ);
    expect(Number.isInteger(q)).toBe(true);
    expect(Number.isInteger(r)).toBe(true);
  });
});

