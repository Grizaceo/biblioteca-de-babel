// Cámara FPS con PointerLockControls simplificado
// WASD + mouse look + gravedad + escaleras

import * as THREE from 'three';
import { MOUSE_SENSITIVITY, MOVE_SPEED, PLAYER_HEIGHT, HEX_HEIGHT } from './constants.js';

export class FPSCamera {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.moveVec = new THREE.Vector3();
    this.keys = { w: false, a: false, s: false, d: false, shift: false };
    this.isLocked = false;
    this.velocity = new THREE.Vector3();
    this.gravity = 15;
    this.jumpSpeed = 6;
    this.canJump = false;

    // Escaleras
    this.stairTriggers = [];
    this.stairTransition = null; // { targetY, progress } cuando está subiendo/bajando

    // Pointer Lock
    domElement.addEventListener('click', () => {
      if (!this.isLocked) domElement.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === domElement;
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isLocked) return;
      this.euler.setFromQuaternion(this.camera.quaternion);
      this.euler.y -= e.movementX * MOUSE_SENSITIVITY;
      this.euler.x -= e.movementY * MOUSE_SENSITIVITY;
      this.euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.euler.x));
      this.camera.quaternion.setFromEuler(this.euler);
    });

    // Keyboard
    document.addEventListener('keydown', (e) => {
      switch (e.code) {
        case 'KeyW': this.keys.w = true; break;
        case 'KeyA': this.keys.a = true; break;
        case 'KeyS': this.keys.s = true; break;
        case 'KeyD': this.keys.d = true; break;
        case 'ShiftLeft': case 'ShiftRight': this.keys.shift = true; break;
        case 'Space': if (this.canJump) this.velocity.y = this.jumpSpeed; this.canJump = false; break;
        case 'Escape': document.exitPointerLock(); this.isLocked = false; break;
      }
    });

    document.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'KeyW': this.keys.w = false; break;
        case 'KeyA': this.keys.a = false; break;
        case 'KeyS': this.keys.s = false; break;
        case 'KeyD': this.keys.d = false; break;
        case 'ShiftLeft': case 'ShiftRight': this.keys.shift = false; break;
      }
    });

    camera.position.y = PLAYER_HEIGHT;
  }

  setStairTriggers(triggers) {
    this.stairTriggers = triggers;
  }

  update(delta) {
    // Si estamos en transición de escalera, no aplicamos gravedad normal
    if (this.stairTransition) {
      this.stairTransition.progress += delta / 0.6; // 0.6 segundos de transición
      if (this.stairTransition.progress >= 1) {
        // Terminó
        this.camera.position.y = this.stairTransition.targetY;
        this.velocity.y = 0;
        this.canJump = true;
        this.stairTransition = null;
      } else {
        // Interpolación suave (ease-in-out cúbico)
        const t = this.stairTransition.progress;
        const smooth = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        this.camera.position.y = PLAYER_HEIGHT + this.stairTransition.fromY
          + (this.stairTransition.targetY - (PLAYER_HEIGHT + this.stairTransition.fromY)) * smooth;

        // Espiral: orbitar alrededor del centro de la escalera
        const totalRotation = this.stairTransition.direction * Math.PI * 3; // 3 vueltas completas
        const angle = this.stairTransition.startAngle + totalRotation * smooth;
        const spiralRadius = 0.5; // dentro de la escalera (radio 0.8)
        this.camera.position.x = this.stairTransition.centerX + Math.cos(angle) * spiralRadius;
        this.camera.position.z = this.stairTransition.centerZ + Math.sin(angle) * spiralRadius;
        return; // no procesar movimiento ni gravedad durante transición
      }
    }

    const speed = this.keys.shift ? MOVE_SPEED * 2 : MOVE_SPEED;

    // Movimiento horizontal
    this.moveVec.set(0, 0, 0);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    right.y = 0;
    right.normalize();

    if (this.keys.w) this.moveVec.add(forward);
    if (this.keys.s) this.moveVec.sub(forward);
    if (this.keys.d) this.moveVec.add(right);
    if (this.keys.a) this.moveVec.sub(right);

    if (this.moveVec.lengthSq() > 0) {
      this.moveVec.normalize().multiplyScalar(speed * delta);
    }

    // Gravedad
    this.velocity.y -= this.gravity * delta;

    // Aplicar movimiento
    this.camera.position.x += this.moveVec.x;
    this.camera.position.z += this.moveVec.z;
    this.camera.position.y += this.velocity.y * delta;

    // Piso base (floor 0)
    if (this.camera.position.y <= PLAYER_HEIGHT) {
      this.camera.position.y = PLAYER_HEIGHT;
      this.velocity.y = 0;
      this.canJump = true;
    }

    // Detección de escaleras
    const triggerRadius = 0.9;
    const floorY = this.camera.position.y - PLAYER_HEIGHT;
    for (const t of this.stairTriggers) {
      const dx = this.camera.position.x - t.worldX;
      const dz = this.camera.position.z - t.worldZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > triggerRadius) continue;

      // El trigger debe estar en el mismo piso que el jugador (con tolerancia)
      const floorDist = Math.abs(floorY - t.worldY);
      if (floorDist > 0.5) continue;

      // Iniciar transición con espiral
      const newFloorY = t.worldY + t.direction * HEX_HEIGHT;
      const dxCam = this.camera.position.x - t.worldX;
      const dzCam = this.camera.position.z - t.worldZ;
      const startAngle = Math.atan2(dzCam, dxCam);
      this.stairTransition = {
        fromY: floorY,
        targetY: newFloorY + PLAYER_HEIGHT,
        progress: 0,
        centerX: t.worldX,
        centerZ: t.worldZ,
        startAngle: startAngle,
        direction: t.direction,
      };
      // Pequeño empuje horizontal hacia las escaleras
      this.camera.position.x = t.worldX + dx * 0.3;
      this.camera.position.z = t.worldZ + dz * 0.3;
      this.velocity.y = 0;
      this.canJump = false;
      break; // solo una escalera a la vez
    }
  }
}
