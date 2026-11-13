// Contraste: un solo archivo para las tres páginas (portada, ficha de una noticia y medios).

const LADOS = [
  ['izquierda', 'Izquierda'],
  ['centro', 'Centro'],
  ['derecha', 'Derecha'],
];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function haceCuanto(iso) {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (!Number.isFinite(min)) return '';
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}

const hora = (iso) => new Date(iso).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

async function cargar(nombre) {
  const r = await fetch(`datos/${nombre}.json`, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`No se pudo leer datos/${nombre}.json (${r.status})`);
  return r.json();
}

function barra(c) {
  const total = c.izquierda + c.centro + c.derecha || 1;
  const partes = LADOS.filter(([l]) => c[l] > 0).map(([l]) => `<i class="${l}" style="width:${(c[l] / total) * 100}%"></i>`).join('');
  const texto = LADOS.map(([l, n]) => `${c[l]} de ${n.toLowerCase()}`).join(', ');
  return `<div class="barra" role="img" aria-label="Medios que la cubren: ${texto}">${partes}</div>`;
}

function leyenda(c) {
  return `<div class="leyenda">${LADOS.map(([l, n]) => `<span><span class="punto ${l}"></span><b>${c[l]}</b> ${n.toLowerCase()}</span>`).join('')}</div>`;
}

function etiquetaCiego(h) {
  if (!h.soloCubre) return '';
  return `<span class="etiqueta ${h.soloCubre}">Solo la cubre la ${h.soloCubre}</span>`;
}

const enlaceFicha = (h) => `noticia.html?id=${encodeURIComponent(h.id)}`;

