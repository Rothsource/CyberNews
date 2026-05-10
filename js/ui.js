import { selectedSeverities, selectedCategories, setSelectedDate, state } from './state.js';

// ── CLOCK ──────────────────────────────────────────────
export function updateClock() {
  document.getElementById('headerTime').textContent =
    new Date().toUTCString().replace('GMT', 'UTC');
}
setInterval(updateClock, 1000);
updateClock();

// ── API KEY PANEL ──────────────────────────────────────
export function toggleKeys() {
  document.getElementById('keysPanel').classList.toggle('open');
  document.getElementById('keysToggle').classList.toggle('open');
}

export function toggleKeyVis(id, btn) {
  const input = document.getElementById(id);
  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';
  btn.querySelector('i').className = isPassword ? 'ti ti-eye-off' : 'ti ti-eye';
}

// ── DATE FILTER ────────────────────────────────────────
export function setDate(el) {
  document.querySelectorAll('.date-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  setSelectedDate(el.dataset.range);
  document.getElementById('customDateRange')
    .classList.toggle('show', el.dataset.range === 'custom');
}

// ── SEVERITY / CATEGORY TOGGLES ────────────────────────
export function toggleSev(el) {
  const sev = el.dataset.sev;
  if (el.classList.contains('active')) {
    el.classList.remove('active');
    selectedSeverities.delete(sev);
  } else {
    el.classList.add('active');
    selectedSeverities.add(sev);
  }
}

export function toggleCat(el) {
  const cat = el.dataset.cat;
  if (el.classList.contains('active')) {
    el.classList.remove('active');
    selectedCategories.delete(cat);
  } else {
    el.classList.add('active');
    selectedCategories.add(cat);
  }
}

export function selectGroup(group) {
  document.querySelectorAll(`.cat-pill[data-group="${group}"]`).forEach(p => {
    p.classList.add('active');
    selectedCategories.add(p.dataset.cat);
  });
}

export function clearGroup(group) {
  document.querySelectorAll(`.cat-pill[data-group="${group}"]`).forEach(p => {
    p.classList.remove('active');
    selectedCategories.delete(p.dataset.cat);
  });
}

export function selectAll() {
  document.querySelectorAll('.cat-pill').forEach(p => {
    p.classList.add('active');
    selectedCategories.add(p.dataset.cat);
  });
}

// ── STATUS / PROGRESS ──────────────────────────────────
export function setStatus(type, text) {
  const dot = document.getElementById('statusDot');
  dot.className = 'pulse-dot' + (type ? ' ' + type : '');
  document.getElementById('statusText').textContent = text;
}

export function setSrc(id, type, label) {
  const el = document.getElementById('src-' + id);
  if (el) { el.className = 'source-badge ' + type; el.textContent = label; }
}

export function setProgress(pct) {
  document.getElementById('progressBar').style.width = pct + '%';
  document.getElementById('progressWrap').classList.toggle('show', pct > 0 && pct < 100);
}

// ── TOAST ──────────────────────────────────────────────
export function toast(msg, type = 'info') {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

// ── MODAL ──────────────────────────────────────────────
export function closeModal(e) {
  if (e.target === document.getElementById('modalBackdrop'))
    document.getElementById('modalBackdrop').classList.remove('show');
}

// ── DATE RANGE HELPER ──────────────────────────────────
export function getDateRange() {
  const now = new Date();
  const fmt = d => d.toISOString().split('T')[0];

  // Read from state object — always gets the current value, not a stale snapshot
  const range = state.selectedDate || 'today';

  if (range === 'today') {
    return { from: fmt(now), to: fmt(now) };
  } else if (range === 'yesterday') {
    const y = new Date(now); y.setDate(y.getDate() - 1);
    return { from: fmt(y), to: fmt(y) };
  } else if (range === '7d') {
    const s = new Date(now); s.setDate(s.getDate() - 7);
    return { from: fmt(s), to: fmt(now) };
  } else if (range === '30d') {
    const s = new Date(now); s.setDate(s.getDate() - 30);
    return { from: fmt(s), to: fmt(now) };
  } else {
    return {
      from: document.getElementById('dateFrom').value || fmt(now),
      to:   document.getElementById('dateTo').value   || fmt(now)
    };
  }
}