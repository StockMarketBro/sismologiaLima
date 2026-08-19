// /api/diagnostico — Diagnóstico IA gratuito (Google Gemini, capa free) + noticias vía RSS (sin costo)
// Variables de entorno en Vercel: GEMINI_API_KEY (obligatoria), GEMINI_MODEL (opcional)

let cache = { at: 0, key: '', text: '' };            // caché en memoria: ahorra cuota gratuita

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const datos = req.method === 'POST' ? (req.body || {}) : {};
  const key = JSON.stringify(datos.indice_contexto || '') + (datos.mag_max || '');

  // caché de 3 horas si los datos no cambiaron
  if (cache.text && cache.key === key && Date.now() - cache.at < 3 * 3600e3) {
    return res.status(200).json({ text: cache.text, cached: true });
  }

  // Noticias gratis: Google News RSS (sin API key)
  let titulares = [];
  try {
    const rss = await fetch(
      'https://news.google.com/rss/search?q=(sismo OR temblor OR IGP) Peru&hl=es-419&gl=PE&ceid=PE:es-419'
    ).then(r => r.text());
    titulares = [...rss.matchAll(/<title>([^<]+)<\/title>/g)].map(m => m[1]).slice(1, 13);
  } catch (e) { /* sin noticias: el diagnóstico continúa */ }

  const prompt = `Eres un sismólogo senior asesorando a un residente de Lima, Perú. NO puedes predecir sismos y debes decirlo. Con los DATOS DE LA APP y los TITULARES recientes, redacta en español un DIAGNÓSTICO DE CONTEXTO SÍSMICO con estas secciones y encabezados exactos:
### Situación actual
### Lectura estadística y geofísica
### Noticias y señales recientes
### Escenario de riesgo para Lima
### Recomendaciones de preparación
Sé riguroso, cita magnitudes y fechas concretas, distingue hechos de estimaciones, descarta rumores no verificados, y cierra recordando que ningún índice permite predecir la fecha de un terremoto. Máximo ~450 palabras.

DATOS DE LA APP:
${JSON.stringify(datos, null, 2)}

TITULARES RECIENTES (Google News Perú):
${titulares.join('\n') || '(no disponibles en este momento)'}`;

  try {
    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      }
    );
    const j = await r.json();
    const text = (j.candidates?.[0]?.content?.parts || []).map(p => p.text).join('').trim();
    if (!text) throw new Error(j.error?.message || 'respuesta vacía');
    cache = { at: Date.now(), key, text };
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
}
