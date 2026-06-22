// Tests para src/booksContent.js — generación determinista de contenido.
//
// Lo crítico:
//   - Misma posición → mismo contenido (determinismo)
//   - Posiciones distintas → contenido distinto (unicidad)
//   - Solo el alfabeto canónico (25 símbolos: 22 letras + ' ' + '.' + ',')
//   - Algunas posiciones generan "libros-catalogo" con título legible

import { describe, it, expect } from 'vitest';
import {
  generateText,
  generateLine,
  generatePage,
  bookId,
  instanceToBook,
  BOOKS_PER_HEX,
  maybeTitle,
  describeBook,
} from '../booksContent.js';
import {
  ALPHABET, PAGES_PER_BOOK, LINES_PER_PAGE, LETTERS_PER_LINE,
  BOOKS_PER_SHELF,
} from '../constants.js';

describe('generateText', () => {
  it('produce exactamente `len` caracteres', () => {
    expect(generateText(42, 80).length).toBe(80);
    expect(generateText(42, 410 * 40 * 80).length).toBe(410 * 40 * 80);
  });

  it('usa SOLO el alfabeto canónico (25 símbolos)', () => {
    const text = generateText(123, 10_000);
    for (const ch of text) {
      expect(ALPHABET).toContain(ch);
    }
  });

  it('es determinista — misma semilla → mismo resultado', () => {
    expect(generateText(99, 100)).toBe(generateText(99, 100));
  });

  it('diferentes semillas producen diferentes textos', () => {
    expect(generateText(1, 100)).not.toBe(generateText(2, 100));
  });
});

describe('generateLine', () => {
  it('produce exactamente LETTERS_PER_LINE caracteres', () => {
    expect(generateLine(42, 0).length).toBe(LETTERS_PER_LINE);
  });

  it('diferentes líneas del mismo libro son distintas', () => {
    const l1 = generateLine(42, 0);
    const l2 = generateLine(42, 1);
    // La probabilidad de colisión en 80 chars de 25 símbolos es ínfima
    expect(l1).not.toBe(l2);
  });

  it('usa solo el alfabeto canónico', () => {
    const line = generateLine(7, 17);
    for (const ch of line) {
      expect(ALPHABET).toContain(ch);
    }
  });
});

describe('generatePage', () => {
  it('produce LINES_PER_PAGE líneas', () => {
    const page = generatePage(0, 0, 0, 0, 0, 0, 0);
    expect(page).toHaveLength(LINES_PER_PAGE);
  });

  it('cada línea tiene LETTERS_PER_LINE caracteres', () => {
    const page = generatePage(0, 0, 0, 0, 0, 0, 5);
    for (const line of page) {
      expect(line.length).toBe(LETTERS_PER_LINE);
    }
  });

  it('página 0 ≠ página 1 del mismo libro', () => {
    const p0 = generatePage(0, 0, 0, 0, 0, 0, 0);
    const p1 = generatePage(0, 0, 0, 0, 0, 0, 1);
    expect(p0.join('')).not.toBe(p1.join(''));
  });
});

describe('bookId', () => {
  it('formato legible hex(q,r)fF/wW/sS/bB', () => {
    expect(bookId(0, 0, 0, 0, 0, 0)).toBe('hex(0,0)f0/w0/s0/b0');
    expect(bookId(-1, 2, 3, 1, 4, 17)).toBe('hex(-1,2)f3/w1/s4/b17');
  });

  it('mismo input → mismo ID', () => {
    expect(bookId(0, 0, 0, 0, 0, 0)).toBe(bookId(0, 0, 0, 0, 0, 0));
  });

  it('diferentes inputs → diferentes IDs', () => {
    expect(bookId(0, 0, 0, 0, 0, 0)).not.toBe(bookId(0, 0, 0, 0, 0, 1));
  });
});

