// Genera feeds RSS de EJEMPLO en test/fixtures/ para probar el sitio sin red (npm run demo).
// Las noticias son inventadas y los enlaces apuntan a ejemplo.invalid: no son notas reales de esos medios.

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const BASE = Date.parse('2026-11-13T09:00:00-03:00');
const h = (horas) => new Date(BASE + horas * 3600e3).toUTCString();

// [medio, horas desde BASE, titular, bajada, categoría]
const NOTAS = [
  // 1. Inflación: todos los lados
  ['infobae', 0.5, 'El INDEC informó que la inflación de octubre fue de 2,1% y acumula 24,8% en el año', 'El índice de precios al consumidor de octubre se ubicó en 2,1%, según el INDEC. Alimentos subió 1,8% y la interanual bajó a 31,2%.', 'Economía'],
  ['clarin', 0.7, 'Inflación de octubre: el INDEC registró 2,1% y el Gobierno celebra la baja interanual', 'El dato del INDEC de octubre fue 2,1% mensual. En el Ministerio de Economía destacan que la interanual perforó el 32%.', 'Economía'],
  ['pagina12', 0.9, 'La inflación de octubre fue 2,1% según el INDEC y los salarios siguen sin recuperarse', 'El INDEC difundió que el IPC de octubre fue de 2,1%. Los gremios advierten que los ingresos corren detrás de los precios.', 'Economía'],
  ['lanacion', 1.1, 'El INDEC confirmó una inflación de 2,1% en octubre, la más baja en cuatro meses', 'La inflación de octubre medida por el INDEC fue 2,1%, con alimentos en 1,8%. Las consultoras esperaban 2,3%.', 'Economía'],
  ['ambito', 1.2, 'Inflación de octubre: 2,1% según INDEC; qué esperan las consultoras para noviembre', 'El IPC de octubre del INDEC fue 2,1%. El mercado proyecta un número similar para noviembre.', 'Economía'],
  ['eldestape', 1.6, 'INDEC: la inflación de octubre fue 2,1% y los alimentos golpean a los jubilados', 'El IPC de octubre informado por el INDEC fue 2,1%. Jubilados y salarios estatales pierden frente a la inflación.', 'Economía'],

  // 2. Paro de la CGT: todos
  ['pagina12', 2.0, 'La CGT anunció un paro general de 24 horas contra la reforma laboral', 'La central obrera definió una huelga general para el jueves 27 en rechazo a la reforma laboral que se debate en el Congreso.', 'Política'],
  ['tiempoar', 2.2, 'La CGT convocó a un paro general de 24 horas para frenar la reforma laboral', 'Los gremios confederados fijaron la huelga general para el 27 de noviembre contra la reforma laboral.', 'Sociedad'],
  ['perfil', 2.5, 'La CGT confirmó un paro general de 24 horas para el 27 de noviembre', 'El consejo directivo de la CGT aprobó la huelga general en rechazo a la reforma laboral del Gobierno.', 'Política'],
  ['clarin', 2.8, 'La CGT lanzó un nuevo paro general y el Gobierno lo calificó de "político"', 'La central sindical anunció una huelga general de 24 horas para el 27. Desde la Casa Rosada acusaron a la CGT de defender privilegios ante la reforma laboral.', 'Política'],
  ['tn', 3.0, 'Paro general de la CGT: qué servicios funcionan el 27 de noviembre', 'La CGT confirmó la huelga general de 24 horas contra la reforma laboral. Colectivos, trenes, bancos y escuelas: cómo funcionarán.', 'Sociedad'],

  // 3. Presupuesto en Diputados: todos
  ['lanacion', 4.0, 'Diputados debate el Presupuesto 2027 con el oficialismo cerca del quórum', 'La Cámara de Diputados inició la sesión para tratar el Presupuesto 2027. El oficialismo negocia con gobernadores los votos.', 'Política'],
  ['infobae', 4.2, 'Presupuesto 2027: Diputados abrió la sesión y el oficialismo busca los votos de los gobernadores', 'Con el apoyo de bloques provinciales, el oficialismo intenta aprobar el Presupuesto 2027 en Diputados.', 'Política'],
  ['eldiarioar', 4.4, 'Diputados trata el Presupuesto 2027 con recortes a universidades y obra pública', 'La sesión por el Presupuesto 2027 empezó en Diputados. La oposición cuestiona los recortes en universidades y obra pública.', 'Política'],
  ['c5n', 4.6, 'Presupuesto 2027 en Diputados: la oposición denuncia recortes en universidades', 'Mientras se debate el Presupuesto 2027 en Diputados, la oposición rechaza el ajuste a universidades y provincias.', 'Política'],

  // 4. Superclásico: centro y derecha
  ['tn', 5.0, 'Boca le ganó 2-1 a River en La Bombonera y se metió en la pelea por el título', 'Con goles en el segundo tiempo, Boca venció 2-1 a River en el superclásico por la Liga Profesional.', 'Deportes'],
  ['ole', 5.1, 'Boca ganó el superclásico 2-1 ante River', 'Medio sin configuración: esta nota se ignora.', 'Deportes'],
  ['infobae', 5.2, 'Superclásico: Boca venció 2-1 a River en La Bombonera por la Liga Profesional', 'Boca dio vuelta el partido y le ganó 2-1 a River en La Bombonera.', 'Deportes'],
  ['clarin', 5.3, 'Boca le ganó 2-1 a River en un superclásico caliente en La Bombonera', 'Boca se impuso 2-1 a River en La Bombonera y quedó a un punto de la cima de la Liga Profesional.', 'Deportes'],

  // 5. Despidos en una autopartista: solo izquierda (punto ciego de la derecha)
  ['pagina12', 6.0, 'Una autopartista de Pacheco despidió a 300 trabajadores y los obreros ocupan la planta', 'Los trabajadores de la autopartista de General Pacheco denunciaron 300 despidos y permanecen dentro de la fábrica.', 'Economía'],
  ['laizquierdadiario', 6.2, 'Pacheco: 300 despidos en una autopartista y la planta está ocupada por los obreros', 'Los trabajadores ocupan la autopartista de General Pacheco tras el despido de 300 operarios.', 'Sociedad'],
  ['eldestape', 6.5, 'Despidos masivos: una autopartista de Pacheco echó a 300 trabajadores', 'La autopartista de General Pacheco despidió a 300 empleados. Los obreros ocupan la planta en reclamo.', 'Economía'],

  // 6. Inseguridad en el conurbano: solo derecha (punto ciego de la izquierda)
  ['clarin', 7.0, 'Crecen los robos en el conurbano: un informe registra 18% más denuncias en La Matanza', 'Un informe de una ONG de seguridad detectó un aumento de 18% en las denuncias por robos en La Matanza en el último trimestre.', 'Policiales'],
  ['lanacion', 7.2, 'Inseguridad en La Matanza: las denuncias por robos subieron 18% según un informe', 'Las denuncias por robo en La Matanza crecieron 18% en el trimestre, según el relevamiento de una ONG.', 'Policiales'],
  ['laprensa', 7.5, 'La Matanza: un informe advierte un aumento de 18% en las denuncias por robos', 'El estudio de una ONG muestra que las denuncias por robos en La Matanza aumentaron 18% en tres meses.', 'Policiales'],

  // 7. Alerta por tormentas: varios
  ['tn', 8.0, 'Alerta amarilla por tormentas fuertes en el AMBA: el SMN anticipa ráfagas de 70 km/h', 'El Servicio Meteorológico Nacional emitió una alerta amarilla por tormentas para Buenos Aires y el AMBA.', 'Sociedad'],
  ['perfil', 8.2, 'El SMN emitió alerta amarilla por tormentas fuertes en el AMBA para esta noche', 'Según el Servicio Meteorológico Nacional, las tormentas llegarán al AMBA con ráfagas de hasta 70 km/h.', 'Sociedad'],
  ['pagina12', 8.3, 'Alerta amarilla por tormentas en el AMBA: qué dice el SMN', 'El SMN anunció alerta amarilla por tormentas y ráfagas de 70 km/h en el AMBA.', 'Sociedad'],

  // Notas sueltas (un solo medio)
  ['ambito', 9.0, 'El dólar oficial cerró estable y el riesgo país bajó a 640 puntos', 'Jornada tranquila en el mercado cambiario. Los bonos subieron y el riesgo país perforó los 650 puntos.', 'Economía'],
  ['infobae', 9.1, 'Una startup cordobesa de inteligencia artificial consiguió financiamiento por USD 12 millones', 'La empresa desarrolla modelos de IA para el agro y abrirá oficinas en San Pablo.', 'Tecnología'],
  ['tiempoar', 9.2, 'Docentes universitarios realizan un paro de 48 horas en reclamo salarial', 'Los gremios universitarios convocaron a un paro de 48 horas por la actualización salarial.', 'Educación'],
  ['lanacion', 9.3, 'Un festival de cine independiente en Mar del Plata anunció su programación', 'La edición incluye 120 películas y una retrospectiva del cine argentino de los 80.', 'Espectáculos'],
];

