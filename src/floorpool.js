// Pool de pisos hexagonales — crea, recicla y oculta pisos según distancia y frustum
// Responsabilidad única: gestionar el ciclo de vida de los pisos renderizados.

import * as THREE from 'three';
import { hexToWorld } from './geometry.js';
import { createHexRoom } from './hexagon.js';
import {
  VISIBLE_FLOORS, LOD_FULL_DIST, LOD_MEDIUM_DIST, LOD_LOW_DIST,
  HEX_HEIGHT, PLAYER_HEIGHT, HEX_RADIUS,
} from './constants.js';

export class FloorPool {
  constructor(scene, hexGrid) {
    this.scene = scene;
    this.hexGrid = hexGrid;
    this.floors = [];       // { group, lod, floorIdx, yPos, lamps[], stairTriggers[] }
    this.allLamps = [];
    this.allStairTriggers = [];

    // Frustum culling — reusado en cada frame
    this._frustum = new THREE.Frustum();
    this._projScreenMatrix = new THREE.Matrix4();
    // Esfera bounding que cubre los 7 hexágonos de un piso
    this._sphere = new THREE.Sphere(new THREE.Vector3(), HEX_RADIUS * 2.8);

    this._build();
  }

  // Determina LOD según distancia absoluta de pisos
  _lodForDistance(dist) {
    if (dist <= LOD_FULL_DIST) return 0;
    if (dist <= LOD_MEDIUM_DIST) return 1;
    return 2;
  }

  // Construye todos los pisos del rango VISIBLE_FLOORS
  _build() {
    for (let f = -VISIBLE_FLOORS; f <= VISIBLE_FLOORS; f++) {
      const yPos = f * HEX_HEIGHT;
      const lod = this._lodForDistance(Math.abs(f));

      const floorGroup = new THREE.Group();
      floorGroup.position.set(0, 0, 0);
      floorGroup.userData.floorIdx = f;

      const floorLamps = [];
      const floorTriggers = [];

      for (const pos of this.hexGrid) {
        const { x, z } = hexToWorld(pos.q, pos.r);
        const withLights = (pos.q === 0 && pos.r === 0 && Math.abs(f) <= 1);

        try {
          const { group, lamps, stairTriggers } = createHexRoom(x, z, yPos, withLights, lod);
          floorGroup.add(group);
          floorLamps.push(...lamps);
          floorTriggers.push(...stairTriggers);
        } catch (err) {
          console.error(`[FloorPool] Error en piso ${f}, hex (${pos.q}, ${pos.r}):`, err);
        }
      }

      this.scene.add(floorGroup);
      this.floors.push({
        group: floorGroup,
        lod,
        floorIdx: f,
        yPos,
        lamps: floorLamps,
        stairTriggers: floorTriggers,
      });
      this.allLamps.push(...floorLamps);
      this.allStairTriggers.push(...floorTriggers);
    }

    console.log(
      `[FloorPool] ${this.floors.length} pisos creados ` +
      `(LOD0: ${this.floors.filter(f => f.lod === 0).length}, ` +
      `LOD1: ${this.floors.filter(f => f.lod === 1).length}, ` +
      `LOD2: ${this.floors.filter(f => f.lod === 2).length})`
    );
  }

  getStairTriggers() { return this.allStairTriggers; }
  getLamps() { return this.allLamps; }

  // Culling vertical por frustum + cercanía al jugador
  updateVisibility(camera) {
    this._projScreenMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    this._frustum.setFromProjectionMatrix(this._projScreenMatrix);

    const playerFloor = Math.round((camera.position.y - PLAYER_HEIGHT) / HEX_HEIGHT);

    for (const floor of this.floors) {
      const dist = Math.abs(floor.floorIdx - playerFloor);

      if (dist <= LOD_FULL_DIST) {
        floor.group.visible = true;
        continue;
      }

      this._sphere.center.set(0, floor.yPos + HEX_HEIGHT / 2, 0);
      const inFrustum = this._frustum.intersectsSphere(this._sphere);

      floor.group.visible = inFrustum && (dist <= LOD_LOW_DIST);
    }
  }

  /**
   * Libera el pool y lo quita de la escena. TODA la geometría, material y
   * textura del mundo es compartida a nivel de módulo (hexagon/staircase/lamp/
   * bookshelf) y se reutiliza si el pool se reconstruye, por lo que NO se hace
   * dispose de ella. Los únicos recursos GPU propios del pool son los buffers
   * por-instancia de los muros de libros (InstancedMesh.dispose). Tras esto se
   * quitan los grupos de la escena y se vacían los arrays.
   *
   * Nota: getStairTriggers()/getLamps() entregan los arrays por referencia y
   * aquí se vacían in-place; un consumidor que los cacheó (p.ej. la cámara) debe
   * re-sincronizarse contra un pool nuevo tras un dispose().
   */
  dispose() {
    for (const floor of this.floors) {
      floor.group.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
      this.scene.remove(floor.group);
    }
    this.floors.length = 0;
    this.allLamps.length = 0;
    this.allStairTriggers.length = 0;
  }
}
