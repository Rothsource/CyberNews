import { setSrc, toast } from './ui.js';
import { escHtml } from './render.js';
import { state } from './state.js';

// ── SHARED CONSTANTS ───────────────────────────────────
const SYSTEM_PROMPT = `You are a senior cybersecurity analyst and AI threat intelligence expert with 15+ years of experience. Your job is to analyze raw threat data and news, then return structured threat intelligence.

CRITICAL INSTRUCTIONS:
- Analyze each piece of raw data carefully
- Return ONLY a valid JSON object with two keys: "threats" (array) and "digest" (string)
- No markdown, no explanation, no backticks
- The "digest" is a 3-4 sentence expert daily summary paragraph
- Each threat in "threats" array must have ALL these fields:
  id, title, summary, severity, categories, affected_systems, attack_vector, ai_system_affected, recommended_action, source, date, is_ai_related, top_targeted_sector

SEVERITY SCORING:
- Critical: active exploitation + mass impact + zero-day
- High: significant threat, widely unpatched, real-world impact
- Medium: limited impact, PoC only, theoretical
- Low: informational, research, awareness only

CATEGORIES (use EXACTLY these, a threat can have multiple):
Cyber: CVE/Exploit, Malware/Ransomware, Cyber Attack, Data Breach, Nation-State, New Tool, New Technology, Threat Actor
AI: AI Model Attacks, AI-Powered Attacks, LLM Vulnerabilities, AI Supply Chain, AI Surveillance, AI Infrastructure, AI Policy & Regulation, AI Security Research

Cross-tag when relevant: ransomware using AI-generated phishing → ["Malware/Ransomware", "AI-Powered Attacks"]

For ai_system_affected: use null if not AI-related, otherwise name the system (e.g. "GPT-4", "Gemini", "Claude", "Llama", "General LLM", etc.)
For top_targeted_sector: e.g. "Healthcare", "Finance", "Government", "Energy", "Technology", etc.`;

function buildUserPrompt(rawData, dateRange, categories, severities) {
  const rawText = rawData.map((item, i) =>
    `[${i + 1}] SOURCE: ${item.source} | DATE: ${item.raw_date || 'unknown'}\nTITLE: ${item.raw_title}\nDESC: ${item.raw_desc || ''}\n`
  ).join('\n---\n');

  return `Analyze the following raw threat intelligence data collected on ${dateRange.to}.

User selected categories to focus on: ${Array.from(categories).join(', ')}
User selected severities: ${Array.from(severities).join(', ')}

RAW DATA:
${rawText}

Return a JSON object with:
1. "threats": array of threat objects (filter to match selected categories/severities)
2. "digest": 3-4 sentence expert summary of today's threat landscape

Each threat object needs: id (string), title, summary (2-3 sentences expert analysis), severity, categories (array), affected_systems (array of strings), attack_vector, ai_system_affected (null or string), recommended_action, source, date, is_ai_related (boolean), top_targeted_sector`;
}

// ── ROUTER ─────────────────────────────────────────────
export async function analyzeWithAI(rawData, provider, apiKey, model, dateRange, categories, severities) {
  switch (provider || state.selectedProvider) {
    case 'openai':  return await analyzeWithOpenAI(rawData, apiKey, dateRange, categories, severities);
    case 'gemini':  return await analyzeWithGemini(rawData, apiKey, dateRange, categories, severities);
    case 'grok':    return await analyzeWithGrok(rawData, apiKey, dateRange, categories, severities);
    case 'claude':
    default:        return await analyzeWithClaude(rawData, apiKey, dateRange, categories, severities);
  }
}

// ── CLAUDE (Anthropic) ─────────────────────────────────
export async function analyzeWithClaude(rawData, apiKey, dateRange, categories, severities) {
  setSrc('claude', 'loading', 'ANALYZING');
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserPrompt(rawData, dateRange, categories, severities) }]
      }),
      signal: AbortSignal.timeout(60000)
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    const textBlock = data.content?.find(b => b.type === 'text');
    if (!textBlock) throw new Error('No text response');

    let jsonText = textBlock.text.trim().replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(jsonText);
    setSrc('claude', 'ok', 'OK ✓');
    return parsed;
  } catch (e) {
    setSrc('claude', 'err', 'ERR');
    toast('Claude analysis error: ' + e.message, 'error');
    return { threats: [], digest: '' };
  }
}

