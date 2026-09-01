// CRUD simple de recordatorios de pago. Lo llama el panel de Administrador (Pagos) cuando
// activa/edita/desactiva el recordatorio de un pago concreto. Guarda en Redis (Upstash vía
// Vercel Storage) porque este es el único componente con estado del lado del servidor — el
// resto de la app vive en localStorage del navegador y por eso el cron no puede leerlo.
const { redisCmd } = require('./_redis');

module.exports = async (req, res) => {
  const secret = process.env.REMINDERS_API_SECRET;
  if (secret) {
    const auth = req.headers['authorization'] || '';
    if (auth !== `Bearer ${secret}`) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
  }

  try {
    if (req.method === 'GET') {
      const ids = (await redisCmd(['SMEMBERS', 'reminders:all'])) || [];
      if (!ids.length) { res.status(200).json({ reminders: [] }); return; }
      const values = await redisCmd(['MGET', ...ids.map((id) => `reminder:${id}`)]);
      const reminders = values.filter(Boolean).map((v) => JSON.parse(v));
      res.status(200).json({ reminders });
      return;
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body || '{}');
      const { paymentId, active } = body || {};
      if (!paymentId) { res.status(400).json({ error: 'paymentId requerido' }); return; }

      if (active === false) {
        await redisCmd(['DEL', `reminder:${paymentId}`]);
        await redisCmd(['SREM', 'reminders:all', paymentId]);
        res.status(200).json({ ok: true, removed: true });
        return;
      }

      const { shipmentNumber, concept, amountUSD, dueDate, email } = body;
      if (!dueDate || !email) { res.status(400).json({ error: 'dueDate y email son requeridos' }); return; }
      const record = {
        paymentId,
        shipmentNumber: shipmentNumber || '',
        concept: concept || '',
        amountUSD: Number(amountUSD) || 0,
        dueDate,
        email,
        sent: false,
        updatedAt: new Date().toISOString(),
      };
      await redisCmd(['SET', `reminder:${paymentId}`, JSON.stringify(record)]);
      await redisCmd(['SADD', 'reminders:all', paymentId]);
      res.status(200).json({ ok: true, reminder: record });
      return;
    }

    res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) });
  }
};
