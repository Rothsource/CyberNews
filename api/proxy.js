export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  let decoded;
  try {
    decoded = decodeURIComponent(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL encoding' });
  }

  // 🔒 Basic safety check (VERY IMPORTANT)
  const allowedHosts = [
    'feeds.arstechnica.com',
    'www.darkreading.com',
    'krebsonsecurity.com',
    'thehackernews.com',
    'www.securityweek.com',
    'arxiv.org',
    'mb-api.abuse.ch'
  ];

  const hostname = (() => {
    try {
      return new URL(decoded).hostname;
    } catch {
      return null;
    }
  })();

  if (!hostname || !allowedHosts.includes(hostname)) {
    return res.status(403).json({ error: 'Blocked host' });
  }

  const isMalwareBazaar = hostname === 'mb-api.abuse.ch';

  try {
    const options = {
      method: isMalwareBazaar ? 'POST' : 'GET',
      headers: {
        'User-Agent': 'CyberIntelBot/1.0',
        'Accept': '*/*',
        ...(isMalwareBazaar && {
          'Content-Type': 'application/x-www-form-urlencoded'
        })
      }
    };

    if (isMalwareBazaar) {
      options.body = 'query=get_recent&selector=100';
    }

    const response = await fetch(decoded, options);

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Upstream error: ${response.status}`
      });
    }

    const contentType = response.headers.get('content-type') || '';

    let data;

    // 🔥 FIX: handle JSON properly
    if (contentType.includes('application/json')) {
      data = await response.json();
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json(data);
    }

    // RSS/XML/text fallback
    data = await response.text();
    res.setHeader('Content-Type', contentType || 'text/plain');

    return res.status(200).send(data);

  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Proxy failure'
    });
  }
}