import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerFeedYoutube, asignarVideos } from '../lib/videos.mjs';

test('lee el feed Atom de un canal de YouTube', () => {
  const xml = `<feed><entry><yt:videoId>abcDEF12345</yt:videoId><title>Paro de la CGT: qué funciona &amp; qué no</title>
    <published>2026-11-13T10:00:00+00:00</published></entry></feed>`;
  const [v] = leerFeedYoutube(xml);
  assert.equal(v.id, 'abcDEF12345');
  assert.equal(v.titulo, 'Paro de la CGT: qué funciona & qué no');
  assert.equal(v.miniatura, 'https://i.ytimg.com/vi/abcDEF12345/hqdefault.jpg');
});

test('asigna cada video a la noticia de la que habla, uno por medio', () => {
  const historias = [
    { id: 'cgt', titular: 'La CGT anunció un paro general de 24 horas', articulos: [{ titulo: 'Paro general de la CGT contra la reforma laboral' }] },
    { id: 'boca', titular: 'Boca le ganó 2-1 a River en La Bombonera', articulos: [{ titulo: 'Superclásico: Boca venció a River' }] },
  ];
  const videos = [
    { id: '1', titulo: 'Paro general de la CGT: qué servicios funcionan', medio: 'tn' },
    { id: '2', titulo: 'CGT: el paro general explicado', medio: 'tn' },
    { id: '3', titulo: 'Boca y River: los goles del superclásico', medio: 'c5n' },
    { id: '4', titulo: 'Receta de pastelitos para el 25 de mayo', medio: 'c5n' },
  ];
  asignarVideos(historias, videos);
  assert.deepEqual(historias[0].videos.map((v) => v.id), ['1']);
  assert.deepEqual(historias[1].videos.map((v) => v.id), ['3']);
});
