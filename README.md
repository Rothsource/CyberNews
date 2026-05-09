# CyberIntel AI — Threat Intelligence Platform

## File Structure

```
cyberintel-ai/
├── index.html          # Entry point and HTML layout
├── css/
│   ├── variables.css   # CSS custom properties (colours, fonts, radii)
│   ├── layout.css      # Header, sidebar, main content, grid
│   ├── components.css  # Cards, badges, pills, buttons, modal, toast
│   └── animations.css  # @keyframes definitions
├── js/
│   ├── main.js         # Entry point — wires up all event listeners
│   ├── state.js        # Shared mutable state (threats, filters, flags)
│   ├── ui.js           # DOM helpers (toast, status, clock, date range)
│   ├── sources.js      # Data fetchers (NVD, CISA, RSS, OTX, MalwareBazaar)
│   ├── claude.js       # Anthropic API calls (analysis + deep dive)
│   ├── render.js       # Card rendering and sort
│   └── scan.js         # runScan() orchestrator
└── README.md
```

## Setup

### Requirements
- A modern browser that supports ES modules (`type="module"`)
- An Anthropic API key (required)
- Optional: AlienVault OTX key for pulse feed data

### Running locally
Because the JS files use ES modules, you need to serve the project over HTTP
rather than opening `index.html` directly from the filesystem.

**Option 1 — VS Code Live Server**
Install the Live Server extension and click "Go Live".

**Option 2 — Python**
```bash
cd cyberintel-ai
python3 -m http.server 8080
# open http://localhost:8080
```

**Option 3 — Node**
```bash
npx serve .
```

### API Keys
Enter your keys in the sidebar panel. They are only stored in memory for the
current session and are never sent anywhere except the respective API endpoints.

| Key | Required | Used for |
|-----|----------|----------|
| Anthropic | ✅ Yes | AI analysis of all collected data + deep dive |
| AlienVault OTX | Optional | Threat pulse subscriptions |
| MalwareBazaar | Not needed | Public API, no key required |
| VirusTotal | Optional | Reserved for future use |

## Notes
- API keys entered in the browser are visible in DevTools. For a production
  deployment, proxy the Anthropic API through your own backend to keep the key
  server-side.
- The app uses `https://api.allorigins.win` as a CORS proxy for RSS feeds. For
  production use, replace this with your own proxy.
