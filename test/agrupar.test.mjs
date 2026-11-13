import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agrupar } from '../lib/agrupar.mjs';
import { temaDe } from '../lib/temas.mjs';

const nota = (medio, lado, titulo, descripcion = '', horas = 0) => ({
  medio, lado, titulo, descripcion, url: `https://ejemplo.invalid/${medio}/${titulo.length}-${horas}`,
  fecha: new Date(Date.UTC(2026, 10, 13, 12) + horas * 3600e3).toISOString(),
});

test('une la misma noticia aunque los titulares difieran y separa noticias distintas', () => {
  const grupos = agrupar([
    nota('a', 'izquierda', 'La CGT anunció un paro general de 24 horas contra la reforma laboral', '', 0),
    nota('b', 'derecha', 'La CGT lanzó un nuevo paro general y el Gobierno lo calificó de político', 'Huelga general de 24 horas por la reforma laboral', 1),
    nota('c', 'centro', 'Paro general de la CGT: qué servicios funcionan', 'La CGT confirmó la huelga contra la reforma laboral', 2),
    nota('d', 'centro', 'Boca le ganó 2-1 a River en La Bombonera', 'Superclásico por la Liga Profesional', 1),
    nota('e', 'derecha', 'Superclásico: Boca venció 2-1 a River', 'En La Bombonera', 2),
  ]);
  const tamaños = grupos.map((g) => g.articulos.length).sort();
  assert.deepEqual(tamaños, [2, 3]);
});

test('no une notas separadas por más de la ventana de tiempo', () => {
  const grupos = agrupar([
    nota('a', 'izquierda', 'Alerta amarilla por tormentas en el AMBA', '', 0),
    nota('b', 'derecha', 'Alerta amarilla por tormentas en el AMBA', '', 80),
  ]);
  assert.equal(grupos.length, 2);
});

test('el id del grupo es estable', () => {
  const notas = [nota('a', 'izquierda', 'Inflación de octubre 2,1% INDEC'), nota('b', 'derecha', 'INDEC: inflación de octubre 2,1%', '', 1)];
  assert.equal(agrupar(notas)[0].id, agrupar([...notas].reverse())[0].id);
});

test('tema por palabras clave y categorías', () => {
  assert.equal(temaDe([nota('a', 'centro', 'El dólar y la inflación según el BCRA')]), 'economia');
  assert.equal(temaDe([{ ...nota('a', 'centro', 'Algo pasó'), categorias: ['Deportes'] }]), 'deportes');
});
