// Inspector de libros — raycaster + modal DOM.
//
// Click central → raycast desde el centro de la pantalla → si golpea un
// InstancedMesh con userData.isBookWall, identifica el libro concreto
// (wall, shelf, bookIndex) y muestra un modal DOM con:
//   - Coordenadas (hex q,r,floor) y posición del libro
//   - Título legible (si es un "libro-catalogo", ~1%)
//   - Primera página del libro (40 líneas × 80 chars del alfabeto canónico)
//
// El modal es DOM (no Three.js HUD) para poder usar texto con monoespaciado
// y scroll sin reinventar tipografía.

import * as THREE from 'three';
import { describeBook, instanceToBook } from './booksContent.js';
import { BOOKS_PER_SHELF } from './constants.js';

export class BookInspector {
  constructor(scene, camera, bookWalls) {
    this.scene = scene;
    this.camera = camera;
    this.bookWalls = bookWalls;
    this.raycaster = new THREE.Raycaster();
    this._vec = new THREE.Vector2(0, 0); // centro de pantalla
    this._modal = null;
    this._createModal();
  }

  _createModal() {
    // Overlay + panel — creado una sola vez, hidden por default.
    const overlay = document.createElement('div');
    overlay.id = 'book-inspector-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.75);
      display: none; align-items: center; justify-content: center;
      z-index: 1000; font-family: 'Space Mono', 'Courier New', monospace;
    `;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });

    const panel = document.createElement('div');
    panel.style.cssText = `
      background: #1a120b; color: #d9c9a6;
      border: 1px solid #5c4033; padding: 24px 32px;
      max-width: 80vw; max-height: 80vh; overflow: auto;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
    `;
    panel.id = 'book-inspector-panel';

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    this._modal = overlay;
    this._panel = panel;

    // Esc para cerrar
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) this.close();
    });
  }

  isOpen() {
    return this._modal && this._modal.style.display !== 'none';
  }

  close() {
    if (this._modal) this._modal.style.display = 'none';
  }

  /**
   * Lanza un raycast desde el centro de la pantalla. Si golpea un libro,
   * muestra el modal. Pensado para ser llamado en cada click del usuario
   * (mousedown o click), NO en cada frame.
   */
  inspectFromCenter() {
    if (!this.bookWalls || this.bookWalls.length === 0) return false;
    this.raycaster.setFromCamera(this._vec, this.camera);
    const hits = this.raycaster.intersectObjects(this.bookWalls, false);
    if (hits.length === 0) return false;

    // Tomamos el hit más cercano
    const hit = hits[0];
    if (!hit.object.userData?.isBookWall) return false;

    const { hexQ, hexR, floorIdx, wallIdx } = hit.object.userData;
    const instanceId = hit.instanceId;
    const { shelf, bookIndex } = instanceToBook(instanceId);

    const desc = describeBook(hexQ, hexR, floorIdx, wallIdx, shelf, bookIndex, 1);
    this._render(desc);
    return true;
  }

  _render(desc) {
    const { id, title, pages, location, canonic } = desc;
    const lines = pages[0] || [];

    const headerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:baseline; gap:24px;">
        <div>
          <div style="font-size:11px; letter-spacing:0.1em; opacity:0.6;">COORDENADAS</div>
          <div style="font-size:13px; margin-top:4px;">${id}</div>
        </div>
        <button id="book-inspector-close"
          style="background:transparent; color:#d9c9a6; border:1px solid #5c4033;
                 padding:4px 12px; cursor:pointer; font-family:inherit;">cerrar ✕</button>
      </div>
      ${title ? `
        <div style="margin-top:18px;">
          <div style="font-size:11px; letter-spacing:0.1em; opacity:0.6;">TÍTULO</div>
          <div style="font-size:18px; font-style:italic; margin-top:4px; color:#ffd78f;">${title}</div>
        </div>` : `
        <div style="margin-top:18px;">
          <div style="font-size:11px; letter-spacing:0.1em; opacity:0.6;">TÍTULO</div>
          <div style="font-size:13px; margin-top:4px; opacity:0.5; font-style:italic;">— sin título discernible —</div>
        </div>`}
      <div style="margin-top:18px; display:grid; grid-template-columns:auto 1fr; gap:4px 16px; font-size:12px; opacity:0.8;">
        <span>hex</span><span>(${location.q}, ${location.r})</span>
        <span>piso</span><span>${location.floor}</span>
        <span>muro</span><span>${location.wall}</span>
        <span>anaquel</span><span>${location.shelf}</span>
        <span>libro</span><span>${location.bookIndex}</span>
        <span>páginas</span><span>${canonic.pagesPerBook} × ${canonic.linesPerPage} × ${canonic.lettersPerLine} letras (canónico)</span>
        <span>alfabeto</span><span>${canonic.alphabet} símbolos</span>
      </div>
    `;

    const linesHTML = lines.map(line =>
      `<div style="white-space:pre; opacity:0.85;">${line}</div>`
    ).join('');

    this._panel.innerHTML = `
      ${headerHTML}
      <div style="margin-top:18px; padding-top:14px; border-top:1px dashed #5c4033;">
        <div style="font-size:11px; letter-spacing:0.1em; opacity:0.6; margin-bottom:8px;">
          PÁGINA 1 / ${canonic.pagesPerBook}
        </div>
        <div style="font-size:11px; line-height:1.5;">${linesHTML}</div>
      </div>
    `;

    // Botón cerrar
    this._panel.querySelector('#book-inspector-close')
      .addEventListener('click', () => this.close());

    this._modal.style.display = 'flex';
  }
}