// Escalera de caracol (spiral staircase) borgiana
// Va desde el piso hasta el techo del hexágono, pasando al siguiente nivel

import * as THREE from 'three';
import { HEX_HEIGHT, COLORS } from './constants.js';

const stairMat = new THREE.MeshStandardMaterial({ color: 0x6b4c3b, roughness: 0.8, metalness: 0.1 });
const railMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.5, metalness: 0.3 });

// Crea una escalera de caracol que sube desde floorY hasta floorY + HEX_HEIGHT
// direction: 1 = sube, -1 = baja
/**
 * Crea una escalera de caracol borgiana: poste central + escalones
 * helicoidales + baranda. Va desde floorY hasta floorY + HEX_HEIGHT.
 * @param {number} cx - Centro X
 * @param {number} cz - Centro Z
 * @param {number} floorY - Altura del piso
 * @param {number} [direction=1] - 1 sube, -1 baja
 * @returns {THREE.Group} Grupo con la escalera completa
 */
export function createSpiralStaircase(cx, cz, floorY, direction = 1) {
  const group = new THREE.Group();
  group.position.set(cx, floorY, cz);

  const steps = 24;           // pasos por nivel
  const totalHeight = HEX_HEIGHT;
  const risePerStep = totalHeight / steps;
  const radius = 0.8;
  const stepWidth = 0.4;
  const stepDepth = 0.12;

  // Poste central
  const poleGeom = new THREE.CylinderGeometry(0.06, 0.08, totalHeight, 8);
  const pole = new THREE.Mesh(poleGeom, stairMat);
  pole.position.y = totalHeight / 2;
  group.add(pole);

  // Escalones alrededor del poste
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2 * 3; // 3 vueltas completas
    const y = i * risePerStep;

    // Base del escalón (triangular/pie)
    const stepGeom = new THREE.BoxGeometry(stepWidth, stepDepth, 0.3);
    const step = new THREE.Mesh(stepGeom, stairMat);
    step.position.set(
      Math.cos(angle) * radius,
      y + risePerStep / 2,
      Math.sin(angle) * radius,
    );
    step.rotation.y = -angle;
    group.add(step);
  }

  // Baranda de la escalera (un aro helicoidal)
  const railPoints = [];
  for (let i = 0; i <= steps * 2; i++) {
    const t = i / (steps * 2);
    const angle = t * Math.PI * 2 * 3;
    const y = t * totalHeight;
    railPoints.push(new THREE.Vector3(
      Math.cos(angle) * (radius + 0.3),
      y + 0.7,
      Math.sin(angle) * (radius + 0.3),
    ));
  }

  const railCurve = new THREE.CatmullRomCurve3(railPoints);
  const railGeom = new THREE.TubeGeometry(railCurve, steps * 4, 0.02, 4, false);
  const rail = new THREE.Mesh(railGeom, railMat);
  group.add(rail);

  return group;
}
