// HUD borgiano — overlay HTML con información de navegación
// Estilo: pergamino/inscripción, tipografía serif, colores hueso/sepia

const STYLE_ID = 'hud-styles';

const STYLES = `
  body { margin: 0; overflow: hidden; background: #0a0a0a; }
  canvas { display: block; cursor: none; }
  #info {
    position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
    color: #8b7355; font-family: 'Space Mono', monospace; font-size: 14px;
    letter-spacing: 0.1em; text-align: center;
    opacity: 0.6; pointer-events: none;
    text-shadow: 0 0 4px rgba(0,0,0,0.8);
  }
  #hud {
    position: fixed;
    top: 18px;
    left: 22px;
    font-family: 'Palatino', 'Palatino Linotype', 'Book Antiqua', 'Georgia', serif;
    color: #c8b896;
    background: linear-gradient(135deg, rgba(10, 8, 6, 0.82) 0%, rgba(18, 14, 10, 0.75) 100%);
    padding: 16px 24px 12px;
    border-radius: 3px;
    pointer-events: none;
    user-select: none;
    text-shadow: 0 1px 4px rgba(0,0,0,0.9);
    box-shadow: 0 2px 16px rgba(0,0,0,0.5);
    letter-spacing: 0.06em;
    line-height: 1.5;
    min-width: 180px;
    backdrop-filter: blur(4px);
    border-left: 2px solid rgba(200, 184, 150, 0.15);
    animation: hudFadeIn 0.6s ease;
  }
  .hud-floor {
    font-size: 22px;
    font-weight: normal;
    font-variant: small-caps;
    letter-spacing: 0.12em;
    border-bottom: 1px solid rgba(200, 184, 150, 0.2);
    padding-bottom: 4px;
    margin-bottom: 4px;
  }
  .hud-coords {
    font-size: 12px;
    opacity: 0.55;
    font-family: 'Space Mono', 'Courier New', monospace;
    letter-spacing: 0.08em;
  }
  .hud-fps {
    font-size: 13px;
    opacity: 0.5;
    color: #c8b896;
    margin-top: 2px;
  }
  .hud-separator {
    border: none;
    border-top: 1px solid rgba(200, 184, 150, 0.12);
    margin: 5px 0 3px;
  }
  .hud-stair {
    font-size: 13px;
    font-variant: small-caps;
    letter-spacing: 0.1em;
    margin-top: 4px;
    opacity: 0;
    transition: opacity 0.25s ease;
  }
  .hud-stair.visible {
    opacity: 1;
  }
  .hud-stair.up {
    color: #d4a574;
  }
  .hud-stair.down {
    color: #7a8a9a;
  }
  @keyframes hudFadeIn {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  #info.fade-out {
    opacity: 0;
    transition: opacity 0.5s ease;
  }
  /* Mira sutil en el centro de la pantalla */
  #crosshair {
    position: fixed; top: 50%; left: 50%;
    width: 4px; height: 4px; margin: -2px 0 0 -2px;
    border-radius: 50%;
    background: rgba(200, 184, 150, 0.35);
    box-shadow: 0 0 4px rgba(0,0,0,0.8);
    pointer-events: none;
  }
  /* Epígrafe inicial: el íncipit del cuento */
  #epigraph {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    max-width: 640px; padding: 0 32px;
    text-align: center; pointer-events: none;
    font-family: 'Palatino', 'Palatino Linotype', 'Book Antiqua', 'Georgia', serif;
    color: #c8b896; font-size: 22px; line-height: 1.6;
    font-style: italic; letter-spacing: 0.04em;
    text-shadow: 0 2px 12px rgba(0,0,0,0.95);
    opacity: 0; transition: opacity 1.4s ease;
  }
  #epigraph.show { opacity: 1; }
  #epigraph .epigraph-author {
    display: block; margin-top: 18px;
    font-style: normal; font-size: 14px; font-variant: small-caps;
    letter-spacing: 0.2em; opacity: 0.6;
  }
  /* Inscripciones rotatorias en la parte inferior */
  #inscription {
    position: fixed; bottom: 56px; left: 50%; transform: translateX(-50%);
    max-width: 70vw; text-align: center; pointer-events: none;
    font-family: 'Palatino', 'Palatino Linotype', 'Book Antiqua', 'Georgia', serif;
    color: #b8a884; font-size: 15px; font-style: italic;
    letter-spacing: 0.05em; text-shadow: 0 1px 6px rgba(0,0,0,0.9);
    opacity: 0; transition: opacity 1.2s ease;
  }
  #inscription.show { opacity: 0.85; }
`;

// Inscripciones rotatorias — frases literales de «La Biblioteca de Babel».
const INSCRIPTIONS = [
  'La Biblioteca es ilimitada y periódica.',
  'En algún anaquel de algún hexágono debía existir un libro total.',
  'La certidumbre de que todo está escrito nos anula o nos afantasma.',
  'A cada libro de formato uniforme corresponden cuatrocientas diez páginas.',
  'Hablar es incurrir en tautologías.',
  'Las superficies bruñidas figuran y prometen el infinito.',
  'Yo afirmo que la Biblioteca es interminable.',
];

