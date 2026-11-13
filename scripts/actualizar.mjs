#!/usr/bin/env node
// Descarga los feeds de los medios, agrupa las notas por noticia y escribe los datos que lee el sitio.
//
//   node scripts/actualizar.mjs          → descarga real
//   node scripts/actualizar.mjs --demo   → usa los feeds de ejemplo de test/fixtures (sin red)
//
// Variables: ANTHROPIC_API_KEY (opcional, activa los resúmenes), MAX_RESUMENES (por corrida, 15 por defecto).

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerFeed } from '../lib/rss.mjs';
import { agrupar } from '../lib/agrupar.mjs';
import { temaDe, nombreTema, TEMAS } from '../lib/temas.mjs';
import { slug } from '../lib/texto.mjs';
import { resumir, resumenDisponible, MODELO } from '../lib/resumir.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEMO = process.argv.includes('--demo');
const ARCHIVO = path.join(RAIZ, 'datos', DEMO ? 'archivo-demo.json' : 'archivo.json');
const SALIDA = path.join(RAIZ, 'public', 'datos');
const HORAS_ARCHIVO = 72; // cuánto se guarda cada nota
const HORAS_PORTADA = 48; // qué notas entran a la portada
const MAX_RESUMENES = Number(process.env.MAX_RESUMENES ?? 15);
const LADOS = ['izquierda', 'centro', 'derecha'];

const ahora = Date.now();
const log = (...a) => console.log(...a);

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

async function leerUno(medio, feed) {
  const xml = DEMO ? await readFile(path.join(RAIZ, 'test', 'fixtures', `${medio.id}.xml`), 'utf8') : await descargar(feed);
  const items = leerFeed(xml);
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
  return { notas, errores: notas.length ? [] : errores, usados };
}

async function cargarArchivo() {
  if (!existsSync(ARCHIVO)) return { articulos: {}, resumenes: {} };
  try {
    return JSON.parse(await readFile(ARCHIVO, 'utf8'));
  } catch {
    return { articulos: {}, resumenes: {} };
  }
}

const horasDesde = (iso) => (ahora - Date.parse(iso)) / 3600e3;

