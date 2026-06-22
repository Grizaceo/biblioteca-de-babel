// Escalera de caracol (spiral staircase) borgiana — mejorada
// Va desde el piso hasta el techo del hexágono, pasando al siguiente nivel
//
// LOD 0: 24 escalones con contrahuella, baranda interior, plataformas descanso
// LOD 1: 16 escalones, baranda interior, plataformas
// LOD 2: 12 escalones, solo baranda exterior

import * as THREE from 'three';
import { HEX_HEIGHT } from './constants.js';

const stairMat = new THREE.MeshStandardMaterial({ color: 0x6b4c3b, roughness: 0.8, metalness: 0.1 });
const riserMat = new THREE.MeshStandardMaterial({ color: 0x4a3528, roughness: 0.9, metalness: 0.0 });
const railMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.5, metalness: 0.3 });
const innerRailMat = new THREE.MeshStandardMaterial({ color: 0x6b5a45, roughness: 0.6, metalness: 0.2 });
const landingMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9, metalness: 0.0 });

// ─── Geometrías invariantes ────────────────────────────────────────────────
// Las 182 escaleras comparten dimensiones; sólo varían dirección/LOD (que viven
// en posiciones/rotaciones por Mesh, salvo las barandas tubulares). Se comparten
// los escalones, contrahuellas, postes, balaustres y plataformas: con ~24 pasos
// por escalera, esto elimina miles de geometrías idénticas en el arranque.
const STEP_WIDTH = 0.35;
const TREAD_DEPTH = 0.15;
const STAIR_RADIUS = 0.8;
const RISER_HEIGHT = Math.min((HEX_HEIGHT / 24) * 0.85, 0.25); // contrahuella en LOD 0
const poleGeom = new THREE.CylinderGeometry(0.06, 0.08, HEX_HEIGHT, 8);
const stepGeom = new THREE.BoxGeometry(STEP_WIDTH, TREAD_DEPTH, 0.25);
const riserGeom = new THREE.BoxGeometry(STEP_WIDTH * 0.9, RISER_HEIGHT, 0.18);
const innerBalusterGeom = new THREE.CylinderGeometry(0.01, 0.012, 0.6, 4);
const extBalusterGeom = new THREE.CylinderGeometry(0.012, 0.015, 0.7, 4);
const landingGeom = new THREE.CircleGeometry(STAIR_RADIUS + 0.25, 12);

// Barandas tubulares: dependen solo de (kind, lod, direction) → conjunto finito
// (2 tipos × 3 LOD × 2 direcciones = 12). Se cachean para no retriangular
// una TubeGeometry por cada una de las ~182 escaleras.
const _tubeCache = new Map();
function railTube(kind, lod, direction, steps, totalAngle) {
  const key = `${kind}_${lod}_${direction}`;
  let geom = _tubeCache.get(key);
  if (geom) return geom;
  const offset = kind === 'inner' ? -0.25 : 0.3;
  const tubeRadius = kind === 'inner' ? 0.015 : 0.02;
  const segMul = kind === 'inner' ? 3 : 4;
  const pts = [];
  for (let i = 0; i <= steps * 2; i++) {
    const t = i / (steps * 2);
    const angle = direction * t * totalAngle;
    pts.push(new THREE.Vector3(
      Math.cos(angle) * (STAIR_RADIUS + offset),
      t * HEX_HEIGHT + 0.7,
      Math.sin(angle) * (STAIR_RADIUS + offset),
    ));
  }
  geom = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), steps * segMul, tubeRadius, 4, false);
  _tubeCache.set(key, geom);
  return geom;
}

/**
 * Crea una escalera de caracol borgiana mejorada:
 * poste central + peldaños en hélice + contrahuellas + barandas (interior/exterior)
 * + plataformas de descanso.
 *
 * @param {number} cx - Centro X
 * @param {number} cz - Centro Z
 * @param {number} floorY - Altura del piso
 * @param {number} [direction=1] - 1 sube, -1 baja
 * @param {number} [lod=0] - Nivel de detalle (0=full, 1=medio, 2=bajo)
 * @returns {THREE.Group} Grupo con la escalera completa
 */
