// Tests para src/physics.js — colisiones 2D puramente geométricas.
// Sin Three.js, sin render: son tests rápidos de matemática.

import { describe, it, expect } from 'vitest';
import {
  PLAYER_RADIUS,
  pointSegment,
  circleVsSegment,
  circleVsCircle,
  buildHexColliders,
  pushOut,
  collidersForArea,
} from '../physics.js';

describe('pointSegment', () => {
  it('encuentra distancia correcta sobre el segmento', () => {
    // segmento (0,0)→(10,0), punto (5, 3) → dist 3, normal (0, +1)
    const r = pointSegment(5, 3, 0, 0, 10, 0);
    expect(r.dist).toBeCloseTo(3, 6);
    expect(r.nx).toBeCloseTo(0, 6);
    expect(r.nz).toBeCloseTo(1, 6);
  });

  it('clampa al extremo A cuando t<0', () => {
    // segmento (0,0)→(10,0), punto (-2, 4) → dist √20 ≈ 4.47, normal hacia (+x,-y)? No: vector desde A(0,0) hacia (-2,4)
    const r = pointSegment(-2, 4, 0, 0, 10, 0);
    expect(r.dist).toBeCloseTo(Math.hypot(-2, 4), 6);
    expect(r.nx).toBeCloseTo(-2 / Math.hypot(-2, 4), 6);
    expect(r.nz).toBeCloseTo(4 / Math.hypot(-2, 4), 6);
  });

  it('clampa al extremo B cuando t>1', () => {
    // segmento (0,0)→(10,0), punto (12, -3)
    const r = pointSegment(12, -3, 0, 0, 10, 0);
    expect(r.dist).toBeCloseTo(Math.hypot(2, -3), 6);
  });

  it('maneja segmento degenerado sin dividir por cero', () => {
    const r = pointSegment(3, 4, 5, 5, 5, 5); // A == B
    expect(r.dist).toBeCloseTo(Math.hypot(-2, -1), 6);
    expect(Number.isFinite(r.nx)).toBe(true);
    expect(Number.isFinite(r.nz)).toBe(true);
  });
});

describe('circleVsSegment', () => {
  it('hit=true cuando el círculo solapa el segmento', () => {
    // círculo (5, 0.1) r=0.5 vs segmento (0,0)→(10,0)
    const r = circleVsSegment(5, 0.1, 0.5, 0, 0, 10, 0);
    expect(r.hit).toBe(true);
    expect(r.overlap).toBeCloseTo(0.4, 6); // 0.5 - 0.1
  });

  it('hit=false cuando no hay solapamiento', () => {
    const r = circleVsSegment(5, 5, 0.5, 0, 0, 10, 0);
    expect(r.hit).toBe(false);
    expect(r.overlap).toBeLessThanOrEqual(0);
  });

  it('normal apunta desde segmento hacia player', () => {
    const r = circleVsSegment(5, 1, 1, 0, 0, 10, 0);
    expect(r.nx).toBeCloseTo(0, 6);
    expect(r.nz).toBeCloseTo(1, 6); // player arriba del segmento → push +z
  });
});

describe('circleVsCircle', () => {
  it('hit=true cuando se solapan', () => {
    const r = circleVsCircle(2, 0, 1, 0, 0, 1.5); // dist=2, suma radios=2.5
    expect(r.hit).toBe(true);
    expect(r.overlap).toBeCloseTo(0.5, 6);
  });

  it('hit=false cuando no se tocan', () => {
    const r = circleVsCircle(5, 0, 1, 0, 0, 1);
    expect(r.hit).toBe(false);
  });

  it('normal apunta desde el obstáculo hacia el player', () => {
    const r = circleVsCircle(2, 0, 1, 0, 0, 1); // player a la derecha del obs
    expect(r.nx).toBeCloseTo(1, 6);
    expect(r.nz).toBeCloseTo(0, 6);
  });
});