function armarHistoria(grupo, mediosPorId, resumen) {
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

  // Sin resumen de IA, el titular sale de la nota más representativa, preferentemente de un medio de centro.
  const deCentro = arts.filter((a) => a.lado === 'centro');
  const base = deCentro.includes(grupo.representativo) || !deCentro.length ? grupo.representativo : deCentro[0];
  const primero = arts[0];
  const ultima = arts[arts.length - 1];
  const titular = resumen?.titular || base.titulo;

  return {
    id: grupo.id,
    slug: slug(titular),
    titular,
    resumen: resumen?.resumen || base.descripcion || '',
    hechos: resumen?.hechos || [],
    enfoques: resumen?.enfoques || null,
    ia: Boolean(resumen),
    tema,
    temaNombre: nombreTema(tema),
    fecha: primero.fecha,
    actualizado: ultima.fecha,
    imagen: (arts.find((a) => a.imagen && a.lado === 'centro') || arts.find((a) => a.imagen))?.imagen || '',
    medios: vistos.size,
    cobertura,
    soloCubre,
    primero: { medio: primero.medio, nombre: mediosPorId[primero.medio].nombre, lado: primero.lado, fecha: primero.fecha },
    puntaje: Math.round((vistos.size * 10 + lados * 6 - Math.max(0, horasDesde(ultima.fecha)) * 0.8) * 10) / 10,
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

/** Firma de la cobertura: si cambia mucho, el resumen se rehace. */
const firma = (g) => [...new Set(g.articulos.map((a) => a.medio))].sort().join(',');

function necesitaResumen(previo, g) {
  if (!previo) return true;
  const antes = previo.firma.split(',');
  const ahoraM = firma(g).split(',');
  return ahoraM.length >= antes.length + 2; // se sumaron al menos dos medios desde el último resumen
}

async function main() {
  const { medios } = JSON.parse(await readFile(path.join(RAIZ, 'config', 'medios.json'), 'utf8'));
  const mediosPorId = Object.fromEntries(medios.map((m) => [m.id, m]));
  const archivo = await cargarArchivo();

  // 1. Descarga
  const estado = {};
  const resultados = await Promise.all(medios.map(async (m) => [m, await leerMedio(m)]));
  let nuevas = 0;
  for (const [m, { notas, errores, usados }] of resultados) {
    estado[m.id] = { ok: notas.length > 0, notas: notas.length, errores, feeds: usados, revisado: new Date(ahora).toISOString() };
    const alternativa = usados.find((u) => !m.feeds.includes(u));
    log(`${notas.length ? '✓' : '✗'} ${m.nombre.padEnd(20)} ${String(notas.length).padStart(3)} notas${alternativa ? `  (alternativa: ${alternativa})` : ''}${errores.length ? '  ' + errores.join(' | ') : ''}`);
    for (const n of notas) {
      const url = limpiarUrl(n.url);
      const previa = archivo.articulos[url];
      if (!previa) nuevas++;
      archivo.articulos[url] = {
        ...n,
        url,
        medio: m.id,
        lado: m.lado,
        // Si el feed no trae fecha, se usa la primera vez que la vimos.
        fecha: n.fecha && Date.parse(n.fecha) <= ahora + 3600e3 ? n.fecha : previa?.fecha || new Date(ahora).toISOString(),
      };
    }
  }

  // 2. Limpieza del archivo
  for (const [url, a] of Object.entries(archivo.articulos)) {
    if (horasDesde(a.fecha) > HORAS_ARCHIVO || !mediosPorId[a.medio]) delete archivo.articulos[url];
    else a.lado = mediosPorId[a.medio].lado; // por si cambió la clasificación del medio
  }

  // 3. Agrupar
  const recientes = Object.values(archivo.articulos).filter((a) => DEMO || horasDesde(a.fecha) <= HORAS_PORTADA);
  const grupos = agrupar(recientes);
  log(`\n${recientes.length} notas recientes (${nuevas} nuevas) → ${grupos.length} grupos, ${grupos.filter((g) => new Set(g.articulos.map((a) => a.medio)).size >= 2).length} con 2 medios o más`);

  // 4. Resúmenes con IA para las noticias más cubiertas
  const resumenes = archivo.resumenes || {};
  const multi = grupos.filter((g) => new Set(g.articulos.map((a) => a.medio)).size >= 3)
    .sort((a, b) => new Set(b.articulos.map((x) => x.medio)).size - new Set(a.articulos.map((x) => x.medio)).size);
  if (resumenDisponible() && MAX_RESUMENES > 0) {
    const pendientes = multi.filter((g) => necesitaResumen(resumenes[g.id], g)).slice(0, MAX_RESUMENES);
    log(`Resumiendo ${pendientes.length} noticias con ${MODELO}…`);
    for (const g of pendientes) {
      try {
        const datos = await resumir(g.articulos.map((a) => ({ ...a, medioNombre: mediosPorId[a.medio].nombre })));
        resumenes[g.id] = { firma: firma(g), datos, fecha: new Date().toISOString() };
      } catch (e) {
        log(`  ✗ ${g.articulos[0].titulo.slice(0, 60)}…: ${e.message}`);
      }
    }
  } else if (!resumenDisponible()) {
    log('Sin ANTHROPIC_API_KEY: titulares tomados de los medios, sin resúmenes.');
  }
  const idsVivos = new Set(grupos.map((g) => g.id));
  for (const id of Object.keys(resumenes)) if (!idsVivos.has(id)) delete resumenes[id];
  archivo.resumenes = resumenes;

  // 5. Historias para el sitio
  const historias = grupos.map((g) => armarHistoria(g, mediosPorId, resumenes[g.id]?.datos));
  const conVarios = historias.filter((h) => h.medios >= 2).sort((a, b) => b.puntaje - a.puntaje).slice(0, 200);
  const sueltas = historias.filter((h) => h.medios < 2).sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha)).slice(0, 80);

  await mkdir(SALIDA, { recursive: true });
  await mkdir(path.dirname(ARCHIVO), { recursive: true });
  const generado = new Date(ahora).toISOString();
  await writeFile(path.join(SALIDA, 'historias.json'), JSON.stringify({ generado, demo: DEMO, temas: TEMAS.map(({ id, nombre }) => ({ id, nombre })), historias: conVarios, sueltas }));
  await writeFile(path.join(SALIDA, 'medios.json'), JSON.stringify({
    generado,
    demo: DEMO,
    medios: medios.map((m) => ({ id: m.id, nombre: m.nombre, web: m.web, lado: m.lado, ...estado[m.id] })),
  }));
  await writeFile(ARCHIVO, JSON.stringify(archivo));
  log(`Listo: ${conVarios.length} noticias con varios medios y ${sueltas.length} de un solo medio en public/datos/.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
