// Funciones geométricas hexagonales — coordenadas axiales, vértices, anillos
// Separadas de hexagon.js para mantener responsabilidades únicas.

import * as THREE from 'three';
import { HEX_RADIUS } from './constants.js';

// ─── Vértices de hexágono ────────────────────────────────────────────────────

/** Calcula la i-ésima esquina de un hexágono centrado en (cx, cz) con radio r. */
function hexCorner(cx, cz, r, i) {
  const angle = (Math.PI / 3) * i - Math.PI / 6;
  return new THREE.Vector3(
    cx + r * Math.cos(angle),
    0,
    cz + r * Math.sin(angle),
  );
}

/** Devuelve los 6 vértices de un hexágono centrado en (cx, cz) con radio r. */
export function hexCorners(cx, cz, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) pts.push(hexCorner(cx, cz, r, i));
  return pts;
}

// ─── Anillo hexágonal (para piso y techo) ─────────────────────────────────────

/** Crea una geometría de anillo hexágonal (dona) entre outerPts e innerPts. */
export function createHexRing(outerPts, innerPts) {
  const shape = new THREE.Shape();
  shape.moveTo(outerPts[0].x, outerPts[0].z);
  for (let i = 1; i < 6; i++) shape.lineTo(outerPts[i].x, outerPts[i].z);
  shape.lineTo(outerPts[0].x, outerPts[0].z);

  const hole = new THREE.Path();
  hole.moveTo(innerPts[0].x, innerPts[0].z);
  for (let i = 1; i < 6; i++) hole.lineTo(innerPts[i].x, innerPts[i].z);
  hole.lineTo(innerPts[0].x, innerPts[0].z);
  shape.holes.push(hole);

  return new THREE.ShapeGeometry(shape);
}

// ─── Conversión axial ↔ cartesiana ───────────────────────────────────────────

/** Convierte coordenadas axiales (q, r) a cartesianas (x, z). */
export function hexToWorld(q, r) {
  const x = HEX_RADIUS * 1.5 * q;
  const z = HEX_RADIUS * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
  return { x, z };
}

/** Redondeo de fracciones a coordenadas axiales enteras. */
function hexRound(q, r) {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  let rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return { q: rq, r: rr };
}

/**
 * Convierte coordenadas cartesianas (x, z) a axiales hexagonales (q, r).
 * Usa hex rounding para snap al hexágono más cercano.
 */
export function worldToHex(x, z) {
  const q = (2 / 3 * x) / HEX_RADIUS;
  const r = (-1 / 3 * x + Math.sqrt(3) / 3 * z) / HEX_RADIUS;
  return hexRound(q, r);
}

// ─── Grid hexagonal ──────────────────────────────────────────────────────────

/**
 * Genera un grid de coordenadas axiales alrededor del centro.
 * @param {number} radius — Número de anillos (0 = solo el central)
 * @returns {Array<{q: number, r: number}>}
 */
export function createHexGrid(radius) {
  const positions = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      if (Math.abs(q + r) > radius) continue;
      positions.push({ q, r });
    }
  }
  return positions;
}