function tarjeta(h, { destacada = false } = {}) {
  const img = h.imagen ? `<img class="tarjeta-img" src="${esc(h.imagen)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : '';
  const Titulo = destacada ? 'h2' : 'h3';
  return `<a class="tarjeta${destacada ? ' destacada' : ''}${h.imagen ? ' con-img' : ''}" href="${enlaceFicha(h)}">
    ${img}
    <div class="tarjeta-cuerpo">
      <div class="meta"><span class="tema">${esc(h.temaNombre)}</span><span>·</span><span>${haceCuanto(h.actualizado)}</span></div>
      <${Titulo}>${esc(h.titular)}</${Titulo}>
      ${destacada && h.resumen ? `<p class="resumen">${esc(h.resumen)}</p>` : ''}
      <div class="tarjeta-pie">
        ${etiquetaCiego(h)}
        ${barra(h.cobertura)}
        <div class="meta"><span><b>${h.medios}</b> medios</span><span>·</span><span>primero: ${esc(h.primero.nombre)}</span>${h.videos?.length ? `<span>·</span><span>▶ ${h.videos.length} ${h.videos.length === 1 ? 'video' : 'videos'}</span>` : ''}</div>
      </div>
    </div>
  </a>`;
}

function filaSuelta(h) {
  const a = h.articulos[0];
  return `<a href="${esc(a.url)}" target="_blank" rel="noopener">
    <div class="meta"><span class="punto ${a.lado}"></span><b>${esc(a.nombre)}</b><span>·</span><span>${esc(h.temaNombre)}</span><span>·</span><span>${haceCuanto(a.fecha)}</span></div>
    <h3>${esc(a.titulo)}</h3>
  </a>`;
}

function avisoDemo(datos) {
  return datos.demo
    ? `<div class="aviso"><b>Datos de ejemplo.</b> Estas noticias son inventadas para probar el sitio. Con <code>npm run actualizar</code> se descargan las reales.</div>`
    : '';
}

function pie(generado) {
  const el = document.getElementById('actualizado');
  if (el && generado) el.textContent = `Actualizado ${haceCuanto(generado)} (${hora(generado)}).`;
}

// ---------- Portada ----------
async function portada() {
  const raiz = document.getElementById('contenido');
  const datos = await cargar('historias');
  const resumenHoy = await cargar('hoy').catch(() => null);
  const params = new URLSearchParams(location.search);
  const vista = document.body.dataset.vista; // 'portada' o 'ciegos'
  let tema = params.get('tema') || '';

  const pintar = () => {
    const filtro = (h) => !tema || h.tema === tema;
    let html = avisoDemo(datos);
    const temasConNotas = datos.temas.filter((t) => datos.historias.some((h) => h.tema === t.id));
    html += `<div class="temas" role="toolbar" aria-label="Filtrar por tema">
      <button type="button" data-tema="" aria-pressed="${!tema}">Todas</button>
      ${temasConNotas.map((t) => `<button type="button" data-tema="${t.id}" aria-pressed="${tema === t.id}">${esc(t.nombre)}</button>`).join('')}
    </div>`;

    if (vista !== 'ciegos' && !tema && resumenHoy?.bloques?.length) {
      html += `<a class="aviso-hoy" href="hoy.html">
        <span class="en-vivo"><i aria-hidden="true"></i>Ponete al día</span>
        <b>${esc(resumenHoy.titulo)}</b>
        <span>Lo importante de hoy en ${resumenHoy.minutos} ${resumenHoy.minutos === 1 ? 'minuto' : 'minutos'} →</span>
      </a>`;
    }
    if (vista === 'ciegos') {
      const lista = datos.historias.filter((h) => h.soloCubre && filtro(h));
      html += `<h1 class="seccion-titulo">Puntos ciegos</h1>
        <p class="seccion-sub">Noticias que publican varios medios de un lado y ninguno del otro.</p>`;
      for (const lado of ['izquierda', 'derecha']) {
        const deLado = lista.filter((h) => h.soloCubre === lado);
        html += `<h2 class="seccion-titulo"><span class="punto ${lado}"></span>Solo la cubre la ${lado}</h2>`;
        html += deLado.length ? `<div class="grilla">${deLado.map((h) => tarjeta(h)).join('')}</div>` : `<p class="seccion-sub">Nada por ahora.</p>`;
      }
    } else {
      const lista = datos.historias.filter(filtro);
      if (!lista.length) {
        html += `<div class="vacio-grande">Todavía no hay noticias publicadas por más de un medio${tema ? ' en este tema' : ''}.</div>`;
      } else {
        const [primera, ...resto] = lista;
        html += tarjeta(primera, { destacada: true });
        html += `<div class="grilla">${resto.map((h) => tarjeta(h)).join('')}</div>`;
      }
      const sueltas = datos.sueltas.filter(filtro).slice(0, 30);
      if (sueltas.length) {
        html += `<h2 class="seccion-titulo">Lo que publicó un solo medio</h2>
          <p class="seccion-sub">Notas recientes que todavía no aparecen en otros medios.</p>
          <div class="lista">${sueltas.map(filaSuelta).join('')}</div>`;
      }
    }
    raiz.innerHTML = html;
    raiz.querySelectorAll('[data-tema]').forEach((b) =>
      b.addEventListener('click', () => {
        tema = b.dataset.tema;
        const url = new URL(location.href);
        tema ? url.searchParams.set('tema', tema) : url.searchParams.delete('tema');
        history.replaceState(null, '', url);
        pintar();
      }),
    );
  };
  pintar();
  pie(datos.generado);
}

// ---------- Ficha de una noticia ----------
async function ficha() {
  const raiz = document.getElementById('contenido');
  const datos = await cargar('historias');
  const id = new URLSearchParams(location.search).get('id');
  const h = [...datos.historias, ...datos.sueltas].find((x) => x.id === id);
  if (!h) {
    raiz.innerHTML = `<div class="vacio-grande">Esta noticia ya no está en portada. <a href="./">Volver al inicio</a>.</div>`;
    return;
  }
  document.title = `${h.titular} · Contraste`;

  const historias = datos.historias;
  const conIA = Boolean(h.enfoques);

  // Cómo la cuenta cada lado: texto humano de la IA y, siempre, cómo tituló un medio de ese lado.
  const lados = LADOS.map(([l, n]) => {
    const arts = h.articulos.filter((a) => a.lado === l);
    if (!arts.length) {
      return `<div class="lado-card ${l} vacio-lado"><div class="lado-cab"><span class="punto ${l}"></span>${n}</div><p>Ningún medio de ${n.toLowerCase()} la publicó.${h.soloCubre ? ' Es un punto ciego para este lado.' : ''}</p></div>`;
    }
    const ejemplo = arts[0];
    return `<div class="lado-card ${l}">
      <div class="lado-cab"><span class="punto ${l}"></span>${n} <span class="lado-n">${arts.length} ${arts.length === 1 ? 'nota' : 'notas'}</span></div>
      ${conIA && h.enfoques[l] ? `<p>${esc(h.enfoques[l])}</p>` : ''}
      <blockquote><span>Así tituló ${esc(ejemplo.nombre)}:</span> «${esc(ejemplo.titulo)}»</blockquote>
    </div>`;
  }).join('');

  const hechos = h.hechos.length
    ? `<section class="caja"><h2>En qué coinciden</h2><ul>${h.hechos.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>`
    : '';
  const origen = h.ia
    ? `<p class="nota-pie">Titular y resumen redactados con IA a partir de los ${h.articulos.length} artículos de abajo. No verificamos los datos: leé las fuentes.</p>`
    : `<p class="nota-pie">Titular y bajada tomados de ${esc((h.articulos.find((a) => a.titulo === h.titular) || h.articulos[0]).nombre)}.</p>`;

  const columnas = LADOS.map(([l, n]) => {
    const arts = h.articulos.filter((a) => a.lado === l);
    return `<div class="columna"><h3><span class="punto ${l}"></span>${n} (${arts.length})</h3>
      ${arts.length ? arts.map((a) => `<a class="articulo" href="${esc(a.url)}" target="_blank" rel="noopener">
          <div class="medio">${esc(a.nombre)} · ${haceCuanto(a.fecha)}</div>
          <div class="titulo">${esc(a.titulo)}</div>
        </a>`).join('') : `<p class="vacio">Ningún medio de ${n.toLowerCase()} la publicó.</p>`}
    </div>`;
  }).join('');

  const videos = h.videos?.length
    ? `<h2 class="seccion-titulo">En video</h2>
       <p class="seccion-sub">Lo que publicaron los canales de los medios sobre esta noticia.</p>
       <div class="videos">${h.videos.map(tarjetaVideo).join('')}</div>`
    : '';

  const relacionadas = sigueLeyendo(h, historias);
  const indice = historias.findIndex((x) => x.id === h.id);
  const siguiente = historias[indice + 1] || (indice > 0 ? historias[0] : null);

  raiz.innerHTML = `${avisoDemo(datos)}
  <div class="ficha">
    <article>
      <div class="meta"><a href="./?tema=${esc(h.tema)}" class="tema">${esc(h.temaNombre)}</a><span>·</span><span>${hora(h.fecha)}</span></div>
      <h1>${esc(h.titular)}</h1>
      ${etiquetaCiego(h)}
      ${h.resumen ? `<p class="resumen">${esc(h.resumen)}</p>` : ''}
      ${origen}
      ${hechos}
      <h2 class="seccion-titulo">Cómo la cuenta cada lado</h2>
      <p class="seccion-sub">${conIA ? 'Qué pone en primer plano cada lado y cómo lo titula.' : 'Cómo la titula cada lado.'}</p>
      <div class="lados">${lados}</div>
      ${videos}
      <h2 class="seccion-titulo">Qué publicó cada medio</h2>
      <div class="columnas">${columnas}</div>
      ${relacionadas.length ? `<h2 class="seccion-titulo">Seguí leyendo</h2>
        <div class="grilla">${relacionadas.map((x) => tarjeta(x)).join('')}</div>` : ''}
      ${siguiente ? `<a class="boton-siguiente" href="${enlaceFicha(siguiente)}"><span>Siguiente noticia</span><b>${esc(siguiente.titular)}</b><i aria-hidden="true">→</i></a>` : ''}
    </article>
    <aside class="lateral">
      <section class="caja">
        <h2>Cobertura</h2>
        <div class="cifra">${h.medios} medios</div>
        <p class="nota-pie">la publicaron hasta ahora</p>
        ${barra(h.cobertura)}
        <div style="margin-top:10px">${leyenda(h.cobertura)}</div>
      </section>
      <section class="caja chat" id="chat" aria-label="Preguntale a la IA sobre esta noticia"></section>
      <section class="caja">
        <h2>Quién la publicó primero</h2>
        <ol class="linea-tiempo">
          ${[...new Map(h.articulos.map((a) => [a.medio, a])).values()].map((a) => `<li><time>${new Date(a.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</time><span><span class="punto ${a.lado}"></span>${esc(a.nombre)}</span></li>`).join('')}
        </ol>
      </section>
    </aside>
  </div>`;
  activarVideos(raiz);
  montarChat(document.getElementById('chat'), h);
  pie(datos.generado);
}

// ---------- Videos ----------
function tarjetaVideo(v) {
  return `<figure class="video" data-video="${esc(v.id)}">
    <button type="button" class="video-play" aria-label="Reproducir: ${esc(v.titulo)}">
      <img src="${esc(v.miniatura)}" alt="" loading="lazy" referrerpolicy="no-referrer">
      <span class="video-icono" aria-hidden="true">▶</span>
    </button>
    <figcaption><span class="punto ${v.lado}"></span><b>${esc(v.nombre)}</b> · ${haceCuanto(v.fecha)}<br>${esc(v.titulo)}</figcaption>
  </figure>`;
}

function activarVideos(raiz) {
  raiz.querySelectorAll('.video-play').forEach((b) => b.addEventListener('click', () => {
    const id = b.closest('[data-video]').dataset.video;
    const marco = document.createElement('iframe');
    marco.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`;
    marco.title = 'Video';
    marco.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    marco.allowFullscreen = true;
    marco.className = 'video-marco';
    b.replaceWith(marco);
  }));
}

