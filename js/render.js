import { threats, setThreats, rawNews, setRawNews } from './state.js';
import { deepDive } from './ai.js';
import { detectTrends } from './classify.js';

const AI_CATS = new Set([
  'AI Model Attacks','AI-Powered Attacks','LLM Vulnerabilities','AI Supply Chain',
  'AI Surveillance','AI Infrastructure','AI Policy & Regulation','AI Security Research'
]);

const SOURCE_COLORS = {
  'NVD / NIST':           '#ff6b6b',
  'CISA KEV':             '#ffa94d',
  'BleepingComputer':     '#a9e34b',
  'The Hacker News':      '#4dabf7',
  'SANS ISC':             '#da77f2',
  'SecurityWeek':         '#ffd43b',
  'ArXiv CS.CR':          '#63e6be',
  'AlienVault OTX':       '#ff8787',
  'MalwareBazaar':        '#f783ac',
  'Exploit-DB':           '#ff6b6b',
  'Schneier on Security': '#74c0fc',
  'Ars Technica':         '#f8982d',
  'MIT Tech Review':      '#e64980',
  'The Verge':            '#cc5de8',
};

const TYPE_COLORS = {
  'CVE':          '#ff6b6b',
  'EXPLOIT':      '#ff4444',
  'MALWARE':      '#f783ac',
  'AI':           '#4dabf7',
  'CYBER ATTACK': '#ffa94d',
  'RESEARCH':     '#63e6be',
  'THREAT_INTEL': '#da77f2',
  'NEWS':         '#adb5bd',
};

let activeSourceFilters = new Set();

export function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── TREND PANEL ────────────────────────────────────────
function renderTrendPanel(items) {
  let panel = document.getElementById('trendPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'trendPanel';
    panel.className = 'trend-panel';
    const grid = document.getElementById('cardsGrid');
    grid.parentElement.insertBefore(panel, grid);
  }

  const t = detectTrends(items);

  panel.innerHTML = `
    <div class="trend-section">
      <div class="trend-title"><i class="ti ti-flame"></i> TRENDING NOW</div>
      <div class="trend-pills">
        ${t.topTypes.map(x => `<span class="trend-pill" style="color:${TYPE_COLORS[x.type]||'#adb5bd'}">${x.type} <span class="trend-count">${x.count}</span></span>`).join('')}
      </div>
    </div>
    <div class="trend-section">
      <div class="trend-title"><i class="ti ti-trophy"></i> TOP 5 TODAY</div>
      <div class="top5-list">
        ${t.top5.map((item, i) => `
          <div class="top5-item">
            <span class="top5-rank">#${i+1}</span>
            <span class="top5-title">${escHtml((item.raw_title||'').slice(0,60))}${item.raw_title?.length > 60 ? '…' : ''}</span>
            <span class="top5-score score-${item.threat_label||'low'}">${item.threat_score||0}</span>
          </div>`).join('')}
      </div>
    </div>
    <div class="trend-section trend-stats">
      <div class="trend-stat"><i class="ti ti-robot"></i><span>${t.aiCount}</span><label>AI Related</label></div>
      <div class="trend-stat"><i class="ti ti-bug"></i><span>${t.exploitCount}</span><label>Exploits</label></div>
      <div class="trend-stat"><i class="ti ti-alert-triangle"></i><span>${t.criticalCount}</span><label>Critical</label></div>
      <div class="trend-stat"><i class="ti ti-news"></i><span>${t.total}</span><label>Total</label></div>
    </div>`;
}

