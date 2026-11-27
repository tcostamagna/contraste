#!/usr/bin/env node
// Descarga los feeds de los medios, agrupa las notas por noticia y escribe los datos que lee el sitio.
//
//   node scripts/actualizar.mjs          → descarga real
//   node scripts/actualizar.mjs --demo   → usa los feeds de ejemplo de test/fixtures (sin red)
//
// No usa servicios pagos: todo sale de los RSS públicos de los medios y de sus canales de YouTube.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerFeed } from '../lib/rss.mjs';
import { agrupar } from '../lib/agrupar.mjs';
import { temaDe, nombreTema, TEMAS } from '../lib/temas.mjs';
import { slug } from '../lib/texto.mjs';
import { idDeCanal, descargarVideos, asignarVideos } from '../lib/videos.mjs';
import { asignarPorSimilitud } from '../lib/asignar.mjs';
import { palabrasPorLado, cifrasPorMedio, esOpinion, contrastePorLados } from '../lib/lados.mjs';
import { solidez } from '../lib/solidez.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEMO = process.argv.includes('--demo');
const ARCHIVO = path.join(RAIZ, 'datos', DEMO ? 'archivo-demo.json' : 'archivo.json');
const SALIDA = path.join(RAIZ, 'public', 'datos');
const HORAS_ARCHIVO = 72; // cuánto se guarda cada nota
const HORAS_AGRUPAR = 36; // qué notas se usan para armar las noticias (para seguir una noticia que empezó ayer)
const HORAS_PORTADA = 24; // una noticia entra al sitio solo si empezó en las últimas 24 horas, como un diario
const HORAS_SIN_NOVEDAD = 12; // una noticia sin notas nuevas en 12 horas sale del sitio
const HORAS_SUELTAS = 12; // notas de un solo medio: las de las últimas 12 horas
// El sitio no cubre deportes ni espectáculos: se descartan por sección del diario y por tema.
const TEMAS_EXCLUIDOS = new Set(['deportes', 'espectaculos']);
const SECCION_EXCLUIDA = /\/(deportes?|futbol|f%C3%BAtbol|tenis|automovilismo|rugby|basquet|polideportivo|olimpicos|espectaculos|show|teleshow|famosos|farandula|gente|celebrities|entretenimiento|cine|musica|series|tv|television)(\/|-)/i;
const CATEGORIA_EXCLUIDA = /deporte|f[uú]tbol|espect[aá]culo|show|famosos|far[aá]ndula|entretenimiento|televisi[oó]n|celebridades/i;
const esExcluida = (n) => SECCION_EXCLUIDA.test(n.url || '') || (n.categorias || []).some((c) => CATEGORIA_EXCLUIDA.test(c));
const LADOS = ['izquierda', 'centro', 'derecha'];
const PALABRAS_POR_MINUTO = 200;

const ahora = Date.now();
const log = (...a) => console.log(...a);
const horasDesde = (iso) => (ahora - Date.parse(iso)) / 3600e3;

function limpiarUrl(u) {
  try {
    const url = new URL(u);
    for (const k of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid|outputType)/i.test(k)) url.searchParams.delete(k);
    url.hash = '';
    return url.toString();
  } catch {
    return u;
  }
}

