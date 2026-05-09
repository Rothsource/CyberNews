import { threats, setThreats, rawNews, setRawNews } from './state.js';
import { deepDive } from './ai.js';
import { applyTypeFilter } from './filter.js';

const AI_CATS = new Set([
  'AI Model Attacks', 'AI-Powered Attacks', 'LLM Vulnerabilities',
  'AI Supply Chain', 'AI Surveillance', 'AI Infrastructure',
  'AI Policy & Regulation', 'AI Security Research'
]);

const SOURCE_COLORS = {
  'NVD / NIST':       '#ff6b6b',
  'CISA KEV':         '#ffa94d',
  'BleepingComputer': '#a9e34b',
  'The Hacker News':  '#4dabf7',
  'SANS ISC':         '#da77f2',
  'SecurityWeek':     '#ffd43b',
  'ArXiv CS.CR':      '#63e6be',
  'AlienVault OTX':   '#ff8787',
  'MalwareBazaar':    '#f783ac',
};

export function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── MODE 1: Raw news cards ──────────────────────────────
export function renderNewsCards(items) {
  const grid = document.getElementById('cardsGrid');
  if (!items || items.length === 0) {
    grid.innerHTML = `<div class="empty-state"><i class="ti ti-rss-off"></i><h3>No articles found</h3><p>Try adjusting your date range or check your network connection.</p></div>`;
    return; // applyTypeFilter not needed — no cards to filter
  }

  setRawNews(items);

  grid.innerHTML = items.map((item, i) => {
    const color = SOURCE_COLORS[item.source] || 'var(--green)';
    const sourceStyle = `background:${color}18; border-color:${color}40; color:${color}`;
    const hasLink = item.raw_link && item.raw_link.startsWith('http');
    const readMoreEl = hasLink
      ? `<a class="news-read-more" href="${escHtml(item.raw_link)}" target="_blank" rel="noopener">
           Read More <i class="ti ti-external-link"></i>
         </a>`
      : '';

    return `
      <div class="news-card" style="animation-delay:${i * 0.04}s">
        <div class="news-card-header">
          <span class="news-source-badge" style="${sourceStyle}">${escHtml(item.source)}</span>
          <span class="news-date">${escHtml(item.raw_date || '')}</span>
        </div>
        <div class="news-title">${escHtml(item.raw_title || '')}</div>
        ${item.raw_desc ? `<div class="news-desc">${escHtml(item.raw_desc)}</div>` : ''}
        <div class="news-footer">
          <span class="news-type-badge">${escHtml(item.type || 'NEWS')}</span>
          ${readMoreEl}
        </div>
      </div>`;
  }).join('');

  const analyzeBtn = document.getElementById('analyzeBtn');
  if (analyzeBtn) analyzeBtn.disabled = false;

  const banner = document.getElementById('modeBanner');
  if (banner) {
    banner.className = 'mode-banner';
    banner.innerHTML = `
      <i class="ti ti-rss"></i>
      <span><strong>NEWS FEED MODE</strong> — ${items.length} articles loaded. Click <strong>ANALYZE WITH AI</strong> for structured threat intelligence.</span>`;
  }

  applyTypeFilter();
}

// ── MODE 2: AI-analyzed threat cards ───────────────────
export function renderCards(data) {
  const grid = document.getElementById('cardsGrid');
  if (!data || data.length === 0) {
    grid.innerHTML = `<div class="empty-state"><i class="ti ti-shield-off"></i><h3>No threats found</h3><p>Try adjusting your filters or date range.</p></div>`;
    return; // applyTypeFilter not needed — no cards to filter
  }

  const banner = document.getElementById('modeBanner');
  if (banner) {
    banner.className = 'mode-banner ai-mode';
    banner.innerHTML = `
      <i class="ti ti-brain"></i>
      <span><strong>AI ANALYSIS MODE</strong> — ${data.length} structured threats. Refresh news feed to start over.</span>`;
  }

  grid.innerHTML = data.map((t, i) => {
    const cats     = Array.isArray(t.categories) ? t.categories : [t.categories || 'Unknown'];
    const affected = Array.isArray(t.affected_systems) ? t.affected_systems : [];
    const catBadges = cats.slice(0,3).map(c =>
      `<span class="cat-badge ${AI_CATS.has(c)?'ai':'cyber'}">${escHtml(c)}</span>`
    ).join('');
    const affectedTags = affected.length
      ? `<div class="affected-tags">${affected.slice(0,6).map(a=>`<span class="affected-tag">${escHtml(a)}</span>`).join('')}</div>`
      : '';
    const metaItems = [
      t.attack_vector       ? `<div class="meta-item"><i class="ti ti-route"></i><span>${escHtml(t.attack_vector)}</span></div>` : '',
      t.ai_system_affected  ? `<div class="meta-item"><i class="ti ti-robot"></i><span>${escHtml(t.ai_system_affected)}</span></div>` : '',
      t.top_targeted_sector ? `<div class="meta-item"><i class="ti ti-building"></i><span>${escHtml(t.top_targeted_sector)}</span></div>` : '',
    ].join('');
    const actionBox = t.recommended_action
      ? `<div class="action-box"><i class="ti ti-bulb"></i><div><div class="action-label">RECOMMENDED ACTION</div><div class="action-text">${escHtml(t.recommended_action)}</div></div></div>`
      : '';
    return `
      <div class="threat-card border-${escHtml(t.severity||'Low')}" style="animation-delay:${i*0.05}s">
        <div class="card-header">
          <div class="card-header-left">
            <span class="sev-badge ${escHtml(t.severity||'Low')}">${escHtml(t.severity||'Low')}</span>
            ${catBadges}
            ${t.is_ai_related?'<span class="ai-badge"><i class="ti ti-brain"></i> AI</span>':''}
          </div>
          <span class="card-date">${escHtml(t.date||'')}</span>
        </div>
        <div class="card-title">${escHtml(t.title||'')}</div>
        <div class="card-summary">${escHtml(t.summary||'')}</div>
        ${affectedTags}
        <div class="card-meta">${metaItems}</div>
        ${actionBox}
        <div class="card-footer">
          <div class="source-info"><i class="ti ti-antenna"></i>${escHtml(t.source||'')}</div>
          <button class="deep-dive-btn" data-index="${i}"><i class="ti ti-microscope"></i> Deep Dive</button>
        </div>
        <div class="deep-dive-panel" id="dd-${i}"></div>
      </div>`;
  }).join('');

  grid.querySelectorAll('.deep-dive-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx    = parseInt(btn.dataset.index, 10);
      const panel  = document.getElementById('dd-' + idx);
      const apiKey = document.getElementById('keyAI').value.trim();
      deepDive(threats[idx], panel, null, apiKey, null);
    });
  });

  applyTypeFilter();
}

export function sortCards() {
  const mode     = document.getElementById('sortSelect').value;
  const sevOrder = { Critical:0, High:1, Medium:2, Low:3 };

  if (threats && threats.length > 0) {
    const sorted = [...threats];
    if (mode === 'severity') sorted.sort((a,b) => (sevOrder[a.severity]??4)-(sevOrder[b.severity]??4));
    else if (mode === 'date') sorted.sort((a,b) => (b.date||'').localeCompare(a.date||''));
    else if (mode === 'ai')   sorted.sort((a,b) => (b.is_ai_related?1:0)-(a.is_ai_related?1:0));
    renderCards(sorted);
  } else if (rawNews && rawNews.length > 0) {
    const sorted = [...rawNews];
    if (mode === 'date') sorted.sort((a,b) => (b.raw_date||'').localeCompare(a.raw_date||''));
    renderNewsCards(sorted);
  }
}