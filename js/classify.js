// ── SMART CLASSIFICATION ENGINE ────────────────────────
// Runs entirely client-side, no AI needed

const CVE_RE      = /CVE-\d{4}-\d{4,7}/gi;
const IP_RE       = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const DOMAIN_RE   = /\b([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+(?:com|net|org|io|gov|edu|ru|cn|uk|de)\b/gi;

const MALWARE_KEYWORDS = [
  'ransomware','trojan','backdoor','rootkit','botnet','worm','spyware',
  'keylogger','stealer','dropper','loader','rat','cobalt strike','mimikatz',
  'lockbit','blackcat','ryuk','conti','emotet','qakbot','redline'
];
const ACTOR_KEYWORDS = [
  'apt','lazarus','fancy bear','cozy bear','sandworm','volt typhoon',
  'scattered spider','lapsus','darkside','revil','killnet','anonymous'
];
const AI_KEYWORDS = [
  'llm','gpt','claude','gemini','chatgpt','artificial intelligence','machine learning',
  'deep learning','neural network','ai model','prompt injection','jailbreak',
  'ai-powered','generative ai','foundation model','openai','anthropic','deepmind'
];
const EXPLOIT_KEYWORDS = [
  'exploit','zero-day','0day','poc','proof of concept','rce','remote code execution',
  'privilege escalation','sql injection','xss','buffer overflow','use after free',
  'heap spray','rop chain','shellcode'
];
const VULN_KEYWORDS = [
  'vulnerability','cve','cvss','patch','advisory','disclosure','security flaw',
  'misconfiguration','weak password','unpatched','affected versions'
];
const BREACH_KEYWORDS = [
  'data breach','leak','exposed','stolen data','credentials','phishing',
  'social engineering','vishing','smishing','supply chain'
];

function textOf(item) {
  return ((item.raw_title || '') + ' ' + (item.raw_desc || '')).toLowerCase();
}

export function classifyItem(item) {
  const text = textOf(item);

  // --- TYPE classification ---
  let type = item.type || 'NEWS';
  if (item.source === 'ArXiv CS.CR' || item.source === 'MIT Tech Review') type = 'RESEARCH';
  if (item.source === 'Exploit-DB') type = 'EXPLOIT';
  if (item.source === 'NVD / NIST' || item.source === 'CISA KEV') type = 'CVE';
  if (item.source === 'MalwareBazaar') type = 'MALWARE';
  if (AI_KEYWORDS.some(k => text.includes(k))) type = 'AI';
  if (EXPLOIT_KEYWORDS.some(k => text.includes(k)) && type === 'NEWS') type = 'EXPLOIT';
  if (VULN_KEYWORDS.some(k => text.includes(k)) && type === 'NEWS') type = 'CVE';
  if (BREACH_KEYWORDS.some(k => text.includes(k)) && type === 'NEWS') type = 'CYBER ATTACK';

  // --- ENTITY extraction ---
  const fullText = (item.raw_title || '') + ' ' + (item.raw_desc || '');
  const cves     = [...new Set((fullText.match(CVE_RE) || []).map(c => c.toUpperCase()))];
  const ips      = [...new Set(fullText.match(IP_RE) || [])].filter(ip => !ip.startsWith('192.168') && !ip.startsWith('127.'));
  const domains  = [...new Set((fullText.match(DOMAIN_RE) || []))].slice(0, 5);
  const malware  = MALWARE_KEYWORDS.filter(k => text.includes(k)).slice(0, 3);
  const actors   = ACTOR_KEYWORDS.filter(k => text.includes(k)).slice(0, 3);

  // --- THREAT SCORE (0-100) ---
  let score = 0;
  if (type === 'EXPLOIT')      score += 40;
  if (type === 'CVE')          score += 25;
  if (type === 'MALWARE')      score += 35;
  if (type === 'CYBER ATTACK') score += 30;
  if (type === 'AI')           score += 15;
  if (cves.length > 0)         score += 15;
  if (actors.length > 0)       score += 20;
  if (malware.length > 0)      score += 15;
  if (item.raw_cvss >= 9.0)    score += 20;
  else if (item.raw_cvss >= 7) score += 10;
  if (EXPLOIT_KEYWORDS.some(k => text.includes(k))) score += 10;
  score = Math.min(100, score);

  // --- SEVERITY from score ---
  let severity = 'Low';
  if (score >= 75) severity = 'Critical';
  else if (score >= 50) severity = 'High';
  else if (score >= 25) severity = 'Medium';

  // --- THREAT LABEL ---
  let threatLabel = 'low';
  if (score >= 75) threatLabel = 'critical';
  else if (score >= 50) threatLabel = 'trending';

  // --- WHY IT MATTERS ---
  const whyItMatters = generateWhyItMatters(item, type, cves, actors, malware, severity);

  // --- BADGES ---
  const badges = [];
  const ageHours = getAgeHours(item.raw_date);
  if (ageHours < 24) badges.push('NEW');
  if (type === 'EXPLOIT' || cves.length > 0) badges.push('EXPLOIT');
  if (type === 'AI' || AI_KEYWORDS.some(k => text.includes(k))) badges.push('AI');
  if (score >= 75) badges.push('CRITICAL');

  return {
    ...item,
    type,
    severity,
    threat_score: score,
    threat_label: threatLabel,
    badges,
    entities: { cves, ips, domains, malware, actors },
    why_it_matters: whyItMatters,
    is_ai_related: type === 'AI' || AI_KEYWORDS.some(k => text.includes(k)),
  };
}

function generateWhyItMatters(item, type, cves, actors, malware, severity) {
  const title = (item.raw_title || '').toLowerCase();
  if (type === 'EXPLOIT' && cves.length > 0)
    return `Active exploit for ${cves[0]} — patch immediately. Systems running affected software are at direct risk.`;
  if (type === 'EXPLOIT')
    return `A working exploit has been released. Attackers can use this to compromise unpatched systems.`;
  if (type === 'CVE' && item.raw_cvss >= 9)
    return `Critical severity (CVSS ${item.raw_cvss}). Immediate patching required — remote exploitation likely.`;
  if (type === 'CVE')
    return `New vulnerability disclosed. Review affected versions and apply vendor patches.`;
  if (type === 'MALWARE')
    return `New malware sample detected in the wild. SOC teams should update detection rules.`;
  if (type === 'AI')
    return `AI systems or infrastructure are involved. Relevant for teams deploying or securing AI models.`;
  if (actors.length > 0)
    return `Linked to known threat actor ${actors[0]}. Indicates targeted, sophisticated activity.`;
  if (type === 'CYBER ATTACK')
    return `Active attack campaign detected. Organizations in the targeted sector should review their defenses.`;
  if (type === 'RESEARCH')
    return `New security research published. May reveal novel attack techniques before they are exploited in the wild.`;
  return `Security professionals should review this for potential impact on their environment.`;
}

function getAgeHours(dateStr) {
  if (!dateStr) return 999;
  const diff = Date.now() - new Date(dateStr).getTime();
  return diff / (1000 * 60 * 60);
}

// ── TREND DETECTION ────────────────────────────────────
export function detectTrends(items) {
  const typeCount   = {};
  const actorCount  = {};
  const malwareCount = {};
  const sectorCount = {};
  let aiCount = 0;
  let exploitCount = 0;
  let criticalCount = 0;

  items.forEach(item => {
    // Type counts
    typeCount[item.type] = (typeCount[item.type] || 0) + 1;

    // Entity counts
    (item.entities?.actors  || []).forEach(a => { actorCount[a]   = (actorCount[a]   || 0) + 1; });
    (item.entities?.malware || []).forEach(m => { malwareCount[m] = (malwareCount[m] || 0) + 1; });

    if (item.is_ai_related)           aiCount++;
    if (item.type === 'EXPLOIT')      exploitCount++;
    if (item.severity === 'Critical') criticalCount++;
  });

  const topTypes = Object.entries(typeCount)
    .sort((a,b) => b[1]-a[1]).slice(0,3)
    .map(([type, count]) => ({ type, count }));

  const topActors = Object.entries(actorCount)
    .sort((a,b) => b[1]-a[1]).slice(0,3)
    .map(([name, count]) => ({ name, count }));

  const topMalware = Object.entries(malwareCount)
    .sort((a,b) => b[1]-a[1]).slice(0,3)
    .map(([name, count]) => ({ name, count }));

  // Top 5 by threat score
  const top5 = [...items]
    .sort((a,b) => (b.threat_score||0) - (a.threat_score||0))
    .slice(0, 5);

  return { topTypes, topActors, topMalware, aiCount, exploitCount, criticalCount, top5, total: items.length };
}