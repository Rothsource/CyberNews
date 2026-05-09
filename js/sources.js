import { setSrc } from './ui.js';

const PROXY = '/api/proxy?url=';

async function proxyFetch(url) {
  const res = await fetch(PROXY + encodeURIComponent(url), { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error('Proxy error: ' + res.status);
  return await res.text();
}

// ── NVD / NIST ─────────────────────────────────────────
export async function fetchNVD(dateRange) {
  setSrc('nvd', 'loading', 'FETCHING');
  try {
    const start = dateRange.from + 'T00:00:00.000';
    const end   = dateRange.to   + 'T23:59:59.999';
    const url   = `https://services.nvd.nist.gov/rest/json/cves/2.0?pubStartDate=${encodeURIComponent(start)}&pubEndDate=${encodeURIComponent(end)}&resultsPerPage=15`;
    const res   = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const data  = await res.json();
    setSrc('nvd', 'ok', 'OK ✓');
    return (data.vulnerabilities || []).map(v => {
      const cve  = v.cve;
      const desc = cve.descriptions?.find(d => d.lang === 'en')?.value || '';
      const cvss = cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore
                || cve.metrics?.cvssMetricV30?.[0]?.cvssData?.baseScore
                || cve.metrics?.cvssMetricV2?.[0]?.cvssData?.baseScore || 0;
      return {
        source:    'NVD / NIST',
        raw_title: cve.id,
        raw_desc:  desc,
        raw_cvss:  cvss,
        raw_date:  cve.published?.split('T')[0] || dateRange.to,
        type:      'CVE'
      };
    });
  } catch (e) {
    setSrc('nvd', 'err', 'ERR');
    return [];
  }
}

// ── CISA KEV ───────────────────────────────────────────
export async function fetchCISA(dateRange) {
  setSrc('cisa', 'loading', 'FETCHING');
  try {
    const start = dateRange.from + 'T00:00:00.000';
    const end   = dateRange.to   + 'T23:59:59.999';
    const url   = `https://services.nvd.nist.gov/rest/json/cves/2.0?pubStartDate=${encodeURIComponent(start)}&pubEndDate=${encodeURIComponent(end)}&cvssV3Severity=CRITICAL&resultsPerPage=10`;
    const res   = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const data  = await res.json();
    setSrc('cisa', 'ok', 'OK ✓');
    return (data.vulnerabilities || []).map(v => {
      const cve  = v.cve;
      const desc = cve.descriptions?.find(d => d.lang === 'en')?.value || '';
      return {
        source:    'CISA KEV',
        raw_title: cve.id + (cve.cisaVulnerabilityName ? ' — ' + cve.cisaVulnerabilityName : ''),
        raw_desc:  desc + (cve.cisaRequiredAction ? ' Required action: ' + cve.cisaRequiredAction : ''),
        raw_date:  cve.published?.split('T')[0] || dateRange.from,
        type:      'EXPLOIT'
      };
    });
  } catch (e) {
    setSrc('cisa', 'err', 'ERR');
    return [];
  }
}

// ── RSS FEEDS (via proxy) ──────────────────────────────
export async function fetchRSS(id, feedUrl, sourceName) {
  setSrc(id, 'loading', 'FETCHING');
  try {
    const text  = await proxyFetch(feedUrl);
    const xml   = new DOMParser().parseFromString(text, 'text/xml');
    const items = Array.from(xml.querySelectorAll('item')).slice(0, 8);
    if (items.length === 0) throw new Error('No items parsed');
    setSrc(id, 'ok', 'OK ✓');
    return items.map(item => ({
      source:    sourceName,
      raw_title: item.querySelector('title')?.textContent || '',
      raw_desc:  (item.querySelector('description')?.textContent || '').replace(/<[^>]+>/g, '').slice(0, 300),
      raw_date:  new Date(item.querySelector('pubDate')?.textContent || Date.now()).toISOString().split('T')[0],
      raw_link:  item.querySelector('link')?.textContent || '',
      type:      'NEWS'
    }));
  } catch (e) {
    setSrc(id, 'err', 'ERR');
    return [];
  }
}

// ── ARXIV (via proxy — direct fetch blocked by CORS) ───
export async function fetchArXiv() {
  setSrc('arxiv', 'loading', 'FETCHING');
  try {
    const url  = 'https://export.arxiv.org/api/query?search_query=cat:cs.CR&sortBy=submittedDate&sortOrder=descending&max_results=8';
    const text = await proxyFetch(url);
    const xml  = new DOMParser().parseFromString(text, 'text/xml');
    const entries = Array.from(xml.querySelectorAll('entry'));
    if (entries.length === 0) throw new Error('No entries');
    setSrc('arxiv', 'ok', 'OK ✓');
    return entries.map(e => ({
      source:    'ArXiv CS.CR',
      raw_title: e.querySelector('title')?.textContent?.trim() || '',
      raw_desc:  e.querySelector('summary')?.textContent?.trim().slice(0, 300) || '',
      raw_date:  e.querySelector('published')?.textContent?.split('T')[0] || '',
      raw_link:  e.querySelector('id')?.textContent?.trim() || '',
      type:      'RESEARCH'
    }));
  } catch (e) {
    setSrc('arxiv', 'err', 'ERR');
    return [];
  }
}

// ── ALIENVAULT OTX ─────────────────────────────────────
export async function fetchOTX(apiKey) {
  if (!apiKey) { setSrc('otx', 'skip', 'NO KEY'); return []; }
  setSrc('otx', 'loading', 'FETCHING');
  try {
    const res  = await fetch('https://otx.alienvault.com/api/v1/pulses/subscribed?limit=10', {
      headers: { 'X-OTX-API-KEY': apiKey },
      signal:  AbortSignal.timeout(15000)
    });
    const data = await res.json();
    setSrc('otx', 'ok', 'OK ✓');
    return (data.results || []).slice(0, 8).map(p => ({
      source:    'AlienVault OTX',
      raw_title: p.name,
      raw_desc:  p.description || '',
      raw_date:  p.created?.split('T')[0] || '',
      raw_tags:  p.tags || [],
      type:      'THREAT_INTEL'
    }));
  } catch (e) {
    setSrc('otx', 'err', 'ERR');
    return [];
  }
}

// ── MALWAREBAZAAR (via proxy — direct fetch blocked by CORS) ──
export async function fetchMalwareBazaar() {
  setSrc('malware', 'loading', 'FETCHING');
  try {
    // Use proxy with POST encoded as query param so the proxy can forward it
    const text = await proxyFetch('https://mb-api.abuse.ch/api/v1/');
    const data = JSON.parse(text);
    setSrc('malware', 'ok', 'OK ✓');
    return (data.data || []).slice(0, 8).map(s => ({
      source:    'MalwareBazaar',
      raw_title: 'Malware Sample: ' + (s.signature || s.file_type || 'Unknown'),
      raw_desc:  `File: ${s.file_name || 'N/A'} | Type: ${s.file_type || 'N/A'} | Tags: ${(s.tags || []).join(', ')}`,
      raw_date:  s.first_seen?.split(' ')[0] || '',
      type:      'MALWARE'
    }));
  } catch (e) {
    setSrc('malware', 'err', 'ERR');
    return [];
  }
}

// ── RSS FEED DEFINITIONS ───────────────────────────────
export const RSS_FEEDS = [
  { id: 'bc',   url: 'https://www.bleepingcomputer.com/feed/',      name: 'BleepingComputer' },
  { id: 'thn',  url: 'https://feeds.feedburner.com/TheHackersNews', name: 'The Hacker News'  },
  { id: 'sans', url: 'https://isc.sans.edu/rssfeed_full.xml',       name: 'SANS ISC'         },
  { id: 'sw',   url: 'https://feeds.feedburner.com/securityweek',   name: 'SecurityWeek'     },
];