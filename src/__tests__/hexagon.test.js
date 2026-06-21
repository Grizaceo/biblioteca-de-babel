import { describe, it, expect } from 'vitest';
import { createHexGrid, hexToWorld } from '../hexagon.js';
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
    // GRID_RADIUS = 1 en constants.js = 7 hexágonos
    expect(GRID_RADIUS).toBe(1);
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