async function descargar(url) {
  const r = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; lector-rss-noticias-ar/1.0)', Accept: 'application/rss+xml, application/xml, text/xml, */*' },
    redirect: 'follow',
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

async function leerUno(medio, feed, tipo = 'noticias') {
  const ejemplo = path.join(RAIZ, 'test', 'fixtures', tipo === 'opinion' ? `${medio.id}-opinion.xml` : `${medio.id}.xml`);
  const xml = DEMO ? await readFile(ejemplo, 'utf8') : await descargar(feed);
  let items = leerFeed(xml);
  // Google Noticias agrega « - Nombre del medio» al final del titular y la bajada repite el titular.
  if (feed.includes('news.google.com')) {
    items = items.map((n) => ({ ...n, titulo: n.titulo.replace(/\s+[-–]\s+[^-–]+$/, ''), descripcion: '' }));
  }
  if (!items.length) throw new Error('el feed no trae notas');
  return items;
}

async function leerMedio(medio) {
  const notas = [];
  const errores = [];
  const usados = [];
  for (const feed of medio.feeds) {
    try {
      notas.push(...(await leerUno(medio, feed)));
      usados.push(feed);
    } catch (e) {
      if (DEMO && e.code === 'ENOENT') continue; // en la demo no todos los medios tienen ejemplo
      errores.push(`${feed}: ${e.message}`);
    }
  }
  // Si ningún feed principal anduvo, se prueban las alternativas en orden hasta que una funcione.
  if (!notas.length && !DEMO) {
    for (const feed of medio.alternativas || []) {
      try {
        notas.push(...(await leerUno(medio, feed)));
        usados.push(feed);
        break;
      } catch (e) {
        errores.push(`${feed}: ${e.message}`);
      }
    }
  }
  // Columnas de opinión: feeds propios o notas del feed general que están en la sección de opinión.
  let opinion = 0;
  let errorOpinion = '';
  for (const feed of medio.opinion || []) {
    try {
      const items = await leerUno(medio, feed, 'opinion');
      notas.push(...items.map((n) => ({ ...n, opinion: true })));
      opinion += items.length;
    } catch (e) {
      if (!(DEMO && e.code === 'ENOENT')) errorOpinion = e.message;
    }
  }
  return { notas, errores: notas.length ? [] : errores, usados, opinion, errorOpinion };
}

/**
 * Fecha de publicación de una nota. Varios medios cambian la fecha del RSS cada vez que editan la nota: se guarda la
 * más vieja que vimos, así una nota de ayer retocada hoy no pasa por nueva. Sin fecha (o con fecha futura), se usa la
 * primera vez que la vimos.
 */
function fechaDeNota(delFeed, previa) {
  const valida = delFeed && Date.parse(delFeed) <= ahora + 3600e3 ? delFeed : null;
  if (previa && (!valida || Date.parse(previa) < Date.parse(valida))) return previa;
  return valida || new Date(ahora).toISOString();
}

async function cargarArchivo() {
  if (!existsSync(ARCHIVO)) return { articulos: {} };
  try {
    return JSON.parse(await readFile(ARCHIVO, 'utf8'));
  } catch {
    return { articulos: {} };
  }
}

