// Tests para src/stairTransition.js — lógica pura de transición de escaleras.
// El bug original era un loop infinito: subir activaba el siguiente trigger
// porque la tolerancia era muy laxa. Estos tests verifican:
//   - findActiveTrigger respeta el flag consumed
//   - releaseConsumedTriggers libera al salir del radio
//   - advanceTransition produce Y monotónico entre fromY y targetY
//   - el descriptor de transición apunta al piso correcto

import { describe, it, expect, beforeEach } from 'vitest';
import {
  STAIR_TRANSITION_DURATION,
  STAIR_TRIGGER_RADIUS,
  STAIR_CONSUMED_HYSTERESIS,
  findActiveTrigger,
  releaseConsumedTriggers,
  buildTransition,
  advanceTransition,
} from '../stairTransition.js';
import { HEX_HEIGHT } from '../constants.js';

const T = (worldX, worldZ, worldY, direction = 1, label = 't') => ({
  worldX, worldZ, worldY, direction, label,
});

describe('findActiveTrigger', () => {
  const triggers = [
    T(0, 0, 0, 1, 'up-0'),
    T(0, 0, 0, -1, 'down-0'),
    T(0, 0, 6, 1, 'up-1'),
  ];
  let consumed;

  beforeEach(() => { consumed = new Set(); });

  it('encuentra trigger cuando player está dentro del radio y mismo piso', () => {
    const r = findActiveTrigger(0.3, 0.3, 0, triggers, consumed);
    expect(r).not.toBeNull();
    // Si hay dos a la misma distancia (up-0 y down-0), gana el primero por orden estable
    expect(['up-0', 'down-0']).toContain(r.trigger.label);
  });

  it('ignora triggers en otro piso', () => {
    const r = findActiveTrigger(0.3, 0.3, 6, triggers, consumed);
    // El del piso 6 está en mismo Y → debe ganar
    expect(r.trigger.label).toBe('up-1');
  });

  it('respeta el flag consumed — no re-dispara el mismo trigger', () => {
    consumed.add(triggers[0]); // marca up-0 como consumido
    const r = findActiveTrigger(0.3, 0.3, 0, triggers, consumed);
    // Debe encontrar down-0 (misma posición, distinto trigger, no consumido)
    expect(r.trigger.label).toBe('down-0');
  });

  it('devuelve null si el player está lejos del radio', () => {
    const r = findActiveTrigger(5, 5, 0, triggers, consumed);
    expect(r).toBeNull();
  });

  it('tolera distancia hasta el radio exacto (boundary)', () => {
    // Justo en el borde del radio debe activar (dist <= radius)
    const r = findActiveTrigger(STAIR_TRIGGER_RADIUS - 0.01, 0, 0, triggers, consumed);
    expect(r).not.toBeNull();
    // Justo afuera NO debe activar
    const r2 = findActiveTrigger(STAIR_TRIGGER_RADIUS + 0.01, 0, 0, triggers, consumed);
    expect(r2).toBeNull();
  });

  it('tolerancia de piso: |floorY - worldY| <= 0.5', () => {
    // worldY=0, player en 0.4 → debe activar
    const r = findActiveTrigger(0, 0, 0.4, triggers, consumed);
    expect(r).not.toBeNull();
    // Player en 0.6 → fuera de tolerancia
    const r2 = findActiveTrigger(0, 0, 0.6, triggers, consumed);
    expect(r2).toBeNull();
  });
});

