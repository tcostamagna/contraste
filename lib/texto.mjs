// Normalización de texto en castellano para comparar titulares de distintos medios.

const VACIAS = new Set(`
a al algo algun alguna algunas alguno algunos ante antes aqui asi aun aunque bajo bien cada casi como con contra cual
cuales cuando cuanto de del desde donde dos el ella ellas ello ellos en entre era eran es esa esas ese eso esos esta
estaba estan estar estas este esto estos fue fueron ha habia han hasta hay la las le les lo los mas me mi mientras muy
nada ni no nos nosotros o otra otras otro otros para pero poco por porque que quien quienes se sea segun ser si sido
sin sino sobre son su sus tal tambien tan tanto te tiene tienen todo todos tras tu un una unas uno unos usted ya yo
dijo dice afirmo aseguro asegura explico sostuvo senalo advirtio anuncio confirmo revelo hoy ayer manana ahora asi
video videos foto fotos minuto vivo ultimo ultima ultimas ultimos momento nuevo nueva nuevos nuevas tras
cual cuales puede pueden podria hacer hace hizo dar da dio tener ver va van vez veces dia dias ano anos
argentina argentino argentinos argentinas pais
`.split(/\s+/).filter(Boolean));

export function sinAcentos(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Reducción mínima de plurales: «elecciones» y «eleccion» quedan iguales. */
function raiz(p) {
  if (p.length > 5 && p.endsWith('ces')) return p.slice(0, -3) + 'z';
  if (p.length > 5 && p.endsWith('es')) return p.slice(0, -2);
  if (p.length > 4 && p.endsWith('s')) return p.slice(0, -1);
  return p;
}

/**
 * Palabras útiles de un texto. Las que en el original empiezan con mayúscula (nombres propios, siglas) y no abren
 * la frase se marcan con peso extra, porque son las que mejor identifican una noticia.
 * Devuelve Map<palabra, peso>.
 */
export function palabras(texto, pesoBase = 1) {
  const pesos = new Map();
  const original = String(texto ?? '');
  const re = /[\p{L}\p{N}][\p{L}\p{N}%.,]*[\p{L}\p{N}%]|[\p{L}\p{N}]/gu;
  let m;
  let inicioFrase = true;
  while ((m = re.exec(original))) {
    const crudo = m[0];
    const antes = original.slice(Math.max(0, m.index - 2), m.index);
    if (/[.!?:]\s*$/.test(antes)) inicioFrase = true;
    let p = sinAcentos(crudo.toLowerCase()).replace(/[.,]/g, (c, i, s) => (/\d/.test(s[i - 1] || '') && /\d/.test(s[i + 1] || '') ? c : ''));
    const tieneDigito = /\d/.test(p);
    if ((!tieneDigito && p.length < 3) || VACIAS.has(p)) { inicioFrase = false; continue; }
    if (!tieneDigito) p = raiz(p);
    const propio = !inicioFrase && /^\p{Lu}/u.test(crudo);
    const peso = pesoBase * (propio ? 1.6 : 1) * (tieneDigito ? 1.3 : 1);
    pesos.set(p, (pesos.get(p) || 0) + peso);
    inicioFrase = false;
  }
  return pesos;
}

export function slug(s, max = 70) {
  return sinAcentos(String(s ?? '').toLowerCase())
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/, '');
}