// ---------- Seguí leyendo ----------
const palabrasClave = (t) => new Set(String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((p) => p.length > 4));

function sigueLeyendo(h, historias, cantidad = 4) {
  const mias = palabrasClave([h.titular, ...h.articulos.map((a) => a.titulo)].join(' '));
  return historias
    .filter((x) => x.id !== h.id)
    .map((x) => {
      let comunes = 0;
      for (const p of palabrasClave(x.titular)) if (mias.has(p)) comunes++;
      return { x, puntos: comunes * 3 + (x.tema === h.tema ? 2 : 0) + x.medios * 0.1 };
    })
    .sort((a, b) => b.puntos - a.puntos)
    .slice(0, cantidad)
    .map((r) => r.x);
}

// ---------- Chat ----------
let configChat;
async function urlChat() {
  if (configChat === undefined) {
    try {
      const r = await fetch('chat.json', { cache: 'no-cache' });
      configChat = r.ok ? (await r.json()).url || '' : '';
    } catch {
      configChat = '';
    }
  }
  return configChat;
}

function respuestasFijas(h) {
  const r = h.respuestas || {};
  const orden = [...new Map(h.articulos.map((a) => [a.medio, a])).values()];
  const primero = orden[0];
  const despues = orden.slice(1, 6).map((a) => a.nombre);
  const quien = `La publicó primero ${primero.nombre} (${primero.lado}), el ${hora(primero.fecha).replace(/\.$/, '')}.${despues.length ? ` Después la publicaron ${despues.join(', ')}${orden.length > 6 ? ' y otros' : ''}.` : ''}${r.origen ? `\n\n${r.origen}` : ''}`;
  const cadaLado = h.enfoques
    ? LADOS.filter(([l]) => h.enfoques[l]).map(([l, n]) => `${n}: ${h.enfoques[l]}`).join('\n\n')
    : LADOS.map(([l, n]) => {
      const a = h.articulos.find((x) => x.lado === l);
      return a ? `${n}: ${a.nombre} tituló «${a.titulo}».` : `${n}: ningún medio la publicó.`;
    }).join('\n\n');
  return [
    { pregunta: 'Explicámelo fácil', respuesta: r.facil },
    { pregunta: '¿Quién la publicó primero y de dónde salió?', respuesta: quien },
    { pregunta: '¿Qué cuenta cada lado?', respuesta: cadaLado },
    { pregunta: '¿Qué falta saber?', respuesta: r.faltaSaber },
  ];
}

