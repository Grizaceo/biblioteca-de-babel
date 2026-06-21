// Lámpara de aceite borgiana — mesh decorativo + point light (opcional)

import * as THREE from 'three';

const lampBaseMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.7, metalness: 0.5 }); // bronce
const lampGlassMat = new THREE.MeshStandardMaterial({ color: 0xffd78f, roughness: 0.2, metalness: 0.0, emissive: 0xff8800, emissiveIntensity: 0.2, transparent: true, opacity: 0.5 });
const chainMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.6, metalness: 0.4 });

// Crea el mesh de una lámpara de aceite colgante (SIN luz, solo visual)
function createLampMesh() {
  const g = new THREE.Group();

  // Cadena
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 6), chainMat);
  chain.position.y = 0.2;
  g.add(chain);

  // Base (copa de bronce)
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.1, 8), lampBaseMat);
  base.position.y = -0.05;
  g.add(base);

  // Vidrio (esfera translúcida emisiva)
  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), lampGlassMat);
  glass.position.y = -0.1;
  glass.scale.y = 1.3;
  g.add(glass);

  // Tapa superior
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.03, 8), lampBaseMat);
  cap.position.y = 0.03;
  g.add(cap);

  return g;
}

// Crea lámparas en las 6 paredes de un hexágono (2 por pared)
// Si withLights=true, agrega PointLights reales
/**
 * Agrega lámparas de aceite colgantes a un hexágono, una por pared.
 * @param {THREE.Group} hexGroup - Grupo del hexágono destino
 * @param {number} innerRadius - Radio desde el centro para colgar las lámparas
 * @param {number} hexHeight - Altura del hexágono (para posicionar en el techo)
 * @param {boolean} [withLights=false] - Si true, agrega PointLight a cada lámpara
 * @returns {Array<{mesh: THREE.Mesh, light?: THREE.PointLight}>} Lámparas para animación
 */
export function addLampsToHex(hexGroup, innerRadius, hexHeight, withLights = false) {
  const lamps = [];

  for (let wall = 0; wall < 6; wall++) {
    const angle = (Math.PI / 3) * wall + Math.PI / 6;
    const midRadius = innerRadius + 0.15;

    for (let level = 0; level < 2; level++) {
      const yPos = level === 0 ? hexHeight * 0.35 : hexHeight * 0.65;
      const x = Math.cos(angle) * midRadius;
      const z = Math.sin(angle) * midRadius;

      const group = createLampMesh();
      group.position.set(x, yPos, z);
      hexGroup.add(group);

      let light = null;
      if (withLights) {
        light = new THREE.PointLight(0xff8800, 1.5, 8, 2);
        light.position.set(x, yPos - 0.1, z);
        hexGroup.add(light);
      }

      lamps.push({ group, light, phase: wall * 1.2 + level * 0.7 });
    }
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