export function createSpiralStaircase(cx, cz, floorY, direction = 1, lod = 0) {
  const group = new THREE.Group();
  group.position.set(cx, floorY, cz);

  const totalHeight = HEX_HEIGHT;

  // LOD → pasos y rotaciones
  const steps    = lod <= 0 ? 24 : (lod <= 1 ? 16 : 12);
  const rotations = lod <= 0 ? 3  : (lod <= 1 ? 2.5 : 2);
  const totalAngle = Math.PI * 2 * rotations;

  const risePerStep = totalHeight / steps;
  const radius = STAIR_RADIUS;
  const treadDepth = TREAD_DEPTH;
  const riserHeight = RISER_HEIGHT;

  // ─── Poste central (geometría compartida) ───
  const pole = new THREE.Mesh(poleGeom, stairMat);
  pole.position.y = totalHeight / 2;
  group.add(pole);

  // ─── Escalones: peldaño + contrahuella (geometrías compartidas) ───
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const angle = direction * t * totalAngle;
    const y = i * risePerStep;

    // Peldaño (tread)
    const step = new THREE.Mesh(stepGeom, stairMat);
    step.position.set(
      Math.cos(angle) * radius,
      y + risePerStep - treadDepth / 2,
      Math.sin(angle) * radius,
    );
    step.rotation.y = -angle;
    group.add(step);

    // Contrahuella (riser) — solo LOD 0
    if (lod <= 0 && i < steps - 1) {
      const riser = new THREE.Mesh(riserGeom, riserMat);
      riser.position.set(
        Math.cos(angle) * (radius + 0.02),
        y + risePerStep - riserHeight / 2,
        Math.sin(angle) * radius,
      );
      riser.rotation.y = -angle;
      group.add(riser);
    }
  }

  // ─── Baranda interior — LOD 0-1 (tubo cacheado por lod/dirección) ───
  if (lod <= 1) {
    const innerRail = new THREE.Mesh(railTube('inner', lod, direction, steps, totalAngle), innerRailMat);
    group.add(innerRail);

    // Barrotes interiores (cada 2 pasos) — geometría compartida
    for (let i = 0; i < steps; i += 2) {
      const t = i / steps;
      const angle = direction * t * totalAngle;
      const postTop = new THREE.Mesh(innerBalusterGeom, innerRailMat);
      postTop.position.set(
        Math.cos(angle) * (radius - 0.25),
        t * totalHeight + 0.4,
        Math.sin(angle) * (radius - 0.25),
      );
      group.add(postTop);
    }
  }

  // ─── Baranda exterior — siempre (tubo cacheado por lod/dirección) ───
  {
    const rail = new THREE.Mesh(railTube('outer', lod, direction, steps, totalAngle), railMat);
    group.add(rail);

    // Barrotes exteriores — LOD 0-1 (geometría compartida)
    if (lod <= 1) {
      for (let i = 0; i < steps; i += 2) {
        const t = i / steps;
        const angle = direction * t * totalAngle;
        const post = new THREE.Mesh(extBalusterGeom, innerRailMat);
        post.position.set(
          Math.cos(angle) * (radius + 0.3),
          t * totalHeight + 0.35,
          Math.sin(angle) * (radius + 0.3),
        );
        group.add(post);
      }
    }
  }

  // ─── Plataformas de descanso — LOD 0-1 (geometría compartida) ───
  if (lod <= 1) {
    const landingBot = new THREE.Mesh(landingGeom, landingMat);
    landingBot.rotation.x = -Math.PI / 2;
    landingBot.position.y = 0.02;
    group.add(landingBot);

    const landingTop = new THREE.Mesh(landingGeom, landingMat);
    landingTop.rotation.x = -Math.PI / 2;
    landingTop.position.y = totalHeight - 0.02;
    group.add(landingTop);
  }

  return group;
}
