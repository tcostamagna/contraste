// Índice de solidez: qué tan respaldada está una noticia según lo que publicaron los medios.
// No verifica los hechos: mide cuántos medios y de qué lados la cuentan, si las cifras coinciden entre medios,
// si cita fuentes identificables o se apoya en trascendidos, y si el titular es de relleno.

const FUENTE_OFICIAL = /\b(INDEC|BCRA|Banco Central|Bolet[ií]n Oficial|comunicado|resoluci[oó]n|decreto|fallo|sentencia|fiscal[ií]a|juzgado|Corte Suprema|SMN|Servicio Meteorol[oó]gico|ANSES|ARCA|AFIP|vocero|vocera|parte oficial|informe oficial|datos oficiales|seg[uú]n (datos|el informe|un informe|el relevamiento|la encuesta|cifras)|oficializ[oó]|confirm[oó]|confirmaron|inform[oó] (el|la|que)|anunci[oó] oficialmente|en conferencia de prensa|declar[oó] ante)\b/i;
const CONDICIONAL = /\b(habr[ií]a|habr[ií]an|podr[ií]a|podr[ií]an|estar[ií]a|estar[ií]an|trascendi[oó]|trascendidos?|seg[uú]n fuentes|fuentes cercanas|fuentes oficiales que pidieron|versiones|rumor(es)?|se especula|especulaciones|no confirmad[oa]|sin confirmar|aseguran que|dicen que)\b/i;
const RELLENO = /(^|\b)(video|videos|fotos?|en vivo|minuto a minuto)\s*[:|-]|qu[eé] se sabe|lo que (hay|ten[eé]s) que saber|te contamos|^mir[aá]\b|\bmir[aá] (el|la|los|las|c[oó]mo|qu[eé])\b|las mejores frases|as[ií] reaccion|impactante|incre[ií]ble|no vas a creer|viral|explot[oó] (las )?redes|furor|la foto (que|de)|el video (que|de)|hor[oó]scopo|qui[eé]n es\b|cu[aá]nto (cuesta|sale|cobra)|c[oó]mo (ver|seguir) en vivo|d[oó]nde ver|a qu[eé] hora/i;

export const esRelleno = (titulo) => RELLENO.test(String(titulo || ''));

const NIVELES = [
  [75, 'solida', 'Muy corroborada'],
  [55, 'corroborada', 'Corroborada'],
  [35, 'poca', 'Poco corroborada'],
  [0, 'sin', 'Sin corroborar'],
];

/** Veredicto de una cifra según cuántos medios y lados la dan. */
export function veredictoCifra(cifra) {
  const lados = new Set(cifra.medios.map((m) => m.lado)).size;
  if (cifra.medios.length >= 3 && lados >= 2) return { id: 'corroborado', texto: `Corroborado: la dan ${cifra.medios.length} medios de ${lados} lados` };
  if (cifra.medios.length >= 2) return { id: 'coinciden', texto: `Coinciden ${cifra.medios.length} medios` };
  return { id: 'un-medio', texto: 'Lo da un solo medio' };
}

/**
 * @param articulos notas de la noticia ({ medio, lado, titulo, descripcion })
 * @param cobertura { izquierda, centro, derecha } (medios distintos por lado)
 * @param cifras [{ cifra, medios: [...] }]
 */
/** Nota citada como respaldo de una señal: medio, lado, enlace y la expresión que se encontró. */
const respaldo = (a, nombres, detalle) => ({ medio: a.medio, nombre: nombres?.[a.medio] || a.nombre || a.medio, lado: a.lado, url: a.url, titulo: a.titulo, detalle });

/**
 * @param nombres { idMedio: 'Nombre' } para mostrar las notas que respaldan cada señal
 */
export function solidez(articulos, cobertura, cifras = [], nombres = {}) {
  const medios = cobertura.izquierda + cobertura.centro + cobertura.derecha;
  const lados = ['izquierda', 'centro', 'derecha'].filter((l) => cobertura[l] > 0).length;
  const textos = articulos.map((a) => `${a.titulo} ${a.descripcion || ''}`);
  const notasConFuente = articulos.map((a, i) => [a, textos[i].match(FUENTE_OFICIAL)]).filter(([, m]) => m).map(([a, m]) => respaldo(a, nombres, m[0]));
  const notasCondicional = articulos.map((a, i) => [a, textos[i].match(CONDICIONAL)]).filter(([, m]) => m).map(([a, m]) => respaldo(a, nombres, m[0]));
  const conFuente = notasConFuente.length;
  const conCondicional = notasCondicional.length;
  const relleno = articulos.filter((a) => esRelleno(a.titulo)).length;
  const veredictos = cifras.map(veredictoCifra);
  const cifrasCorroboradas = veredictos.filter((v) => v.id !== 'un-medio').length;

  const senales = [];
  let puntos = Math.min(40, medios * 10);
  senales.push({ id: 'medios', estado: medios >= 3 ? 'ok' : medios === 2 ? 'medio' : 'mal', texto: medios === 1 ? 'La publicó un solo medio' : `La publicaron ${medios} medios distintos` });

  if (lados === 3) puntos += 20;
  else if (lados === 2) puntos += 10;
  senales.push({ id: 'lados', estado: lados === 3 ? 'ok' : lados === 2 ? 'medio' : 'mal', texto: lados === 3 ? 'La cuentan los tres lados' : lados === 2 ? 'La cuentan dos de los tres lados' : 'La cuenta un solo lado' });

  if (conFuente) {
    puntos += 15;
    senales.push({ id: 'fuente', estado: 'ok', texto: `Cita una fuente identificable (organismo, documento o vocero) en ${conFuente} de ${articulos.length} notas`, notas: notasConFuente });
  } else {
    senales.push({ id: 'fuente', estado: 'mal', texto: 'Ninguna nota nombra una fuente identificable en el titular o la bajada' });
  }

  if (cifras.length) {
    puntos += Math.round(15 * (cifrasCorroboradas / cifras.length));
    senales.push({
      id: 'cifras',
      estado: cifrasCorroboradas === cifras.length ? 'ok' : cifrasCorroboradas ? 'medio' : 'mal',
      texto: cifrasCorroboradas === cifras.length ? 'Todas las cifras las dan al menos dos medios' : `${cifrasCorroboradas} de ${cifras.length} cifras las dan al menos dos medios`,
    });
  }

  if (conCondicional) {
    const proporcion = conCondicional / articulos.length;
    puntos -= Math.round(25 * proporcion);
    senales.push({ id: 'condicional', estado: proporcion >= 0.5 ? 'mal' : 'medio', texto: `${conCondicional} de ${articulos.length} notas hablan en condicional o de trascendidos ("habría", "según fuentes")`, notas: notasCondicional });
  }

  const esDeRelleno = relleno / articulos.length >= 0.5;
  if (esDeRelleno) {
    puntos -= 15;
    senales.push({ id: 'relleno', estado: 'mal', texto: 'El titular parece de relleno (video, "lo que tenés que saber", "mirá")' });
  }

  const puntaje = Math.max(0, Math.min(100, puntos));
  const [, nivel, etiqueta] = NIVELES.find(([min]) => puntaje >= min);
  return { puntaje, nivel, etiqueta, senales, relleno: esDeRelleno, cifras: veredictos };
}
