// Textos con Claude (opcionales). Solo corren si hay ANTHROPIC_API_KEY.
// - resumir(): titular y resumen neutrales de una noticia, cómo la cuenta cada lado (en tono humano) y las respuestas
//   a las preguntas sugeridas del chat.
// - resumirDia(): el resumen «Hoy en 15 minutos» con las noticias más importantes del momento.
// Trabajan solo con lo que publicaron los medios: no verifican datos.

export const MODELO = process.env.MODELO_RESUMEN || 'claude-opus-5-5';

/** Cambiá este número si cambia el esquema: fuerza a rehacer los resúmenes guardados. */
export const VERSION_RESUMEN = 2;

const LADO = (que) => ({
  type: ['string', 'null'],
  description: `Dos o tres oraciones sobre cómo la cuentan los medios de ${que}, o null si ninguno de ese lado la publicó.`,
});

const ESQUEMA_NOTICIA = {
  type: 'object',
  additionalProperties: false,
  required: ['titular', 'resumen', 'hechos', 'enfoques', 'respuestas'],
  properties: {
    titular: { type: 'string', description: 'Titular neutral, sin adjetivos valorativos, de 8 a 16 palabras.' },
    resumen: { type: 'string', description: 'Dos o tres oraciones que cuentan qué pasó, en tono neutral.' },
    hechos: { type: 'array', items: { type: 'string' }, description: 'De 2 a 4 hechos concretos en los que coinciden varios medios.' },
    enfoques: {
      type: 'object',
      additionalProperties: false,
      required: ['izquierda', 'centro', 'derecha'],
      properties: { izquierda: LADO('izquierda'), centro: LADO('centro'), derecha: LADO('derecha') },
    },
    respuestas: {
      type: 'object',
      additionalProperties: false,
      required: ['facil', 'origen', 'faltaSaber'],
      properties: {
        facil: { type: 'string', description: 'La noticia explicada a alguien que no sigue la actualidad: qué pasó y por qué le puede importar. 3 a 5 oraciones simples, sin jerga.' },
        origen: { type: 'string', description: 'De dónde sale la información según los textos (organismo, documento, declaración, fuente anónima). Si los textos no lo dicen, decilo. 1 a 3 oraciones.' },
        faltaSaber: { type: 'string', description: 'Qué preguntas importantes quedan abiertas o en qué datos no coinciden los medios. 2 a 4 oraciones.' },
      },
    },
  },
};

const SISTEMA_NOTICIA = `Sos editor de Contraste, un sitio que compara cómo cubren la misma noticia los medios argentinos de distintas líneas editoriales.
Te paso los titulares y bajadas que publicó cada medio sobre un mismo hecho. Escribí en español rioplatense, claro y cálido, sin opinar.
- Usá solo información que aparezca en los textos. Si los medios se contradicen en un dato, decilo en vez de elegir uno.
- El titular y el resumen son neutrales: no toman partido ni copian el tono de ningún medio.
- En "enfoques", contalo como se lo contarías a un amigo que pregunta "¿y cómo lo están contando?": qué le preocupa o qué celebra cada lado, a quién ponen en el centro de la historia (los trabajadores, el Gobierno, los vecinos, el mercado) y qué palabras eligen. Nombrá algún medio como ejemplo. Describí el ángulo con empatía por los lectores de cada lado, sin decir quién tiene razón y sin caricaturizar.`;

