// Chat de Contraste: responde preguntas sobre una noticia usando solo las notas de los medios que la cubrieron.
// POST /preguntar  { id: "<id de la noticia>", pregunta: "...", historial?: [{ rol: "usuario"|"ia", texto }] }
// → { respuesta }

import Anthropic from '@anthropic-ai/sdk';

const MODELO = 'claude-opus-5-5';
const MAX_PREGUNTA = 500;
const MAX_HISTORIAL = 6;

const SISTEMA = `Sos el asistente de Contraste, un sitio que compara cómo cubren una misma noticia los medios argentinos de izquierda, centro y derecha.
Respondé preguntas sobre UNA noticia usando solo la información de las notas que te paso.
- Español rioplatense, claro, cálido y breve (hasta 120 palabras salvo que pidan más detalle).
- Cuando des un dato, decí qué medio lo publicó. Si los medios no coinciden, mostrá las versiones.
- Si la respuesta no está en las notas, decilo y sugerí leer las fuentes. No inventes ni completes con lo que sabés de antes.
- No opines ni digas quién tiene razón. Si te piden opinión, explicá qué dice cada lado.
- Si la pregunta no tiene que ver con la noticia, decí amablemente que solo podés hablar de esta noticia.`;

function cabecerasCors(env, origen) {
  const permitido = origen === env.ORIGEN_PERMITIDO || /^http:\/\/localhost(:\d+)?$/.test(origen || '');
  return {
    'Access-Control-Allow-Origin': permitido ? origen : env.ORIGEN_PERMITIDO,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(datos, estado, cors) {
  return new Response(JSON.stringify(datos), { status: estado, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors } });
}

async function buscarNoticia(env, id) {
  // Las noticias se leen del propio sitio; Cloudflare guarda la copia 5 minutos.
  const r = await fetch(`${env.SITIO}/datos/historias.json`, { cf: { cacheTtl: 300, cacheEverything: true } });
  if (!r.ok) throw new Error(`No pude leer las noticias (HTTP ${r.status})`);
  const datos = await r.json();
  return [...datos.historias, ...datos.sueltas].find((h) => h.id === id);
}

function contexto(h) {
  const notas = h.articulos
    .map((a) => `- [${a.lado}] ${a.nombre} (${a.fecha}): ${a.titulo}${a.descripcion ? `\n  ${a.descripcion}` : ''}`)
    .join('\n');
  return [
    `Noticia: ${h.titular}`,
    h.resumen && `Resumen: ${h.resumen}`,
    h.hechos?.length && `Hechos en común: ${h.hechos.join(' / ')}`,
    h.enfoques && `Cómo la cuenta cada lado: ${JSON.stringify(h.enfoques)}`,
    `Cobertura: ${h.cobertura.izquierda} medios de izquierda, ${h.cobertura.centro} de centro, ${h.cobertura.derecha} de derecha. La publicó primero ${h.primero.nombre}.`,
    `Notas publicadas:\n${notas}`,
  ].filter(Boolean).join('\n\n');
}

export default {
  async fetch(request, env) {
    const cors = cabecerasCors(env, request.headers.get('Origin'));
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (url.pathname !== '/preguntar' || request.method !== 'POST') return json({ error: 'No encontrado' }, 404, cors);

    let cuerpo;
    try {
      cuerpo = await request.json();
    } catch {
      return json({ error: 'El pedido no es JSON válido' }, 400, cors);
    }
    const pregunta = String(cuerpo?.pregunta || '').trim();
    const id = String(cuerpo?.id || '');
    if (!pregunta || !id) return json({ error: 'Falta la pregunta o la noticia' }, 400, cors);
    if (pregunta.length > MAX_PREGUNTA) return json({ error: `La pregunta puede tener hasta ${MAX_PREGUNTA} caracteres` }, 400, cors);

    try {
      const noticia = await buscarNoticia(env, id);
      if (!noticia) return json({ error: 'Esa noticia ya no está en el sitio' }, 404, cors);

      const historial = (Array.isArray(cuerpo.historial) ? cuerpo.historial : [])
        .slice(-MAX_HISTORIAL)
        .filter((m) => m && typeof m.texto === 'string' && (m.rol === 'usuario' || m.rol === 'ia'))
        .map((m) => ({ role: m.rol === 'usuario' ? 'user' : 'assistant', content: m.texto.slice(0, 2000) }));
      // La conversación tiene que empezar con un mensaje del usuario.
      while (historial.length && historial[0].role !== 'user') historial.shift();

      const cliente = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
      const respuesta = await cliente.beta.messages.create({
        model: MODELO,
        max_tokens: 2000,
        output_config: { effort: 'low' },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: `${SISTEMA}\n\n${contexto(noticia)}`,
        messages: [...historial, { role: 'user', content: pregunta }],
      });
      if (respuesta.stop_reason === 'refusal') return json({ respuesta: 'No puedo responder esa pregunta. Probá con otra sobre esta noticia.' }, 200, cors);
      const texto = respuesta.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
      console.log(JSON.stringify({ evento: 'pregunta', noticia: id, entrada: respuesta.usage.input_tokens, salida: respuesta.usage.output_tokens }));
      return json({ respuesta: texto || 'No encontré una respuesta en las notas de esta noticia.' }, 200, cors);
    } catch (e) {
      console.error(JSON.stringify({ evento: 'error', noticia: id, mensaje: e.message, estado: e.status }));
      const ocupado = e instanceof Anthropic.RateLimitError || e instanceof Anthropic.InternalServerError;
      return json({ error: ocupado ? 'El asistente está ocupado. Probá en un minuto.' : 'No pude responder ahora. Probá de nuevo.' }, ocupado ? 503 : 500, cors);
    }
  },
};
