// Clasificación por tema con palabras clave (sin acentos, en minúscula). Primero se mira la categoría que trae el
// feed; si no sirve, se cuentan coincidencias en titulares y bajadas del grupo.

import { sinAcentos } from './texto.mjs';

export const TEMAS = [
  { id: 'politica', nombre: 'Política', claves: ['milei', 'kicillof', 'cristina', 'kirchner', 'macri', 'bullrich', 'villarruel', 'francos', 'karina', 'congreso', 'diputados', 'senado', 'senador', 'diputado', 'peronismo', 'peronista', 'libertario', 'la libertad avanza', 'union por la patria', 'pro ', 'ucr', 'radical', 'gobernador', 'intendente', 'eleccion', 'electoral', 'campana', 'casa rosada', 'jefe de gabinete', 'ministro', 'oposicion', 'oficialismo', 'decreto', 'dnu', 'veto', 'ley ', 'politica'] },
  { id: 'economia', nombre: 'Economía', claves: ['dolar', 'inflacion', 'indec', 'ipc', 'caputo', 'bcra', 'banco central', 'reservas', 'fmi', 'riesgo pais', 'bonos', 'acciones', 'merval', 'tasa', 'plazo fijo', 'salario', 'jubilacion', 'jubilados', 'tarifa', 'precios', 'exportacion', 'importacion', 'cosecha', 'soja', 'pbi', 'recaudacion', 'impuesto', 'arca', 'afip', 'paritaria', 'deuda', 'cepo', 'mercado', 'empresa', 'economia', 'inversion'] },
  { id: 'internacional', nombre: 'Internacional', claves: ['trump', 'estados unidos', 'eeuu', 'china', 'rusia', 'ucrania', 'israel', 'gaza', 'iran', 'brasil', 'lula', 'chile', 'uruguay', 'paraguay', 'bolivia', 'venezuela', 'maduro', 'europa', 'union europea', 'papa ', 'vaticano', 'onu', 'otan', 'mexico', 'espana', 'francia', 'alemania', 'reino unido', 'internacional', 'el mundo'] },
  { id: 'policiales', nombre: 'Policiales y Justicia', claves: ['detenido', 'detuvieron', 'asesinato', 'crimen', 'homicidio', 'robo', 'asalto', 'policia', 'fiscal', 'juez', 'jueza', 'juicio', 'condena', 'condenado', 'causa', 'imputado', 'procesado', 'corte suprema', 'tribunal', 'justicia', 'allanamiento', 'narco', 'femicidio', 'policiales'] },
  { id: 'deportes', nombre: 'Deportes', claves: ['futbol', 'boca', 'river', 'racing', 'independiente', 'san lorenzo', 'seleccion', 'scaloni', 'messi', 'afa', 'liga profesional', 'copa', 'libertadores', 'gol', 'partido', 'torneo', 'tenis', 'formula 1', 'colapinto', 'rugby', 'pumas', 'basquet', 'nba', 'mundial', 'deportes', 'dt '] },
  { id: 'espectaculos', nombre: 'Cultura y espectáculos', claves: ['pelicula', 'serie', 'netflix', 'actor', 'actriz', 'cantante', 'musica', 'disco', 'recital', 'show', 'teatro', 'libro', 'escritor', 'festival', 'premio', 'grammy', 'oscar', 'tv', 'television', 'streaming', 'espectaculos', 'cultura', 'famosos'] },
  { id: 'tecnologia', nombre: 'Tecnología y ciencia', claves: ['inteligencia artificial', ' ia ', 'tecnologia', 'google', 'apple', 'microsoft', 'meta', 'whatsapp', 'celular', 'iphone', 'android', 'ciberataque', 'hackeo', 'conicet', 'cientifico', 'ciencia', 'espacio', 'nasa', 'satelite', 'startup', 'cripto', 'bitcoin'] },
  { id: 'salud', nombre: 'Salud', claves: ['salud', 'hospital', 'medico', 'medicos', 'vacuna', 'dengue', 'gripe', 'virus', 'enfermedad', 'paciente', 'pami', 'garrahan', 'obra social', 'prepaga', 'anmat', 'cancer'] },
  { id: 'sociedad', nombre: 'Sociedad', claves: ['educacion', 'escuela', 'universidad', 'docentes', 'clases', 'transporte', 'colectivo', 'tren', 'subte', 'clima', 'tormenta', 'lluvia', 'calor', 'frio', 'smn', 'alerta', 'protesta', 'marcha', 'paro', 'sindicato', 'cgt', 'vivienda', 'alquiler', 'barrio', 'sociedad'] },
];

const POR_ID = Object.fromEntries(TEMAS.map((t) => [t.id, t]));

function puntuar(texto) {
  const t = ' ' + sinAcentos(String(texto).toLowerCase()) + ' ';
  const puntos = {};
  for (const tema of TEMAS) {
    let n = 0;
    for (const c of tema.claves) {
      let desde = 0;
      let i;
      while ((i = t.indexOf(c, desde)) !== -1) { n++; desde = i + c.length; }
    }
    if (n) puntos[tema.id] = n;
  }
  return puntos;
}

/** Tema de un grupo de artículos: suma categorías del feed (peso 3) y palabras clave (peso 1). */
export function temaDe(articulos) {
  const total = {};
  for (const a of articulos) {
    const deCategorias = puntuar((a.categorias || []).join(' . '));
    for (const [id, n] of Object.entries(deCategorias)) total[id] = (total[id] || 0) + 3 * Math.min(n, 1);
    const deTexto = puntuar(`${a.titulo} . ${a.descripcion}`);
    for (const [id, n] of Object.entries(deTexto)) total[id] = (total[id] || 0) + n;
  }
  const mejor = Object.entries(total).sort((a, b) => b[1] - a[1])[0];
  return mejor ? mejor[0] : 'sociedad';
}

export const nombreTema = (id) => POR_ID[id]?.nombre ?? 'Sociedad';
