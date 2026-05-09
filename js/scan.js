import { isScanning, setIsScanning, setThreats, selectedCategories, selectedSeverities, state } from './state.js';
import { setStatus, setSrc, setProgress, toast, getDateRange } from './ui.js';
import { fetchNVD, fetchCISA, fetchRSS, fetchOTX, fetchMalwareBazaar, RSS_FEEDS } from './sources.js';
import { analyzeWithAI } from './ai.js';
import { renderCards } from './render.js';

const PROVIDER_LABELS = {
  claude: 'Claude',
  openai: 'ChatGPT',
  gemini: 'Gemini',
  grok:   'Grok'
};

function getAIConfig() {
  return {
    provider: state.selectedProvider || 'claude',
    apiKey:   document.getElementById('keyAI').value.trim(),
  };
}

export async function runScan() {
  if (isScanning) return;

  const { provider, apiKey } = getAIConfig();
  if (!apiKey) {
    toast('API key required', 'error');
    document.getElementById('keysPanel').classList.add('open');
    document.getElementById('keysToggle').classList.add('open');
    return;
  }
  if (selectedCategories.size === 0) { toast('Select at least one category', 'error'); return; }
  if (selectedSeverities.size === 0) { toast('Select at least one severity',  'error'); return; }

  setIsScanning(true);
  document.getElementById('scanBtn').disabled = true;
  setStatus('active', 'SCANNING');
  setProgress(5);

  const dateRange = getDateRange();
  const otxKey    = document.getElementById('keyOTX').value.trim();

  // Update the dynamic AI source label in source status panel
  const aiSrcName = document.getElementById('ai-src-name');
  if (aiSrcName) aiSrcName.textContent = (PROVIDER_LABELS[provider] || 'AI') + ' Analysis';

  ['nvd','cisa','otx','malware','bc','thn','sans','sw','arxiv','claude'].forEach(s =>
    setSrc(s, 'idle', 'IDLE')
  );

  let allRaw = [];

  try {
    setProgress(10);
    const [nvdData, cisaData] = await Promise.all([fetchNVD(dateRange), fetchCISA(dateRange)]);
    allRaw.push(...nvdData, ...cisaData);
    setProgress(25);

    const [otxData, malwareData] = await Promise.all([fetchOTX(otxKey), fetchMalwareBazaar()]);
    allRaw.push(...otxData, ...malwareData);
    setProgress(40);

    const rssResults = await Promise.all(RSS_FEEDS.map(f => fetchRSS(f.id, f.url, f.name)));
    rssResults.forEach(r => allRaw.push(...r));
    setProgress(65);

    if (allRaw.length === 0) {
      toast('No raw data collected. Check network/API keys.', 'error');
      resetScanState();
      setStatus('error', 'ERROR');
      return;
    }

    toast(`Collected ${allRaw.length} raw items. Analyzing with ${PROVIDER_LABELS[provider] || provider}...`, 'info');

    const result = await analyzeWithAI(allRaw, provider, apiKey, null, dateRange, selectedCategories, selectedSeverities);
    setProgress(90);

    const threats = result.threats || [];
    setThreats(threats);
    updateStats(threats);

    if (result.digest) {
      document.getElementById('digestText').textContent = result.digest;
      document.getElementById('digestCard').classList.add('show');
    }

    renderCards(threats);
    document.getElementById('resultsCount').innerHTML = '<span>' + threats.length + '</span> threats found';

    setProgress(100);
    setTimeout(() => setProgress(0), 800);
    setStatus('active', 'SCAN COMPLETE');
    toast('Scan complete — ' + threats.length + ' threats found', 'success');

  } catch (e) {
    toast('Scan error: ' + e.message, 'error');
    setStatus('error', 'ERROR');
    setProgress(0);
  }

  resetScanState();
  setTimeout(() => setStatus('', 'STANDBY'), 5000);
}

function resetScanState() {
  setIsScanning(false);
  document.getElementById('scanBtn').disabled = false;
}

function updateStats(threats) {
  const critical  = threats.filter(t => t.severity === 'Critical').length;
  const aiCount   = threats.filter(t => t.is_ai_related).length;
  const sectors   = threats.map(t => t.top_targeted_sector).filter(Boolean);
  const topSector = sectors.length > 0
    ? Object.entries(sectors.reduce((a, s) => { a[s] = (a[s]||0)+1; return a; }, {}))
        .sort((a,b) => b[1]-a[1])[0][0]
    : '—';
  document.getElementById('statTotal').textContent    = threats.length;
  document.getElementById('statCritical').textContent = critical;
  document.getElementById('statAI').textContent       = aiCount;
  document.getElementById('statSector').textContent   = topSector;
}