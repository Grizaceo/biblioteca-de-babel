// Lógica pura de transición de escaleras — testeable sin Three.js.
//
// Responsabilidad única: dado un set de stairTriggers y la posición del
// jugador en XZ/Y, decidir:
//   1. Si el jugador está dentro de algún trigger activo.
//   2. Si debe iniciar una transición (respetando flags de consumido y cooldown).
//   3. El progreso del tween (avance de Y + órbita en XZ).
//
// El flag `consumed` por trigger evita el loop infinito: una vez que un
// trigger dispara una transición, queda inerte hasta que el jugador sale
// del radio (con histéresis). El cooldown post-transición evita re-trigger
// inmediato si el tween deja al jugador en una posición límite.

import { HEX_HEIGHT } from './constants.js';

export const STAIR_TRANSITION_DURATION = 0.6; // segundos
export const STAIR_TRIGGER_RADIUS = 0.9;
export const STAIR_FLOOR_TOLERANCE = 0.5; // |floorY - worldY| permitido
export const STAIR_CONSUMED_HYSTERESIS = 0.4; // margen sobre radio para liberar
export const STAIR_COOLDOWN_AFTER = 0.5; // segundos sin re-trigger tras tween

// ─── Helpers puros ───────────────────────────────────────────────────────────

/**
 * Encuentra el trigger más cercano al jugador dentro del radio y piso correctos.
 * @param {number} px - X del player
 * @param {number} pz - Z del player
 * @param {number} floorY - altura del piso del player (Y - PLAYER_HEIGHT)
 * @param {Array} triggers
 * @param {Set} consumedSet - triggers marcados como consumidos
 * @returns {{ trigger: object, dist: number } | null}
 */
export function findActiveTrigger(px, pz, floorY, triggers, consumedSet) {
  let best = null;
  let bestDist = Infinity;
  for (const t of triggers) {
    if (consumedSet.has(t)) continue; // flag consumed: trigger inerte
    const dx = px - t.worldX;
    const dz = pz - t.worldZ;
    const dist = Math.hypot(dx, dz);
    if (dist > STAIR_TRIGGER_RADIUS) continue;
    const floorDist = Math.abs(floorY - t.worldY);
    if (floorDist > STAIR_FLOOR_TOLERANCE) continue;
    if (dist < bestDist) {
      bestDist = dist;
      best = t;
    }
  }
  return best ? { trigger: best, dist: bestDist } : null;
}

/**
 * Libera los triggers consumidos cuando el jugador ha salido de su radio
 * (más histéresis). Retorna el conjunto actualizado (mismo objeto, mutado).
 */
export function releaseConsumedTriggers(px, pz, triggers, consumedSet) {
  const releaseRadius = STAIR_TRIGGER_RADIUS + STAIR_CONSUMED_HYSTERESIS;
  for (const t of triggers) {
    if (!consumedSet.has(t)) continue;
    const dx = px - t.worldX;
    const dz = pz - t.worldZ;
    if (Math.hypot(dx, dz) > releaseRadius) {
      consumedSet.delete(t);
    }
  }
}

/**
 * Construye el descriptor de transición a partir de un trigger activo y la
 * posición actual del player. Pura — sin estado, sin side-effects.
 *
 * Las coordenadas Y son siempre altura de CÁMARA (mundo), no de piso:
 *   fromY = PLAYER_HEIGHT + floorY (Y absoluta de cámara al iniciar)
 *   targetY = PLAYER_HEIGHT + (worldY + direction*HEX_HEIGHT) (Y final)
 */
export function buildTransition(trigger, floorY, px, pz, playerHeightOffset) {
  const newFloorY = trigger.worldY + trigger.direction * HEX_HEIGHT;
  const startAngle = Math.atan2(pz - trigger.worldZ, px - trigger.worldX);
  return {
    fromY: playerHeightOffset + floorY,
    targetY: playerHeightOffset + newFloorY,
    progress: 0,
    centerX: trigger.worldX,
    centerZ: trigger.worldZ,
    startAngle,
    direction: trigger.direction,
    trigger, // referencia para poder agregarlo a consumedSet
  };
}

/**
 * Avanza el progreso de la transición y devuelve { x, y, z } interpolados.
 * Si progress >= 1, marca `done = true` y devuelve la posición final exacta
 * (centro de la escalera en XZ, Y final absoluta de cámara).
 */
export function advanceTransition(transition, dt, _playerHeightOffset) {
  transition.progress += dt / STAIR_TRANSITION_DURATION;
  if (transition.progress >= 1) {
    return {
      x: transition.centerX,
      y: transition.targetY,
      z: transition.centerZ,
      done: true,
    };
  }
  const t = transition.progress;
  // Ease-in-out cúbico
  const smooth = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  // Y interpolado entre fromY (Y absoluta de cámara al iniciar) y targetY
  const y = transition.fromY + (transition.targetY - transition.fromY) * smooth;

  // XZ espiral: 3 vueltas completas, radio fijo pequeño dentro del cilindro
  const totalRotation = transition.direction * Math.PI * 3;
  const angle = transition.startAngle + totalRotation * smooth;
  const spiralRadius = 0.5;
  const x = transition.centerX + Math.cos(angle) * spiralRadius;
  const z = transition.centerZ + Math.sin(angle) * spiralRadius;
  return { x, y, z, done: false };
}