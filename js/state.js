// Shared mutable application state
export let threats = [];
export let selectedDate = 'today';
export let selectedSeverities = new Set(['Critical', 'High', 'Medium', 'Low']);
export let selectedCategories = new Set([
  'CVE/Exploit', 'Malware/Ransomware', 'Cyber Attack', 'Data Breach',
  'Nation-State', 'New Tool', 'New Technology', 'Threat Actor',
  'AI Model Attacks', 'AI-Powered Attacks', 'LLM Vulnerabilities',
  'AI Supply Chain', 'AI Surveillance', 'AI Infrastructure',
  'AI Policy & Regulation', 'AI Security Research'
]);
export let isScanning = false;
export let selectedProvider = 'claude'; // 'claude' | 'openai' | 'gemini' | 'grok'

export function setThreats(data)       { threats = data; }
export function setSelectedDate(d)     { selectedDate = d; }
export function setIsScanning(v)       { isScanning = v; }
export function setProvider(name)      { selectedProvider = name; state.selectedProvider = name; }

// Exported state object (for modules that import state directly)
export let rawNews = [];
export function setRawNews(items) { rawNews = items; }

export const state = { selectedProvider: 'claude' };