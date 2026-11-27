#!/usr/bin/env node
// Genera las páginas HTML de public/ a partir de una sola plantilla (misma cabecera, menú y pie en todas).
//   node scripts/paginas.mjs
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Versión de los archivos: cambia en cada publicación para que el navegador no use un app.js o estilos.css viejos.
const VERSION = process.env.VERSION || String(Date.now());
const PUBLICO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const DESCRIPCION = 'La misma noticia contada por los medios argentinos de izquierda, centro y derecha: quién la publica, quién no, cómo la titula cada uno y qué opinan sus columnistas.';

const MENU = [
  ['./', 'portada', 'Portada'],
  ['hoy.html', 'hoy', 'Ponete al día'],
  ['puntos-ciegos.html', 'ciegos', 'Puntos ciegos'],
  ['opinion.html', 'opinion', 'Opinión'],
  ['medios.html', 'medios', 'Medios'],
  ['metodo.html', 'metodo', 'Cómo funciona'],
];

const PAGINAS = [
  ['index.html', 'portada', 'Contraste News · La misma noticia, contada por todos los medios'],
  ['hoy.html', 'hoy', 'Ponete al día · Contraste News'],
  ['puntos-ciegos.html', 'ciegos', 'Puntos ciegos · Contraste News'],
  ['opinion.html', 'opinion', 'Opinión · Contraste News'],
  ['medios.html', 'medios', 'Medios · Contraste News'],
  ['noticia.html', 'ficha', 'Noticia · Contraste News'],
  ['metodo.html', 'metodo', 'Cómo funciona · Contraste News'],
];

const plantilla = (vista, titulo) => `<!doctype html>
<html lang="es-AR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${titulo}</title>
  <meta name="description" content="${DESCRIPCION}">
  <meta name="theme-color" content="#111418">
  <meta property="og:title" content="${titulo}">
  <meta property="og:description" content="${DESCRIPCION}">
  <meta property="og:type" content="website">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Source+Serif+4:opsz,wght@8..60,500;8..60,600;8..60,700;8..60,800&display=swap">
  <link rel="stylesheet" href="estilos.css?v=${VERSION}">
</head>
<body data-vista="${vista}">
  <a class="saltar" href="#contenido">Ir al contenido</a>
  <header class="cabecera">
    <div class="cabecera-in">
      <a class="marca" href="./" aria-label="Contraste News, inicio">
        <span class="marca-icono" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="marca-texto">Contraste <em>News</em></span>
      </a>
      <form class="buscador" action="./" method="get" role="search">
        <label class="sr" for="q">Buscar noticias</label>
        <input id="q" name="q" type="search" placeholder="Buscar: Milei, dólar, Boca…" autocomplete="off">
      </form>
      <nav class="nav" aria-label="Secciones">
${MENU.map(([href, id, texto]) => `        <a href="${href}"${id === vista ? ' aria-current="page"' : ''}>${texto}</a>`).join('\n')}
      </nav>
    </div>
    <div class="ticker" id="ticker" hidden></div>
  </header>
  <main class="contenedor" id="contenido"><div class="cargando"><span></span><span></span><span></span></div></main>
  <footer class="pie">
    <div class="pie-in">
      <div>
        <a class="marca marca-pie" href="./"><span class="marca-icono" aria-hidden="true"><i></i><i></i><i></i></span><span class="marca-texto">Contraste <em>News</em></span></a>
        <p>La misma noticia, contada por todos los medios. Agrupamos automáticamente lo que publican los diarios argentinos en sus RSS públicos y siempre enlazamos a la nota original.</p>
      </div>
      <div>
        <p id="actualizado"></p>
        <p>La ubicación de cada medio en izquierda, centro o derecha es aproximada y discutible: mirala en <a href="medios.html">Medios</a>. <a href="metodo.html">Cómo funciona</a> · <a href="metodo.html#glosario">Glosario</a>.</p>
      </div>
    </div>
  </footer>
  <script src="app.js?v=${VERSION}" defer></script>
</body>
</html>
`;

for (const [archivo, vista, titulo] of PAGINAS) await writeFile(path.join(PUBLICO, archivo), plantilla(vista, titulo));
console.log(`Páginas generadas en ${PUBLICO}`);
