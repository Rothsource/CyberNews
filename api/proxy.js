export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url parameter' });

  const decoded = decodeURIComponent(url);

  // Detect MalwareBazaar and forward as POST
  const isMalwareBazaar = decoded.includes('mb-api.abuse.ch');

  try {
    const fetchOptions = {
      method: isMalwareBazaar ? 'POST' : 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CyberIntelBot/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, application/json, */*',
        ...(isMalwareBazaar && { 'Content-Type': 'application/x-www-form-urlencoded' }),
      },
      ...(isMalwareBazaar && { body: 'query=get_recent&selector=100' }),
      signal: AbortSignal.timeout(10000),
    };

    const response = await fetch(decoded, fetchOptions);

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Upstream error: ' + response.status });
    }

    const contentType = response.headers.get('content-type') || 'text/plain';
    const text = await response.text();
    res.setHeader('Content-Type', contentType);
    res.status(200).send(text);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}