describe('instanceToBook (mapeo instanceId → shelf/book)', () => {
  it('instanceId 0 → shelf 0, book 0', () => {
    const { shelf, bookIndex } = instanceToBook(0);
    expect(shelf).toBe(0);
    expect(bookIndex).toBe(0);
  });

  it('instanceId N*BOOKS_PER_SHELF → shelf N, book 0', () => {
    const { shelf, bookIndex } = instanceToBook(BOOKS_PER_SHELF);
    expect(shelf).toBe(1);
    expect(bookIndex).toBe(0);
  });

  it('último instanceId → último shelf, último book', () => {
    const last = BOOKS_PER_SHELF * 5 - 1; // 5 anaqueles, 32 libros
    const { shelf, bookIndex } = instanceToBook(last);
    expect(shelf).toBe(4);
    expect(bookIndex).toBe(BOOKS_PER_SHELF - 1);
  });
});

describe('BOOKS_PER_HEX', () => {
  it('es 640 (canónico: 4 muros × 5 anaqueles × 32 libros)', () => {
    expect(BOOKS_PER_HEX).toBe(4 * 5 * 32);
  });
});

describe('maybeTitle (libros-catalogo)', () => {
  it('devuelve string legible cuando es especial', () => {
    // Buscar una posición que sí sea especial (~1% de probabilidad)
    let title = null;
    for (let q = 0; q < 50 && !title; q++) {
      for (let r = 0; r < 50 && !title; r++) {
        for (let b = 0; b < 50 && !title; b++) {
          title = maybeTitle(q, r, 0, 0, 0, b);
        }
      }
    }
    expect(title).not.toBeNull();
    expect(typeof title).toBe('string');
    expect(title.length).toBeGreaterThan(0);
  });

  it('la mayoría de los libros NO son especiales (ratio ~1%)', () => {
    let specials = 0;
    let total = 0;
    for (let b = 0; b < 1000; b++) {
      total++;
      if (maybeTitle(0, 0, 0, 0, 0, b)) specials++;
    }
    // ~1/256 = ~0.4%, esperado entre 0 y 1.5%
    expect(specials).toBeLessThan(total * 0.015);
    expect(specials).toBeGreaterThan(0); // alguno debe haber
  });

  it('misma posición → mismo título (o null) — determinismo', () => {
    const t1 = maybeTitle(0, 0, 0, 0, 0, 7);
    const t2 = maybeTitle(0, 0, 0, 0, 0, 7);
    expect(t1).toBe(t2);
  });
});

describe('describeBook', () => {
  it('incluye id, location, pages, canonic', () => {
    const desc = describeBook(0, 0, 0, 0, 0, 0, 1);
    expect(desc.id).toBe('hex(0,0)f0/w0/s0/b0');
    expect(desc.location).toEqual({ q: 0, r: 0, floor: 0, wall: 0, shelf: 0, bookIndex: 0 });
    expect(desc.pages).toHaveLength(1);
    expect(desc.canonic.pagesPerBook).toBe(PAGES_PER_BOOK);
    expect(desc.canonic.alphabet).toBe(25);
  });

  it('múltiples páginas si se piden', () => {
    const desc = describeBook(0, 0, 0, 0, 0, 0, 3);
    expect(desc.pages).toHaveLength(3);
  });

  it('dos libros distintos en el mismo hex tienen contenido distinto', () => {
    const b1 = describeBook(0, 0, 0, 0, 0, 0, 1);
    const b2 = describeBook(0, 0, 0, 0, 0, 1, 1);
    expect(b1.pages[0].join('')).not.toBe(b2.pages[0].join(''));
  });

  it('dos hex distintos en el mismo piso tienen contenido distinto', () => {
    const b1 = describeBook(0, 0, 0, 0, 0, 0, 1);
    const b2 = describeBook(1, 0, 0, 0, 0, 0, 1);
    expect(b1.pages[0].join('')).not.toBe(b2.pages[0].join(''));
  });

  it('dos pisos distintos del mismo hex tienen contenido distinto', () => {
    const b1 = describeBook(0, 0, 0, 0, 0, 0, 1);
    const b2 = describeBook(0, 0, 1, 0, 0, 0, 1);
    expect(b1.pages[0].join('')).not.toBe(b2.pages[0].join(''));
  });
});

describe('determinismo global', () => {
  it('el mismo libro generado 10 veces da el mismo texto', () => {
    const samples = Array.from({ length: 10 }, () =>
      generatePage(0, 0, 0, 0, 0, 0, 5).join('')
    );
    const first = samples[0];
    for (const s of samples) {
      expect(s).toBe(first);
    }
  });
});