function armarHistoria(grupo, mediosPorId) {
  const arts = grupo.articulos;
  const cobertura = { izquierda: 0, centro: 0, derecha: 0 };
  const vistos = new Set();
  for (const a of arts) {
    if (vistos.has(a.medio)) continue;
    vistos.add(a.medio);
    cobertura[a.lado]++;
  }
  const lados = LADOS.filter((l) => cobertura[l] > 0).length;
  const tema = temaDe(arts);
  // Punto ciego: al menos dos medios de un lado la cuentan y ninguno del otro. En deportes y espectáculos no aplica.
  let soloCubre = null;
  if (!['deportes', 'espectaculos'].includes(tema)) {
    if (cobertura.izquierda >= 2 && cobertura.derecha === 0) soloCubre = 'izquierda';
    if (cobertura.derecha >= 2 && cobertura.izquierda === 0) soloCubre = 'derecha';
  }

  const primero = arts[0];
  const ultima = arts[arts.length - 1];
  // Titular: si la noticia sigue desarrollándose, sale de las notas de las últimas 6 horas (el último avance, no la
  // primera nota de ayer). Entre ellas se prefiere la más representativa, de un medio de centro y con bajada.
  const recientes = DEMO ? arts : arts.filter((a) => horasDesde(a.fecha) <= 6);
  const candidatas = recientes.length ? recientes : arts;
  const deCentro = candidatas.filter((a) => a.lado === 'centro' && a.descripcion);
  const base = candidatas.includes(grupo.representativo) && (grupo.representativo.lado === 'centro' || !deCentro.length)
    ? grupo.representativo
    : deCentro[deCentro.length - 1] || candidatas.filter((a) => a.descripcion).pop() || candidatas[candidatas.length - 1];
  const resumen = base.descripcion || [...candidatas].reverse().find((a) => a.descripcion)?.descripcion || '';
  // Cuántos medios distintos la publicaron en las últimas 3 horas: mide si la noticia está «viva» ahora.
  const mediosRecientes = new Set(arts.filter((a) => horasDesde(a.fecha) <= 3).map((a) => a.medio)).size;
  const nombres = Object.fromEntries(Object.values(mediosPorId).map((m) => [m.id, m.nombre]));
  const cifras = cifrasPorMedio(arts, nombres);
  const sol = solidez(arts, cobertura, cifras, nombres);

  return {
    id: grupo.id,
    slug: slug(base.titulo),
    titular: base.titulo,
    titularDe: base.medio,
    resumen,
    tema,
    temaNombre: nombreTema(tema),
    fecha: primero.fecha,
    actualizado: ultima.fecha,
    imagen: (arts.find((a) => a.imagen && a.lado === 'centro') || arts.find((a) => a.imagen))?.imagen || '',
    medios: vistos.size,
    cobertura,
    soloCubre,
    primero: { medio: primero.medio, nombre: mediosPorId[primero.medio].nombre, lado: primero.lado, fecha: primero.fecha },
    // Orden de la portada, como un diario: pesa la cobertura, pero más lo que se está publicando ahora. Resta la
    // antigüedad desde que empezó y el tiempo sin notas nuevas; suma los medios que la publicaron en las últimas 3 h.
    puntaje: Math.round((
      vistos.size * 6 + lados * 5 + mediosRecientes * 8
      - Math.max(0, horasDesde(primero.fecha)) * 2
      - Math.max(0, horasDesde(ultima.fecha)) * 3
      - (sol.relleno ? 25 : 0) + sol.puntaje * 0.05
      - (tema === 'sociedad' ? 20 : 0) // Sociedad (clima, tránsito, curiosidades) va al final de la portada
    ) * 10) / 10,
    mediosRecientes,
    solidez: { puntaje: sol.puntaje, nivel: sol.nivel, etiqueta: sol.etiqueta, senales: sol.senales },
    relleno: sol.relleno,
    palabras: vistos.size >= 2 ? palabrasPorLado(arts) : null,
    contraste: conNombres(contrastePorLados(arts, cobertura), nombres),
    cifras: cifras.map((c, i) => ({ ...c, veredicto: sol.cifras[i] })),
    articulos: arts.map((a) => ({
      medio: a.medio,
      nombre: mediosPorId[a.medio].nombre,
      lado: a.lado,
      titulo: a.titulo,
      descripcion: a.descripcion,
      url: a.url,
      fecha: a.fecha,
    })),
  };
}

function conNombres(c, nombres) {
  if (!c) return null;
  return { ...c, izquierda: { ...c.izquierda, nombre: nombres[c.izquierda.medio] }, derecha: { ...c.derecha, nombre: nombres[c.derecha.medio] } };
}

/**
 * Noticias destacadas de Google Noticias Argentina: lo más parecido a «lo más leído» que hay disponible en público.
 * Marca las historias que aparecen ahí (`enTendencia`).
 */