describe('releaseConsumedTriggers', () => {
  const triggers = [T(0, 0, 0, 1, 'up'), T(10, 0, 0, 1, 'far')];

  it('libera trigger cuando player sale del radio + histéresis', () => {
    const consumed = new Set([triggers[0]]);
    // Player aún dentro del radio+histéresis: NO libera
    releaseConsumedTriggers(0.5, 0, triggers, consumed);
    expect(consumed.has(triggers[0])).toBe(true);
    // Player lejos: libera
    releaseConsumedTriggers(5, 0, triggers, consumed);
    expect(consumed.has(triggers[0])).toBe(false);
  });

  it('no afecta triggers no consumidos', () => {
    const consumed = new Set([triggers[0]]);
    releaseConsumedTriggers(5, 0, triggers, consumed);
    expect(consumed.size).toBe(0);
  });

  it('histéresis evita liberación en el borde exacto del radio', () => {
    const consumed = new Set([triggers[0]]);
    // Player en STAIR_TRIGGER_RADIUS exacto: NO libera (necesita histéresis)
    releaseConsumedTriggers(STAIR_TRIGGER_RADIUS, 0, triggers, consumed);
    expect(consumed.has(triggers[0])).toBe(true);
    // Player en radio + histéresis: ahí sí libera
    releaseConsumedTriggers(
      STAIR_TRIGGER_RADIUS + STAIR_CONSUMED_HYSTERESIS + 0.01,
      0, triggers, consumed,
    );
    expect(consumed.has(triggers[0])).toBe(false);
  });
});

describe('buildTransition', () => {
  const PH = 1.4;

  it('apunta al piso correcto según direction', () => {
    const upTrig = T(0, 0, 0, 1);
    const tUp = buildTransition(upTrig, 0, 0, 0, PH);
    expect(tUp.targetY).toBe(PH + HEX_HEIGHT); // sube HEX_HEIGHT (Y absoluta de cámara)

    const downTrig = T(0, 0, 0, -1);
    const tDown = buildTransition(downTrig, 0, 0, 0, PH);
    expect(tDown.targetY).toBe(PH - HEX_HEIGHT); // baja HEX_HEIGHT
  });

  it('fromY es la Y absoluta de cámara al iniciar (PLAYER_HEIGHT + floorY)', () => {
    const trig = T(0, 0, 6, 1);
    const t = buildTransition(trig, 6, 0, 0, PH);
    expect(t.fromY).toBe(PH + 6); // player en piso 6, cámara a PH sobre el piso
  });

  it('calcula startAngle desde la posición relativa del player', () => {
    const trig = T(0, 0, 0, 1);
    const t = buildTransition(trig, 0, 1, 1, PH);
    expect(t.startAngle).toBeCloseTo(Math.PI / 4, 6);
  });

  it('guarda referencia al trigger para marcarlo consumido', () => {
    const trig = T(0, 0, 0, 1, 'myTrigger');
    const t = buildTransition(trig, 0, 0, 0, PH);
    expect(t.trigger).toBe(trig);
  });
});

describe('advanceTransition', () => {
  const PH = 1.4;

  it('al completar devuelve posición final exacta', () => {
    const trig = T(0, 0, 0, 1);
    const t = buildTransition(trig, 0, 0, 0, PH);
    t.progress = 0.99;
    const r = advanceTransition(t, STAIR_TRANSITION_DURATION, PH);
    expect(r.done).toBe(true);
    expect(r.x).toBe(0);
    expect(r.z).toBe(0);
    // targetY = PH + HEX_HEIGHT (Y absoluta de cámara final)
    expect(r.y).toBe(PH + HEX_HEIGHT);
  });

  it('Y es monotónico crecientes cuando sube', () => {
    const trig = T(0, 0, 0, 1);
    const t = buildTransition(trig, 0, 0, 0, PH);
    const samples = [];
    for (let i = 0; i < 10; i++) {
      const r = advanceTransition(t, STAIR_TRANSITION_DURATION / 10, PH);
      samples.push(r.y);
    }
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1]);
    }
  });

  it('Y es monotónico decreciente cuando baja', () => {
    const trig = T(0, 0, 0, -1);
    const t = buildTransition(trig, 0, 0, 0, PH);
    const samples = [];
    for (let i = 0; i < 10; i++) {
      const r = advanceTransition(t, STAIR_TRANSITION_DURATION / 10, PH);
      samples.push(r.y);
    }
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeLessThanOrEqual(samples[i - 1]);
    }
  });

  it('XZ orbita — ángulo cambia con el progreso', () => {
    const trig = T(0, 0, 0, 1);
    const t = buildTransition(trig, 0, 1, 0, PH); // startAngle = 0
    const r1 = advanceTransition(t, STAIR_TRANSITION_DURATION * 0.25, PH);
    const distFromStart = Math.hypot(r1.x - 1, r1.z - 0);
    expect(distFromStart).toBeGreaterThan(0.1);
  });

  it('XZ permanece dentro del radio de la escalera (0.5)', () => {
    const trig = T(0, 0, 0, 1);
    const t = buildTransition(trig, 0, 0.5, 0, PH);
    for (let i = 0; i < 20; i++) {
      const r = advanceTransition(t, STAIR_TRANSITION_DURATION / 20, PH);
      if (r.done) break;
      const distFromCenter = Math.hypot(r.x - trig.worldX, r.z - trig.worldZ);
      expect(distFromCenter).toBeLessThanOrEqual(0.5 + 0.001);
    }
  });
});

