#!/usr/bin/env node
/* 말씀공방 — 로컬 서버 + AI 프록시
 * 정적 파일 서빙 + /api/status + /api/ai (SSE 스트리밍)
 * AI 백엔드 우선순위:
 *   1) ANTHROPIC_API_KEY 환경변수
 *   2) 요청 헤더 x-user-api-key (앱 설정에서 사용자가 직접 입력한 키)
 *   3) claude CLI (터미널에서 claude 로그인이 되어 있을 때)
 */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

const ROOT = __dirname;
const PORT = process.env.PORT || 5208;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

// ---------- claude CLI 상태 확인 ----------
let cliState = { checked: false, ok: false, path: null };
function cleanEnv() {
  const env = { ...process.env };
  // 중첩 세션·프록시·인증 관련 변수 전부 제거 (독립 CLI 호출을 위해)
  Object.keys(env).forEach(k => {
    if (/^(CLAUDE|ANTHROPIC|AI_AGENT|BAGGAGE|CODEX_|USE_LOCAL_OAUTH|USE_STAGING_OAUTH)/.test(k)) delete env[k];
  });
  return env;
}
function findClaude() {
  const candidates = ['/opt/homebrew/bin/claude', '/usr/local/bin/claude'];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  try { return execFileSync('which', ['claude']).toString().trim() || null; } catch { return null; }
}
function checkCli(force) {
  if (cliState.checked && !force) return cliState;
  cliState.checked = true;
  cliState.path = findClaude();
  if (!cliState.path) { cliState.ok = false; return cliState; }
  try {
    const out = execFileSync(cliState.path,
      ['-p', 'ping', '--output-format', 'json', '--max-turns', '1', '--model', 'haiku'],
      { env: cleanEnv(), cwd: ROOT, timeout: 60000, input: '' }).toString();
    cliState.ok = !/Not logged in|authentication_failed/i.test(out);
  } catch { cliState.ok = false; }
  return cliState;
}

// ---------- SSE 도우미 ----------
function sseHead(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
}
function sseSend(res, obj) { res.write('data: ' + JSON.stringify(obj) + '\n\n'); }

// ---------- Anthropic API 직접 호출 (스트리밍) ----------
async function runApi(res, key, { system, prompt, model, maxTokens }, onAbort) {
  const apiModel = ({ sonnet: 'claude-sonnet-5', opus: 'claude-opus-4-8', haiku: 'claude-haiku-4-5-20251001' })[model] || model || 'claude-sonnet-5';
  const controller = new AbortController();
  onAbort(() => controller.abort());
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: apiModel,
      max_tokens: maxTokens || 8000,
      system: system || undefined,
      stream: true,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!r.ok) {
    const errText = await r.text().catch(() => '');
    throw new Error('API 오류 ' + r.status + ': ' + errText.slice(0, 300));
  }
  let full = '';
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') continue;
      try {
        const ev = JSON.parse(data);
        if (ev.type === 'content_block_delta' && ev.delta && ev.delta.text) {
          full += ev.delta.text;
          sseSend(res, { delta: ev.delta.text });
        }
        if (ev.type === 'error') throw new Error(ev.error && ev.error.message || 'stream error');
      } catch (e) { if (e.message !== 'Unexpected end of JSON input') { /* 파싱 실패 무시 */ } }
    }
  }
  return full;
}

