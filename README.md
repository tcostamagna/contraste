# Contraste

La misma noticia, contada por todos los medios argentinos. Contraste lee los RSS públicos de diarios de distintas líneas editoriales, agrupa las notas que hablan del mismo hecho y muestra:

- **Cobertura**: cuántos medios de izquierda, centro y derecha la publicaron.
- **Quién la publicó primero** y en qué orden la levantaron los demás.
- **Puntos ciegos**: noticias que publican varios medios de un lado y ninguno del otro.
- **Qué publicó cada medio**, con enlace a la nota original.
- Opcional, con una clave de la API de Claude: **titular y resumen neutrales**, los hechos en los que coinciden los medios y cómo enfoca la noticia cada lado.

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
