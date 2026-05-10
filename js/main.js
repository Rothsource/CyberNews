import { toggleKeys, toggleKeyVis, setDate, toggleSev, toggleCat, selectGroup, clearGroup, selectAll, closeModal } from './ui.js';
import { sortCards } from './render.js';
import { fetchNews, analyzeNews } from './scan.js';
import { setProvider } from './state.js';

const PROVIDER_META = {
  claude: { label: 'ANTHROPIC API KEY *', placeholder: 'sk-ant-...',  srcName: 'Claude Analysis'  },
  openai: { label: 'OPENAI API KEY *',    placeholder: 'sk-...',      srcName: 'ChatGPT Analysis' },
  gemini: { label: 'GOOGLE API KEY *',    placeholder: 'AIza...',     srcName: 'Gemini Analysis'  },
  grok:   { label: 'XAI API KEY *',       placeholder: 'xai-...',     srcName: 'Grok Analysis'    },
};

const keyLabel  = document.getElementById('aiKeyLabel');
const keyInput  = document.getElementById('keyAI');
const aiSrcName = document.getElementById('ai-src-name');

document.querySelectorAll('.provider-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    const provider = pill.dataset.provider;
    document.querySelectorAll('.provider-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    const meta = PROVIDER_META[provider];
    if (keyLabel)  keyLabel.textContent  = meta.label;
    if (keyInput)  keyInput.placeholder  = meta.placeholder;
    if (aiSrcName) aiSrcName.textContent = meta.srcName;
    setProvider(provider);
  });
});

document.getElementById('keysToggle').addEventListener('click', toggleKeys);
document.querySelectorAll('.key-eye').forEach(btn => {
  btn.addEventListener('click', () => toggleKeyVis(btn.dataset.target, btn));
});

// Date pills — re-fetch on change, skip custom until both dates filled
document.querySelectorAll('.date-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    setDate(pill);
    if (pill.dataset.range !== 'custom') fetchNews();
  });
});

const dateFrom = document.getElementById('dateFrom');
const dateTo   = document.getElementById('dateTo');
function onCustomDateChange() {
  if (dateFrom.value && dateTo.value) fetchNews();
}
dateFrom.addEventListener('change', onCustomDateChange);
dateTo.addEventListener('change', onCustomDateChange);

document.querySelectorAll('.sev-pill').forEach(pill => {
  pill.addEventListener('click', () => toggleSev(pill));
});
document.querySelectorAll('.cat-pill').forEach(pill => {
  pill.addEventListener('click', () => toggleCat(pill));
});
document.querySelectorAll('.cat-ctrl-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.groupAction === 'select') selectGroup(btn.dataset.group);
    else clearGroup(btn.dataset.group);
  });
});
document.getElementById('selectAllBtn').addEventListener('click', selectAll);

// Scan button
document.getElementById('scanBtn').addEventListener('click', fetchNews);

// Analyze button — reads selected AI mode
document.getElementById('analyzeBtn').addEventListener('click', () => {
  const mode = document.getElementById('aiModeSelect')?.value || 'general';
  analyzeNews(mode);
});

// AI mode pills
document.querySelectorAll('.ai-mode-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.ai-mode-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    if (document.getElementById('aiModeSelect')) {
      document.getElementById('aiModeSelect').value = pill.dataset.mode;
    }
  });
});

document.getElementById('sortSelect').addEventListener('change', sortCards);
document.getElementById('modalBackdrop').addEventListener('click', closeModal);
document.getElementById('modalClose').addEventListener('click', () => {
  document.getElementById('modalBackdrop').classList.remove('show');
});

fetchNews();