// ---------- claude CLI 호출 (스트리밍) ----------
function runCli(res, { system, prompt, model, maxTokens, effort }, onAbort) {
  return new Promise((resolve, reject) => {
    const args = ['-p',
      '--output-format', 'stream-json', '--include-partial-messages', '--verbose',
      '--max-turns', '2',
      '--model', model || 'sonnet',
      '--tools', '',                 // 도구 없이 순수 텍스트 생성만
      '--setting-sources', '',       // 사용자 훅·플러그인 미적용 (독립 호출)
      '--strict-mcp-config',
      '--effort', (effort === 'low' || effort === 'high') ? effort : 'medium', // 작업별 추론 깊이 (가벼운 일은 low로 빠르게)
    ];
    if (system) args.push('--system-prompt', system);   // 기본 코딩 페르소나를 설교 조력자로 교체
    const child = spawn(cliState.path, args, { env: cleanEnv(), cwd: ROOT });
    onAbort(() => child.kill('SIGTERM'));
    child.stdin.write(prompt);
    child.stdin.end();
    let full = '', buf = '', errBuf = '';
    child.stderr.on('data', d => { errBuf += d; });
    child.stdout.on('data', chunk => {
      buf += chunk.toString();
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        let ev; try { ev = JSON.parse(line); } catch { continue; }
        if (ev.type === 'stream_event' && ev.event && ev.event.type === 'content_block_delta'
            && ev.event.delta && ev.event.delta.text) {
          full += ev.event.delta.text;
          sseSend(res, { delta: ev.event.delta.text });
        } else if (ev.type === 'assistant' && !full && ev.message && Array.isArray(ev.message.content)) {
          // 부분 스트림이 없을 때 통짜 메시지 수신
          for (const c of ev.message.content) if (c.type === 'text') {
            full += c.text; sseSend(res, { delta: c.text });
          }
        } else if (ev.type === 'result') {
          if (ev.is_error) {
            console.error('[CLI 오류 원문]', line.slice(0, 600));
            reject(new Error(ev.result || ev.subtype || 'CLI 오류'));
          }
        }
      }
    });
    child.on('close', code => {
      if (full) resolve(full);
      else reject(new Error('claude CLI 응답 없음 (code ' + code + ') ' + errBuf.slice(0, 200)));
    });
    child.on('error', reject);
  });
}

