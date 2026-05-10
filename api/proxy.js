export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url' });

  let decoded;
  try {
    decoded = decodeURIComponent(url);
  } catch {
    return res.status(400).json({ error: 'Bad URL encoding' });
  }

  // 🔥 FORCE user-agent spoofing (important)
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9'
  };

  try {
    const r = await fetch(decoded, {
      method: 'GET',
      headers
    });

    const contentType = r.headers.get('content-type') || '';

    if (!r.ok) {
      return res.status(r.status).json({
        error: `Blocked upstream: ${r.status}`
      });
    }

    if (contentType.includes('application/json')) {
      const json = await r.json();
      return res.status(200).json(json);
    }

    const text = await r.text();
    res.setHeader('Content-Type', contentType);
    return res.status(200).send(text);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}