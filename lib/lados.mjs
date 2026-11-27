// Lo que distingue a cada lado en una misma noticia: las palabras que usa solo ese lado y las cifras que da cada medio.

import { VACIAS, sinAcentos, palabras, mismoAsunto } from './texto.mjs';

const LADOS = ['izquierda', 'centro', 'derecha'];
// Palabras demasiado genéricas para decir algo sobre el enfoque.
const GENERICAS = new Set(['sobre', 'luego', 'durante', 'desde', 'entre', 'hasta', 'tiene', 'tienen', 'hacia', 'donde', 'cuando', 'quien', 'parte', 'forma', 'mismo', 'misma', 'otros', 'otras', 'nuevo', 'nueva', 'puede', 'pueden', 'segun', 'tambien', 'mientras', 'aunque', 'despues', 'antes', 'ahora', 'todos', 'todas', 'mucho', 'muchos', 'sigue', 'siguen', 'queda', 'quedan', 'hecho', 'hecha', 'semana', 'jueves', 'viernes', 'sabado', 'domingo', 'lunes', 'martes', 'miercoles', 'noviembre', 'octubre', 'millones', 'pesos', 'dolares', 'dólares', 'informo', 'registro', 'ubico', 'difundio', 'confirmo', 'anuncio', 'destaco', 'indico', 'explico', 'senalo', 'aseguro', 'afirmo', 'advirtio', 'sostuvo', 'agrego', 'realizo', 'realizan', 'informaron', 'confirmaron', 'anunciaron']);

function terminos(texto) {
  const salida = [];
  for (const m of String(texto).matchAll(/[\p{L}]{5,}/gu)) {
    const original = m[0];
    const clave = sinAcentos(original.toLowerCase());
    if (VACIAS.has(clave) || GENERICAS.has(clave)) continue;
    salida.push({ clave: clave.replace(/(es|s)$/, ''), forma: original.toLowerCase() });
  }
  return salida;
}

/**
 * Palabras que aparecen en las notas de un lado y en ninguna nota de los otros lados.
 * Solo tiene sentido si la noticia la cubren al menos dos lados. Devuelve { izquierda: [...], centro: [...], derecha: [...] }.
 */
export function palabrasPorLado(articulos, maximo = 5) {
  const porLado = Object.fromEntries(LADOS.map((l) => [l, new Map()]));
  for (const a of articulos) {
    for (const t of terminos(`${a.titulo} ${a.descripcion || ''}`)) {
      const m = porLado[a.lado];
      const previo = m.get(t.clave);
      m.set(t.clave, { forma: previo?.forma || t.forma, veces: (previo?.veces || 0) + 1, notas: new Set([...(previo?.notas || []), a.url]) });
    }
  }
  const conNotas = LADOS.filter((l) => porLado[l].size);
  if (conNotas.length < 2) return null;
  const salida = {};
  for (const l of LADOS) {
    const otros = LADOS.filter((x) => x !== l);
    salida[l] = [...porLado[l].entries()]
      .filter(([clave]) => otros.every((o) => !porLado[o].has(clave)))
      .sort((a, b) => b[1].notas.size - a[1].notas.size || b[1].veces - a[1].veces)
      .slice(0, maximo)
      .map(([, v]) => v.forma);
  }
  return salida;
}

const RE_CIFRA = /(?:US\$|u\$s|\$)\s?\d[\d.,]*(?:\s(?:mil\smillones|millones|billones|mil))?|\d[\d.,]*\s?%|\d[\d.,]*\s(?:mil\smillones|millones|billones|puntos(?:\sbásicos)?|personas|trabajadores|empleados|despidos|muertos|víctimas|heridos|detenidos|votos|diputados|senadores|km\/h|grados|toneladas|hectáreas)/giu;

const normalizarCifra = (c) => c.toLowerCase().replace(/u\$s/, 'us$').replace(/\s+/g, ' ').replace(/(\d)\s%/, '$1%').trim();

