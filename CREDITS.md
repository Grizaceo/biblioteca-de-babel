# Créditos y agradecimientos

## Inspiración conceptual

**Jorge Luis Borges** — *"La Biblioteca de Babel"* (1941)
Este proyecto es una exploración interactiva y tridimensional del universo
descrito en el cuento de Borges: una biblioteca infinita compuesta de galerías
hexagonales comunicadas por pozos de ventilación y escaleras de caracol.
La estética y la atmósfera del proyecto intentan capturar la mezcla de
sublimidad, claustrofobia y asombro del texto original.

## Librerías y herramientas

- **[Three.js](https://threejs.org/)** (r184) — Motor 3D WebGL/WebGPU.
  Licencia MIT. Copyright © 2010-2025 Three.js Authors.
- **[Vite](https://vite.dev/)** — Bundler y dev server.
  Licencia MIT.

## Código original

Todo el código fuente en este repositorio fue escrito originalmente para este
proyecto, inspirado en los patrones descritos por Borges y en ejemplos de la
documentación de Three.js. No se utilizó código de otros proyectos de la
"Biblioteca de Babel" existentes.

## Modelado 3D

- Escalera de caracol: generación procedural basada en principios de
  geometría helicoidal, ajustada a la escala hexagonal.
- Lámparas de aceite: modelado procedural inspirado en lámparas de aceite
  de época (bronce + vidrio emisivo).
- Estantes y libros: generación procedural con texturas canvas para simular
  lomos con caracteres del alfabeto canónico de 25 símbolos. Los muros pueblan
  los 32 libros por anaquel del cuento mediante `InstancedMesh` (un draw call
  por muro), conciliando fidelidad y rendimiento.

## Fidelidad al texto

Las dimensiones del mundo (5 anaqueles por lado, 32 libros por anaquel, 410
páginas, 2 lámparas transversales, el espejo del zaguán, los 25 símbolos
ortográficos) se tomaron literalmente de «La Biblioteca de Babel» y están
fijadas en `src/constants.js`, verificadas por la suite de tests.

---

*Proyecto creado por Cristóbal y DAVI (Hermes Agent). Junio 2026.*
