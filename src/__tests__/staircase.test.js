import { describe, it, expect } from 'vitest';
import { createSpiralStaircase } from '../staircase.js';

describe('createSpiralStaircase', () => {
  it('retorna un THREE.Group', () => {
    const sg = createSpiralStaircase(0, 0, 0);
    expect(sg.type).toBe('Group');
  });

  it('tiene poste central + escalones + baranda (26 hijos)', () => {
    const sg = createSpiralStaircase(0, 0, 0);
    // 1 poste + 24 escalones + 1 baranda helicoidal = 26
    expect(sg.children.length).toBe(26);
  });

  it('posiciona el grupo en (cx, floorY, cz)', () => {
    const sg = createSpiralStaircase(3, 0, 5);
    expect(sg.position.x).toBe(3);
    expect(sg.position.y).toBe(5);
    expect(sg.position.z).toBe(0);
  });

  it('direction -1 también produce 26 hijos', () => {
    const sg = createSpiralStaircase(0, 0, 0, -1);
    expect(sg.children.length).toBe(26);
  });

  it('todos los hijos son Mesh', () => {
    const sg = createSpiralStaircase(0, 0, 0);
    expect(sg.children.every(c => c.type === 'Mesh')).toBe(true);
  });

  it('el poste central (primer hijo) es un CylinderGeometry', () => {
    const sg = createSpiralStaircase(0, 0, 0);
    const pole = sg.children[0];
    expect(pole.geometry.type).toBe('CylinderGeometry');
  });
});
