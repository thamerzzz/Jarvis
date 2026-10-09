import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { WebSocketServer } from 'ws';
import { buildGraph } from './graph.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 4719);
function findClaude() {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  const home = os.homedir();
  const dirs = [...(process.env.PATH || '').split(path.delimiter), `${home}/.local/bin`, `${home}/.claude/local`,
    `${home}/.npm-global/bin`, '/usr/local/bin', '/opt/homebrew/bin', `${home}/.volta/bin`];
  for (const d of dirs) { const f = path.join(d, 'claude'); try { fs.accessSync(f, fs.constants.X_OK); return f; } catch {} }
  return 'claude';
}
const CLAUDE_BIN = findClaude();
const sessionFile = path.join(root, '.jarvis-session');

const SYSTEM = `You are JARVIS, the operations assistant for Ohjiya (Thamer's business). 
Context: 3-year plan streams (on-prem deals, cloud companies, market orders, studio startups), 11 CRM segments, 
focus order Nadwoor Contract -> Ohjiya Market -> Reayat -> Mega Project -> vendors -> Cloud SaaS -> Moosanid.
Be concise. Reply in the user's language (Arabic or English). Read freely, but NEVER send emails/messages, publish, delete, 
spend money or write to the CRM without first stating the exact action and getting the user's explicit OK in chat. Drafts are fine.`;

const READ_ONLY = ['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch'];
const mimes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const graph = buildGraph();

function serveFile(res, file) {
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': mimes[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/graph') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify(graph));
  }
  if (url.pathname === '/vendor/3d-force-graph.js') {
    return serveFile(res, path.join(root, 'node_modules/3d-force-graph/dist/3d-force-graph.min.js'));
  }
  const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const file = path.join(root, 'web', path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(path.join(root, 'web'))) { res.writeHead(403); return res.end(); }
  serveFile(res, file);
});

// Map an MCP tool name (mcp__Server__tool) to a graph node id.
function nodeForTool(name) {
  const lower = name.toLowerCase();
  const server = lower.startsWith('mcp__') ? lower.split('__')[1] : '';
  for (const nd of graph.nodes) {
    if (nd.kind === 'tool' && nd.match.some((m) => server.includes(m) || (!server && lower === m))) return nd.id;
  }
  return null;
}

const loadSession = () => { try { return fs.readFileSync(sessionFile, 'utf8').trim(); } catch { return ''; } };

const wss = new WebSocketServer({ server });
wss.on('connection', (ws) => {
  let proc = null;
  const send = (o) => ws.readyState === 1 && ws.send(JSON.stringify(o));

  ws.on('message', (raw) => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type === 'stop') { proc?.kill(); return; }
    if (msg.type === 'reset') { try { fs.unlinkSync(sessionFile); } catch {} return send({ type: 'reset' }); }
    if (msg.type !== 'chat' || proc) return;

    const ctx = (msg.context || []).map((c) => `- ${c.kind}: ${c.name}`).join('\n');
    const prompt = ctx ? `[Selected in graph]\n${ctx}\n\n${msg.text}` : msg.text;
    const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
      '--append-system-prompt', SYSTEM];
    const sid = loadSession();
    if (sid) args.push('--resume', sid);
    // Act mode lets Claude use any tool; default is read-only built-ins + whatever MCP reads are pre-approved in your Claude config.
    if (msg.act) args.push('--permission-mode', 'acceptEdits');
    else args.push('--allowedTools', READ_ONLY.join(','));

    proc = spawn(CLAUDE_BIN, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    send({ type: 'start' });
    let buf = '';
    proc.stdout.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line) continue;
        let ev; try { ev = JSON.parse(line); } catch { continue; }
        handle(ev);
      }
    });
    let err = '';
    proc.stderr.on('data', (d) => { err += d; });
    proc.on('error', (e) => { send({ type: 'error', text: `Cannot start "${CLAUDE_BIN}": ${e.message}. Install Claude Code (npm i -g @anthropic-ai/claude-code), run "which claude" in Terminal, then restart with: CLAUDE_BIN=<that path> npm start` }); proc = null; });
    proc.on('close', (code) => {
      if (code && err) send({ type: 'error', text: err.slice(-500) });
      send({ type: 'done' }); proc = null;
    });
  });
  ws.on('close', () => proc?.kill());

  function handle(ev) {
    if (ev.session_id && ev.type === 'system') fs.writeFileSync(sessionFile, ev.session_id);
    if (ev.type === 'stream_event' && ev.event?.delta?.type === 'text_delta') {
      send({ type: 'text', text: ev.event.delta.text });
    } else if (ev.type === 'assistant') {
      for (const c of ev.message?.content || []) {
        if (c.type === 'tool_use') send({ type: 'tool', name: c.name, node: nodeForTool(c.name) });
      }
    } else if (ev.type === 'result') {
      send({ type: 'result', cost: ev.total_cost_usd, ms: ev.duration_ms, error: ev.is_error });
    }
  }
});

server.listen(PORT, '127.0.0.1', () => console.log(`JARVIS on http://localhost:${PORT} (claude: ${CLAUDE_BIN})`));
