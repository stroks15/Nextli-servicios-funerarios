// NEXTLI · Generador seguro de ilustraciones realistas de mascotas.
// La clave de AI Gateway permanece exclusivamente en el servidor.
const MODEL = 'openai/gpt-image-2.6-sunburst';
const recent = new Map();

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Método no permitido.' });
  }

  const origin = req.headers.origin;
  const host = req.headers.host || '';
  if (origin) {
    try {
      const parsed = new URL(origin);
      if (parsed.host !== host || !parsed.hostname.endsWith('.vercel.app')) {
        return send(res, 403, { error: 'Origen no autorizado.' });
      }
    } catch (_) {
      return send(res, 403, { error: 'Origen no autorizado.' });
    }
  }

  const token = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  if (!token) {
    return send(res, 503, {
      error: 'Falta configurar AI_GATEWAY_API_KEY en las variables de entorno de Vercel para generar ilustraciones realistas.'
    });
  }

  const ip = String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const previous = recent.get(ip) || 0;
  if (now - previous < 15000) {
    return send(res, 429, { error: 'Espera unos segundos antes de generar otra ilustración.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = null; }
  }
  if (!body || typeof body !== 'object') {
    return send(res, 400, { error: 'Solicitud inválida.' });
  }

  const clean = value => String(value || '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 100);
  const species = clean(body.species);
  const breed = clean(body.breed);
  const color = clean(body.color);
  if (!species || !breed || !color) {
    return send(res, 400, { error: 'Se requiere especie, raza y color del pelaje.' });
  }

  const prompt = [
    'Create one highly photorealistic, premium studio photograph of a real animal for a memorial certificate.',
    'Animal species: ' + species + '. Exact breed: ' + breed + '. Exact coat color and pattern selected by the family: ' + color + '.',
    'Make the breed recognizable and anatomically accurate: breed-specific head and muzzle, ears, body proportions, legs, tail, coat length, fur texture and characteristic markings.',
    'Show the complete animal standing naturally in a gentle three-quarter side view. All four paws and the complete tail must be visible. Center the subject with generous margins.',
    'Apply the exact requested coat color. Do not substitute colors or add unrequested markings. Natural eyes, anatomically correct paws, fine individual fur detail.',
    'Isolated animal only, transparent background, no scenery, no floor, no cast shadow, no accessories, no collar, no clothes, no text, no frame, no watermark.',
    'Soft professional studio lighting, realistic photographic texture, refined natural appearance. Square PNG composition.'
  ].join(' ');

  recent.set(ip, now);
  try {
    const upstream = await fetch('https://ai-gateway.vercel.sh/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        size: '1024x1024',
        n: 1,
        background: 'transparent',
        output_format: 'png',
        quality: 'high'
      })
    });

    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const detail = data && data.error && (data.error.message || data.error) || 'El proveedor de imágenes no pudo completar la solicitud.';
      const status = upstream.status === 429 ? 429 : upstream.status === 402 ? 402 : 502;
      return send(res, status, { error: String(detail).slice(0, 300) });
    }

    let image = data && data.data && data.data[0] && data.data[0].b64_json;
    if (!image && data && data.data && data.data[0] && data.data[0].url) {
      const imageResponse = await fetch(data.data[0].url);
      if (!imageResponse.ok) throw new Error('No se pudo descargar la imagen generada.');
      const bytes = Buffer.from(await imageResponse.arrayBuffer());
      if (bytes.length > 7 * 1024 * 1024) throw new Error('La imagen generada supera el tamaño permitido.');
      image = bytes.toString('base64');
    }
    if (!image) throw new Error('El servicio no devolvió la imagen en formato esperado.');
    return send(res, 200, { image: 'data:image/png;base64,' + image, model: MODEL });
  } catch (error) {
    return send(res, 502, { error: String(error && error.message || 'Error al generar la ilustración.').slice(0, 300) });
  }
};
