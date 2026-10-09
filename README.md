# JARVIS for Ohjiya

Chat-first assistant (voice + text) with a 3D business graph. Chat is driven by the
`claude` CLI on your laptop, so it uses your Claude subscription and your own MCP
connections (Novamira, HubSpot, Make, ...) and needs no API key.

## Run on your Mac
1. Install Node 20+ (`brew install node`) and Claude Code (`npm i -g @anthropic-ai/claude-code`), then run `claude` once and log in.
2. `git clone <this repo> && cd Jarvis && npm install && npm start`
3. Open http://localhost:4719 in Chrome (voice input needs Chrome or Safari).

## Use
- Type or press the mic (EN/AR switch) and talk. Replies stream; the speaker button reads them aloud.
- Click graph nodes to attach them to your next message ("[Al Muhaidib Group] draft outreach").
- When Claude calls an MCP tool, its node lights up in the graph.
- Safety: **Act: off** (default) allows only read-only built-in tools, plus any MCP tools you
  pre-approved in your Claude settings. **Act: ON** lets Claude use write tools. The system prompt also
  requires an explicit chat OK before sending, publishing, deleting, spending or writing to the CRM.

## Files
- `server/index.js` HTTP + WebSocket bridge that spawns `claude -p --output-format stream-json`.
- `server/graph.js` seed graph from the 2026-10-09 CRM/ICP/plan export. Edit this to change the graph.
- `web/index.html` chat, voice and graph UI.
