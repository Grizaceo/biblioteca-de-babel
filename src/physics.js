// Primitivas de colisión 2D (XZ) — sin Three.js, puramente geométrico.
// El player se modela como un círculo vertical de radio PLAYER_RADIUS.
// Los colisionadores son segmentos (paredes) o círculos (barandas del pozo).
//
// Toda función devuelve "penetración mínima + normal de push-out", es decir,
// lo necesario para sacar al player del solapamiento en una sola iteración.

import { HEX_RADIUS } from './constants.js';

export const PLAYER_RADIUS = 0.3; // radio del cilindro vertical del player

/**
 * Distancia mínima del punto (px, pz) al segmento AB y vector desde el
 * punto más cercano del segmento hacia el punto (sale normalizado).
 * @returns {{ dist: number, nx: number, nz: number }}
 *   dist = distancia euclidiana; nx, nz = unitario desde segmento → punto.
 */
export function pointSegment(px, pz, ax, az, bx, bz) {
  const abx = bx - ax;
  const abz = bz - az;
  const apx = px - ax;
  const apz = pz - az;
  const abLen2 = abx * abx + abz * abz;
  if (abLen2 === 0) {
    // Segmento degenerado: tratar A como punto
    const d = Math.hypot(apx, apz);
    return { dist: d, nx: d > 0 ? apx / d : 0, nz: d > 0 ? apz / d : 0 };
  }
  let t = (apx * abx + apz * abz) / abLen2;
  t = Math.max(0, Math.min(1, t));
  const cxp = ax + t * abx;
  const czp = az + t * abz;
  const dx = px - cxp;
  const dz = pz - czp;
  const d = Math.hypot(dx, dz);
  return {
    dist: d,
    nx: d > 0 ? dx / d : 0,
    nz: d > 0 ? dz / d : 0,
  };
}

/**
 * Colisión círculo (player) vs segmento (pared).
 * Si overlap > 0, hay solapamiento: el player debe empujarse en (nx, nz)
 * una distancia `overlap` para salir.
 * @returns {{ overlap: number, nx: number, nz: number, hit: boolean }}
 */
export function circleVsSegment(cx, cz, r, ax, az, bx, bz) {
  const { dist, nx, nz } = pointSegment(cx, cz, ax, az, bx, bz);
  const overlap = r - dist;
  return { overlap, nx, nz, hit: overlap > 0 };
}

/**
 * Colisión círculo vs círculo (player vs baranda del pozo, p.ej.).
 * Normal apunta desde el centro del círculo-obstáculo hacia el player.
 * Si el player está exactamente en el centro del obstáculo, devuelve la
 * dirección +X (arbitraria pero determinista) para no quedarse atascado.
 */
export function circleVsCircle(cx, cz, r, ox, oz, orad) {
  const dx = cx - ox;
  const dz = cz - oz;
  const dist = Math.hypot(dx, dz);
  const overlap = r + orad - dist;
  let nx, nz;
  if (dist > 1e-6) {
    nx = dx / dist;
    nz = dz / dist;
  } else {
    // Caso degenerado: player está en el centro exacto del obstáculo.
    // Empujamos en +X (arbitrario pero consistente). En práctica este caso
    // aparece solo si un spawn o teleport dejó al player exactamente en el
    // centro, lo que no debería ocurrir en gameplay normal.
    nx = 1;
    nz = 0;
  }
  return {
    overlap,
    nx,
    nz,
    hit: overlap > 0,
  };
}

/**
 * Construye los colisionadores de un hex centrado en (cx, cz) en XZ:
 *   - 6 segmentos de pared (los lados del hex regular)
 *   - 1 círculo central para la baranda del pozo (radio CENTER_HOLE_RADIUS)
 *   - el player NO puede cruzar la baranda hacia el pozo
 *
 * @param {number} cx - centro X del hex
 * @param {number} cz - centro Z del hex
 * @param {number} hexRadius - radio del hex (de centro a vértice)
 * @param {number} holeRadius - radio del pozo central
 * @returns {Array<{kind: 'wall'|'railing', ...}>}
 */
