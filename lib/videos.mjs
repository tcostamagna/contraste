// Videos de YouTube de los medios, emparejados con las noticias de las que hablan.
// Usa el RSS público de cada canal (youtube.com/feeds/videos.xml), sin API ni claves.

import { decodificar } from './rss.mjs';
import { asignarPorSimilitud } from './asignar.mjs';

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

/** Asigna a cada historia los videos que hablan de ella (`historia.videos`), uno por medio. */
export function asignarVideos(historias, videos, opciones = {}) {
  return asignarPorSimilitud(historias, videos, 'videos', opciones);
}