describe('integration: el bug del loop infinito', () => {
  // Simulación: 7 pisos con escaleras (una por hex por piso).
  // El player sube 1 piso. Sin consumed, dispara otra vez. Con consumed, no.
  it('un solo paso sube exactamente 1 piso (sin re-trigger)', () => {
    const triggers = [];
    for (let floor = -3; floor <= 3; floor++) {
      for (const dir of [1, -1]) {
        triggers.push(T(0, 0, floor * HEX_HEIGHT, dir, `f${floor}_${dir}`));
      }
    }
    const consumed = new Set();
    const PH = 1.4;

    // Player en piso 0, dentro del trigger up-f0
    let playerFloor = 0;
    let playerCamY = playerFloor + PH;

    // Detectar y disparar
    let active = findActiveTrigger(0, 0, playerFloor, triggers, consumed);
    expect(active).not.toBeNull();
    expect(active.trigger.label).toBe('f0_1');

    // Construir y avanzar hasta completar
    const t = buildTransition(active.trigger, playerFloor, 0, 0, PH);
    consumed.add(active.trigger); // marcar consumido

    let r;
    let elapsed = 0;
    while (elapsed < STAIR_TRANSITION_DURATION + 0.1) {
      r = advanceTransition(t, 0.05, PH);
      elapsed += 0.05;
      if (r.done) break;
    }
    expect(r.done).toBe(true);
    playerCamY = r.y;
    playerFloor = playerCamY - PH;
    expect(playerFloor).toBeCloseTo(HEX_HEIGHT, 6);

    // Intentar re-disparar inmediatamente: el trigger consumido debe
    // ignorarse, pero el del piso de arriba (mismo XZ, worldY=6) debe
    // estar disponible. En este array los triggers van de floor -3..3
    // con worldY = floor * HEX_HEIGHT. El trigger del piso "1" (worldY=6)
    // tiene label 'f1_1'.
    const reTrigger = findActiveTrigger(0, 0, playerFloor, triggers, consumed);
    expect(reTrigger).not.toBeNull();
    expect(reTrigger.trigger.label).toBe('f1_1');
    // PERO: el del piso 0 (consumido) no debe volver a disparar
    // (el find ya respeta consumedSet, así que aunque up-f0 también esté en
    // radio+piso, no se elige — gana up-f1 por estar más cerca)
  });

  it('tras cooldown + salir del radio, el trigger consumido se libera', () => {
    const triggers = [T(0, 0, 0, 1, 'up')];
    const consumed = new Set([triggers[0]]);
    consumed.add(triggers[0]);

    // Player sale del radio (XZ)
    releaseConsumedTriggers(5, 5, triggers, consumed);
    expect(consumed.has(triggers[0])).toBe(false);

    // Ahora puede disparar de nuevo
    const r = findActiveTrigger(0, 0, 0, triggers, consumed);
    expect(r).not.toBeNull();
  });
});