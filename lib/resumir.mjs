// Resumen neutral de una noticia con Claude (opcional). Solo corre si hay ANTHROPIC_API_KEY.
// Recibe los titulares y bajadas de cada medio y devuelve un titular neutral, un resumen, los hechos en común y cómo
// la enfoca cada lado. No verifica datos: trabaja solo con lo que publicaron los medios.

export const MODELO = process.env.MODELO_RESUMEN || 'claude-opus-5-5';

const ESQUEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['titular', 'resumen', 'hechos', 'enfoques'],
  properties: {
    titular: { type: 'string', description: 'Titular neutral, sin adjetivos valorativos, de 8 a 16 palabras.' },
    resumen: { type: 'string', description: 'Dos o tres oraciones que cuentan qué pasó, en tono neutral.' },
    hechos: { type: 'array', items: { type: 'string' }, description: 'De 2 a 4 hechos concretos en los que coinciden varios medios.' },
    enfoques: {
      type: 'object',
      additionalProperties: false,
      required: ['izquierda', 'centro', 'derecha'],
      properties: {
        izquierda: { type: ['string', 'null'], description: 'Una oración sobre qué destacan los medios de izquierda, o null si ninguno la cubre.' },
        centro: { type: ['string', 'null'], description: 'Una oración sobre qué destacan los medios de centro, o null si ninguno la cubre.' },
        derecha: { type: ['string', 'null'], description: 'Una oración sobre qué destacan los medios de derecha, o null si ninguno la cubre.' },
      },
    },
  },
};

const SISTEMA = `Sos editor de un sitio que compara cómo cubren la misma noticia los medios argentinos de distintas líneas editoriales.
Te paso los titulares y bajadas que publicó cada medio sobre un mismo hecho. Escribí en español rioplatense neutro, sin opinar.
- Usá solo información que aparezca en los textos. Si los medios se contradicen en un dato, decilo en vez de elegir uno.
- El titular y el resumen no toman partido ni copian el tono de ningún medio.
- En "enfoques", describí el ángulo de cada lado (qué resaltan, qué palabras eligen), no si tienen razón.`;

let clienteCache;
async function cliente() {
  if (!clienteCache) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    clienteCache = new Anthropic();
  }
  return clienteCache;
}

export const resumenDisponible = () => Boolean(process.env.ANTHROPIC_API_KEY);

/** @param articulos [{ medioNombre, lado, titulo, descripcion }] */
export async function resumir(articulos) {
  const c = await cliente();
  const lista = articulos
    .map((a) => `- [${a.lado}] ${a.medioNombre}: ${a.titulo}${a.descripcion ? `\n  ${a.descripcion.slice(0, 400)}` : ''}`)
    .join('\n');
  const respuesta = await c.beta.messages.create({
    model: MODELO,
    max_tokens: 4000,
    // Tarea corta y acotada: esfuerzo bajo alcanza y abarata cada corrida.
    output_config: { effort: 'low', format: { type: 'json_schema', schema: ESQUEMA } },
    // Si el modelo declina la solicitud, la API la reintenta sola con otro modelo.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SISTEMA,
    messages: [{ role: 'user', content: `Notas publicadas sobre el mismo hecho:\n\n${lista}` }],
  });
  if (respuesta.stop_reason === 'refusal') throw new Error('El modelo declinó resumir esta noticia');
  if (respuesta.stop_reason === 'max_tokens') throw new Error('La respuesta quedó cortada (max_tokens)');
  const texto = respuesta.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const datos = JSON.parse(texto);
  if (!datos.titular || !datos.resumen || !Array.isArray(datos.hechos)) throw new Error('Respuesta sin los campos esperados');
  return datos;
}