export function buildHexColliders(cx, cz, hexRadius = HEX_RADIUS, holeRadius = 2) {
  const colliders = [];

  // 6 paredes (segmentos entre vértices consecutivos)
  // Misma convención que hexCorners() en geometry.js: i*60° - 30°
  for (let i = 0; i < 6; i++) {
    const a1 = (Math.PI / 3) * i - Math.PI / 6;
    const a2 = (Math.PI / 3) * ((i + 1) % 6) - Math.PI / 6;
    const ax = cx + hexRadius * Math.cos(a1);
    const az = cz + hexRadius * Math.sin(a1);
    const bx = cx + hexRadius * Math.cos(a2);
    const bz = cz + hexRadius * Math.sin(a2);
    colliders.push({ kind: 'wall', ax, az, bx, bz });
  }

  // Baranda del pozo: círculo que repele al player hacia afuera
  colliders.push({ kind: 'railing', ox: cx, oz: cz, orad: holeRadius });

  return colliders;
}

/**
 * Empuja al player fuera de todos los colisionadores activos, iterando
 * hasta que no quede overlap o se alcance `maxIter`. Cada iteración aplica
 * el push-out más profundo (resuelve el peor solapamiento primero para
 * evitar peleas entre colliders adyacentes en el mismo frame).
 *
 * @param {number} px - X actual del player
 * @param {number} pz - Z actual del player
 * @param {Array} colliders - output de buildHexColliders()
 * @param {number} r - radio del player
 * @param {number} [maxIter=4] - iteraciones máx
 * @returns {{ x: number, z: number }}
 */
export function pushOut(px, pz, colliders, r = PLAYER_RADIUS, maxIter = 4) {
  let x = px;
  let z = pz;

  for (let iter = 0; iter < maxIter; iter++) {
    let worst = null;
    let worstOverlap = 0;

    for (const c of colliders) {
      let res;
      if (c.kind === 'wall') {
        res = circleVsSegment(x, z, r, c.ax, c.az, c.bx, c.bz);
      } else if (c.kind === 'railing') {
        res = circleVsCircle(x, z, r, c.ox, c.oz, c.orad);
      } else {
        continue;
      }
      if (res.hit && res.overlap > worstOverlap) {
        worstOverlap = res.overlap;
        worst = res;
      }
    }

    if (!worst) break; // sin solapamientos

    // Empujar exactamente lo necesario (más un epsilon para no quedarse pegado)
    const EPS = 0.001;
    x += worst.nx * (worstOverlap + EPS);
    z += worst.nz * (worstOverlap + EPS);
  }

  return { x, z };
}

/**
 * Dado el hex axial (q, r) y el punto (px, pz), devuelve el conjunto de
 * colisionadores que aplican: el hex actual + sus 6 vecinos (anillo 1).
 * Esto cubre el caso de player en el borde entre dos hexes.
 *
 * @param {number} q - axial q del hex actual
 * @param {number} r - axial r del hex actual
 * @param {Function} hexToWorld - (q,r) -> {x,z}
 * @param {Function} worldToHex - (x,z) -> {q,r}
 * @param {number} [hexRadius]
 * @param {number} [holeRadius]
 * @returns {Array}
 */
export function collidersForArea(q, r, hexToWorld, worldToHex, hexRadius = HEX_RADIUS, holeRadius = 2) {
  const offsets = [
    [0, 0], [1, 0], [0, 1], [-1, 1],
    [-1, 0], [0, -1], [1, -1],
  ];
  const out = [];
  for (const [dq, dr] of offsets) {
    const center = hexToWorld(q + dq, r + dr);
    // Solo incluir si el player está dentro del radio "razonable" (~1.2 hexes)
    // — pero como hexToWorld puede no estar limitado, incluimos todos los del
    // anillo 1; son solo 7, así que el costo es despreciable.
    out.push(...buildHexColliders(center.x, center.z, hexRadius, holeRadius));
  }
  return out;
}