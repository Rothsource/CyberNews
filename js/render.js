import { threats, setThreats } from './state.js';
import { deepDive } from './ai.js';

const AI_CATS = new Set([
  'AI Model Attacks', 'AI-Powered Attacks', 'LLM Vulnerabilities',
  'AI Supply Chain', 'AI Surveillance', 'AI Infrastructure',
  'AI Policy & Regulation', 'AI Security Research'
]);

export function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export function renderCards(data) {
  const grid = document.getElementById('cardsGrid');
  if (!data || data.length === 0) {
    grid.innerHTML = `<div class="empty-state"><i class="ti ti-shield-off"></i><h3>No threats found</h3><p>Try adjusting your filters or date range.</p></div>`;
    return;
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
      const idx      = parseInt(btn.dataset.index, 10);
      const panel    = document.getElementById('dd-' + idx);
      const provider = document.getElementById('aiProvider').value;
      const apiKey   = document.getElementById('keyAI').value.trim();
      const model    = document.getElementById('aiModel').value;
      deepDive(threats[idx], panel, provider, apiKey, model);
    });
  });
}

export function sortCards() {
  const mode     = document.getElementById('sortSelect').value;
  const sevOrder = { Critical:0, High:1, Medium:2, Low:3 };
  const sorted   = [...threats];
  if (mode === 'severity') sorted.sort((a,b) => (sevOrder[a.severity]??4)-(sevOrder[b.severity]??4));
  else if (mode === 'date') sorted.sort((a,b) => (b.date||'').localeCompare(a.date||''));
  else if (mode === 'ai')   sorted.sort((a,b) => (b.is_ai_related?1:0)-(a.is_ai_related?1:0));
  renderCards(sorted);
}