// ── OPENAI (gpt-4o) ────────────────────────────────────
async function analyzeWithOpenAI(rawData, apiKey, dateRange, categories, severities) {
  setSrc('claude', 'loading', 'ANALYZING');
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 4000,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: buildUserPrompt(rawData, dateRange, categories, severities) }
        ]
      }),
      signal: AbortSignal.timeout(60000)
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    let text = data.choices[0].message.content.trim().replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);
    setSrc('claude', 'ok', 'OK ✓');
    return parsed;
  } catch (e) {
    setSrc('claude', 'err', 'ERR');
    toast('OpenAI analysis error: ' + e.message, 'error');
    return { threats: [], digest: '' };
  }
}

// ── GEMINI (gemini-2.0-flash) ──────────────────────────
async function analyzeWithGemini(rawData, apiKey, dateRange, categories, severities) {
  setSrc('claude', 'loading', 'ANALYZING');
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: buildUserPrompt(rawData, dateRange, categories, severities) }] }],
        generationConfig: { maxOutputTokens: 4000 }
      }),
      signal: AbortSignal.timeout(60000)
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    let text = data.candidates[0].content.parts[0].text.trim().replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);
    setSrc('claude', 'ok', 'OK ✓');
    return parsed;
  } catch (e) {
    setSrc('claude', 'err', 'ERR');
    toast('Gemini analysis error: ' + e.message, 'error');
    return { threats: [], digest: '' };
  }
}

// ── GROK (xAI — grok-3) ───────────────────────────────
async function analyzeWithGrok(rawData, apiKey, dateRange, categories, severities) {
  setSrc('claude', 'loading', 'ANALYZING');
  try {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'grok-3',
        max_tokens: 4000,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: buildUserPrompt(rawData, dateRange, categories, severities) }
        ]
      }),
      signal: AbortSignal.timeout(60000)
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    let text = data.choices[0].message.content.trim().replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);
    setSrc('claude', 'ok', 'OK ✓');
    return parsed;
  } catch (e) {
    setSrc('claude', 'err', 'ERR');
    toast('Grok analysis error: ' + e.message, 'error');
    return { threats: [], digest: '' };
  }
}

// ── DEEP DIVE (routes through selected provider) ───────
export async function deepDive(threat, panelEl, apiKey) {
  const provider = state.selectedProvider || 'claude';
  if (!apiKey) { toast('API key required', 'error'); return; }

  if (panelEl.classList.contains('show')) {
    panelEl.classList.remove('show');
    return;
  }

  panelEl.classList.add('show');
  panelEl.innerHTML = `<div class="dd-loading"><div class="spinner"></div><span>Running deep analysis...</span></div>`;

  const systemPrompt = 'You are a senior cybersecurity analyst. Provide a deep-dive analysis of this threat. Cover: technical details, threat actor attribution (if known), IOCs, affected versions, exploitation in the wild, MITRE ATT&CK mapping, and detailed mitigation steps. Be thorough and technical but clear.';
  const userContent  = `Deep dive analysis on this threat:\n\nTitle: ${threat.title}\nSummary: ${threat.summary}\nSeverity: ${threat.severity}\nAttack Vector: ${threat.attack_vector}\nAffected: ${(threat.affected_systems || []).join(', ')}\nSource: ${threat.source}`;

  try {
    let text = '';

    if (provider === 'claude') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          system: systemPrompt,
          messages: [{ role: 'user', content: userContent }]
        }),
        signal: AbortSignal.timeout(30000)
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const textBlock = data.content?.find(b => b.type === 'text');
      text = textBlock?.text || 'No analysis available.';

    } else if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
        body: JSON.stringify({
          model: 'gpt-4o', max_tokens: 1000,
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }]
        }),
        signal: AbortSignal.timeout(30000)
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      text = data.choices[0].message.content.trim();

    } else if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userContent }] }],
          generationConfig: { maxOutputTokens: 1000 }
        }),
        signal: AbortSignal.timeout(30000)
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      text = data.candidates[0].content.parts[0].text.trim();

    } else if (provider === 'grok') {
      const res = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
        body: JSON.stringify({
          model: 'grok-3', max_tokens: 1000,
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }]
        }),
        signal: AbortSignal.timeout(30000)
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      text = data.choices[0].message.content.trim();
    }

    panelEl.innerHTML = `<div style="white-space: pre-wrap; font-size: 12px; color: var(--text2); line-height: 1.7;">${escHtml(text)}</div>`;
  } catch (e) {
    panelEl.innerHTML = `<div style="color: var(--red); font-size: 11px; font-family: var(--font-mono);">Analysis error: ${escHtml(e.message)}</div>`;
  }
}