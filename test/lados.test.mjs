import { test } from 'node:test';
import assert from 'node:assert/strict';
import { palabrasPorLado, cifrasPorMedio, esOpinion } from '../lib/lados.mjs';

const notas = [
  { medio: 'p', lado: 'izquierda', url: '1', titulo: 'Los jubilados pierden contra la inflación de 2,1%', descripcion: 'Los salarios no alcanzan' },
  { medio: 'c', lado: 'derecha', url: '2', titulo: 'El Gobierno celebra la baja de la inflación: 2,1%', descripcion: 'Un alivio de US$ 12 millones' },
];

test('palabras que usa solo cada lado', () => {
  const p = palabrasPorLado(notas);
  assert.ok(p.izquierda.includes('jubilados'));
  assert.ok(p.derecha.includes('celebra'));
  assert.ok(!p.izquierda.includes('inflación'), 'una palabra compartida no es de un solo lado');
  assert.equal(palabrasPorLado([notas[0]]), null, 'con un solo lado no se compara');
});

test('cifras con los medios que las dan', () => {
  const c = cifrasPorMedio(notas, { p: 'Página/12', c: 'Clarín' });
  assert.deepEqual(c[0], { cifra: '2,1%', medios: [{ medio: 'p', nombre: 'Página/12', lado: 'izquierda' }, { medio: 'c', nombre: 'Clarín', lado: 'derecha' }] });
  assert.ok(c.some((x) => x.cifra === 'US$ 12 millones'));
});

test('detecta columnas de opinión por sección o categoría', () => {
  assert.equal(esOpinion({ url: 'https://www.clarin.com/opinion/columna.html' }), true);
  assert.equal(esOpinion({ url: 'https://x.com/politica/nota', categorias: ['Opinión'] }), true);
  assert.equal(esOpinion({ url: 'https://x.com/politica/nota', categorias: ['Política'] }), false);
});
