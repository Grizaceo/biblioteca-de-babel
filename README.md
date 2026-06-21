# La Biblioteca de Babel — Three.js

Exploración 3D en primera persona de *La Biblioteca de Babel* de **Jorge Luis Borges**.

> "El universo (que otros llaman la Biblioteca) se compone de un número indefinido, y tal vez infinito, de galerías hexagonales..."

![Screenshot](./screenshot.png)

## Características

- **Galerías hexagonales** con pozo central, estantes y lámparas
- **Libros detallados** con lomo texturizado, páginas y cantos dorados
- **Escaleras de caracol** funcionales entre pisos (subir/bajar)
- **Lámparas de aceite** con parpadeo orgánico simulado
- **Niebla volumétrica** para sensación de profundidad infinita
- **6 galerías** conectadas en grid hexagonal (7 hexágonos: central + 6 vecinos)
- **Control en primera persona** con WASD, ratón, salto
- **Renderizado eficiente**: solo 8 pisos visibles arriba/abajo

## Controles

| Tecla   | Acción            |
|---------|-------------------|
| Click   | Pointer Lock      |
| WASD    | Moverse           |
| Ratón   | Mirar             |
| Shift   | Correr            |
| Espacio | Saltar            |
| ESC     | Liberar cursor    |

## Requisitos

- Node.js >= 18
- Navegador moderno con WebGL (Chrome, Firefox, Edge)

## Instalar y ejecutar

```bash
# Instalar dependencias
npm install

# Desarrollo (con hot-reload)
npm run dev

# Build producción
npm run build

# Preview del build
npm run preview
```

Abrir `http://localhost:5173`.

## Tests

```bash
# Ejecutar suite completa
npm test

# Modo watch (desarrollo)
npm run test:watch
```

La suite cubre: validación de constantes, coordenadas hexagonales axiales,
geometría de libros, escaleras de caracol. 26 tests en total.

## Estructura del proyecto

```
src/
├── main.js          # Entry point: escena, render loop, init
├── camera.js        # FPSCamera: controles de primera persona
├── hexagon.js       # Geometría hexagonal (rooms, grid, world coords)
├── book.js          # Libros detallados con texturas procedurales
├── staircase.js     # Escaleras de caracol
├── lamp.js          # Lámparas de aceite con parpadeo
├── constants.js     # Todos los parámetros del mundo borgiano
└── __tests__/       # Suite de tests (Vitest)
    ├── constants.test.js
    ├── hexagon.test.js
    ├── book.test.js
    └── staircase.test.js
```

## Arquitectura

### Coordenadas hexagonales axiales

El mundo usa un sistema de coordenadas axiales (q, r) para posicionar
hexágonos, con conversión a cartesianas (x, z) para Three.js.

- `hexToWorld(q, r)` → `{ x, z }`
- `createHexGrid(radius)` → `[{ q, r }]`
- `createHexRoom(x, z, y)` → grupo 3D completo

### Pisos infinitos

La escena renderiza `VISIBLE_FLOORS` pisos arriba y abajo del jugador.
Al subir/bajar por una escalera, el grid se desplaza y se re-pueblan
los hexágonos que entran/ salen del rango visible.

### Libros

Cada libro es un grupo de meshes (lomo + páginas + cantos decorativos)
con textura procedural generada en canvas. El color del lomo varía
pseudoaleatoriamente según un seed determinista.

## Parámetros configurables

Ver `src/constants.js` para ajustar dimensiones, colores, velocidades.

| Constante             | Default | Descripción                           |
|-----------------------|---------|---------------------------------------|
| `HEX_RADIUS`          | 5       | Radio del hexágono (centro a vértice) |
| `HEX_HEIGHT`          | 6       | Altura del hexágono (piso a techo)    |
| `CENTER_HOLE_RADIUS`  | 2       | Radio del pozo central                |
| `BOOKS_PER_SHELF`     | 8       | Libros por estante                    |
| `VISIBLE_FLOORS`      | 8       | Pisos visibles arriba/abajo           |
| `MOVE_SPEED`          | 5       | Velocidad de movimiento               |
| `MOUSE_SENSITIVITY`   | 0.002   | Sensibilidad del ratón                |

## Inspiración

Basado en el cuento *La Biblioteca de Babel* (1941) de Jorge Luis Borges.
La adaptación visual busca capturar la atmósfera del relato: galerías
hexagonales idénticas e infinitas, luz de lámparas de aceite, libros
que contienen todas las combinaciones posibles del alfabeto.

## Licencia

MIT — ver [LICENSE](./LICENSE).
