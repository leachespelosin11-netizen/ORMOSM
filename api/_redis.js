// Cliente mínimo para la API REST de Upstash Redis (la misma base de datos que Vercel conectó
// como "KV" al proyecto). Se usa fetch nativo a propósito, sin el paquete @upstash/redis, para
// no depender de npm install en el build — este proyecto no tiene package.json y así se queda.
function baseUrl() {
  const url = process.env.KV_REST_API_URL;
  if (!url) throw new Error('KV_REST_API_URL no está configurada');
  return url;
}
function token() {
  const t = process.env.KV_REST_API_TOKEN;
  if (!t) throw new Error('KV_REST_API_TOKEN no está configurada');
  return t;
}

async function redisCmd(cmd) {
  const res = await fetch(baseUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Redis command failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.result;
}

module.exports = { redisCmd };
