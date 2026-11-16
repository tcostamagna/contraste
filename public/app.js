// Contraste: un solo archivo para todas las páginas. Lee los JSON de datos/ y arma cada vista.

const LADOS = [
  ['izquierda', 'Izquierda'],
  ['centro', 'Centro'],
  ['derecha', 'Derecha'],
];
const NOMBRE_LADO = Object.fromEntries(LADOS);

// ---------- Utilidades ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const sinAcentos = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

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
const hora = (iso) => new Date(iso).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace(/\.$/, '');
const ZONA = 'America/Argentina/Buenos_Aires';
const diaAR = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: ZONA });
/** «Hoy 14:30», «Ayer 21:10» o «sáb 14 nov, 09:00», siempre en hora argentina. */
function cuando(iso) {
  if (!iso) return '';
  const d = diaAR(iso);
  const hoy = diaAR(Date.now());
  const ayer = diaAR(Date.now() - 864e5);
  const hhmm = new Date(iso).toLocaleTimeString('es-AR', { timeZone: ZONA, hour: '2-digit', minute: '2-digit' });
  if (d === hoy) return `Hoy ${hhmm}`;
  if (d === ayer) return `Ayer ${hhmm}`;
  return new Date(iso).toLocaleString('es-AR', { timeZone: ZONA, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace(/\.$/, '');
}
/** Cuándo empezó la noticia y, si siguió otro día, que sigue. */
function cuandoNoticia(h) {
  const inicio = cuando(h.fecha);
  return h.actualizado && diaAR(h.actualizado) !== diaAR(h.fecha) && diaAR(h.actualizado) === diaAR(Date.now()) ? `${inicio} · sigue hoy` : inicio;
}
const sello = (h) => (h.solidez ? `<span class="sello s-${h.solidez.nivel}" title="${esc(h.solidez.etiqueta)}: índice de solidez ${h.solidez.puntaje} de 100"><b>${h.solidez.puntaje}</b>${esc(h.solidez.etiqueta)}</span>` : '');
const horaCorta = (iso) => new Date(iso).toLocaleTimeString('es-AR', { timeZone: ZONA, hour: '2-digit', minute: '2-digit' });

const cache = {};
function cargar(nombre) {
  cache[nombre] ||= fetch(`datos/${nombre}.json`, { cache: 'no-cache' }).then((r) => {
    if (!r.ok) throw new Error(`No se pudo leer datos/${nombre}.json (${r.status})`);
    return r.json();
  });
  return cache[nombre];
}

const enlaceFicha = (h) => `noticia.html?id=${encodeURIComponent(h.id || h)}`;
const raiz = () => document.getElementById('contenido');

function barra(c, grande = false) {
  const total = c.izquierda + c.centro + c.derecha || 1;
  const partes = LADOS.filter(([l]) => c[l] > 0).map(([l]) => `<i class="${l}" style="width:${(c[l] / total) * 100}%"></i>`).join('');
  const texto = LADOS.map(([l, n]) => `${c[l]} de ${n.toLowerCase()}`).join(', ');
  return `<div class="barra${grande ? ' grande' : ''}" role="img" aria-label="Medios que la cubren: ${texto}">${partes}</div>`;
}
const leyenda = (c) => `<div class="leyenda">${LADOS.map(([l, n]) => `<span><span class="punto ${l}"></span><b>${c[l]}</b> ${n.toLowerCase()}</span>`).join('')}</div>`;
const etiquetaCiego = (h) => (h.soloCubre ? `<span class="etiqueta ${h.soloCubre}">Solo la cuenta la ${h.soloCubre}</span>` : '');
const sinImagen = (clase) => `<div class="${clase}" aria-hidden="true"><i style="background:var(--izquierda)"></i><i style="background:var(--centro)"></i><i style="background:var(--derecha)"></i></div>`;
const imagen = (src, clase) => `<img class="${clase}" src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'${clase} tarjeta-sin-img'}))">`;

function tarjeta(h) {
  return `<a class="tarjeta" href="${enlaceFicha(h)}">
    ${h.imagen ? imagen(h.imagen, 'tarjeta-img') : sinImagen('tarjeta-sin-img')}
    <div class="tarjeta-cuerpo">
      <div class="meta"><span class="kicker">${esc(h.temaNombre)}</span><span>·</span><span>${cuandoNoticia(h)}</span></div>
      <h3>${esc(h.titular)}</h3>
      <div class="tarjeta-pie">
        <div class="meta">${sello(h)}${etiquetaCiego(h)}${h.videos?.length ? `<span class="etiqueta video">▶ ${plural(h.videos.length, 'video', 'videos')}</span>` : ''}${h.opiniones?.length ? `<span class="etiqueta video">✎ ${plural(h.opiniones.length, 'columna', 'columnas')}</span>` : ''}</div>
        ${barra(h.cobertura)}
        <div class="meta"><span><b>${h.medios}</b> medios</span><span>·</span><span>primero: ${esc(h.primero.nombre)}</span></div>
      </div>
    </div>
  </a>`;
}

function filaSuelta(h) {
  const a = h.articulos[0];
  return `<a href="${esc(a.url)}" target="_blank" rel="noopener">
    <div class="meta"><span class="punto ${a.lado}"></span><b>${esc(a.nombre)}</b><span>·</span><span>${esc(h.temaNombre)}</span><span>·</span><span>${cuando(a.fecha)}</span></div>
    <h3>${esc(a.titulo)}</h3>
  </a>`;
}

function columnaOpinion(c, historias) {
  const noticia = c.historia && historias?.find((h) => h.id === c.historia);
  return `<article class="columna-op ${c.lado}">
    <div class="autor"><span class="punto ${c.lado}"></span>${esc(c.nombre)}${c.autor ? ` · ${esc(c.autor)}` : ''}</div>
    <h3><a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.titulo)}</a></h3>
    ${c.descripcion ? `<p>${esc(c.descripcion.slice(0, 220))}${c.descripcion.length > 220 ? '…' : ''}</p>` : ''}
    <div class="meta">${cuando(c.fecha)}</div>
    ${noticia ? `<div class="sobre">Sobre: <a href="${enlaceFicha(noticia)}">${esc(noticia.titular)}</a></div>` : ''}
  </article>`;
}

function tarjetaVideo(v, historia) {
  return `<figure class="video" data-video="${esc(v.id)}">
    <button type="button" class="video-play" aria-label="Reproducir: ${esc(v.titulo)}">
      <img src="${esc(v.miniatura)}" alt="" loading="lazy" referrerpolicy="no-referrer">
      <span class="video-icono" aria-hidden="true">▶</span>
    </button>
    <figcaption><span class="punto ${v.lado}"></span><b>${esc(v.nombre)}</b> · ${cuando(v.fecha)}<br>${esc(v.titulo)}${historia ? `<br><a href="${enlaceFicha(historia)}">Ver la noticia →</a>` : ''}</figcaption>
  </figure>`;
}

function activarVideos(contenedor) {
  contenedor.querySelectorAll('.video-play').forEach((b) => b.addEventListener('click', () => {
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

const seccion = (titulo, contenido, { enlace, sub } = {}) => `<section class="seccion">
  <div class="seccion-cab"><h2>${titulo}</h2>${enlace ? `<a href="${enlace[0]}">${enlace[1]}</a>` : ''}</div>
  ${sub ? `<p class="seccion-sub">${sub}</p>` : ''}
  ${contenido}
</section>`;

const avisoDemo = (datos) => (datos.demo ? `<div class="aviso"><b>Datos de ejemplo.</b> Estas noticias son inventadas para probar el sitio.</div>` : '');

function pie(generado) {
  const el = document.getElementById('actualizado');
  if (el && generado) el.textContent = `Actualizado ${haceCuanto(generado)} (${hora(generado)}). Se renueva cada 30 minutos.`;
}

// Cinta de último momento en la cabecera: lo más reciente de todos los medios.
async function ticker() {
  const el = document.getElementById('ticker');
  if (!el) return;
  try {
    const d = await cargar('historias');
    const items = [...d.historias, ...d.sueltas]
      .map((h) => ({ h, a: [...h.articulos].sort((x, y) => Date.parse(y.fecha) - Date.parse(x.fecha))[0] }))
      .sort((x, y) => Date.parse(y.a.fecha) - Date.parse(x.a.fecha))
      .slice(0, 14);
    if (!items.length) return;
    const html = items.map(({ h, a }) => `<a href="${h.medios > 1 ? enlaceFicha(h) : esc(a.url)}"${h.medios > 1 ? '' : ' target="_blank" rel="noopener"'}><b>${horaCorta(a.fecha)}</b>${esc(a.nombre)}: ${esc(a.titulo)}</a>`).join('');
    el.innerHTML = `<span class="ticker-etiqueta">Último momento</span><div class="ticker-ventana"><div class="ticker-pista">${html}${html.replace(/<a /g, '<a tabindex="-1" aria-hidden="true" ')}</div></div>`;
    el.hidden = false;
  } catch {
    // La cinta es un adorno: si falla, no se muestra.
  }
}

// ---------- Portada ----------
async function portada() {
  const [datos, resumenHoy, opinion] = await Promise.all([cargar('historias'), cargar('hoy').catch(() => null), cargar('opinion').catch(() => null)]);
  const params = new URLSearchParams(location.search);
  let tema = params.get('tema') || '';
  const q = (params.get('q') || '').trim();
  const buscador = document.getElementById('q');
  if (buscador) buscador.value = q;

  const pintar = () => {
    const temasConNotas = datos.temas.filter((t) => datos.historias.some((h) => h.tema === t.id));
    let html = avisoDemo(datos);
    html += `<div class="chips" role="toolbar" aria-label="Filtrar por tema">
      <button type="button" data-tema="" aria-pressed="${!tema}">Todas</button>
      ${temasConNotas.map((t) => `<button type="button" data-tema="${t.id}" aria-pressed="${tema === t.id}">${esc(t.nombre)}</button>`).join('')}
    </div>`;

    if (q) {
      const palabras = sinAcentos(q).split(/\s+/).filter(Boolean);
      const coincide = (h) => {
        const texto = sinAcentos([h.titular, h.resumen, ...h.articulos.map((a) => a.titulo)].join(' '));
        return palabras.every((p) => texto.includes(p)) && (!tema || h.tema === tema);
      };
      const encontradas = [...datos.historias.filter(coincide), ...datos.sueltas.filter(coincide)];
      html += `<h1 class="titulo-pagina">Resultados para «${esc(q)}»</h1>
        <p class="seccion-sub">${plural(encontradas.length, 'noticia', 'noticias')} de las últimas 48 horas.</p>
        ${encontradas.length ? `<div class="grilla">${encontradas.map(tarjeta).join('')}</div>` : '<div class="vacio-grande">No encontramos noticias con esas palabras. Probá con otras.</div>'}`;
    } else if (tema) {
      const lista = datos.historias.filter((h) => h.tema === tema);
      html += `<h1 class="titulo-pagina">${esc(datos.temas.find((t) => t.id === tema)?.nombre || '')}</h1>
        ${lista.length ? `<div class="grilla">${lista.map(tarjeta).join('')}</div>` : '<div class="vacio-grande">No hay noticias de este tema publicadas por varios medios.</div>'}`;
      const sueltas = datos.sueltas.filter((h) => h.tema === tema).slice(0, 20);
      if (sueltas.length) html += seccion('Lo que publicó un solo medio', `<div class="lista">${sueltas.map(filaSuelta).join('')}</div>`);
    } else {
      const [primera, ...resto] = datos.historias;
      if (!primera) {
        html += '<div class="vacio-grande">Todavía no hay noticias publicadas por más de un medio.</div>';
      } else {
        const laterales = resto.slice(0, 4);
        html += `<div class="portada-top">
          <a class="principal${primera.imagen ? '' : ' sin-img'}" href="${enlaceFicha(primera)}">
            ${primera.imagen ? `<img src="${esc(primera.imagen)}" alt="" referrerpolicy="no-referrer" onerror="this.parentElement.classList.add('sin-img');this.remove()">` : ''}
            <div class="principal-texto">
              <div class="meta"><span class="kicker">${esc(primera.temaNombre)}</span><span>·</span><span>${cuandoNoticia(primera)}</span>${sello(primera)}</div>
              <h2>${esc(primera.titular)}</h2>
              ${primera.resumen ? `<p>${esc(primera.resumen.slice(0, 220))}${primera.resumen.length > 220 ? '…' : ''}</p>` : ''}
              ${barra(primera.cobertura, true)}
              <div class="meta"><span><b>${primera.medios}</b> medios la cuentan</span><span>·</span><span>primero: <b>${esc(primera.primero.nombre)}</b></span></div>
            </div>
          </a>
          <div class="laterales">${laterales.map((h) => `<a class="lateral-nota" href="${enlaceFicha(h)}">
            ${h.imagen ? `<img src="${esc(h.imagen)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'mini-sin-img'}))">` : sinImagen('mini-sin-img')}
            <div><div class="meta"><span class="kicker">${esc(h.temaNombre)}</span><span>·</span><span>${cuando(h.fecha)}</span></div><h3>${esc(h.titular)}</h3>${barra(h.cobertura)}</div>
          </a>`).join('')}</div>
        </div>`;

        if (resumenHoy?.bloques?.length) {
          html += `<a class="banda-hoy" href="hoy.html">
            <div class="reloj"><div><b>${resumenHoy.minutos}</b><small>min</small></div></div>
            <div><span class="en-vivo"><i aria-hidden="true"></i>Ponete al día</span><h2>Lo importante de hoy, en ${plural(resumenHoy.minutos, 'minuto', 'minutos')}</h2>
              <ol>${resumenHoy.bloques.slice(0, 3).map((b) => `<li>${esc(b.titular)}</li>`).join('')}</ol></div>
            <span class="ir">Empezar →</span>
          </a>`;
        }

        html += seccion('Más noticias', `<div class="grilla">${resto.slice(4, 16).map(tarjeta).join('')}</div>`, { sub: 'Ordenadas por cuántos medios las cuentan y qué tan recientes son.' });

        const ciegosIzq = datos.historias.filter((h) => h.soloCubre === 'izquierda').slice(0, 3);
        const ciegosDer = datos.historias.filter((h) => h.soloCubre === 'derecha').slice(0, 3);
        if (ciegosIzq.length || ciegosDer.length) {
          const col = (lado, lista) => `<div class="ciego-col ${lado}">
            <h3><span class="punto ${lado}"></span>Solo la cuenta la ${lado}</h3>
            <p>Si leés solo medios de ${lado === 'izquierda' ? 'derecha' : 'izquierda'}, esto no te llega.</p>
            ${lista.length ? lista.map((h) => `<a class="ciego-nota" href="${enlaceFicha(h)}"><h4>${esc(h.titular)}</h4><div class="meta">${plural(h.medios, 'medio', 'medios')} · ${cuandoNoticia(h)}</div></a>`).join('') : '<p>Nada por ahora.</p>'}
          </div>`;
          html += seccion('Puntos ciegos', `<div class="ciegos">${col('izquierda', ciegosIzq)}${col('derecha', ciegosDer)}</div>`, { enlace: ['puntos-ciegos.html', 'Ver todos →'] });
        }

        if (opinion?.columnas?.length) {
          const elegidas = [];
          for (const l of ['izquierda', 'centro', 'derecha']) elegidas.push(...opinion.columnas.filter((c) => c.lado === l).slice(0, 2));
          html += seccion('Opinión', `<div class="columnas-op">${elegidas.map((c) => columnaOpinion(c, datos.historias)).join('')}</div>`, { enlace: ['opinion.html', 'Todas las columnas →'], sub: 'Qué piensan los columnistas de cada lado.' });
        }

        const videos = datos.historias.flatMap((h) => (h.videos || []).map((v) => ({ v, h }))).sort((a, b) => Date.parse(b.v.fecha) - Date.parse(a.v.fecha)).slice(0, 12);
        if (videos.length) html += seccion('En video', `<div class="carrusel">${videos.map(({ v, h }) => tarjetaVideo(v, h)).join('')}</div>`, { sub: 'Lo último de los canales de los medios sobre las noticias del día.' });

        const sueltas = datos.sueltas.slice(0, 20);
        if (sueltas.length) html += seccion('Lo que publicó un solo medio', `<div class="lista">${sueltas.map(filaSuelta).join('')}</div>`, { sub: 'Notas recientes que todavía no aparecen en otros medios.' });
      }
    }

    raiz().innerHTML = html;
    activarVideos(raiz());
    raiz().querySelectorAll('[data-tema]').forEach((b) => b.addEventListener('click', () => {
      tema = b.dataset.tema;
      const url = new URL(location.href);
      tema ? url.searchParams.set('tema', tema) : url.searchParams.delete('tema');
      history.replaceState(null, '', url);
      pintar();
      scrollTo({ top: 0 });
    }));
  };
  pintar();
  pie(datos.generado);
}

// ---------- Puntos ciegos ----------
async function ciegos() {
  const datos = await cargar('historias');
  let html = `${avisoDemo(datos)}<h1 class="titulo-pagina">Puntos ciegos</h1>
    <p class="seccion-sub">Noticias que publican al menos dos medios de un lado y ninguno del otro. Lo que te perdés si leés solo a un lado.</p>`;
  const col = (lado) => {
    const lista = datos.historias.filter((h) => h.soloCubre === lado);
    return `<div class="ciego-col ${lado}">
      <h3><span class="punto ${lado}"></span>Solo la cuenta la ${lado} (${lista.length})</h3>
      <p>Ningún medio de ${lado === 'izquierda' ? 'derecha' : 'izquierda'} la publicó.</p>
      ${lista.length ? lista.map((h) => `<a class="ciego-nota" href="${enlaceFicha(h)}"><div class="meta"><span class="kicker">${esc(h.temaNombre)}</span></div><h4>${esc(h.titular)}</h4><div class="meta">${h.articulos.filter((a, i, arr) => arr.findIndex((x) => x.medio === a.medio) === i).map((a) => esc(a.nombre)).join(', ')} · ${cuandoNoticia(h)}</div></a>`).join('') : '<p>Nada por ahora.</p>'}
    </div>`;
  };
  html += `<div class="ciegos">${col('izquierda')}${col('derecha')}</div>`;
  raiz().innerHTML = html;
  pie(datos.generado);
}

// ---------- Opinión ----------
async function opinionPagina() {
  const [datos, historias] = await Promise.all([cargar('opinion'), cargar('historias')]);
  let lado = new URLSearchParams(location.search).get('lado') || '';
  const pintar = () => {
    const lista = datos.columnas.filter((c) => !lado || c.lado === lado);
    raiz().innerHTML = `${avisoDemo(datos)}<h1 class="titulo-pagina">Opinión</h1>
      <p class="seccion-sub">Columnas y editoriales de los medios de cada lado. Cuando hablan de una noticia del día, te llevamos a ver cómo la cuenta cada medio.</p>
      <div class="chips" role="toolbar" aria-label="Filtrar por lado">
        <button type="button" data-lado="" aria-pressed="${!lado}">Todos</button>
        ${LADOS.map(([l, n]) => `<button type="button" data-lado="${l}" aria-pressed="${lado === l}"><span class="punto ${l}"></span>${n}</button>`).join('')}
      </div>
      ${lista.length ? `<div class="columnas-op" style="margin-top:16px">${lista.map((c) => columnaOpinion(c, historias.historias)).join('')}</div>` : '<div class="vacio-grande">Todavía no hay columnas de este lado.</div>'}`;
    raiz().querySelectorAll('[data-lado]').forEach((b) => b.addEventListener('click', () => {
      lado = b.dataset.lado;
      const url = new URL(location.href);
      lado ? url.searchParams.set('lado', lado) : url.searchParams.delete('lado');
      history.replaceState(null, '', url);
      pintar();
    }));
  };
  pintar();
  pie(datos.generado);
}

// ---------- Ficha de una noticia ----------
const palabrasClave = (t) => new Set(sinAcentos(t).split(/[^a-z0-9]+/).filter((p) => p.length > 4));

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

const unaPorMedio = (arts) => arts.filter((a, i) => arts.findIndex((x) => x.medio === a.medio) === i);

async function ficha() {
  const datos = await cargar('historias');
  const id = new URLSearchParams(location.search).get('id');
  const h = [...datos.historias, ...datos.sueltas].find((x) => x.id === id);
  if (!h) {
    raiz().innerHTML = `<div class="vacio-grande">Esta noticia ya no está en portada. <a href="./">Volver al inicio</a>.</div>`;
    return;
  }
  document.title = `${h.titular} · Contraste`;
  const titularDe = h.articulos.find((a) => a.medio === h.titularDe) || h.articulos[0];

  const lados = LADOS.map(([l, n]) => {
    const arts = unaPorMedio(h.articulos.filter((a) => a.lado === l));
    if (!arts.length) {
      return `<div class="lado-card ${l}"><div class="lado-cab"><span class="punto ${l}"></span>${n}</div>
        <p class="lado-vacio">Ningún medio de ${n.toLowerCase()} la publicó.${h.soloCubre && h.soloCubre !== l ? ' Es un punto ciego para este lado.' : ''}</p></div>`;
    }
    const conBajada = arts.find((a) => a.descripcion);
    const palabras = h.palabras?.[l] || [];
    return `<div class="lado-card ${l}">
      <div class="lado-cab"><span class="punto ${l}"></span>${n}<span class="lado-n">${plural(arts.length, 'medio', 'medios')}</span></div>
      ${arts.slice(0, 2).map((a) => `<a class="titulo-lado" href="${esc(a.url)}" target="_blank" rel="noopener"><span>${esc(a.nombre)}</span>${esc(a.titulo)}</a>`).join('')}
      ${conBajada && conBajada.descripcion !== h.resumen ? `<p class="bajada-lado">${esc(conBajada.descripcion.slice(0, 200))}${conBajada.descripcion.length > 200 ? '…' : ''}</p>` : ''}
      ${palabras.length ? `<div><div class="palabras-tit">Palabras que usa solo este lado</div><div class="palabras">${palabras.map((p) => `<span class="palabra">${esc(p)}</span>`).join('')}</div></div>` : ''}
    </div>`;
  }).join('');

  const cifras = (h.cifras || []).filter((c) => h.medios > 1 || c.medios.length > 0);
  const columnas = LADOS.map(([l, n]) => {
    const arts = h.articulos.filter((a) => a.lado === l);
    return `<div class="columna"><h3><span class="punto ${l}"></span>${n} (${arts.length})</h3>
      ${arts.length ? arts.map((a) => `<a class="articulo" href="${esc(a.url)}" target="_blank" rel="noopener"><div class="medio">${esc(a.nombre)} · ${cuando(a.fecha)}</div><div class="titulo">${esc(a.titulo)}</div></a>`).join('') : `<p class="vacio">Ningún medio de ${n.toLowerCase()} la publicó.</p>`}
    </div>`;
  }).join('');

  const relacionadas = sigueLeyendo(h, datos.historias);
  const indice = datos.historias.findIndex((x) => x.id === h.id);
  const siguiente = datos.historias[indice + 1] || (indice !== 0 ? datos.historias[0] : null);
  const orden = unaPorMedio(h.articulos);

  raiz().innerHTML = `${avisoDemo(datos)}
  <div class="ficha">
    <article>
      <header class="ficha-cab">
        <div class="meta"><a href="./?tema=${esc(h.tema)}" class="kicker">${esc(h.temaNombre)}</a><span>·</span><span>Empezó ${cuando(h.fecha).replace(/^H/, 'h').replace(/^A/, 'a')}</span>${h.actualizado !== h.fecha ? `<span>·</span><span>última nota ${cuando(h.actualizado).replace(/^H/, 'h').replace(/^A/, 'a')}</span>` : ''}<span>·</span><span>${plural(h.medios, 'medio', 'medios')}</span></div>
        <h1>${esc(h.titular)}</h1>
        <div class="meta">${sello(h)}${etiquetaCiego(h)}</div>
        ${barra(h.cobertura, true)}
        ${leyenda(h.cobertura)}
        ${h.imagen ? `<img class="ficha-img" src="${esc(h.imagen)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}
        ${h.resumen ? `<p class="bajada">${esc(h.resumen)}</p><p class="fuente">Titular y bajada de ${esc(titularDe.nombre)}.</p>` : ''}
      </header>
      ${seccion('Cómo la cuenta cada lado', `<div class="lados">${lados}</div>`, { sub: 'Qué titula cada medio y qué palabras elige cada lado.' })}
      ${cifras.length ? seccion('Cifras en juego', `<div class="cifras">${cifras.map((c) => `<div class="cifra-fila"><div class="cifra-valor">${esc(c.cifra)}${c.veredicto ? `<span class="veredicto v-${c.veredicto.id}">${esc(c.veredicto.texto)}</span>` : ''}</div><div class="cifra-medios">${c.medios.map((m) => `<span><span class="punto ${m.lado}"></span>${esc(m.nombre)}</span>`).join('')}</div></div>`).join('')}</div>`, { sub: 'Los números que aparecen en los titulares y bajadas, y qué medio da cada uno.' }) : ''}
      ${h.opiniones?.length ? seccion('Qué opinan los columnistas', `<div class="columnas-op">${h.opiniones.map((c) => columnaOpinion(c)).join('')}</div>`, { sub: 'Columnas y editoriales sobre esta noticia.' }) : ''}
      ${h.videos?.length ? seccion('En video', `<div class="videos">${h.videos.map((v) => tarjetaVideo(v)).join('')}</div>`, { sub: 'Lo que publicaron los canales de los medios.' }) : ''}
      ${seccion('Qué publicó cada medio', `<div class="columnas">${columnas}</div>`)}
      ${relacionadas.length ? seccion('Seguí leyendo', `<div class="grilla">${relacionadas.map(tarjeta).join('')}</div>`) : ''}
      ${siguiente ? `<a class="boton-siguiente" href="${enlaceFicha(siguiente)}"><span>Siguiente noticia</span><b>${esc(siguiente.titular)}</b><i aria-hidden="true">→</i></a>` : ''}
    </article>
    <aside class="lateral">
      <section class="caja">
        <h2>Cobertura</h2>
        <div class="cifra-grande">${h.medios}</div>
        <p class="nota-pie">${h.medios === 1 ? 'medio la publicó' : 'medios la publicaron'}</p>
        ${barra(h.cobertura, true)}
        ${leyenda(h.cobertura)}
      </section>
      ${h.solidez ? `<section class="caja solidez s-${h.solidez.nivel}">
        <h2>¿Qué tan corroborada está?</h2>
        <div class="solidez-cifra"><b>${h.solidez.puntaje}</b><span>de 100</span><em>${esc(h.solidez.etiqueta)}</em></div>
        <div class="solidez-barra"><i style="width:${h.solidez.puntaje}%"></i></div>
        <ul class="senales">${h.solidez.senales.map((x) => `<li class="${x.estado}"><span aria-hidden="true">${x.estado === 'ok' ? '✓' : x.estado === 'medio' ? '~' : '✗'}</span>${esc(x.texto)}</li>`).join('')}</ul>
        <p class="nota-pie">No verificamos los hechos: medimos cuántos medios y de qué lados la cuentan, si las cifras coinciden, si citan fuentes identificables y si hablan de trascendidos.</p>
      </section>` : ''}
      <section class="caja preguntas" id="preguntas" aria-label="Preguntas rápidas sobre esta noticia"></section>
      <section class="caja">
        <h2>Quién la publicó primero</h2>
        <ol class="linea-tiempo">${orden.map((a) => `<li><time>${horaCorta(a.fecha)}</time><span><span class="punto ${a.lado}"></span>${esc(a.nombre)}</span></li>`).join('')}</ol>
      </section>
    </aside>
  </div>`;
  activarVideos(raiz());
  montarPreguntas(document.getElementById('preguntas'), h, datos.medios || []);
  pie(datos.generado);
}

// Preguntas rápidas: respuestas armadas con los datos de la noticia (sin IA).
function respuestas(h, catalogo) {
  const orden = unaPorMedio(h.articulos);
  const lista = [];
  lista.push({
    pregunta: '¿Quién la publicó primero?',
    respuesta: `<p>La publicó primero <b>${esc(orden[0].nombre)}</b> (${orden[0].lado}), el ${hora(orden[0].fecha)}.</p>
      ${orden.length > 1 ? `<p>Después la levantaron: ${orden.slice(1).map((a) => `${esc(a.nombre)} (${horaCorta(a.fecha)})`).join(', ')}.</p>` : '<p>Por ahora ningún otro medio la publicó.</p>'}`,
  });
  lista.push({
    pregunta: '¿Qué cuenta cada lado?',
    respuesta: LADOS.map(([l, n]) => {
      const a = h.articulos.find((x) => x.lado === l);
      const pal = h.palabras?.[l]?.slice(0, 3) || [];
      return a
        ? `<p><span class="punto ${l}"></span><b>${n}:</b> ${esc(a.nombre)} tituló «${esc(a.titulo)}».${pal.length ? ` Solo este lado habla de <i>${pal.map(esc).join(', ')}</i>.` : ''}</p>`
        : `<p><span class="punto ${l}"></span><b>${n}:</b> ningún medio la publicó.</p>`;
    }).join(''),
  });
  if (h.solidez) {
    lista.push({
      pregunta: '¿Está corroborada?',
      respuesta: `<p><b>${esc(h.solidez.etiqueta)}</b> (${h.solidez.puntaje} de 100).</p><ul>${h.solidez.senales.map((x) => `<li>${x.estado === 'ok' ? '✓' : x.estado === 'medio' ? '~' : '✗'} ${esc(x.texto)}</li>`).join('')}</ul>`,
    });
  }
  const presentes = new Set(h.articulos.map((a) => a.medio));
  const ausentes = catalogo.filter((m) => m.ok && !presentes.has(m.id));
  lista.push({
    pregunta: '¿Quién no la cuenta?',
    respuesta: ausentes.length
      ? `<p>De los medios que leemos, todavía no la publicaron:</p><ul>${LADOS.map(([l, n]) => {
        const del = ausentes.filter((m) => m.lado === l);
        return del.length ? `<li><span class="punto ${l}"></span><b>${n}:</b> ${del.map((m) => esc(m.nombre)).join(', ')}</li>` : '';
      }).join('')}</ul>${h.soloCubre ? `<p>Es un <b>punto ciego</b>: solo la cuentan medios de ${h.soloCubre}.</p>` : ''}`
      : '<p>La publicaron todos los medios que leemos.</p>',
  });
  if (h.cifras?.length) {
    lista.push({
      pregunta: '¿Qué cifras dan?',
      respuesta: `<ul>${h.cifras.slice(0, 6).map((c) => `<li><b>${esc(c.cifra)}</b>: ${c.medios.map((m) => esc(m.nombre)).join(', ')}</li>`).join('')}</ul><p>Si dos medios dan números distintos para lo mismo, conviene leer las dos notas.</p>`,
    });
  }
  if (h.opiniones?.length) {
    lista.push({
      pregunta: '¿Qué opinan los columnistas?',
      respuesta: `<ul>${h.opiniones.map((c) => `<li><span class="punto ${c.lado}"></span><b>${esc(c.nombre)}${c.autor ? ` (${esc(c.autor)})` : ''}:</b> <a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.titulo)}</a></li>`).join('')}</ul>`,
    });
  }
  if (h.videos?.length) {
    lista.push({
      pregunta: '¿Hay videos?',
      respuesta: `<p>Sí, ${plural(h.videos.length, 'video', 'videos')}: ${h.videos.map((v) => `${esc(v.nombre)} («${esc(v.titulo)}»)`).join('; ')}. Están más abajo, en «En video».</p>`,
    });
  }
  return lista;
}

function montarPreguntas(caja, h, catalogo) {
  const lista = respuestas(h, catalogo);
  caja.innerHTML = `
    <div class="preguntas-cab"><span class="preguntas-sello" aria-hidden="true">?</span><div><h2>Preguntas rápidas</h2><p>Respuestas armadas con lo que publicó cada medio.</p></div></div>
    <div class="respuestas" aria-live="polite"></div>
    <div class="sugeridas">${lista.map((s, i) => `<button type="button" data-i="${i}">${esc(s.pregunta)}<span aria-hidden="true">→</span></button>`).join('')}</div>`;
  const zona = caja.querySelector('.respuestas');
  caja.querySelectorAll('.sugeridas button').forEach((b) => b.addEventListener('click', () => {
    const s = lista[Number(b.dataset.i)];
    b.remove();
    zona.insertAdjacentHTML('beforeend', `<div class="msg yo">${esc(s.pregunta)}</div><div class="msg resp">${s.respuesta}</div>`);
    zona.scrollTop = zona.scrollHeight;
  }));
}

// ---------- Ponete al día ----------
async function hoy() {
  const datos = await cargar('hoy');
  const bloques = datos.bloques || [];
  raiz().innerHTML = `${avisoDemo(datos)}
    <div class="hoy">
      <header class="hoy-cab">
        <span class="en-vivo"><i aria-hidden="true"></i>En vivo · se renueva cada 30 minutos</span>
        <h1 class="titulo-pagina">Lo importante de hoy</h1>
        <div class="hoy-meta"><span>⏱ ${plural(datos.minutos, 'minuto', 'minutos')} de lectura</span><span>${plural(bloques.length, 'noticia', 'noticias')}</span><span>Actualizado ${haceCuanto(datos.generado)}</span></div>
        <p class="hoy-intro">${esc(datos.intro)}</p>
      </header>
      ${bloques.length ? `<nav class="hoy-indice" aria-label="Ir a una noticia">${bloques.map((_, i) => `<a href="#n${i + 1}">${i + 1}</a>`).join('')}</nav>` : ''}
      <ol class="hoy-lista">
        ${bloques.map((b, i) => `<li class="hoy-bloque" id="n${i + 1}">
          ${b.imagen ? `<img src="${esc(b.imagen)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}
          <div class="hoy-cuerpo">
            <div class="hoy-num" aria-hidden="true">${i + 1}</div>
            <div>
              <div class="meta"><span class="kicker">${esc(b.tema || '')}</span><span>·</span><span>${cuando(b.fecha)}</span><span>·</span><span>${plural(b.medios, 'medio', 'medios')}</span>${sello(b)}${b.soloCubre ? `<span class="etiqueta ${b.soloCubre}">Solo la cuenta la ${b.soloCubre}</span>` : ''}</div>
              <h2>${esc(b.titular)}</h2>
              ${b.texto ? `<p>${esc(b.texto)}</p>` : ''}
              ${b.mas ? `<div class="otra-mirada ${b.mas.lado}"><b>Otra mirada · ${esc(b.mas.nombre)}</b>${esc(b.mas.texto)}</div>` : ''}
              <div class="asi-titulan">${LADOS.map(([l, n]) => `<div><b><span class="punto ${l}"></span>${n}</b>${b.lados[l] ? `<span>«${esc(b.lados[l].titulo)}» <small class="nota-pie">${esc(b.lados[l].nombre)}</small></span>` : '<span class="falta">No la cuenta</span>'}</div>`).join('')}</div>
              ${b.cobertura ? barra(b.cobertura) : ''}
              <a class="hoy-mas" href="${enlaceFicha(b.id)}">Ver cómo la cuenta cada medio →</a>
            </div>
          </div>
        </li>`).join('')}
      </ol>
      ${bloques.length ? '<p class="vacio-grande" style="padding:20px 0">Ya estás al día. 👏</p>' : ''}
    </div>
    <div class="progreso" aria-hidden="true"><i></i></div>`;
  const barraProgreso = raiz().querySelector('.progreso i');
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
  const datos = await cargar('medios');
  const filas = LADOS.flatMap(([l]) => datos.medios.filter((m) => m.lado === l)).map((m) => `<tr>
      <td><a href="${esc(m.web)}" target="_blank" rel="noopener"><b>${esc(m.nombre)}</b></a></td>
      <td><span class="punto ${m.lado}"></span>${NOMBRE_LADO[m.lado]}</td>
      <td>${m.ok ? `<span class="ok">Funciona</span> · ${plural(m.notas, 'nota', 'notas')}` : `<span class="error">Sin datos</span>${m.errores?.length ? `<div class="nota-pie">${esc(m.errores.join(' · '))}</div>` : ''}`}</td>
      <td>${m.opinion ? plural(m.opinion, 'columna', 'columnas') : '<span class="nota-pie">—</span>'}</td>
    </tr>`).join('');
  raiz().innerHTML = `${avisoDemo(datos)}
    <h1 class="titulo-pagina">Los medios que leemos</h1>
    <p class="seccion-sub">Leemos el RSS público de cada medio. La ubicación de cada uno en izquierda, centro o derecha es aproximada y discutible: sirve para comparar coberturas, no para calificar a nadie.</p>
    <div class="tabla-scroll"><table class="tabla">
      <thead><tr><th>Medio</th><th>Línea</th><th>Noticias</th><th>Opinión</th></tr></thead>
      <tbody>${filas}</tbody>
    </table></div>
    ${datos.videos?.length ? seccion('Canales de video', `<div class="tabla-scroll"><table class="tabla"><thead><tr><th>Canal</th><th>Medio</th><th>Última lectura</th></tr></thead><tbody>
      ${datos.videos.map((v) => `<tr><td><a href="https://www.youtube.com/${esc(v.handle)}" target="_blank" rel="noopener">${esc(v.handle)}</a></td><td>${esc(datos.medios.find((m) => m.id === v.medio)?.nombre || v.medio)}</td><td>${v.ok ? `<span class="ok">Funciona</span> · ${plural(v.videos, 'video', 'videos')} en 48 h` : `<span class="error">Sin datos</span><div class="nota-pie">${esc(v.error)}</div>`}</td></tr>`).join('')}
      </tbody></table></div>`, { sub: 'Leemos el RSS público del canal de YouTube de cada medio y mostramos sus videos junto a la noticia de la que hablan.' }) : ''}`;
  pie(datos.generado);
}

const paginas = { portada, ciegos, ficha, medios, hoy, opinion: opinionPagina };
ticker();
(paginas[document.body.dataset.vista] || portada)().catch((e) => {
  raiz().innerHTML = `<div class="vacio-grande">No se pudieron cargar las noticias. ${esc(e.message)}</div>`;
});