// ── SOURCE FILTER TABS ─────────────────────────────────
function renderSourceTabs(items) {
  const sources = ['All', ...new Set(items.map(i => i.source))];
  if (activeSourceFilters.size === 0) {
    sources.filter(s => s !== 'All').forEach(s => activeSourceFilters.add(s));
  }

  let bar = document.getElementById('sourceTabBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'sourceTabBar';
    bar.className = 'source-tab-bar';
    document.getElementById('modeBanner').insertAdjacentElement('afterend', bar);
  }

  bar.innerHTML = sources.map(src => {
    const color    = SOURCE_COLORS[src] || 'var(--green)';
    const isAll    = src === 'All';
    const allActive = activeSourceFilters.size === sources.length - 1;
    const isActive = isAll ? allActive : activeSourceFilters.has(src);
    const style    = isActive
      ? `background:${isAll ? 'rgba(255,255,255,0.08)' : color+'18'}; border-color:${isAll ? 'rgba(255,255,255,0.25)' : color+'60'}; color:${isAll ? '#fff' : color};`
      : '';
    return `<button class="source-tab${isActive?' active':''}" data-source="${escHtml(src)}" style="${style}">${escHtml(src)}</button>`;
  }).join('');

  bar.querySelectorAll('.source-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const src = btn.dataset.source;
      if (src === 'All') {
        const allSrcs = sources.filter(s => s !== 'All');
        if (activeSourceFilters.size === allSrcs.length) activeSourceFilters.clear();
        else allSrcs.forEach(s => activeSourceFilters.add(s));
      } else {
        if (activeSourceFilters.has(src)) activeSourceFilters.delete(src);
        else activeSourceFilters.add(src);
      }
      applySourceFilter(items);
      renderSourceTabs(items);
    });
  });
}

function applySourceFilter(items) {
  const filtered = activeSourceFilters.size === 0 ? items : items.filter(i => activeSourceFilters.has(i.source));
  renderNewsGrid(filtered);
  document.getElementById('resultsCount').innerHTML = `<span>${filtered.length}</span> of ${items.length} articles`;
}

// ── MODE 1: News cards ─────────────────────────────────
export function renderNewsCards(items) {
  const grid = document.getElementById('cardsGrid');
  if (!items || items.length === 0) {
    grid.innerHTML = `<div class="empty-state"><i class="ti ti-rss-off"></i><h3>No articles found</h3><p>Try adjusting your date range.</p></div>`;
    return;
  }

  setRawNews(items);
  activeSourceFilters = new Set(items.map(i => i.source));

  renderTrendPanel(items);
  renderSourceTabs(items);
  renderNewsGrid(items);

  const analyzeBtn = document.getElementById('analyzeBtn');
  if (analyzeBtn) analyzeBtn.disabled = false;

  const banner = document.getElementById('modeBanner');
  if (banner) {
    banner.className = 'mode-banner';
    banner.innerHTML = `<i class="ti ti-rss"></i><span><strong>NEWS FEED MODE</strong> — ${items.length} articles loaded. Click <strong>ANALYZE WITH AI</strong> for structured threat intelligence.</span>`;
  }
}

function renderNewsGrid(items) {
  const grid = document.getElementById('cardsGrid');
  if (!items || items.length === 0) {
    grid.innerHTML = `<div class="empty-state"><i class="ti ti-filter-off"></i><h3>No articles match</h3><p>Select more sources above.</p></div>`;
    return;
  }
  grid.innerHTML = items.map((item, i) => {
    const color       = SOURCE_COLORS[item.source] || 'var(--green)';
    const typeColor   = TYPE_COLORS[item.type] || '#adb5bd';
    const sourceStyle = `background:${color}18; border-color:${color}40; color:${color}`;
    const hasLink     = item.raw_link && item.raw_link.startsWith('http');

    // Badges
    const badgeHtml = (item.badges || []).map(b => {
      const bColor = b==='CRITICAL'?'#ff4444': b==='EXPLOIT'?'#ffa94d': b==='AI'?'#4dabf7': b==='NEW'?'#a9e34b':'#adb5bd';
      return `<span class="news-badge" style="background:${bColor}22;border-color:${bColor}60;color:${bColor}">${b}</span>`;
    }).join('');

    // Entities
    const cveHtml = (item.entities?.cves || []).map(c =>
      `<span class="entity-tag cve">${escHtml(c)}</span>`).join('');
    const actorHtml = (item.entities?.actors || []).map(a =>
      `<span class="entity-tag actor">${escHtml(a)}</span>`).join('');
    const malwareHtml = (item.entities?.malware || []).map(m =>
      `<span class="entity-tag malware">${escHtml(m)}</span>`).join('');
    const entitiesHtml = (cveHtml + actorHtml + malwareHtml)
      ? `<div class="entity-row">${cveHtml}${actorHtml}${malwareHtml}</div>` : '';

    // Why it matters
    const whyHtml = item.why_it_matters
      ? `<div class="why-matters"><i class="ti ti-info-circle"></i>${escHtml(item.why_it_matters)}</div>` : '';

    // Threat score bar
    const scoreColor = item.threat_label==='critical'?'#ff4444': item.threat_label==='trending'?'#ffa94d':'#63e6be';
    const scoreHtml = `<div class="threat-score-bar"><div class="threat-score-fill" style="width:${item.threat_score||0}%;background:${scoreColor}"></div></div>`;

    return `
      <div class="news-card threat-label-${item.threat_label||'low'}" style="animation-delay:${i*0.03}s">
        <div class="news-card-header">
          <span class="news-source-badge" style="${sourceStyle}">${escHtml(item.source)}</span>
          <div class="news-card-header-right">
            <span class="news-type-tag" style="color:${typeColor};border-color:${typeColor}40">${escHtml(item.type||'NEWS')}</span>
            <span class="news-date">${escHtml(item.raw_date||'')}</span>
          </div>
        </div>
        ${badgeHtml ? `<div class="badge-row">${badgeHtml}</div>` : ''}
        <div class="news-title">${escHtml(item.raw_title||'')}</div>
        ${item.raw_desc ? `<div class="news-desc">${escHtml(item.raw_desc)}</div>` : ''}
        ${whyHtml}
        ${entitiesHtml}
        ${scoreHtml}
        <div class="news-footer">
          <span class="score-label" style="color:${scoreColor}">THREAT SCORE: ${item.threat_score||0}</span>
          ${hasLink ? `<a class="news-read-more" href="${escHtml(item.raw_link)}" target="_blank" rel="noopener">Read More <i class="ti ti-external-link"></i></a>` : ''}
        </div>
      </div>`;
  }).join('');
}

