// Agrupa artículos de distintos medios que cuentan la misma noticia.
// Método: vectores TF-IDF del titular (peso doble) y la bajada, similitud coseno y agrupamiento voraz por orden de
// publicación, con una segunda pasada que une grupos muy parecidos. Sin modelos ni servicios externos.

import { createHash } from 'node:crypto';
import { palabras } from './texto.mjs';

export const PARAMETROS = {
  umbralUnir: 0.3, // similitud mínima entre un artículo y un grupo
  umbralFusion: 0.42, // similitud mínima para fusionar dos grupos ya formados
  ventanaHoras: 36, // un artículo no se une a un grupo cuya última nota es más vieja que esto
};

function vectorBruto(a) {
  const v = palabras(a.titulo, 2);
  for (const [p, w] of palabras(a.descripcion, 1)) v.set(p, (v.get(p) || 0) + w);
  return v;
}

function normalizar(v) {
  let n = 0;
  for (const w of v.values()) n += w * w;
  n = Math.sqrt(n) || 1;
  const r = new Map();
  for (const [p, w] of v) r.set(p, w / n);
  return r;
}

export function coseno(a, b) {
  const [chico, grande] = a.size < b.size ? [a, b] : [b, a];
  let s = 0;
  for (const [p, w] of chico) {
    const o = grande.get(p);
    if (o) s += w * o;
  }
  return s;
}

function sumar(destino, v, factor = 1) {
  for (const [p, w] of v) destino.set(p, (destino.get(p) || 0) + w * factor);
}

const ms = (iso) => (iso ? Date.parse(iso) : 0);

/**
 * @param articulos [{ id, medio, lado, titulo, descripcion, url, fecha, ... }]
 * @returns grupos [{ id, articulos: [...] }] (cada grupo con al menos un artículo)
 */
export function agrupar(articulos, parametros = PARAMETROS) {
  const p = { ...PARAMETROS, ...parametros };
  // IDF: una palabra que aparece en muchos artículos (p. ej. «gobierno») pesa menos que una rara («Starlink»).
  const brutos = articulos.map(vectorBruto);
  const df = new Map();
  for (const v of brutos) for (const palabra of v.keys()) df.set(palabra, (df.get(palabra) || 0) + 1);
  const N = articulos.length || 1;
  const vectores = brutos.map((v) => {
    const r = new Map();
    for (const [palabra, w] of v) r.set(palabra, w * Math.log(1 + N / df.get(palabra)));
    return normalizar(r);
  });

  const orden = articulos.map((_, i) => i).sort((i, j) => ms(articulos[i].fecha) - ms(articulos[j].fecha));
  const grupos = [];
  const ventana = p.ventanaHoras * 3600e3;

  for (const i of orden) {
    const a = articulos[i];
    const v = vectores[i];
    let mejor = null;
    let mejorSim = 0;
    for (const g of grupos) {
      if (ms(a.fecha) && g.ultima && ms(a.fecha) - g.ultima > ventana) continue;
      const sim = coseno(v, g.centroNorm);
      if (sim > mejorSim) { mejorSim = sim; mejor = g; }
    }
    if (mejor && mejorSim >= p.umbralUnir) {
      mejor.miembros.push(i);
      sumar(mejor.centro, v);
      mejor.centroNorm = normalizar(mejor.centro);
      mejor.ultima = Math.max(mejor.ultima, ms(a.fecha));
    } else {
      const centro = new Map(v);
      grupos.push({ miembros: [i], centro, centroNorm: normalizar(centro), primera: ms(a.fecha), ultima: ms(a.fecha) });
    }
  }

  // Segunda pasada: fusionar grupos que terminaron siendo la misma noticia (y que se solapan en el tiempo).
  const cercanos = (g, h) => !g.primera || !h.primera || (h.primera - g.ultima <= ventana && g.primera - h.ultima <= ventana);
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (let x = 0; x < grupos.length && !cambio; x++) {
      for (let y = x + 1; y < grupos.length; y++) {
        if (cercanos(grupos[x], grupos[y]) && coseno(grupos[x].centroNorm, grupos[y].centroNorm) >= p.umbralFusion) {
          grupos[x].miembros.push(...grupos[y].miembros);
          sumar(grupos[x].centro, grupos[y].centro);
          grupos[x].centroNorm = normalizar(grupos[x].centro);
          grupos[x].ultima = Math.max(grupos[x].ultima, grupos[y].ultima);
          grupos[x].primera = Math.min(grupos[x].primera, grupos[y].primera);
          grupos.splice(y, 1);
          cambio = true;
          break;
        }
      }
    }
  }

  return grupos.map((g) => {
    const arts = g.miembros.map((i) => articulos[i]).sort((a, b) => ms(a.fecha) - ms(b.fecha));
    // Cercanía de cada artículo al centro del grupo: sirve para elegir el titular más representativo.
    const cercania = new Map(g.miembros.map((i) => [articulos[i], coseno(vectores[i], g.centroNorm)]));
    return {
      // Identificador estable mientras el primer artículo del grupo siga siendo el mismo.
      id: createHash('sha1').update(arts[0].url).digest('hex').slice(0, 12),
      articulos: arts,
      representativo: [...cercania.entries()].sort((a, b) => b[1] - a[1])[0][0],
    };
  });
}
