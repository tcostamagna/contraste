# Contraste

La misma noticia, contada por todos los medios argentinos. Contraste lee los RSS públicos de diarios de distintas líneas editoriales, agrupa las notas que hablan del mismo hecho y muestra:

- **Cobertura**: cuántos medios de izquierda, centro y derecha la publicaron.
- **Quién la publicó primero** y en qué orden la levantaron los demás.
- **Puntos ciegos**: noticias que publican varios medios de un lado y ninguno del otro.
- **Qué publicó cada medio**, con enlace a la nota original.
- **Ponete al día** (`hoy.html`): lo importante del momento en pocos minutos de lectura, renovado cada 30 minutos.
- **Cómo la cuenta cada lado**, con un titular de ejemplo de cada lado.
- **Videos** de los canales de YouTube de los medios, junto a la noticia de la que hablan (`config/videos.json`).
- **Seguí leyendo**: noticias relacionadas y botón a la siguiente.
- **Preguntale a la IA**: respuestas a preguntas sugeridas sobre cada noticia y, con el servidor del chat, preguntas libres.
- Con una clave de la API de Claude: titular y resumen neutrales, los hechos en común, cómo la cuenta cada lado en tono humano, las respuestas del chat y el texto de «Ponete al día».

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

Con resúmenes de IA (opcional):

```bash
ANTHROPIC_API_KEY=tu-clave npm run actualizar
```

## Publicarlo solo (GitHub Actions + GitHub Pages)

El workflow `.github/workflows/publicar.yml` corre cada 30 minutos en la rama `main`: descarga las noticias, las agrupa y publica `public/` en GitHub Pages.

1. En **Settings → Pages**, elegí **Source: GitHub Actions**.
2. En **Settings → Actions → General**, dejá habilitadas las Actions.
3. Opcional: en **Settings → Secrets and variables → Actions**, agregá el secreto `ANTHROPIC_API_KEY`. La variable `MAX_RESUMENES` limita cuántas noticias se resumen por corrida (15 por defecto); cada resumen se hace una sola vez y se rehace solo si se suman al menos dos medios.
4. En **Actions → Actualizar y publicar → Run workflow** lo podés correr a mano la primera vez.

## Chat con preguntas libres (Cloudflare)

GitHub Pages solo sirve archivos fijos, así que las preguntas libres pasan por un servidor chiquito en Cloudflare Workers (`chat/`), que guarda la clave de Claude como secreto. El plan gratuito de Workers alcanza para empezar.

1. Creá una cuenta en https://dash.cloudflare.com/sign-up.
2. Copiá tu **Account ID** (aparece en la página principal de la cuenta, en la columna de la derecha, o en *Workers & Pages*).
3. Creá un token en **My Profile → API Tokens → Create Token → plantilla «Edit Cloudflare Workers»**.
4. En GitHub, **Settings → Secrets and variables → Actions**, cargá `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` y `ANTHROPIC_API_KEY`.
5. En **Actions → Publicar chat (Cloudflare) → Run workflow**. El workflow publica el Worker, anota su dirección en `public/chat.json` y vuelve a publicar el sitio: desde ahí aparece la caja para escribir preguntas.

Cada pregunta libre es una llamada a la API de Claude (unos centavos de dólar). El Worker solo acepta pedidos desde el sitio, limita la pregunta a 500 caracteres y responde solo sobre la noticia abierta.

## Cómo funciona

| Paso | Archivo |
|---|---|
| Lista de medios, su línea y sus feeds | `config/medios.json` |
| Lectura de RSS y Atom (sin dependencias) | `lib/rss.mjs` |
| Agrupar notas del mismo hecho: TF-IDF del titular y la bajada, similitud coseno, ventana de 36 h | `lib/agrupar.mjs` |
| Tema por categoría del feed y palabras clave | `lib/temas.mjs` |
| Resumen neutral con Claude (opcional) | `lib/resumir.mjs` |
| Todo junto; escribe `public/datos/*.json` | `scripts/actualizar.mjs` |
| Sitio estático (HTML, CSS y JS sin frameworks) | `public/` |

Las notas de las últimas 72 horas se guardan en `datos/archivo.json` (en GitHub, en la caché del workflow), así una noticia sigue agrupada aunque ya no aparezca en el RSS.

### Ajustes

- **Medios**: agregá, quitá o reclasificá en `config/medios.json`. La página *Medios* del sitio muestra qué feeds fallaron en la última lectura; algunas URLs de RSS pueden necesitar corrección la primera vez.
- **Sensibilidad del agrupamiento**: `PARAMETROS` en `lib/agrupar.mjs`. Si junta noticias distintas, subí `umbralUnir`; si deja separadas notas del mismo hecho, bajalo.
- **Modelo de los resúmenes**: variable `MODELO_RESUMEN` (por defecto `claude-opus-5-5`, con esfuerzo bajo).

### Límites

- La ubicación de cada medio en izquierda, centro o derecha es una simplificación discutible.
- El agrupamiento es estadístico: a veces junta dos noticias parecidas o separa una misma noticia contada con palabras muy distintas.
- Los resúmenes de IA se basan solo en los titulares y bajadas de los RSS; no verifican datos.

## Pruebas

```bash
npm test
```