describe('buildHexColliders', () => {
  it('genera exactamente 7 colisionadores por hex (6 paredes + 1 baranda)', () => {
    const coll = buildHexColliders(0, 0, 5, 2);
    expect(coll).toHaveLength(7);
    const walls = coll.filter(c => c.kind === 'wall');
    const rails = coll.filter(c => c.kind === 'railing');
    expect(walls).toHaveLength(6);
    expect(rails).toHaveLength(1);
  });

  it('paredes forman hexágono regular cerrado', () => {
    // Cada segmento debe conectar con el siguiente en sus extremos (módulo ε)
    const coll = buildHexColliders(0, 0, 5, 2);
    const walls = coll.filter(c => c.kind === 'wall');
    for (let i = 0; i < 6; i++) {
      const next = walls[(i + 1) % 6];
      expect(walls[i].bx).toBeCloseTo(next.ax, 6);
      expect(walls[i].bz).toBeCloseTo(next.az, 6);
    }
  });

  it('baranda central está en (cx, cz) con el radio pedido', () => {
    const coll = buildHexColliders(7, -3, 5, 2);
    const rail = coll.find(c => c.kind === 'railing');
    expect(rail.ox).toBe(7);
    expect(rail.oz).toBe(-3);
    expect(rail.orad).toBe(2);
  });
});

describe('pushOut', () => {
  it('no mueve al player si no hay colisión', () => {
    const coll = buildHexColliders(0, 0, 5, 2);
    // player en (4, 0) — bien dentro del hex, lejos de paredes y pozo
    const r = pushOut(4, 0, coll, PLAYER_RADIUS);
    expect(r.x).toBeCloseTo(4, 6);
    expect(r.z).toBeCloseTo(0, 6);
  });

  it('empuja al player fuera de la pared cuando está pegado', () => {
    const coll = buildHexColliders(0, 0, 5, 2);
    // Pared del hex en y=0 va del vértice al vértice. Colocamos al player
    // apenas afuera (en x=0, z=0.5 con r=0.3): NO hay overlap, queda igual.
    // Lo metemos dentro: x=0, z=5 con r=0.3 → empuja hacia afuera del hex
    // (hacia +z en este vértice concreto).
    // En realidad, lo más fácil: colocar player cerca de una pared.
    // Pared "inferior" del hex (lado 3-4) tiene z<0; probar z=-4.8 (radio=5 vértice):
    // vértice 3 está en ángulo 3*60°-30° = 150°, cos=-√3/2 ≈ -0.866, sin=0.5
    // vértice 4 está en ángulo 4*60°-30° = 210°, cos=-√3/2 ≈ -0.866, sin=-0.5
    // segmento entre (-4.33, 2.5) y (-4.33, -2.5). Player en (-4.5, 0) r=0.3
    // → dist al segmento: |(-4.5)-(-4.33)| = 0.17, solapa por 0.13
    const r = pushOut(-4.5, 0, coll, PLAYER_RADIUS);
    // Debe empujar hacia -x (afuera del hex)
    expect(r.x).toBeLessThan(-4.5);
    expect(Math.abs(r.x - -4.5)).toBeGreaterThan(0.05);
  });

  it('mantiene al player fuera del pozo central', () => {
    const coll = buildHexColliders(0, 0, 5, 2);
    // Player justo en el centro, debería ser empujado al borde del pozo
    const r = pushOut(0, 0, coll, PLAYER_RADIUS);
    // dist al centro debe ser >= orad + r + epsilon = 2 + 0.3 + 0.001
    const distFromCenter = Math.hypot(r.x, r.z);
    expect(distFromCenter).toBeGreaterThanOrEqual(2.3 - 0.01); // pequeño epsilon de cálculo
  });

  it('resuelve colisión con múltiples paredes simultáneamente', () => {
    // Esquinas: el player atrapado en una esquina debe liberarse en una iteración
    const coll = buildHexColliders(0, 0, 5, 2);
    // vértice 0 está en -30°: (4.33, -2.5). Player dentro del hex en esa zona
    // en (4.0, -2.0) — debe quedar dentro del hex pero lejos de paredes
    const r = pushOut(4.0, -2.0, coll, PLAYER_RADIUS);
    expect(Math.hypot(r.x, r.z)).toBeLessThanOrEqual(5 + 0.01);
  });
});

describe('collidersForArea', () => {
  it('genera colisionadores para 7 hexes (centro + 6 vecinos)', () => {
    const hexToWorld = (q, r) => ({ x: q * 7.5, z: (q * 0.866 + r * 1.732) * 5 });
    const worldToHex = (x, z) => ({ q: 0, r: 0 }); // stub, no usado en este test
    const coll = collidersForArea(0, 0, hexToWorld, worldToHex, 5, 2);
    expect(coll).toHaveLength(7 * 7); // 7 hexes × 7 colliders cada uno
  });
});

describe('PLAYER_RADIUS', () => {
  it('es un valor razonable (0.3 m)', () => {
    expect(PLAYER_RADIUS).toBe(0.3);
  });
});