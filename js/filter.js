const TYPE_MAP = {
  cve:      { types: ['CVE'],                       cats: ['CVE/Exploit'] },
  malware:  { types: ['MALWARE', 'MALWAREBAZAAR'],  cats: ['Malware/Ransomware', 'New Tool'] },
  breach:   { types: ['BREACH', 'DATA BREACH'],     cats: ['Data Breach'] },
  ai:       { types: ['AI'],                        cats: ['AI Model Attacks','AI-Powered Attacks','LLM Vulnerabilities','AI Supply Chain','AI Surveillance','AI Infrastructure','AI Policy & Regulation','AI Security Research'] },
  news:     { types: ['NEWS', 'ARTICLE'],           cats: ['Cyber Attack','Nation-State','Threat Actor'] },
  research: { types: ['RESEARCH', 'ARXIV'],         cats: ['New Technology','AI Security Research'] },
};

let activeTypeFilter = 'all';

export function initTypeFilter() {
  document.getElementById('typeFilterBar').addEventListener('click', e => {
    const btn = e.target.closest('.type-filter');
    if (!btn) return;
    document.querySelectorAll('.type-filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeTypeFilter = btn.dataset.type;
    applyTypeFilter();
  });
}

export function applyTypeFilter() {
  const grid = document.getElementById('cardsGrid');
  if (!grid) return;

  if (activeTypeFilter === 'all') {
    grid.querySelectorAll('.news-card, .threat-card').forEach(c => c.style.display = '');
    return;
  }

  const map = TYPE_MAP[activeTypeFilter];
  if (!map) return;

  // Mode 1 — news cards: match .news-type-badge text
  grid.querySelectorAll('.news-card').forEach(card => {
    const badge = card.querySelector('.news-type-badge');
    const val = badge ? badge.textContent.trim().toUpperCase() : '';
    card.style.display = map.types.includes(val) ? '' : 'none';
  });

  // Mode 2 — threat cards: match .cat-badge text
  grid.querySelectorAll('.threat-card').forEach(card => {
    const badges = [...card.querySelectorAll('.cat-badge')].map(b => b.textContent.trim());
    card.style.display = badges.some(b => map.cats.includes(b)) ? '' : 'none';
  });
}