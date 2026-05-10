const TYPE_MAP = {
  cve: {
    types: ['cve'],
    cats: ['cve/exploit']
  },
  malware: {
    types: ['malware', 'malwarebazaar'],
    cats: ['malware/ransomware', 'new tool']
  },
  breach: {
    types: ['breach', 'data breach'],
    cats: ['data breach']
  },
  ai: {
    types: ['ai'],
    cats: [
      'ai model attacks',
      'ai-powered attacks',
      'llm vulnerabilities',
      'ai supply chain',
      'ai surveillance',
      'ai infrastructure',
      'ai policy & regulation',
      'ai security research'
    ]
  },
  news: {
    types: ['news', 'article'],
    cats: ['cyber attack', 'nation-state', 'threat actor']
  },
  research: {
    types: ['research', 'arxiv'],
    cats: ['new technology', 'ai security research']
  }
};

let activeTypeFilter = 'all';

// 🔧 Normalize helper (key fix)
function normalize(text) {
  return (text || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' '); // remove double spaces
}

export function initTypeFilter() {
  const bar = document.getElementById('typeFilterBar');
  if (!bar) return;

  bar.addEventListener('click', e => {
    const btn = e.target.closest('.type-filter');
    if (!btn) return;

    document.querySelectorAll('.type-filter').forEach(b =>
      b.classList.remove('active')
    );

    btn.classList.add('active');
    activeTypeFilter = btn.dataset.type;

    applyTypeFilter();
  });
}

export function applyTypeFilter() {
  const grid = document.getElementById('cardsGrid');
  if (!grid) return;

  const allCards = grid.querySelectorAll('.news-card, .threat-card');

  // ✅ Show all
  if (activeTypeFilter === 'all') {
    allCards.forEach(c => (c.style.display = ''));
    return;
  }

  const map = TYPE_MAP[activeTypeFilter];
  if (!map) return;

  // Normalize config once
  const typeList = map.types.map(normalize);
  const catList = map.cats.map(normalize);

  // 🔹 Mode 1 — news cards
  grid.querySelectorAll('.news-card').forEach(card => {
    const badge = card.querySelector('.news-type-badge');
    const val = normalize(badge?.textContent);

    // ✅ flexible match (includes instead of exact)
    const match = typeList.some(t => val.includes(t));

    card.style.display = match ? '' : 'none';
  });

  // 🔹 Mode 2 — threat cards
  grid.querySelectorAll('.threat-card').forEach(card => {
    const badges = [...card.querySelectorAll('.cat-badge')]
      .map(b => normalize(b.textContent));

    // ✅ flexible + resilient match
    const match = badges.some(b =>
      catList.some(c => b.includes(c))
    );

    card.style.display = match ? '' : 'none';
  });
}