// Videos de YouTube de los medios, emparejados con las noticias de las que hablan.
// Usa el RSS público de cada canal (youtube.com/feeds/videos.xml), sin API ni claves.

import { decodificar } from './rss.mjs';
import { palabras } from './texto.mjs';
import { coseno } from './agrupar.mjs';

const UA = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36', 'Accept-Language': 'es-AR,es;q=0.9' };

/** Averigua el id del canal (UC…) a partir de su @handle leyendo la página pública del canal. */
export async function idDeCanal(handle) {
  const r = await fetch(`https://www.youtube.com/${handle}`, { headers: UA, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const html = await r.text();
  const m = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/) || html.match(/"externalId":"(UC[\w-]{22})"/) || html.match(/"channelId":"(UC[\w-]{22})"/);
  if (!m) throw new Error('no encontré el id del canal');
  return m[1];
}

/** Lee el feed Atom de un canal. Devuelve [{ id, titulo, fecha, miniatura }] */
export function leerFeedYoutube(xml) {
  const entradas = String(xml).match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  return entradas.map((e) => {
    const id = (e.match(/<yt:videoId>([\w-]{11})<\/yt:videoId>/) || [])[1];
    const titulo = decodificar((e.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '').trim();
    const fecha = (e.match(/<published>([^<]+)<\/published>/) || [])[1];
    return id && titulo ? { id, titulo, fecha: fecha ? new Date(fecha).toISOString() : null, miniatura: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` } : null;
  }).filter(Boolean);
}

export async function descargarVideos(canalId) {
  const r = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${canalId}`, { headers: UA, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return leerFeedYoutube(await r.text());
}

function vector(texto, df, n) {
  const v = palabras(texto);
  const r = new Map();
  let norma = 0;
  for (const [p, w] of v) {
    const x = w * Math.log(1 + n / (df.get(p) || 1));
    r.set(p, x);
    norma += x * x;
  }
  norma = Math.sqrt(norma) || 1;
  for (const [p, x] of r) r.set(p, x / norma);
  return r;
}

/**
 * Asigna a cada historia los videos que hablan de ella (similitud del título del video con los titulares de la noticia).
 * Modifica las historias: agrega `videos: [{ id, titulo, fecha, miniatura, medio, nombre, lado }]`.
 * Devuelve los videos que quedaron asignados.
 */
export function asignarVideos(historias, videos, { umbral = 0.3, maxPorHistoria = 4 } = {}) {
  const textos = historias.map((h) => [h.titular, ...h.articulos.map((a) => a.titulo)].join('. '));
  const df = new Map();
  for (const t of [...textos, ...videos.map((v) => v.titulo)]) for (const p of palabras(t).keys()) df.set(p, (df.get(p) || 0) + 1);
  const n = textos.length + videos.length;
  const vh = textos.map((t) => vector(t, df, n));
  const asignados = [];
  for (const v of videos) {
    const vv = vector(v.titulo, df, n);
    let mejor = -1;
    let sim = 0;
    vh.forEach((x, i) => {
      const s = coseno(vv, x);
      if (s > sim) { sim = s; mejor = i; }
    });
    if (mejor >= 0 && sim >= umbral) {
      const h = historias[mejor];
      h.videos ||= [];
      if (h.videos.length < maxPorHistoria && !h.videos.some((x) => x.medio === v.medio)) {
        h.videos.push({ ...v, similitud: Math.round(sim * 100) / 100 });
        asignados.push({ ...v, historia: h.id });
      }
    }
  }
  return asignados;
}