async function montarChat(caja, h) {
  const url = await urlChat();
  const sugeridas = respuestasFijas(h).filter((s) => s.respuesta || url);
  const historial = [];
  const dictado = window.SpeechRecognition || window.webkitSpeechRecognition;

  caja.innerHTML = `
    <div class="chat-cab"><span class="chat-sello">IA</span><div><h2>Preguntale a la IA</h2><p class="nota-pie">Responde solo con lo que publicaron los medios. No opina.</p></div></div>
    <div class="chat-mensajes" aria-live="polite"></div>
    <div class="chat-sugeridas">${sugeridas.map((s, i) => `<button type="button" data-i="${i}">${esc(s.pregunta)}<span aria-hidden="true">→</span></button>`).join('')}</div>
    ${url ? `<form class="chat-form">
        <label class="sr" for="chat-texto">Tu pregunta sobre esta noticia</label>
        <textarea id="chat-texto" rows="2" maxlength="500" placeholder="Escribí tu pregunta sobre esta noticia"></textarea>
        ${dictado ? '<button type="button" class="chat-mic" aria-label="Dictar la pregunta" title="Dictar">🎙</button>' : ''}
        <button type="submit" class="chat-enviar" aria-label="Enviar">↑</button>
      </form>` : `<p class="nota-pie chat-off">Las preguntas libres se activan cuando se conecte el servidor del chat.</p>`}`;

  const lista = caja.querySelector('.chat-mensajes');
  const agregar = (rol, texto) => {
    const el = document.createElement('div');
    el.className = `chat-msg ${rol}`;
    el.textContent = texto;
    lista.appendChild(el);
    lista.scrollTop = lista.scrollHeight;
    return el;
  };

  const preguntar = async (pregunta, fija) => {
    agregar('usuario', pregunta);
    if (fija) {
      agregar('ia', fija);
      historial.push({ rol: 'usuario', texto: pregunta }, { rol: 'ia', texto: fija });
      return;
    }
    const espera = agregar('ia cargando', 'Leyendo las notas…');
    try {
      const r = await fetch(`${url.replace(/\/$/, '')}/preguntar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: h.id, pregunta, historial }),
      });
      const datos = await r.json();
      espera.classList.remove('cargando');
      espera.textContent = datos.respuesta || datos.error || 'No hubo respuesta.';
      if (datos.respuesta) historial.push({ rol: 'usuario', texto: pregunta }, { rol: 'ia', texto: datos.respuesta });
    } catch {
      espera.classList.remove('cargando');
      espera.textContent = 'No me pude conectar con el asistente. Probá de nuevo en un rato.';
    }
  };

  caja.querySelectorAll('.chat-sugeridas button').forEach((b) => b.addEventListener('click', () => {
    const s = sugeridas[Number(b.dataset.i)];
    b.remove();
    preguntar(s.pregunta, s.respuesta);
  }));

  const form = caja.querySelector('.chat-form');
  if (form) {
    const texto = form.querySelector('textarea');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = texto.value.trim();
      if (!q) return;
      texto.value = '';
      preguntar(q);
    });
    texto.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
    });
    const mic = form.querySelector('.chat-mic');
    if (mic) {
      mic.addEventListener('click', () => {
        const rec = new dictado();
        rec.lang = 'es-AR';
        rec.interimResults = false;
        mic.classList.add('activo');
        rec.onresult = (ev) => { texto.value = (texto.value + ' ' + ev.results[0][0].transcript).trim(); };
        rec.onend = () => mic.classList.remove('activo');
        rec.start();
      });
    }
  }
}

// ---------- Ponete al día ----------
async function hoy() {
  const raiz = document.getElementById('contenido');
  const datos = await cargar('hoy');
  const bloques = datos.bloques || [];
  raiz.innerHTML = `${avisoDemo(datos)}
    <div class="hoy">
      <header class="hoy-cab">
        <span class="en-vivo"><i aria-hidden="true"></i>Se actualiza cada 30 minutos</span>
        <h1>${esc(datos.titulo)}</h1>
        <p class="hoy-meta">Lectura de ${datos.minutos} ${datos.minutos === 1 ? 'minuto' : 'minutos'} · ${bloques.length} noticias · actualizado ${haceCuanto(datos.generado)}</p>
        <p class="resumen">${esc(datos.intro)}</p>
      </header>
      <ol class="hoy-lista">
        ${bloques.map((b, i) => `<li class="hoy-bloque" id="n${i + 1}">
          <div class="hoy-num" aria-hidden="true">${i + 1}</div>
          <div>
            <div class="meta"><span class="tema">${esc(b.tema || '')}</span><span>·</span><span>${b.medios} medios</span></div>
            <h2>${esc(b.titular)}</h2>
            <p>${esc(b.texto)}</p>
            ${b.porQueImporta ? `<p class="hoy-importa"><b>Por qué importa:</b> ${esc(b.porQueImporta)}</p>` : ''}
            ${b.cobertura ? barra(b.cobertura) : ''}
            <a class="hoy-mas" href="noticia.html?id=${encodeURIComponent(b.id)}">Cómo la cuenta cada medio →</a>
          </div>
        </li>`).join('')}
      </ol>
      ${datos.cierre ? `<p class="hoy-cierre">${esc(datos.cierre)}</p>` : ''}
      <p class="nota-pie">${datos.ia ? 'Escrito con IA a partir de lo que publicaron los medios; no verificamos los datos. Entrá a cada noticia para leer las fuentes.' : 'Titulares y bajadas tomados de los medios.'}</p>
    </div>
    <div class="progreso" aria-hidden="true"><i></i></div>`;
  const barraProgreso = raiz.querySelector('.progreso i');
  const actualizar = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    barraProgreso.style.width = `${max > 0 ? Math.min(100, (scrollY / max) * 100) : 100}%`;
  };
  addEventListener('scroll', actualizar, { passive: true });
  actualizar();
  pie(datos.generado);
}

// ---------- Medios ----------
async function medios() {
  const raiz = document.getElementById('contenido');
  const datos = await cargar('medios');
  const filas = LADOS.flatMap(([l]) => datos.medios.filter((m) => m.lado === l)).map((m) => `<tr>
      <td><a href="${esc(m.web)}" target="_blank" rel="noopener">${esc(m.nombre)}</a></td>
      <td><span class="punto ${m.lado}"></span>${esc(m.lado)}</td>
      <td>${m.ok ? `<span class="ok">Funciona</span> · ${m.notas} ${m.notas === 1 ? "nota" : "notas"}` : `<span class="error">Sin datos</span>${m.errores?.length ? `<div class="nota-pie">${esc(m.errores.join(' · '))}</div>` : ''}`}</td>
    </tr>`).join('');
  raiz.innerHTML = `${avisoDemo(datos)}
    <h1 class="seccion-titulo">Los medios que leemos</h1>
    <p class="seccion-sub">Leemos el RSS público de cada medio. La ubicación de cada uno (izquierda, centro o derecha) es una clasificación aproximada y discutible, pensada para comparar coberturas, no para calificar a nadie.</p>
    <div class="tabla-scroll"><table class="tabla">
      <thead><tr><th>Medio</th><th>Línea</th><th>Última lectura</th></tr></thead>
      <tbody>${filas}</tbody>
    </table></div>
    ${datos.videos?.length ? `<h2 class="seccion-titulo">Canales de video</h2>
      <p class="seccion-sub">Leemos el RSS público del canal de YouTube de cada medio y mostramos sus videos junto a la noticia de la que hablan.</p>
      <div class="tabla-scroll"><table class="tabla"><thead><tr><th>Canal</th><th>Medio</th><th>Última lectura</th></tr></thead><tbody>
      ${datos.videos.map((v) => `<tr><td><a href="https://www.youtube.com/${esc(v.handle)}" target="_blank" rel="noopener">${esc(v.handle)}</a></td><td>${esc(datos.medios.find((m) => m.id === v.medio)?.nombre || v.medio)}</td><td>${v.ok ? `<span class="ok">Funciona</span> · ${v.videos} videos en 48 h` : `<span class="error">Sin datos</span><div class="nota-pie">${esc(v.error)}</div>`}</td></tr>`).join('')}
      </tbody></table></div>` : ''}`;
  pie(datos.generado);
}

const paginas = { portada, ciegos: portada, ficha, medios, hoy };
(paginas[document.body.dataset.vista] || portada)().catch((e) => {
  document.getElementById('contenido').innerHTML = `<div class="vacio-grande">No se pudieron cargar las noticias. ${esc(e.message)}</div>`;
});