// ---------- 요청 처리 ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  // CORS(로컬 전용)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-user-api-key');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  // ---- API: 상태 ----
  if (url.pathname === '/api/status') {
    const force = url.searchParams.has('refresh');
    const cli = checkCli(force);
    const envKey = !!process.env.ANTHROPIC_API_KEY;
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({
      envKey, cli: cli.ok, cliFound: !!cli.path,
      backend: envKey ? 'env-key' : (cli.ok ? 'cli' : 'none'),
    }));
  }

  // ---- API: AI 생성 (SSE) ----
  if (url.pathname === '/api/ai' && req.method === 'POST') {
    let body = '';
    req.on('data', d => { body += d; if (body.length > 3e6) req.destroy(); });
    req.on('end', async () => {
      let payload;
      try { payload = JSON.parse(body); } catch { res.writeHead(400); return res.end('bad json'); }
      const userKey = req.headers['x-user-api-key'];
      const envKey = process.env.ANTHROPIC_API_KEY;
      sseHead(res);
      const aborts = [];
      const onAbort = fn => aborts.push(fn);
      // 클라이언트가 응답을 받다 끊었을 때만 중단한다
      // (req 'close'는 요청 수신 완료 시에도 발생하므로 쓰면 안 됨)
      res.on('close', () => {
        if (!res.writableEnded) aborts.forEach(f => { try { f(); } catch {} });
      });
      try {
        let full;
        if (envKey || userKey) {
          full = await runApi(res, envKey || userKey, payload, onAbort);
        } else if (checkCli().ok) {
          full = await runCli(res, payload, onAbort);
        } else {
          sseSend(res, { error: 'AI가 연결되지 않았습니다. 설정에서 API 키를 입력하거나, 터미널에서 claude 로그인을 해 주세요.' });
          return res.end();
        }
        sseSend(res, { done: true, text: full });
      } catch (e) {
        sseSend(res, { error: String(e.message || e).slice(0, 500) });
      }
      res.end();
    });
    return;
  }

  // ---- API: 이미지 원고 인식 (claude CLI + Read 도구) ----
  if (url.pathname === '/api/ocr' && req.method === 'POST') {
    let body = '';
    req.on('data', d => { body += d; if (body.length > 25e6) req.destroy(); });
    req.on('end', () => {
      let payload;
      try { payload = JSON.parse(body); } catch { res.writeHead(400); return res.end('bad json'); }
      if (!checkCli().ok) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ error: '이미지 인식에는 Claude 로그인(claude CLI)이 필요합니다.' }));
      }
      const ext = ({ 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'application/pdf': '.pdf' })[payload.mime] || '.png';
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mworks-ocr-'));
      const fp = path.join(dir, 'sermon' + ext);
      fs.writeFileSync(fp, Buffer.from(payload.data, 'base64'));
      const args = ['-p', '--output-format', 'json', '--max-turns', '8',
        '--model', payload.model || 'sonnet',
        '--tools', 'Read', '--setting-sources', '', '--strict-mcp-config',
        '--effort', 'low', '--dangerously-skip-permissions'];
      const child = spawn(cliState.path, args, { env: cleanEnv(), cwd: dir });
      child.stdin.write(`Read 도구로 ${fp} 파일을 읽어라. 파일에 담긴 설교 원고(또는 문서) 텍스트를 빠짐없이 그대로 전사하라. 손글씨면 최선을 다해 판독하고 판독 불가한 부분은 [판독불가]로 표시하라. 설명 없이 전사한 텍스트만 출력하라.`);
      child.stdin.end();
      let out = '';
      child.stdout.on('data', d => { out += d; });
      child.on('close', () => {
        try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        try {
          const j = JSON.parse(out.trim().split('\n').pop());
          if (j.is_error) return res.end(JSON.stringify({ error: j.result || '인식 실패' }));
          return res.end(JSON.stringify({ text: j.result || '' }));
        } catch {
          return res.end(JSON.stringify({ error: '이미지 인식 응답을 해석하지 못했습니다.' }));
        }
      });
      child.on('error', e => {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: String(e.message) }));
      });
    });
    return;
  }

  // ---- API: 유튜브 자막 추출 ----
  if (url.pathname === '/api/youtube') {
    const vurl = url.searchParams.get('url') || '';
    const m = vurl.match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{11})/);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    if (!m) return res.end(JSON.stringify({ error: '유튜브 주소를 인식하지 못했습니다.' }));
    (() => {
      const YTDLP = ['/opt/homebrew/bin/yt-dlp', '/usr/local/bin/yt-dlp'].find(p => fs.existsSync(p));
      if (!YTDLP) return res.end(JSON.stringify({ error: '자막 추출 도구(yt-dlp)가 없습니다. 터미널에서 "brew install yt-dlp" 후 다시 시도해 주세요.' }));
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mworks-yt-'));
      const child = spawn(YTDLP, [
        '--skip-download', '--write-subs', '--write-auto-subs',
        '--sub-langs', 'ko,ko-orig,en', '--sub-format', 'vtt',
        '--print-to-file', '%(title)s', path.join(dir, 'title.txt'),
        '-o', path.join(dir, 'cap'),
        'https://www.youtube.com/watch?v=' + m[1],
      ], { env: cleanEnv() });
      let errBuf = '';
      child.stderr.on('data', d => { errBuf += d; });
      child.on('close', () => {
        try {
          const files = fs.readdirSync(dir).filter(f => f.endsWith('.vtt'));
          const pick = files.find(f => f.includes('.ko')) || files[0];
          if (!pick) {
            fs.rmSync(dir, { recursive: true, force: true });
            return res.end(JSON.stringify({ error: '이 영상에서 자막을 찾지 못했습니다. 자막이 있는 영상이거나, 원고를 직접 붙여넣어 주세요.' }));
          }
          const vtt = fs.readFileSync(path.join(dir, pick), 'utf8');
          let title = '';
          try { title = fs.readFileSync(path.join(dir, 'title.txt'), 'utf8').trim(); } catch {}
          // VTT → 텍스트 (타임스탬프·태그 제거, 자동자막의 반복 줄 제거)
          const lines = vtt.split('\n')
            .filter(l => l.trim() && !/^WEBVTT|^Kind:|^Language:|^NOTE|-->|^\d+$/.test(l))
            .map(l => l.replace(/<[^>]+>/g, '').trim())
            .filter(Boolean);
          const out = [];
          for (const l of lines) if (l !== out[out.length - 1]) out.push(l);
          const text = out.join(' ').replace(/\s+/g, ' ').trim();
          fs.rmSync(dir, { recursive: true, force: true });
          if (!text) return res.end(JSON.stringify({ error: '자막을 읽지 못했습니다.' }));
          res.end(JSON.stringify({ text, lang: pick.includes('.ko') ? 'ko' : 'en', title }));
        } catch (e) {
          res.end(JSON.stringify({ error: '자막 처리 실패: ' + String(e.message).slice(0, 200) }));
        }
      });
      child.on('error', e => res.end(JSON.stringify({ error: 'yt-dlp 실행 실패: ' + e.message })));
    })();
    return;
  }

  // ---- API: 설교 파일 탐색 (로컬 전용 — 홈 폴더 안만) ----
  const HOME = os.homedir();
  const safePath = p => {
    if (!p) return null;
    const r = path.resolve(p);
    return (r === HOME || r.startsWith(HOME + path.sep)) ? r : null;
  };
  if (url.pathname === '/api/fs/list') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    const p = safePath(url.searchParams.get('path') || path.join(HOME, 'Desktop'));
    if (!p) return res.end(JSON.stringify({ error: '홈 폴더 안의 경로만 열 수 있습니다.' }));
    try {
      const items = fs.readdirSync(p, { withFileTypes: true }).filter(d => !d.name.startsWith('.'));
      const dirs = [], files = [];
      for (const d of items) {
        if (d.isDirectory()) dirs.push({ name: d.name });
        else if (d.isFile()) {
          let size = 0, mtime = 0;
          try { const st = fs.statSync(path.join(p, d.name)); size = st.size; mtime = st.mtimeMs; } catch {}
          files.push({ name: d.name, size, mtime });
        }
      }
      return res.end(JSON.stringify({ home: HOME, path: p, parent: p === HOME ? null : path.dirname(p), dirs, files }));
    } catch (e) { return res.end(JSON.stringify({ error: '폴더를 읽지 못했습니다: ' + String(e.message).slice(0, 200) })); }
  }
  if (url.pathname === '/api/fs/open') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    const p = safePath(url.searchParams.get('path'));
    if (!p || !fs.existsSync(p)) return res.end(JSON.stringify({ error: '파일을 찾을 수 없습니다.' }));
    const reveal = url.searchParams.has('reveal'); // Finder에서 보기
    try {
      if (process.platform === 'darwin') spawn('open', reveal ? ['-R', p] : [p], { detached: true, stdio: 'ignore' }).unref();
      else if (process.platform === 'win32') spawn('cmd', reveal ? ['/c', 'explorer', '/select,', p] : ['/c', 'start', '', p], { detached: true, stdio: 'ignore' }).unref();
      else spawn('xdg-open', [p], { detached: true, stdio: 'ignore' }).unref();
      return res.end(JSON.stringify({ ok: true }));
    } catch (e) { return res.end(JSON.stringify({ error: String(e.message).slice(0, 200) })); }
  }
  if (url.pathname === '/api/fs/read') {
    const p = safePath(url.searchParams.get('path'));
    if (!p || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
    try {
      const st = fs.statSync(p);
      if (st.size > 40e6) { res.writeHead(413); return res.end(); }
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      return fs.createReadStream(p).pipe(res);
    } catch { res.writeHead(500); return res.end(); }
  }

  // ---- 정적 파일 ----
  let file = decodeURIComponent(url.pathname);
  if (file === '/') file = '/index.html';
  const fp = path.join(ROOT, file);
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('말씀공방 서버 실행: http://localhost:' + PORT + '/');
});