async function marcarTendencias(historias) {
  const feeds = [
    'https://news.google.com/rss?hl=es-419&gl=AR&ceid=AR:es-419',
    'https://news.google.com/rss/headlines/section/topic/NATION?hl=es-419&gl=AR&ceid=AR:es-419',
  ];
  const items = [];
  for (const f of feeds) {
    try {
      items.push(...leerFeed(await descargar(f)).map((n) => ({ titulo: n.titulo.replace(/\s+[-–]\s+[^-–]+$/, ''), medio: 'google' })));
    } catch (e) {
      log(`  ✗ Google Noticias destacadas: ${e.message}`);
    }
  }
  const asignados = asignarPorSimilitud(historias, items, 'tendencia', { umbral: 0.3, maxPorHistoria: 20, unoPorMedio: false });
  for (const h of historias) {
    h.enTendencia = Boolean(h.tendencia?.length);
    delete h.tendencia;
  }
  log(`Tendencias: ${items.length} destacadas de Google Noticias, ${new Set(asignados.map((a) => a.historia)).size} noticias en tendencia`);
}

async function videosDeMedios(archivo, mediosPorId, historias) {
  const { canales } = JSON.parse(await readFile(path.join(RAIZ, 'config', 'videos.json'), 'utf8'));
  archivo.canales ||= {};
  const estado = [];
  const todos = [];
  await Promise.all(canales.filter((c) => mediosPorId[c.medio]).map(async (c) => {
    const m = mediosPorId[c.medio];
    try {
      const id = archivo.canales[c.handle] || (archivo.canales[c.handle] = await idDeCanal(c.handle));
      const videos = (await descargarVideos(id)).filter((v) => v.fecha && horasDesde(v.fecha) <= HORAS_AGRUPAR);
      todos.push(...videos.map((v) => ({ ...v, medio: m.id, nombre: m.nombre, lado: m.lado })));
      estado.push({ medio: m.id, handle: c.handle, ok: true, videos: videos.length });
    } catch (e) {
      delete archivo.canales[c.handle];
      estado.push({ medio: m.id, handle: c.handle, ok: false, error: e.message });
    }
  }));
  const asignados = asignarVideos(historias, todos);
  log(`Videos: ${todos.length} recientes de ${estado.filter((e) => e.ok).length}/${estado.length} canales, ${asignados.length} asignados a noticias${estado.some((e) => !e.ok) ? '  ✗ ' + estado.filter((e) => !e.ok).map((e) => `${e.handle}: ${e.error}`).join(' | ') : ''}`);
  return estado;
}

/** Primeras oraciones de un texto, hasta un máximo de caracteres. */
function oraciones(texto, max = 320) {
  const partes = String(texto || '').match(/[^.!?]+[.!?]+(\s|$)/g) || [texto || ''];
  let salida = '';
  for (const p of partes) {
    if ((salida + p).length > max && salida) break;
    salida += p;
  }
  return salida.trim();
}

/** «Ponete al día»: las noticias más cubiertas de las últimas 24 horas, con cómo la titula cada lado. */
function armarHoy(historias) {
  const elegidas = [...historias]
    .filter((h) => h.medios >= 3 && !h.relleno && h.tema !== 'sociedad' && (DEMO || horasDesde(h.fecha) <= 24))
    .sort((a, b) => b.puntaje - a.puntaje)
    .slice(0, 12);
  const bloques = elegidas.map((h) => {
    const otraBajada = h.articulos.find((a) => a.descripcion && a.lado !== h.articulos.find((x) => x.titulo === h.titular)?.lado && a.descripcion !== h.resumen);
    return {
      id: h.id,
      titular: h.titular,
      texto: oraciones(h.resumen),
      mas: otraBajada ? { nombre: otraBajada.nombre, lado: otraBajada.lado, texto: oraciones(otraBajada.descripcion, 220) } : null,
      lados: Object.fromEntries(LADOS.map((l) => {
        const a = h.articulos.find((x) => x.lado === l);
        return [l, a ? { nombre: a.nombre, titulo: a.titulo } : null];
      })),
      tema: h.temaNombre,
      cobertura: h.cobertura,
      medios: h.medios,
      soloCubre: h.soloCubre,
      solidez: h.solidez,
      fecha: h.fecha,
      imagen: h.imagen,
    };
  });
  const temas = [...new Set(bloques.map((b) => b.tema))].slice(0, 4);
  const palabras = bloques.flatMap((b) => [b.titular, b.texto, b.mas?.texto, ...Object.values(b.lados).map((x) => x?.titulo)]).join(' ').split(/\s+/).length;
  return {
    titulo: 'Lo importante de hoy',
    intro: bloques.length
      ? `Las ${bloques.length} noticias que más medios están contando ahora${temas.length ? `: ${temas.join(', ').toLowerCase()}` : ''}. En cada una, cómo la titula cada lado.`
      : 'Todavía no hay noticias publicadas por varios medios.',
    bloques,
    minutos: Math.max(1, Math.round(palabras / PALABRAS_POR_MINUTO)),
  };
}