const NOMBRES = {
  pagina12: 'Página/12', eldestape: 'El Destape', tiempoar: 'Tiempo Argentino', laizquierdadiario: 'La Izquierda Diario',
  c5n: 'C5N', eldiarioar: 'elDiarioAR', infobae: 'Infobae', perfil: 'Perfil', ambito: 'Ámbito', clarin: 'Clarín',
  lanacion: 'La Nación', tn: 'TN', laprensa: 'La Prensa', ole: 'Olé',
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

await mkdir(DIR, { recursive: true });
for (const medio of Object.keys(NOMBRES)) {
  const items = NOTAS.filter((n) => n[0] === medio).map(([, horas, titulo, bajada, cat], i) => `
    <item>
      <title><![CDATA[${titulo}]]></title>
      <link>https://ejemplo.invalid/${medio}/nota-${i + 1}?utm_source=rss</link>
      <pubDate>${h(horas)}</pubDate>
      <category>${esc(cat)}</category>
      <description>&lt;p&gt;${esc(bajada)}&lt;/p&gt;</description>
    </item>`).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>${esc(NOMBRES[medio])} (EJEMPLO)</title>${items}
</channel></rss>
`;
  await writeFile(path.join(DIR, `${medio}.xml`), xml);
}
console.log(`Feeds de ejemplo escritos en ${DIR}`);
