import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerFeed, textoPlano } from '../lib/rss.mjs';

test('lee RSS 2.0 con CDATA, HTML escapado, imagen y categoría', () => {
  const xml = `<rss><channel><item>
    <title><![CDATA[Título con «comillas» &amp; acentos]]></title>
    <link>https://ejemplo.invalid/a</link>
    <pubDate>Fri, 13 Nov 2026 12:00:00 GMT</pubDate>
    <category><![CDATA[Política]]></category>
    <media:content url="https://ejemplo.invalid/foto.jpg" medium="image"/>
    <description>&lt;p&gt;Bajada &lt;b&gt;en negrita&lt;/b&gt;&lt;/p&gt;</description>
  </item></channel></rss>`;
  const [n] = leerFeed(xml);
  assert.equal(n.titulo, 'Título con «comillas» & acentos');
  assert.equal(n.url, 'https://ejemplo.invalid/a');
  assert.equal(n.fecha, '2026-11-13T12:00:00.000Z');
  assert.equal(n.descripcion, 'Bajada en negrita');
  assert.equal(n.imagen, 'https://ejemplo.invalid/foto.jpg');
  assert.deepEqual(n.categorias, ['Política']);
});

test('lee Atom', () => {
  const xml = `<feed><entry><title>Nota Atom</title><link rel="alternate" href="https://ejemplo.invalid/b"/>
    <updated>2026-11-13T10:00:00Z</updated><summary>Resumen</summary></entry></feed>`;
  const [n] = leerFeed(xml);
  assert.equal(n.titulo, 'Nota Atom');
  assert.equal(n.url, 'https://ejemplo.invalid/b');
  assert.equal(n.descripcion, 'Resumen');
});

test('ignora items sin título o enlace', () => {
  assert.equal(leerFeed('<rss><item><title>Sin link</title></item></rss>').length, 0);
});

test('textoPlano quita etiquetas y decodifica entidades numéricas', () => {
  assert.equal(textoPlano('<p>a&#233;&#x00f1;</p>'), 'aéñ');
});
