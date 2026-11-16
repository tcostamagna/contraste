import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solidez, esRelleno, veredictoCifra } from '../lib/solidez.mjs';

const nota = (lado, titulo) => ({ lado, titulo });

test('noticia de los tres lados, con fuente y cifras que coinciden: muy corroborada', () => {
  const s = solidez(
    [nota('izquierda', 'El INDEC informó una inflación de 2,1%'), nota('centro', 'Inflación de 2,1% según el INDEC'), nota('derecha', 'El INDEC confirmó 2,1% de inflación'), nota('derecha', 'Inflación: 2,1% en octubre')],
    { izquierda: 1, centro: 1, derecha: 2 },
    [{ cifra: '2,1%', medios: [{ lado: 'izquierda' }, { lado: 'centro' }, { lado: 'derecha' }] }],
  );
  assert.equal(s.nivel, 'solida');
  assert.ok(s.puntaje >= 75);
});

test('trascendidos de un solo lado sin fuente: sin corroborar', () => {
  const s = solidez([nota('derecha', 'El ministro habría renunciado, según fuentes'), nota('derecha', 'Trascendió que el ministro podría irse')], { izquierda: 0, centro: 0, derecha: 2 });
  assert.equal(s.nivel, 'sin');
  assert.ok(s.senales.some((x) => x.texto.includes('condicional')));
});

test('detecta titulares de relleno', () => {
  assert.equal(esRelleno('Video: así reaccionaron los hinchas'), true);
  assert.equal(esRelleno('Lo que tenés que saber del paro'), true);
  assert.equal(esRelleno('Godoy Cruz le ganó 2-0 a Talleres'), false);
});

test('veredicto de una cifra', () => {
  assert.equal(veredictoCifra({ medios: [{ lado: 'izquierda' }, { lado: 'derecha' }, { lado: 'derecha' }] }).id, 'corroborado');
  assert.equal(veredictoCifra({ medios: [{ lado: 'derecha' }, { lado: 'derecha' }] }).id, 'coinciden');
  assert.equal(veredictoCifra({ medios: [{ lado: 'centro' }] }).id, 'un-medio');
});