export class HUD {
  constructor() {
    this._injectStyles();

    this.container = document.createElement('div');
    this.container.id = 'hud';
    this.container.innerHTML = `
      <div class="hud-floor" id="hud-floor">PISO 0</div>
      <div class="hud-coords" id="hud-coords">[q: 0, r: 0]</div>
      <hr class="hud-separator">
      <div class="hud-fps" id="hud-fps">FPS: --</div>
      <div class="hud-stair" id="hud-stair"></div>
    `;
    document.body.appendChild(this.container);
    this._createCrosshair();
    this._createInfoBar();
    this._showEpigraph();
    this._startInscriptions();
    this._setupAutoHideInfo();
  }

  _createCrosshair() {
    const cross = document.createElement('div');
    cross.id = 'crosshair';
    document.body.appendChild(cross);
    this.crosshair = cross;
  }

  // Epígrafe inicial con el íncipit del cuento; aparece y se desvanece.
  _showEpigraph() {
    const ep = document.createElement('div');
    ep.id = 'epigraph';
    ep.innerHTML = `
      «El universo (que otros llaman la Biblioteca) se compone de un número
       indefinido, y tal vez infinito, de galerías hexagonales…»
      <span class="epigraph-author">Jorge Luis Borges</span>
    `;
    document.body.appendChild(ep);
    this.epigraph = ep;
    requestAnimationFrame(() => ep.classList.add('show'));
    const dismiss = () => {
      ep.classList.remove('show');
      setTimeout(() => ep.remove(), 1600);
    };
    setTimeout(dismiss, 6500);
    document.addEventListener('click', dismiss, { once: true });
    document.addEventListener('keydown', dismiss, { once: true });
  }

  // Inscripciones que afloran periódicamente, una por una.
  _startInscriptions() {
    const el = document.createElement('div');
    el.id = 'inscription';
    document.body.appendChild(el);
    this.inscription = el;
    let i = 0;
    const cycle = () => {
      el.textContent = `«${INSCRIPTIONS[i % INSCRIPTIONS.length]}»`;
      i++;
      el.classList.add('show');
      setTimeout(() => el.classList.remove('show'), 7000);
    };
    // Primera inscripción tras el epígrafe; luego cada ~38 s.
    this._inscriptionTimers = [
      setTimeout(() => { cycle(); this._inscriptionInterval = setInterval(cycle, 38000); }, 12000),
    ];
  }

  _injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  /**
   * @param {number} floor - Número de piso actual
   * @param {number} hexQ - Coordenada axial Q
   * @param {number} hexR - Coordenada axial R
   * @param {number} fps - FPS actual (redondeado)
   * @param {boolean} nearStair - Si está cerca de una escalera
   * @param {number} stairDir - Dirección de la escalera (1=sube, -1=baja)
   */
  update(floor, hexQ, hexR, fps, nearStair, stairDir) {
    const floorEl = document.getElementById('hud-floor');
    floorEl.textContent = floor >= 0 ? `Piso +${floor}` : `Piso ${floor}`;

    const coordEl = document.getElementById('hud-coords');
    coordEl.textContent = `[q: ${hexQ}, r: ${hexR}]`;

    const fpsEl = document.getElementById('hud-fps');
    fpsEl.textContent = `FPS: ${fps}`;

    const stairEl = document.getElementById('hud-stair');
    if (nearStair) {
      stairEl.textContent = stairDir > 0 ? '▲ Subiendo' : '▼ Bajando';
      stairEl.className = `hud-stair visible ${stairDir > 0 ? 'up' : 'down'}`;
    } else {
      stairEl.className = 'hud-stair';
    }
  }

  /** Limpia el HUD (útil si se reconstruye la escena) */
  destroy() {
    this.container.remove();
    for (const id of ['info', 'crosshair', 'epigraph', 'inscription']) {
      const el = document.getElementById(id);
      if (el) el.remove();
    }
    if (this._inscriptionTimers) this._inscriptionTimers.forEach(clearTimeout);
    if (this._inscriptionInterval) clearInterval(this._inscriptionInterval);
  }

  _createInfoBar() {
    const info = document.createElement('div');
    info.id = 'info';
    info.textContent = 'Haz click para explorar — WASD moverse · Ratón mirar · Shift correr · Espacio saltar · ESC liberar cursor';
    document.body.appendChild(info);
  }

  _setupAutoHideInfo() {
    const hide = () => {
      const info = document.getElementById('info');
      if (info) info.classList.add('fade-out');
    };
    // Ocultar tras 8s incluso sin interacción
    setTimeout(hide, 8000);
    // O al primer clic o tecla
    document.addEventListener('click', hide, { once: true });
    document.addEventListener('keydown', hide, { once: true });
  }
}
