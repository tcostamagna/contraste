// Asigna elementos sueltos (videos, columnas de opinión) a la noticia de la que hablan, por similitud de títulos.

import { palabras } from './texto.mjs';
import { coseno } from './agrupar.mjs';

function vector(texto, df, n) {
  const r = new Map();
  let norma = 0;
  for (const [p, w] of palabras(texto)) {
    const x = w * Math.log(1 + n / (df.get(p) || 1));
    r.set(p, x);
    norma += x * x;
  }
  norma = Math.sqrt(norma) || 1;
  for (const [p, x] of r) r.set(p, x / norma);
  return r;
}

/**
 * Agrega a cada historia `historia[campo] = [...]` con los elementos que hablan de ella.
 * Cada elemento necesita `titulo` (y opcionalmente `descripcion`) y `medio`.
 * Devuelve los elementos asignados, con `historia` = id de la noticia.
 */
export function asignarPorSimilitud(historias, elementos, campo, { umbral = 0.3, maxPorHistoria = 4, unoPorMedio = true } = {}) {
  const textos = historias.map((h) => [h.titular, ...h.articulos.map((a) => a.titulo)].join('. '));
  const textoDe = (e) => `${e.titulo}. ${e.descripcion || ''}`;
  const df = new Map();
  for (const t of [...textos, ...elementos.map(textoDe)]) for (const p of palabras(t).keys()) df.set(p, (df.get(p) || 0) + 1);
  const n = textos.length + elementos.length;
  const vh = textos.map((t) => vector(t, df, n));
  // También se compara con cada titular por separado: una columna suele parecerse mucho a una nota puntual.
  const vt = historias.map((h) => h.articulos.map((a) => vector(a.titulo, df, n)));
  const asignados = [];
  for (const e of elementos) {
    const ve = vector(textoDe(e), df, n);
    let mejor = -1;
    let sim = 0;
    vh.forEach((x, i) => {
      const s = Math.max(coseno(ve, x), ...vt[i].map((t) => coseno(ve, t)));
      if (s > sim) { sim = s; mejor = i; }
    });
    if (mejor < 0 || sim < umbral) continue;
    const h = historias[mejor];
    h[campo] ||= [];
    if (h[campo].length >= maxPorHistoria) continue;
    if (unoPorMedio && h[campo].some((x) => x.medio === e.medio)) continue;
    h[campo].push(e);
    asignados.push({ ...e, historia: h.id });
  }
  return asignados;
}