async function main() {
  const { medios } = JSON.parse(await readFile(path.join(RAIZ, 'config', 'medios.json'), 'utf8'));
  const mediosPorId = Object.fromEntries(medios.map((m) => [m.id, m]));
  const archivo = await cargarArchivo();

  // 1. Descarga
  const estado = {};
  const resultados = await Promise.all(medios.map(async (m) => [m, await leerMedio(m)]));
  let nuevas = 0;
  for (const [m, { notas, errores, usados, opinion, errorOpinion }] of resultados) {
    estado[m.id] = { ok: notas.length > 0, notas: notas.length, errores, feeds: usados, opinion, errorOpinion, revisado: new Date(ahora).toISOString() };
    const alternativa = usados.find((u) => !m.feeds.includes(u));
    log(`${notas.length ? '✓' : '✗'} ${m.nombre.padEnd(20)} ${String(notas.length).padStart(3)} notas${m.opinion ? ` (${opinion} de opinión${errorOpinion ? `, error: ${errorOpinion}` : ''})` : ''}${alternativa ? `  (alternativa: ${alternativa})` : ''}${errores.length ? '  ' + errores.join(' | ') : ''}`);
    for (const n of notas) {
      if (esExcluida(n)) continue;
      const url = limpiarUrl(n.url);
      const previa = archivo.articulos[url];
      if (!previa) nuevas++;
      archivo.articulos[url] = {
        ...n,
        url,
        medio: m.id,
        lado: m.lado,
        opinion: Boolean(n.opinion || previa?.opinion || esOpinion(n)),
        // Si el feed no trae fecha, se usa la primera vez que la vimos.
        fecha: fechaDeNota(n.fecha, previa?.fecha),
      };
    }
  }

  // 2. Limpieza del archivo (y de datos de versiones anteriores)
  delete archivo.resumenes;
  delete archivo.hoy;
  for (const [url, a] of Object.entries(archivo.articulos)) {
    // En la demo las notas de ejemplo tienen fecha fija: no se descartan por antigüedad.
    if ((!DEMO && horasDesde(a.fecha) > HORAS_ARCHIVO) || !mediosPorId[a.medio]) delete archivo.articulos[url];
    else a.lado = mediosPorId[a.medio].lado; // por si cambió la clasificación del medio
  }

  // 3. Agrupar las noticias (las columnas de opinión van aparte)
  const todas = Object.values(archivo.articulos);
  const recientes = todas.filter((a) => !a.opinion && !esExcluida(a) && (DEMO || horasDesde(a.fecha) <= HORAS_AGRUPAR));
  const grupos = agrupar(recientes);
  log(`\n${recientes.length} notas recientes (${nuevas} nuevas) → ${grupos.length} grupos, ${grupos.filter((g) => new Set(g.articulos.map((a) => a.medio)).size >= 2).length} con 2 medios o más`);

  // 4. Historias para el sitio
  const historias = grupos
    .map((g) => armarHistoria(g, mediosPorId))
    .filter((h) => !TEMAS_EXCLUIDOS.has(h.tema));
  const conVarios = historias
    // Entra si empezó en las últimas 24 h y tuvo alguna nota nueva en las últimas 12 h (si no, ya es vieja).
    .filter((h) => h.medios >= 2 && (DEMO || (horasDesde(h.fecha) <= HORAS_PORTADA && horasDesde(h.actualizado) <= HORAS_SIN_NOVEDAD)))
    .sort((a, b) => b.puntaje - a.puntaje)
    .slice(0, 200);
  const sueltas = historias
    .filter((h) => h.medios < 2 && (DEMO || horasDesde(h.fecha) <= HORAS_SUELTAS))
    .sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha))
    .slice(0, 80);

  // 5. Opinión: columnas y editoriales, asignadas a la noticia de la que hablan
  const columnas = todas
    .filter((a) => a.opinion && !esExcluida(a) && (DEMO || horasDesde(a.fecha) <= 48))
    .sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha))
    .slice(0, 150)
    .map((a) => ({ medio: a.medio, nombre: mediosPorId[a.medio].nombre, lado: a.lado, titulo: a.titulo, descripcion: a.descripcion, autor: a.autor || '', url: a.url, fecha: a.fecha }));
  const conNoticia = asignarPorSimilitud(conVarios, columnas, 'opiniones', { umbral: 0.25, maxPorHistoria: 6 });
  const noticiaDe = new Map(conNoticia.map((c) => [c.url, c.historia]));
  for (const c of columnas) c.historia = noticiaDe.get(c.url) || null;
  log(`Opinión: ${columnas.length} columnas, ${conNoticia.length} asociadas a una noticia`);

  // 6. Videos de los canales de YouTube de los medios
  const estadoVideos = DEMO ? [] : await videosDeMedios(archivo, mediosPorId, conVarios);

  // 8. Ponete al día
  // 7. Relevancia y polémica: las que están en tendencia y en las que los lados más chocan suben en la portada.
  if (!DEMO) await marcarTendencias(conVarios);
  for (const h of conVarios) {
    if (h.contraste) h.contraste.puntaje = Math.min(100, h.contraste.puntaje + Math.min(15, 5 * (h.opiniones?.length || 0)));
    h.puntaje = Math.round((h.puntaje + (h.enTendencia ? 12 : 0) + (h.contraste?.puntaje || 0) * 0.15) * 10) / 10;
  }
  conVarios.sort((a, b) => b.puntaje - a.puntaje);

  const hoy = armarHoy(conVarios);

  await mkdir(SALIDA, { recursive: true });
  await mkdir(path.dirname(ARCHIVO), { recursive: true });
  const generado = new Date(ahora).toISOString();
  const catalogo = medios.map((m) => ({ id: m.id, nombre: m.nombre, lado: m.lado, ok: estado[m.id].ok }));
  await writeFile(path.join(SALIDA, 'historias.json'), JSON.stringify({ generado, demo: DEMO, temas: TEMAS.filter((t) => !TEMAS_EXCLUIDOS.has(t.id)).map(({ id, nombre }) => ({ id, nombre })), medios: catalogo, historias: conVarios, sueltas }));
  await writeFile(path.join(SALIDA, 'hoy.json'), JSON.stringify({ generado, demo: DEMO, ...hoy }));
  await writeFile(path.join(SALIDA, 'opinion.json'), JSON.stringify({ generado, demo: DEMO, columnas }));
  await writeFile(path.join(SALIDA, 'medios.json'), JSON.stringify({
    generado,
    demo: DEMO,
    medios: medios.map((m) => ({ id: m.id, nombre: m.nombre, web: m.web, lado: m.lado, ...estado[m.id] })),
    videos: estadoVideos,
  }));
  await writeFile(ARCHIVO, JSON.stringify(archivo));
  log(`Listo: ${conVarios.length} noticias con varios medios, ${sueltas.length} de un solo medio y ${columnas.length} columnas en public/datos/.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
