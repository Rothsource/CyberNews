import { isScanning, setIsScanning, setThreats, selectedCategories, selectedSeverities, state, rawNews } from './state.js';
import { setStatus, setSrc, setProgress, toast, getDateRange } from './ui.js';
import { fetchNVD, fetchCISA, fetchRSS, fetchOTX, fetchMalwareBazaar, fetchArXiv, RSS_FEEDS } from './sources.js';
import { analyzeWithAI } from './ai.js';
import { renderNewsCards, renderCards } from './render.js';

const PROVIDER_LABELS = {
  claude: 'Claude',
  openai: 'ChatGPT',
  gemini: 'Gemini',
  grok:   'Grok'
};

let refreshTimer = null;
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

function getAIConfig() {
  return {
    provider: state.selectedProvider || 'claude',
    apiKey:   document.getElementById('keyAI').value.trim(),
  };
}

function updateRefreshInfo(timestamp) {
  const el = document.getElementById('refreshInfo');
  if (el && timestamp) {
    el.textContent = `Last updated: ${timestamp.toLocaleTimeString()}`;
  }
}

// ── MODE 1: Fetch & display raw news (no AI) ────────────
export async function fetchNews() {
  if (isScanning) return;
  if (selectedCategories.size === 0) { toast('Select at least one category', 'error'); return; }

  setIsScanning(true);
  const scanBtn    = document.getElementById('scanBtn');
  const analyzeBtn = document.getElementById('analyzeBtn');
  if (scanBtn)    scanBtn.disabled    = true;
  if (analyzeBtn) analyzeBtn.disabled = true;

  setStatus('active', 'FETCHING');
  setProgress(5);

  const dateRange = getDateRange();
  const otxKey    = document.getElementById('keyOTX').value.trim();

  ['nvd','cisa','otx','malware','bc','thn','sans','sw','arxiv'].forEach(s =>
    setSrc(s, 'idle', 'IDLE')
  );
  setSrc('claude', 'idle', 'IDLE');

  document.getElementById('resultsCount').textContent = 'Fetching news feed…';

  let allRaw = [];

  try {
    setProgress(10);
    const [nvdData, cisaData] = await Promise.all([fetchNVD(dateRange), fetchCISA(dateRange)]);
    allRaw.push(...nvdData, ...cisaData);
    setProgress(30);

    const [otxData, malwareData] = await Promise.all([fetchOTX(otxKey), fetchMalwareBazaar()]);
    allRaw.push(...otxData, ...malwareData);
    setProgress(50);

    const rssResults = await Promise.all(RSS_FEEDS.map(f => fetchRSS(f.id, f.url, f.name)));
    rssResults.forEach(r => allRaw.push(...r));
    setProgress(65);

    const arxivData = await fetchArXiv();
    allRaw.push(...arxivData);
    setProgress(80);

    const filtered = filterByDate(allRaw, dateRange);

    if (filtered.length === 0) {
      toast('No articles found for the selected date range.', 'warning');
      document.getElementById('resultsCount').textContent = '0 articles';
      document.getElementById('cardsGrid').innerHTML = `
        <div class="empty-state">
          <i class="ti ti-calendar-off"></i>
          <h3>No articles found</h3>
          <p>Try a wider date range.</p>
        </div>`;
    } else {
      renderNewsCards(filtered);
      document.getElementById('resultsCount').innerHTML = `<span>${filtered.length}</span> articles loaded`;
      toast(`${filtered.length} articles fetched`, 'success');
      updateRefreshInfo(new Date());
    }

    setProgress(100);
    setTimeout(() => setProgress(0), 800);
    setStatus('active', 'LIVE');

  } catch (e) {
    toast('Fetch error: ' + e.message, 'error');
    setStatus('error', 'ERROR');
    setProgress(0);
  }

  setIsScanning(false);
  if (scanBtn) scanBtn.disabled = false;
  setTimeout(() => setStatus('', 'STANDBY'), 5000);
  scheduleRefresh();
}

function filterByDate(items, dateRange) {
  if (!dateRange.from && !dateRange.to) return items;
  const from = dateRange.from ? new Date(dateRange.from) : null;
  const to   = dateRange.to   ? new Date(dateRange.to + 'T23:59:59') : null;
  return items.filter(item => {
    if (!item.raw_date) return true;
    const d = new Date(item.raw_date);
    if (from && d < from) return false;
    if (to   && d > to)   return false;
    return true;
  });
}

function scheduleRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    toast('Auto-refreshing news feed…', 'info');
    fetchNews();
  }, REFRESH_INTERVAL_MS);
}

// ── MODE 2: AI analysis of loaded news cards ────────────
export async function analyzeNews() {
  if (isScanning) return;

  const { provider, apiKey } = getAIConfig();
  if (!apiKey) {
    toast('API key required for AI analysis', 'error');
    document.getElementById('keysPanel').classList.add('open');
    document.getElementById('keysToggle').classList.add('open');
    return;
  }
  if (selectedCategories.size === 0) { toast('Select at least one category', 'error'); return; }
  if (selectedSeverities.size === 0) { toast('Select at least one severity',  'error'); return; }

  const currentNews = rawNews;
  if (!currentNews || currentNews.length === 0) {
    toast('No news loaded. Refresh the feed first.', 'error');
    return;
  }

  setIsScanning(true);
  const scanBtn    = document.getElementById('scanBtn');
  const analyzeBtn = document.getElementById('analyzeBtn');
  if (scanBtn)    scanBtn.disabled    = true;
  if (analyzeBtn) analyzeBtn.disabled = true;

  setStatus('active', 'ANALYZING');
  setProgress(10);

  const aiSrcName = document.getElementById('ai-src-name');
  if (aiSrcName) aiSrcName.textContent = (PROVIDER_LABELS[provider] || 'AI') + ' Analysis';
  setSrc('claude', 'loading', 'ANALYZING');

  document.getElementById('resultsCount').textContent = `Analyzing ${currentNews.length} articles with ${PROVIDER_LABELS[provider] || provider}…`;

  try {
    const dateRange = getDateRange();
    toast(`Sending ${currentNews.length} articles to ${PROVIDER_LABELS[provider] || provider}…`, 'info');

    const result = await analyzeWithAI(currentNews, provider, apiKey, null, dateRange, selectedCategories, selectedSeverities);
    setProgress(90);

    const analysedThreats = result.threats || [];
    setThreats(analysedThreats);
    updateStats(analysedThreats);

    if (result.digest) {
      document.getElementById('digestText').textContent = result.digest;
      document.getElementById('digestCard').classList.add('show');
    }

    renderCards(analysedThreats);
    document.getElementById('resultsCount').innerHTML = `<span>${analysedThreats.length}</span> threats found`;

    setSrc('claude', 'ok', 'OK ✓');
    setProgress(100);
    setTimeout(() => setProgress(0), 800);
    setStatus('active', 'ANALYSIS COMPLETE');
    toast(`Analysis complete — ${analysedThreats.length} threats`, 'success');

  } catch (e) {
    toast('Analysis error: ' + e.message, 'error');
    setStatus('error', 'ERROR');
    setSrc('claude', 'err', 'ERR');
    setProgress(0);
  }

  setIsScanning(false);
  if (scanBtn)    scanBtn.disabled    = false;
  if (analyzeBtn) analyzeBtn.disabled = false;
  setTimeout(() => setStatus('', 'STANDBY'), 5000);
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