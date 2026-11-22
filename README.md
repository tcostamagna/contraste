# Contraste News

La misma noticia, contada por todos los medios argentinos. Contraste News lee los RSS públicos de diarios de distintas líneas editoriales, agrupa las notas que hablan del mismo hecho y muestra:

- **Cobertura**: cuántos medios de izquierda, centro y derecha la publicaron.
- **Quién la publicó primero** y en qué orden la levantaron los demás.
- **Puntos ciegos**: noticias que publican varios medios de un lado y ninguno del otro.
- **Qué publicó cada medio**, con enlace a la nota original.
- **Ponete al día** (`hoy.html`): las noticias más cubiertas de las últimas 24 horas, con otra mirada y cómo la titula cada lado, y el tiempo de lectura.
- **Cómo la cuenta cada lado**: titulares y bajadas de cada lado y las palabras que usa solo ese lado.
- **Cifras en juego**: los números que aparecen en las notas y qué medio da cada uno.
- **Opinión** (`opinion.html`): columnas y editoriales de cada lado, también dentro de cada noticia.
- **Preguntas rápidas**: quién la publicó primero, qué cuenta cada lado, quién no la cuenta, qué cifras dan.
- **Videos** de los canales de YouTube de los medios, junto a la noticia de la que hablan (`config/videos.json`).
- **Seguí leyendo**, botón a la siguiente noticia, buscador y cinta de último momento.

No usa servicios pagos ni inteligencia artificial: todo sale de los RSS públicos de los medios y de sus canales de YouTube.

## Probarlo en tu computadora

Hace falta Node.js 20 o superior.

```bash
npm install
npm run demo      # genera noticias de EJEMPLO (inventadas), sin conexión
npm run servir    # abre http://localhost:4000
```

Para usar noticias reales:

```bash
npm run actualizar
```

## Publicarlo solo (GitHub Actions + GitHub Pages)

El workflow `.github/workflows/publicar.yml` descarga las noticias, las agrupa y publica `public/` en GitHub Pages cada 30 minutos. Como el reloj de GitHub es poco confiable (en la práctica corre cada varias horas), cada corrida programa la siguiente: espera hasta completar media hora y la lanza. El reloj queda como respaldo, por si la cadena se corta. En un repositorio público, GitHub Actions no tiene costo.

El sitio muestra solo noticias que empezaron en las últimas 24 horas y no cubre deportes ni espectáculos.

1. En **Settings → Pages**, elegí **Source: GitHub Actions**.
2. En **Settings → Actions → General**, dejá habilitadas las Actions.
3. En **Actions → Actualizar y publicar → Run workflow** lo podés correr a mano la primera vez.

## Cómo funciona

| Paso | Archivo |
|---|---|
| Lista de medios, su línea y sus feeds | `config/medios.json` |
| Lectura de RSS y Atom (sin dependencias) | `lib/rss.mjs` |
| Agrupar notas del mismo hecho: TF-IDF del titular y la bajada, similitud coseno, ventana de 36 h | `lib/agrupar.mjs` |
| Tema por categoría del feed y palabras clave | `lib/temas.mjs` |
| Palabras por lado, cifras y detección de columnas de opinión | `lib/lados.mjs` |
| Videos de YouTube y asignación de videos y columnas a cada noticia | `lib/videos.mjs`, `lib/asignar.mjs` |
| Páginas HTML (una sola plantilla: `node scripts/paginas.mjs`) | `scripts/paginas.mjs` |
| Todo junto; escribe `public/datos/*.json` | `scripts/actualizar.mjs` |
| Sitio estático (HTML, CSS y JS sin frameworks) | `public/` |

Las notas de las últimas 72 horas se guardan en `datos/archivo.json` (en GitHub, en la caché del workflow), así una noticia sigue agrupada aunque ya no aparezca en el RSS.

### Ajustes

- **Medios**: agregá, quitá o reclasificá en `config/medios.json`. La página *Medios* del sitio muestra qué feeds fallaron en la última lectura; algunas URLs de RSS pueden necesitar corrección la primera vez.
- **Sensibilidad del agrupamiento**: `PARAMETROS` en `lib/agrupar.mjs`. Si junta noticias distintas, subí `umbralUnir`; si deja separadas notas del mismo hecho, bajalo.

### Límites

- La ubicación de cada medio en izquierda, centro o derecha es una simplificación discutible.
- El agrupamiento es estadístico: a veces junta dos noticias parecidas o separa una misma noticia contada con palabras muy distintas.
- Los videos y columnas se asocian a cada noticia por parecido de títulos: a veces una columna queda sin noticia o en la equivocada.

## Pruebas

```bash
npm test
```