/** Cifras que mencionan los medios, con quién da cada una. [{ cifra, medios: [{ medio, nombre, lado }] }] */
export function cifrasPorMedio(articulos, nombres, maximo = 8) {
  const mapa = new Map();
  for (const a of articulos) {
    const texto = `${a.titulo} ${a.descripcion || ''}`;
    for (const m of texto.matchAll(RE_CIFRA)) {
      const cifra = normalizarCifra(m[0]);
      if (/^\d{1,2}%?$/.test(cifra.replace(/[.,]/g, '')) && !cifra.includes('%')) continue;
      const e = mapa.get(cifra) || { cifra: m[0].trim(), medios: [] };
      if (!e.medios.some((x) => x.medio === a.medio)) e.medios.push({ medio: a.medio, nombre: nombres[a.medio], lado: a.lado, url: a.url });
      mapa.set(cifra, e);
    }
  }
  return [...mapa.values()].sort((a, b) => b.medios.length - a.medios.length).slice(0, maximo);
}

const RE_OPINION = /\/(opinion|opiniones|columnistas?|editorial(es)?|contratapa|tribuna|ideas)\//i;

/** ¿Es una columna de opinión? Por la dirección o por la categoría del feed. */
export function esOpinion(nota) {
  return RE_OPINION.test(nota.url || '') || (nota.categorias || []).some((c) => /opini|editorial|columna|tribuna/i.test(c));
}

/**
 * Índice de contraste (0 a 100): qué tan distinto titulan la noticia la izquierda y la derecha.
 * Compara las palabras de los titulares y bajadas de cada lado (similitud coseno): si casi no comparten palabras,
 * cada lado está contando otra cosa. Solo se calcula si la cuentan los dos lados. Devuelve también el titular de
 * cada lado que más se diferencia del otro, para mostrarlos enfrentados.
 */
export function contrastePorLados(articulos, cobertura) {
  if (!cobertura.izquierda || !cobertura.derecha) return null;
  const vectorDe = (lista) => {
    const v = new Map();
    for (const a of lista) for (const [p, w] of palabras(`${a.titulo} ${a.descripcion || ''}`)) v.set(p, (v.get(p) || 0) + w);
    return v;
  };
  const coseno = (a, b) => {
    let s = 0;
    let na = 0;
    let nb = 0;
    for (const w of a.values()) na += w * w;
    for (const w of b.values()) nb += w * w;
    for (const [p, w] of a) if (b.has(p)) s += w * b.get(p);
    return na && nb ? s / Math.sqrt(na * nb) : 0;
  };
  const izq = articulos.filter((a) => a.lado === 'izquierda');
  const der = articulos.filter((a) => a.lado === 'derecha');
  const vIzq = vectorDe(izq);
  const vDer = vectorDe(der);
  const divergencia = 1 - coseno(vIzq, vDer);
  // Con pocos medios por lado la medición es menos confiable: pesa menos.
  const confianza = Math.min(1, (cobertura.izquierda + cobertura.derecha) / 4);
  const puntaje = Math.round(100 * divergencia * (0.6 + 0.4 * confianza));
  // Los titulares enfrentados tienen que hablar de lo mismo: compartir un nombre propio (persona, lugar, organismo)
  // o una palabra de tema concreta («inflación», no «Gobierno»). Entre esos pares se elige el que más se diferencia. Si ningún par comparte un nombre, no es contraste:
  // probablemente son noticias distintas, y no se muestra.
  let par = null;
  for (const a of izq) {
    for (const b of der) {
      if (!mismoAsunto(a.titulo, b.titulo)) continue;
      const s = coseno(vectorDe([a]), vectorDe([b]));
      if (!par || s < par.s) par = { a, b, s };
    }
  }
  if (!par) return null;
  const tIzq = par.a;
  const tDer = par.b;
  return {
    puntaje,
    izquierda: { medio: tIzq.medio, titulo: tIzq.titulo, url: tIzq.url },
    derecha: { medio: tDer.medio, titulo: tDer.titulo, url: tDer.url },
  };
}
