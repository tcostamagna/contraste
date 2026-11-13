// Lector de RSS 2.0 y Atom sin dependencias. No es un parser XML completo: alcanza para los feeds de noticias,
// que son planos (<item> o <entry> con campos de texto).

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', laquo: '«', raquo: '»',
  ndash: '–', mdash: '—', hellip: '…', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', iexcl: '¡', iquest: '¿',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', uuml: 'ü',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', Uuml: 'Ü', deg: '°' };

export function decodificar(s) {
  return String(s ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTIDADES[n] ?? m);
}

function sinCdata(s) {
  return String(s ?? '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

/** Texto plano a partir de un fragmento que puede traer HTML escapado o en CDATA. */
export function textoPlano(s) {
  let t = sinCdata(s);
  // Algunos feeds escapan el HTML (&lt;p&gt;): se decodifica una vez, se quitan las etiquetas y se decodifica de nuevo.
  t = decodificar(t);
  t = t.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ');
  t = decodificar(t);
  return t.replace(/\s+/g, ' ').trim();
}

function campo(bloque, ...nombres) {
  for (const n of nombres) {
    const re = new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, 'i');
    const m = bloque.match(re);
    if (m && m[1].trim()) return m[1];
  }
  return '';
}

function atributo(bloque, etiqueta, attr, filtro) {
  const re = new RegExp(`<${etiqueta}\\b([^>]*)/?>`, 'gi');
  let m;
  while ((m = re.exec(bloque))) {
    const attrs = m[1];
    if (filtro && !filtro(attrs)) continue;
    const v = attrs.match(new RegExp(`\\b${attr}\\s*=\\s*"([^"]*)"|\\b${attr}\\s*=\\s*'([^']*)'`, 'i'));
    if (v) return decodificar(v[1] ?? v[2]);
  }
  return '';
}

function enlace(bloque) {
  // RSS: <link>url</link>. Atom: <link rel="alternate" href="..."/>.
  const rss = textoPlano(campo(bloque, 'link'));
  if (/^https?:\/\//.test(rss)) return rss;
  const atom = atributo(bloque, 'link', 'href', (a) => !/rel\s*=\s*["'](?!alternate)/i.test(a));
  if (atom) return atom;
  const guid = textoPlano(campo(bloque, 'guid', 'id'));
  return /^https?:\/\//.test(guid) ? guid : '';
}

function imagen(bloque) {
  const esImagen = (a) => !/type\s*=/.test(a) || /type\s*=\s*["']image/i.test(a);
  const directa =
    atributo(bloque, 'media:content', 'url', esImagen) ||
    atributo(bloque, 'media:thumbnail', 'url') ||
    atributo(bloque, 'enclosure', 'url', esImagen);
  if (directa) return directa;
  // Si no, la primera <img> dentro de la descripción o del contenido.
  const html = decodificar(sinCdata(campo(bloque, 'content:encoded', 'description', 'content', 'summary')));
  const m = html.match(/<img[^>]+src\s*=\s*["']([^"']+)["']/i);
  return m ? m[1] : '';
}

function fecha(bloque) {
  const t = textoPlano(campo(bloque, 'pubDate', 'dc:date', 'published', 'updated'));
  const ms = Date.parse(t);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/** Devuelve [{ titulo, url, fecha, descripcion, imagen, categorias }] */
export function leerFeed(xml) {
  const texto = String(xml ?? '');
  const bloques = texto.match(/<item\b[\s\S]*?<\/item>/gi) || texto.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  const salida = [];
  for (const b of bloques) {
    const titulo = textoPlano(campo(b, 'title'));
    const url = enlace(b);
    if (!titulo || !url) continue;
    const categorias = [...b.matchAll(/<category\b[^>]*?(?:term\s*=\s*["']([^"']*)["'][^>]*)?(?:\/>|>([\s\S]*?)<\/category>)/gi)]
      .map((m) => textoPlano(m[1] || m[2] || ''))
      .filter(Boolean);
    salida.push({
      titulo,
      url: url.trim(),
      fecha: fecha(b),
      descripcion: textoPlano(campo(b, 'description', 'summary', 'content')).slice(0, 600),
      imagen: imagen(b),
      categorias,
    });
  }
  return salida;
}