const ESQUEMA_DIA = {
  type: 'object',
  additionalProperties: false,
  required: ['titulo', 'intro', 'bloques', 'cierre'],
  properties: {
    titulo: { type: 'string', description: 'Una frase que resuma el día, sin sensacionalismo, de hasta 12 palabras.' },
    intro: { type: 'string', description: 'Dos oraciones de bienvenida que anticipan los temas del día.' },
    bloques: {
      type: 'array',
      description: 'Una entrada por noticia, en el orden en que conviene leerlas.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'titular', 'texto', 'porQueImporta'],
        properties: {
          id: { type: 'string', description: 'El id de la noticia, copiado tal cual.' },
          titular: { type: 'string', description: 'Titular neutral y breve.' },
          texto: { type: 'string', description: 'De 3 a 5 oraciones con lo esencial, incluida cualquier diferencia relevante entre cómo la cuentan los medios.' },
          porQueImporta: { type: 'string', description: 'Una oración sobre por qué le importa a quien vive en Argentina.' },
        },
      },
    },
    cierre: { type: 'string', description: 'Una o dos oraciones de cierre, sin opinar.' },
  },
};

const SISTEMA_DIA = `Sos editor de Contraste, un sitio argentino que compara la cobertura de los medios de izquierda, centro y derecha.
Escribí «Hoy en 15 minutos»: un repaso de las noticias más importantes del momento para alguien que no tuvo tiempo de leer nada.
Español rioplatense, tono cercano y neutral, sin opinar. Usá solo lo que está en los datos que te paso.`;

let clienteCache;
async function cliente() {
  if (!clienteCache) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    clienteCache = new Anthropic();
  }
  return clienteCache;
}

export const resumenDisponible = () => Boolean(process.env.ANTHROPIC_API_KEY);

async function pedirJSON({ sistema, contenido, esquema, maxTokens, esfuerzo = 'low' }) {
  const c = await cliente();
  const respuesta = await c.beta.messages.create({
    model: MODELO,
    max_tokens: maxTokens,
    output_config: { effort: esfuerzo, format: { type: 'json_schema', schema: esquema } },
    // Si el modelo declina la solicitud, la API la reintenta sola con otro modelo.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: sistema,
    messages: [{ role: 'user', content: contenido }],
  });
  if (respuesta.stop_reason === 'refusal') throw new Error('El modelo declinó la solicitud');
  if (respuesta.stop_reason === 'max_tokens') throw new Error('La respuesta quedó cortada (max_tokens)');
  return JSON.parse(respuesta.content.filter((b) => b.type === 'text').map((b) => b.text).join(''));
}

/** @param articulos [{ medioNombre, lado, titulo, descripcion }] */
export async function resumir(articulos) {
  const lista = articulos
    .map((a) => `- [${a.lado}] ${a.medioNombre}: ${a.titulo}${a.descripcion ? `\n  ${a.descripcion.slice(0, 400)}` : ''}`)
    .join('\n');
  const datos = await pedirJSON({
    sistema: SISTEMA_NOTICIA,
    contenido: `Notas publicadas sobre el mismo hecho:\n\n${lista}`,
    esquema: ESQUEMA_NOTICIA,
    maxTokens: 6000,
  });
  if (!datos.titular || !datos.resumen || !Array.isArray(datos.hechos) || !datos.respuestas) throw new Error('Respuesta sin los campos esperados');
  return datos;
}

/** @param historias las más importantes del momento, ya ordenadas */
export async function resumirDia(historias) {
  const lista = historias
    .map((h) => `id: ${h.id}\ntema: ${h.temaNombre}\ncobertura: ${h.cobertura.izquierda} medios de izquierda, ${h.cobertura.centro} de centro, ${h.cobertura.derecha} de derecha\ntitular: ${h.titular}\nresumen: ${h.resumen}\n${h.enfoques ? `enfoques: ${JSON.stringify(h.enfoques)}\n` : ''}titulares de los medios:\n${h.articulos.slice(0, 6).map((a) => `  - [${a.lado}] ${a.nombre}: ${a.titulo}`).join('\n')}`)
    .join('\n\n');
  const datos = await pedirJSON({
    sistema: SISTEMA_DIA,
    contenido: `Noticias del momento, de la más a la menos importante:\n\n${lista}`,
    esquema: ESQUEMA_DIA,
    maxTokens: 12000,
  });
  if (!Array.isArray(datos.bloques) || !datos.bloques.length) throw new Error('Resumen del día vacío');
  return datos;
}
