// Cámara FPS con PointerLockControls simplificado
// WASD + mouse look + gravedad + escaleras (tween atómico con flag consumed)
// + colisiones (inyectadas)

import * as THREE from 'three';
import { MOUSE_SENSITIVITY, MOVE_SPEED, PLAYER_HEIGHT } from './constants.js';
import { PLAYER_RADIUS, pushOut } from './physics.js';
import {
  findActiveTrigger,
  releaseConsumedTriggers,
  buildTransition,
  advanceTransition,
} from './stairTransition.js';

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
    this.stairTransition = null; // descriptor devuelto por buildTransition()
    this.consumedStairs = new Set(); // triggers que ya dispararon en este piso
    this.stairCooldown = 0; // segundos de gracia tras terminar una transición

    // Colisiones — inyectadas por main.js cada frame desde FloorPool
    this.getColliders = () => [];

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
    // ─── Transición de escalera activa ───
    // Durante el tween no aplicamos gravedad ni movimiento WASD. La posición
    // XZ+Y es totalmente controlada por advanceTransition().
    if (this.stairTransition) {
      const r = advanceTransition(this.stairTransition, delta, PLAYER_HEIGHT);
      this.camera.position.x = r.x;
      this.camera.position.y = r.y;
      this.camera.position.z = r.z;
      if (r.done) {
        this.velocity.y = 0;
        this.canJump = true;
        this.stairTransition = null;
        // Cooldown: durante los próximos ~0.5s no se re-disparan escaleras.
        // Evita que el tween deje al player en una posición donde otro
        // trigger re-detecte inmediatamente (problema del loop original).
        this.stairCooldown = 0.5;
      }
      return; // no procesar WASD/gravedad/colisiones durante el tween
    }

    // Tick del cooldown post-transición
    if (this.stairCooldown > 0) {
      this.stairCooldown -= delta;
    }

    // Liberar triggers consumidos si el player salió de su radio (histéresis)
    releaseConsumedTriggers(
      this.camera.position.x,
      this.camera.position.z,
      this.stairTriggers,
      this.consumedStairs,
    );

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

    // Colisiones XZ (paredes del hex actual + barandas del pozo).
    // El integrador inyecta los colisionadores del hex del player cada frame
    // (anillo 1 = 7 hexes para cubrir el caso de borde entre dos salas).
    // Si getColliders() no está conectado (no-op por defecto), el pushOut
    // opera sobre [] y no hace nada, así que el código sigue siendo seguro
    // aunque se olvide de inyectar.
    const colliders = this.getColliders();
    if (colliders.length > 0) {
      const out = pushOut(
        this.camera.position.x,
        this.camera.position.z,
        colliders,
        PLAYER_RADIUS,
      );
      this.camera.position.x = out.x;
      this.camera.position.z = out.z;
    }

    this.camera.position.y += this.velocity.y * delta;

    // Piso base (floor 0)
    if (this.camera.position.y <= PLAYER_HEIGHT) {
      this.camera.position.y = PLAYER_HEIGHT;
      this.velocity.y = 0;
      this.canJump = true;
    }

    // Detección de escaleras — usa el módulo puro stairTransition.js
    // para mantener la lógica testeable. findActiveTrigger respeta el flag
    // `consumedStairs` (Set), por lo que un trigger que ya disparó no puede
    // volver a disparar mientras el player siga dentro de su radio.
    if (this.stairCooldown <= 0) {
      const floorY = this.camera.position.y - PLAYER_HEIGHT;
      const active = findActiveTrigger(
        this.camera.position.x,
        this.camera.position.z,
        floorY,
        this.stairTriggers,
        this.consumedStairs,
      );
      if (active) {
        // Marcar consumido ANTES de iniciar — clave contra el loop.
        this.consumedStairs.add(active.trigger);
        this.stairTransition = buildTransition(
          active.trigger,
          floorY,
          this.camera.position.x,
          this.camera.position.z,
          PLAYER_HEIGHT,
        );
        this.velocity.y = 0;
        this.canJump = false;
        return; // siguiente frame entra al bloque de tween
      }
    }
  }
}