// ── MODE 2: AI threat cards ────────────────────────────
export function renderCards(data) {
  const grid = document.getElementById('cardsGrid');
  const bar  = document.getElementById('sourceTabBar');
  if (bar) bar.remove();
  const tp = document.getElementById('trendPanel');
  if (tp) tp.remove();

  if (!data || data.length === 0) {
    grid.innerHTML = `<div class="empty-state"><i class="ti ti-shield-off"></i><h3>No threats found</h3><p>Try adjusting filters.</p></div>`;
    return;
  }

  const banner = document.getElementById('modeBanner');
  if (banner) {
    banner.className = 'mode-banner ai-mode';
    banner.innerHTML = `<i class="ti ti-brain"></i><span><strong>AI ANALYSIS MODE</strong> — ${data.length} structured threats. Refresh news feed to start over.</span>`;
  }

  grid.innerHTML = data.map((t, i) => {
    const cats     = Array.isArray(t.categories) ? t.categories : [t.categories||'Unknown'];
    const affected = Array.isArray(t.affected_systems) ? t.affected_systems : [];
    const catBadges = cats.slice(0,3).map(c =>
      `<span class="cat-badge ${AI_CATS.has(c)?'ai':'cyber'}">${escHtml(c)}</span>`).join('');
    const affectedTags = affected.length
      ? `<div class="affected-tags">${affected.slice(0,6).map(a=>`<span class="affected-tag">${escHtml(a)}</span>`).join('')}</div>` : '';
    const metaItems = [
      t.attack_vector       ? `<div class="meta-item"><i class="ti ti-route"></i><span>${escHtml(t.attack_vector)}</span></div>` : '',
      t.ai_system_affected  ? `<div class="meta-item"><i class="ti ti-robot"></i><span>${escHtml(t.ai_system_affected)}</span></div>` : '',
      t.top_targeted_sector ? `<div class="meta-item"><i class="ti ti-building"></i><span>${escHtml(t.top_targeted_sector)}</span></div>` : '',
    ].join('');
    const actionBox = t.recommended_action
      ? `<div class="action-box"><i class="ti ti-bulb"></i><div><div class="action-label">RECOMMENDED ACTION</div><div class="action-text">${escHtml(t.recommended_action)}</div></div></div>` : '';
    const whyBox = t.why_it_matters
      ? `<div class="why-matters"><i class="ti ti-info-circle"></i>${escHtml(t.why_it_matters)}</div>` : '';

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
        ${whyBox}
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
    if (mode === 'date')  sorted.sort((a,b) => (b.raw_date||'').localeCompare(a.raw_date||''));
    else if (mode === 'severity') sorted.sort((a,b) => (b.threat_score||0)-(a.threat_score||0));
    renderNewsCards(sorted);
  }
}