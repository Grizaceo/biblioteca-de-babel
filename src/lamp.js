// Lámpara borgiana — "frutas esféricas que llevan el nombre de lámparas".
// Mesh decorativo + point light (opcional). Hay exactamente dos por hexágono,
// en muros transversales (opuestos), según el cuento.

import * as THREE from 'three';
import { LAMPS_PER_HEX } from './constants.js';

const lampBaseMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.7, metalness: 0.5 }); // bronce
const lampGlassMat = new THREE.MeshStandardMaterial({ color: 0xffd78f, roughness: 0.2, metalness: 0.0, emissive: 0xff8800, emissiveIntensity: 0.2, transparent: true, opacity: 0.5 });
const chainMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.6, metalness: 0.4 });

// Geometrías invariantes de la lámpara — compartidas entre todas las lámparas.
const chainGeom = new THREE.CylinderGeometry(0.015, 0.015, 0.4, 6);
const lampBaseGeom = new THREE.CylinderGeometry(0.08, 0.12, 0.1, 8);
const lampGlassGeom = new THREE.SphereGeometry(0.1, 8, 8);
const lampCapGeom = new THREE.CylinderGeometry(0.1, 0.08, 0.03, 8);

// Crea el mesh de una lámpara de aceite colgante (SIN luz, solo visual)
function createLampMesh() {
  const g = new THREE.Group();

  // Cadena
  const chain = new THREE.Mesh(chainGeom, chainMat);
  chain.position.y = 0.2;
  g.add(chain);

  // Base (copa de bronce)
  const base = new THREE.Mesh(lampBaseGeom, lampBaseMat);
  base.position.y = -0.05;
  g.add(base);

  // Vidrio (esfera translúcida emisiva)
  const glass = new THREE.Mesh(lampGlassGeom, lampGlassMat);
  glass.position.y = -0.1;
  glass.scale.y = 1.3;
  g.add(glass);

  // Tapa superior
  const cap = new THREE.Mesh(lampCapGeom, lampBaseMat);
  cap.position.y = 0.03;
  g.add(cap);

  return g;
}

/**
 * Cuelga las dos lámparas canónicas del hexágono ("Hay dos en cada hexágono:
 * transversales"), en muros opuestos y a la altura del barandal del pozo.
 * Si withLights=true, agrega una PointLight a cada una.
 * @param {THREE.Group} hexGroup - Grupo del hexágono destino
 * @param {number} innerRadius - Radio desde el centro para colgar las lámparas
 * @param {number} hexHeight - Altura del hexágono (para posicionar en alto)
 * @param {boolean} [withLights=false] - Si true, agrega PointLight a cada lámpara
 * @returns {Array<{group: THREE.Group, light?: THREE.PointLight, phase: number}>}
 *   Lámparas para animación de parpadeo
 */
export function addLampsToHex(hexGroup, innerRadius, hexHeight, withLights = false) {
  const lamps = [];
  const midRadius = innerRadius + 0.15;
  const yPos = hexHeight * 0.62;

  // LAMPS_PER_HEX lámparas repartidas en muros transversales (opuestos).
  for (let i = 0; i < LAMPS_PER_HEX; i++) {
    const angle = Math.PI / 6 + (i * 2 * Math.PI) / LAMPS_PER_HEX;
    const x = Math.cos(angle) * midRadius;
    const z = Math.sin(angle) * midRadius;

    const group = createLampMesh();
    group.position.set(x, yPos, z);
    hexGroup.add(group);

    let light = null;
    if (withLights) {
      // "La luz que emiten es insuficiente, incesante." Intensidad contenida.
      light = new THREE.PointLight(0xff8800, 1.5, 10, 2);
      light.position.set(x, yPos - 0.1, z);
      hexGroup.add(light);
    }

    lamps.push({ group, light, phase: i * 1.7 });
  }

  return lamps;
}

/**
 * Anima el parpadeo de lámparas de aceite en el game loop.
 * Usa dos ondas senoidales superpuestas para un efecto orgánico.
 * @param {Array<{group: THREE.Group, light?: THREE.PointLight, phase: number}>} lamps
 *   Arreglo devuelto por addLampsToHex
 * @param {number} time - Tiempo transcurrido en segundos (performance.now / 1000)
 */
export function flickerLamps(lamps, time) {
  for (const lamp of lamps) {
    if (!lamp.light) continue;
    const flicker = 0.8 + 0.2 * Math.sin(time * 2.1 + lamp.phase)
                   + 0.1 * Math.sin(time * 5.3 + lamp.phase * 1.7);
    lamp.light.intensity = flicker;
  }
}
