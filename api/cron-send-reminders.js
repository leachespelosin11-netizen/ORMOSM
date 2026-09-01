// Vercel Cron llama esta función una vez al día (ver "crons" en vercel.json). Revisa cada
// recordatorio guardado en Redis y manda el correo cuando faltan exactamente 2 días para la
// fecha de vencimiento, usando Resend. Marca sent:true para no reenviar el mismo recordatorio.
const { redisCmd } = require('./_redis');

async function sendEmail(to, subject, html) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY no está configurada');
  const from = process.env.REMINDERS_FROM_EMAIL || 'ORMO <onboarding@resend.dev>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Resend error (${res.status}): ${text}`);
  }
  return res.json();
}

function daysUntil(dueDateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr + 'T00:00:00');
  return Math.round((due - today) / 86400000);
}

module.exports = async (req, res) => {
  // Vercel manda este header automáticamente en la llamada del Cron cuando CRON_SECRET existe.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers['authorization'] || '';
    if (auth !== `Bearer ${cronSecret}`) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
  }

  try {
    const ids = (await redisCmd(['SMEMBERS', 'reminders:all'])) || [];
    const results = [];
    for (const id of ids) {
      const raw = await redisCmd(['GET', `reminder:${id}`]);
      if (!raw) continue;
      const rem = JSON.parse(raw);
      if (rem.sent) { results.push({ id, status: 'already_sent' }); continue; }
      const d = daysUntil(rem.dueDate);
      if (d === 2) {
        try {
          await sendEmail(
            rem.email,
            `Recordatorio de pago — vence en 2 días (${rem.dueDate})`,
            `<p>Recordatorio: el pago "<strong>${rem.concept || 'Pago'}</strong>" del embarque <strong>${rem.shipmentNumber || ''}</strong> por <strong>$${Number(rem.amountUSD || 0).toFixed(2)} USD</strong> vence el <strong>${rem.dueDate}</strong> (en 2 días).</p><p>— ORMO Control de Importaciones</p>`
          );
          rem.sent = true;
          rem.sentAt = new Date().toISOString();
          await redisCmd(['SET', `reminder:${id}`, JSON.stringify(rem)]);
          results.push({ id, status: 'sent' });
        } catch (e) {
          results.push({ id, status: 'error', error: String(e && e.message || e) });
        }
      } else {
        results.push({ id, status: 'skipped', daysUntil: d });
      }
    }
    res.status(200).json({ checked: ids.length, results });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) });
  }
};
