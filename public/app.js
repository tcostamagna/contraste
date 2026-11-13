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
        <div class="meta"><span><b>${h.medios}</b> medios</span><span>·</span><span>primero: ${esc(h.primero.nombre)}</span></div>
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

  const enfoques = h.enfoques
    ? `<section class="caja"><h2>Cómo la cuenta cada lado</h2>
        ${LADOS.filter(([l]) => h.enfoques[l]).map(([l, n]) => `<div class="enfoque ${l}"><b>${n}</b>${esc(h.enfoques[l])}</div>`).join('')}
      </section>`
    : '';
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

  raiz.innerHTML = `${avisoDemo(datos)}
  <div class="ficha">
    <article>
      <div class="meta"><a href="./?tema=${esc(h.tema)}" class="tema">${esc(h.temaNombre)}</a><span>·</span><span>${hora(h.fecha)}</span></div>
      <h1>${esc(h.titular)}</h1>
      ${etiquetaCiego(h)}
      ${h.resumen ? `<p class="resumen">${esc(h.resumen)}</p>` : ''}
      ${origen}
      ${hechos}
      ${enfoques}
      <h2 class="seccion-titulo">Qué publicó cada medio</h2>
      <div class="columnas">${columnas}</div>
    </article>
    <aside class="lateral">
      <section class="caja">
        <h2>Cobertura</h2>
        <div class="cifra">${h.medios} medios</div>
        <p class="nota-pie">la publicaron hasta ahora</p>
        ${barra(h.cobertura)}
        <div style="margin-top:10px">${leyenda(h.cobertura)}</div>
      </section>
      <section class="caja">
        <h2>Quién la publicó primero</h2>
        <ol class="linea-tiempo">
          ${[...new Map(h.articulos.map((a) => [a.medio, a])).values()].map((a) => `<li><time>${new Date(a.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</time><span><span class="punto ${a.lado}"></span>${esc(a.nombre)}</span></li>`).join('')}
        </ol>
      </section>
    </aside>
  </div>`;
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
    </table></div>`;
  pie(datos.generado);
}

const paginas = { portada, ciegos: portada, ficha, medios };
(paginas[document.body.dataset.vista] || portada)().catch((e) => {
  document.getElementById('contenido').innerHTML = `<div class="vacio-grande">No se pudieron cargar las noticias. ${esc(e.message)}</div>`;
});
