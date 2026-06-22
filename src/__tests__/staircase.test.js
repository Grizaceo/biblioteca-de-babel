import { describe, it, expect } from 'vitest';
import { createSpiralStaircase } from '../staircase.js';

describe('createSpiralStaircase', () => {
  it('retorna un THREE.Group', () => {
    const sg = createSpiralStaircase(0, 0, 0);
    expect(sg.type).toBe('Group');
  });

  it('tiene poste central + escalones + barandas (LOD 0: >= 70 hijos)', () => {
    const sg = createSpiralStaircase(0, 0, 0);
    // LOD 0 = 1 poste + 24 treads + 23 risers + inner rail + inner balusters
    //        + outer rail + outer balusters + 2 landings ≈ 76
    expect(sg.children.length).toBeGreaterThanOrEqual(70);
  });

  it('posiciona el grupo en (cx, floorY, cz)', () => {
    const sg = createSpiralStaircase(3, 0, 5);
    expect(sg.position.x).toBe(3);
    expect(sg.position.y).toBe(5);
    expect(sg.position.z).toBe(0);
  });

  it('direction -1 también produce suficientes hijos', () => {
    const sg = createSpiralStaircase(0, 0, 0, -1);
    expect(sg.children.length).toBeGreaterThanOrEqual(70);
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

  it('LOD 0 produce más hijos que LOD 2', () => {
    const lod0 = createSpiralStaircase(0, 0, 0, 1, 0);
    const lod2 = createSpiralStaircase(0, 0, 0, 1, 2);
    expect(lod0.children.length).toBeGreaterThan(lod2.children.length);
  });

  it('comparte la geometría de los escalones entre escaleras', () => {
    // El primer escalón (hijo 1, tras el poste) usa la BoxGeometry compartida.
    const a = createSpiralStaircase(0, 0, 0).children[1];
    const b = createSpiralStaircase(5, 0, 8).children[1];
    expect(a.geometry.type).toBe('BoxGeometry');
    expect(a.geometry).toBe(b.geometry); // mismo objeto, no una copia por escalera
  });

  it('dos escaleras con misma (dirección, LOD) comparten TODA su geometría', () => {
    // Incluye las barandas tubulares (TubeGeometry cacheada por lod/dirección).
    const uuids = (sg) => new Set(sg.children.map(c => c.geometry.uuid));
    const a = uuids(createSpiralStaircase(0, 0, 0, 1, 0));
    const b = uuids(createSpiralStaircase(9, 0, 4, 1, 0));
    expect(a).toEqual(b); // mismos objetos geometry → cero geometría nueva por escalera
    // y debe haber un tubo (baranda) entre ellas
    const hasTube = createSpiralStaircase(0, 0, 0, 1, 0).children
      .some(c => c.geometry.type === 'TubeGeometry');
    expect(hasTube).toBe(true);
  });
});
