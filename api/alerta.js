// /api/alerta — Revisa sismos nuevos cerca de Lima y avisa por Telegram. Pensado para cron horario.
// Variables de entorno: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, UMBRAL_MAG (opcional, default 4.5)

export default async function handler(req, res) {
  const umbral = parseFloat(process.env.UMBRAL_MAG || '4.5');
  const desde = new Date(Date.now() - 65 * 60e3).toISOString(); // ventana 65 min (cron cada 60)
  const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=-12.0464&longitude=-77.0428&maxradiuskm=400&starttime=${desde}&minmagnitude=${umbral}`;

  try {
    const j = await fetch(url).then(r => r.json());
    const evs = j.features || [];
    for (const f of evs) {
      const p = f.properties, d = f.geometry.coordinates[2];
      const msg = `🔴 SISMO·LIMA\nM${p.mag} · ${Math.round(d)} km de profundidad\n${p.place}\n${new Date(p.time).toLocaleString('es-PE', { timeZone: 'America/Lima' })}\n${p.url}`;
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: msg })
      });
    }
    return res.status(200).json({ revisados: evs.length });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
}
