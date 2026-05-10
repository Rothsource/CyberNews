import { setSrc } from './ui.js';

const PROXY = '/api/proxy?url=';

async function proxyFetch(url) {
  const res = await fetch(PROXY + encodeURIComponent(url), { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error('Proxy error: ' + res.status);
  return await res.text();
}

function splitDateRange(from, to, maxDays = 110) {
  const chunks = [];
  let start = new Date(from);
  const end = new Date(to);
  while (start <= end) {
    const chunkEnd = new Date(start);
    chunkEnd.setDate(chunkEnd.getDate() + maxDays);
    if (chunkEnd > end) chunkEnd.setTime(end.getTime());
    chunks.push({ from: start.toISOString().split('T')[0], to: chunkEnd.toISOString().split('T')[0] });
    start = new Date(chunkEnd);
    start.setDate(start.getDate() + 1);
  }
  return chunks;
}

export async function fetchNVD(dateRange) {
  setSrc('nvd', 'loading', 'FETCHING');
  try {
    const chunks = splitDateRange(dateRange.from, dateRange.to);
    const results = [];
    for (const chunk of chunks) {
      const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?pubStartDate=${encodeURIComponent(chunk.from + 'T00:00:00.000')}&pubEndDate=${encodeURIComponent(chunk.to + 'T23:59:59.999')}&resultsPerPage=15`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) continue;
      const data = await res.json();
      (data.vulnerabilities || []).forEach(v => {
        const cve  = v.cve;
        const desc = cve.descriptions?.find(d => d.lang === 'en')?.value || '';
        const cvss = cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore
                  || cve.metrics?.cvssMetricV30?.[0]?.cvssData?.baseScore
                  || cve.metrics?.cvssMetricV2?.[0]?.cvssData?.baseScore || 0;
        results.push({
          source: 'NVD / NIST', raw_title: cve.id, raw_desc: desc,
          raw_cvss: cvss, raw_date: cve.published?.split('T')[0] || dateRange.to, type: 'CVE'
        });
      });
    }
    setSrc('nvd', 'ok', 'OK ✓');
    return results;
  } catch (e) { setSrc('nvd', 'err', 'ERR'); return []; }
}

export async function fetchCISA(dateRange) {
  setSrc('cisa', 'loading', 'FETCHING');
  try {
    const chunks = splitDateRange(dateRange.from, dateRange.to);
    const results = [];
    for (const chunk of chunks) {
      const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?pubStartDate=${encodeURIComponent(chunk.from + 'T00:00:00.000')}&pubEndDate=${encodeURIComponent(chunk.to + 'T23:59:59.999')}&cvssV3Severity=CRITICAL&resultsPerPage=10`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) continue;
      const data = await res.json();
      (data.vulnerabilities || []).forEach(v => {
        const cve = v.cve;
        const desc = cve.descriptions?.find(d => d.lang === 'en')?.value || '';
        results.push({
          source: 'CISA KEV',
          raw_title: cve.id + (cve.cisaVulnerabilityName ? ' — ' + cve.cisaVulnerabilityName : ''),
          raw_desc: desc + (cve.cisaRequiredAction ? ' Required action: ' + cve.cisaRequiredAction : ''),
          raw_date: cve.published?.split('T')[0] || dateRange.from, type: 'EXPLOIT'
        });
      });
    }
    setSrc('cisa', 'ok', 'OK ✓');
    return results;
  } catch (e) { setSrc('cisa', 'err', 'ERR'); return []; }
}

export async function fetchRSS(id, feedUrl, sourceName) {
  setSrc(id, 'loading', 'FETCHING');
  try {
    const text = await proxyFetch(feedUrl);
    const xml  = new DOMParser().parseFromString(text, 'text/xml');
    const items = Array.from(xml.querySelectorAll('item')).slice(0, 10);
    if (items.length === 0) throw new Error('No items');
    setSrc(id, 'ok', 'OK ✓');
    return items.map(item => ({
      source:    sourceName,
      raw_title: item.querySelector('title')?.textContent || '',
      raw_desc:  (item.querySelector('description')?.textContent || '').replace(/<[^>]+>/g, '').slice(0, 300),
      raw_date:  new Date(item.querySelector('pubDate')?.textContent || Date.now()).toISOString().split('T')[0],
      raw_link:  item.querySelector('link')?.textContent || '',
      type:      'NEWS'
    }));
  } catch (e) { setSrc(id, 'err', 'ERR'); return []; }
}

export async function fetchArXiv() {
  setSrc('arxiv', 'loading', 'FETCHING');
  try {
    const text = await proxyFetch('https://export.arxiv.org/api/query?search_query=cat:cs.CR&sortBy=submittedDate&sortOrder=descending&max_results=8');
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
  } catch (e) { setSrc('arxiv', 'err', 'ERR'); return []; }
}

export async function fetchOTX(apiKey) {
  if (!apiKey) { setSrc('otx', 'skip', 'NO KEY'); return []; }
  setSrc('otx', 'loading', 'FETCHING');
  try {
    const res  = await fetch('https://otx.alienvault.com/api/v1/pulses/subscribed?limit=10', {
      headers: { 'X-OTX-API-KEY': apiKey }, signal: AbortSignal.timeout(15000)
    });
    const data = await res.json();
    setSrc('otx', 'ok', 'OK ✓');
    return (data.results || []).slice(0, 8).map(p => ({
      source: 'AlienVault OTX', raw_title: p.name, raw_desc: p.description || '',
      raw_date: p.created?.split('T')[0] || '', raw_tags: p.tags || [], type: 'THREAT_INTEL'
    }));
  } catch (e) { setSrc('otx', 'err', 'ERR'); return []; }
}

export async function fetchMalwareBazaar() {
  setSrc('malware', 'loading', 'FETCHING');
  try {
    const text = await proxyFetch('https://mb-api.abuse.ch/api/v1/');
    const data = JSON.parse(text);
    setSrc('malware', 'ok', 'OK ✓');
    return (data.data || []).slice(0, 8).map(s => ({
      source: 'MalwareBazaar',
      raw_title: 'Malware Sample: ' + (s.signature || s.file_type || 'Unknown'),
      raw_desc:  `File: ${s.file_name || 'N/A'} | Type: ${s.file_type || 'N/A'} | Tags: ${(s.tags || []).join(', ')}`,
      raw_date:  s.first_seen?.split(' ')[0] || '', type: 'MALWARE'
    }));
  } catch (e) { setSrc('malware', 'err', 'ERR'); return []; }
}

export const RSS_FEEDS = [
  { id: 'bc',       url: 'https://www.bleepingcomputer.com/feed/',                name: 'BleepingComputer'      },
  { id: 'thn',      url: 'https://feeds.feedburner.com/TheHackersNews',           name: 'The Hacker News'       },
  { id: 'sans',     url: 'https://isc.sans.edu/rssfeed_full.xml',                 name: 'SANS ISC'              },
  { id: 'sw',       url: 'https://feeds.feedburner.com/securityweek',             name: 'SecurityWeek'          },
  { id: 'exploitdb',url: 'https://www.exploit-db.com/rss.xml',                    name: 'Exploit-DB'            },
  { id: 'schneier', url: 'https://www.schneier.com/feed/atom/',                   name: 'Schneier on Security'  },
  { id: 'ars',      url: 'https://feeds.arstechnica.com/arstechnica/technology',  name: 'Ars Technica'          },
  { id: 'mit',      url: 'https://www.technologyreview.com/feed/',                name: 'MIT Tech Review'       },
  { id: 'verge',    url: 'https://www.theverge.com/rss/index.xml',               name: 'The Verge'             },
];