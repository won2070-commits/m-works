/* M.WORKS — 앱 로직
 * 데이터: localStorage 'malsseum_v1' (프로젝트·설정·사용자 형식·프롬프트 오버라이드)
 * AI: /api/ai (SSE) — server.cjs 가 Anthropic API 또는 claude CLI로 중계
 */
'use strict';

/* ═══════════════════ 저장소 ═══════════════════ */
const LS_KEY = 'malsseum_v1';
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

let DB = load();
function load() {
  const raw = localStorage.getItem(LS_KEY) || '{}';
  try {
    return normalize(JSON.parse(raw));
  } catch (e) {
    // 데이터 보호: 읽기에 실패해도 원본을 백업해 두고 시작한다 (덮어쓰기 방지)
    try { localStorage.setItem(LS_KEY + '_backup_' + Date.now(), raw); } catch {}
    console.error('M.WORKS 데이터 로드 실패 — 백업 후 새로 시작:', e);
    return normalize({});
  }
}
// 함수 선언은 호이스팅되므로 load()보다 뒤에 있어도 안전하다 (const는 TDZ 위험)
function defaultRules() {
  return `- 문장은 짧게. 한 문장에 한 생각. 귀에는 되감기 버튼이 없다.
- 존댓말 구어체("…습니다")로 쓴다.
- 설교 마지막에 적용 찬양과 마무리 기도문을 반드시 넣는다. 찬양은 성도들이 즐겨 부르는 잘 알려진 최근 가스펠을 우선 2곡, 적합하다면 새찬송가 찬송도 1~2곡 더한다(각각 고른 이유 한 줄씩).
- 설교문·기도문·찬양 뒤에, 이 설교의 중심내용과 궤를 같이하는 서적 2권을 추천한다. 각 책마다 추천 이유를 간략히 밝히고, 책 내용을 약 A4 두 페이지 분량으로 요약해 붙인다. 실제 존재하는 책만 추천하며, 불확실한 정보에는 "(확인 필요)"를 붙인다.
- 확인되지 않은 통계·인용·예화는 쓰지 않는다. 불확실하면 "(확인 필요)"를 붙인다.
- 첫 문장과 마지막 문장은 설교자가 직접 고쳐 쓸 것을 전제로, 담백하게 시작하고 담백하게 닫는다.

[MS 워드 설교문 양식 — 예시 원고('몸을 움직이면 삶이 움직인다.docx')와 동일. Word 내보내기에 자동 적용됨]
- 글꼴: 맑은 고딕
- 본문: 기본 크기(10pt), 양쪽 정렬
- 설교 제목: 14pt 굵게 (그 아래 본문 장절 → 날짜·시리즈, 모두 굵게)
- 한 문장 = 한 문단(한 줄). 문단 사이 여백 없음
- 굵게는 핵심 문장에만 절제해서 사용
- 대지·소제목도 본문 크기에 굵게만`;
}
/* MS 워드 내보내기 서식 — 예시 원고('몸을 움직이면 삶이 움직인다.docx')와 동일 */
function wordCss() {
  return `body{font-family:"맑은 고딕","Malgun Gothic","Apple SD Gothic Neo",sans-serif;font-size:10pt;line-height:1.15;}
 p{margin:0;text-align:justify}
 h1{font-size:14pt;font-weight:bold;margin:0 0 2pt 0;text-align:left}
 h2{font-size:10pt;font-weight:bold;margin:10pt 0 0 0;text-align:left}
 h3{font-size:10pt;font-weight:bold;margin:8pt 0 0 0;text-align:left}
 blockquote{margin:4pt 0 4pt 16pt;padding:0;color:#333}
 blockquote p{text-align:left}
 hr{border:none;border-top:0.5pt solid #999;margin:8pt 0}
 .pause-mark{color:#a4443a;font-weight:bold} .stress-mark{background:#f6e7bf}
 .eye-mark{color:#2e7d4f;font-weight:bold} .note-mark{background:#e7ecf6;color:#3d5a80} .breath-mark{color:#2e7d4f;font-weight:bold}`;
}
/* 클로드 프로젝트에서 가져온 참조 프롬프트 — 사용자가 프롬프트 서재에서 계속 다듬는다 */
function defaultRefPrompts() {
  return [
    { id: 'ref-dodo', name: 'dodo — 성경적 설교문 작성', target: 'sermon', builtin: true, text: dodoPromptText() },
    { id: 'ref-title', name: 'title — 설교 제목', target: 'partial', builtin: true, text: `설교 제목은 모든 사람이 듣고 싶어 할 만큼 매력적이어야 한다. 듣고 싶고, 꼭 들어야 될 것 같은 기대감이 생기는 제목. 성경의 핵심 내용을 담은 간결하고 임팩트 있는 문구. 감각적인 광고 카피 같은 제목도 좋다.` },
    { id: 'ref-bigidea', name: 'big idea — 중심사상', target: 'central', builtin: true, text: `그 많은 내용 중에서, 하나님이 오늘 딱 한 가지만 말씀하시고 싶다면 무엇을 말씀하실까? 이 질문으로 한 가지 중심점을 캐라. 주요소는 질문으로, 보조요소는 본문의 답으로. (여기에 클로드 프로젝트 'big idea'의 프롬프트 전문을 붙여넣어 보완하세요)` },
    { id: 'ref-form', name: '설교형식 — 형식 결정', target: 'formatConvert', builtin: true, text: `(여기에 클로드 프로젝트 '설교형식'의 프롬프트 전문을 붙여넣으세요 — 형식 변환 시 함께 적용됩니다)` },
    { id: 'ref-honor', name: 'honor — 천재화 피드백', target: 'sermonReport', builtin: true, text: `천재 설교 코치의 관점에서 분석하라: 이 설교가 평범한 설교에서 천재적인 설교가 되려면 무엇이 달라져야 하는가. 원고의 가장 빛나는 한 문장을 찾아 그것을 중심으로 재구성하는 전략까지 제안하라. (여기에 클로드 프로젝트 'honor'의 천재화 프롬프트 전문을 붙여넣어 보완하세요)` },
  ];
}
function dodoPromptText() {
  return `주된 목적은 성경적인 설교를 하는 것입니다.
저는 30년차 베테랑 교회 목사입니다. 매주 주일마다 회중에게 설교해야 합니다.
중심주제에 근거한 설교를 만들기 원합니다.
성경의 내용을 깊이 있게 설명하고, 설교를 자연스럽게 전개하며, 무엇보다도 간결해야 합니다. 전체 문장은 단문이고 구어체이면 좋겠어요.

설교제목은 모든 사람이 듣고 싶어 할 만큼, 매력적이어야 합니다.
듣고 싶고, 꼭 들어야 될 것 같은 기대감이 생기는 제목으로 해 주세요.
성경의 핵심 내용을 잘 담고 있는 간결하고 임팩트 있는 문구로. 감각적이고 광고 카피 같은 것도 좋아요.

필요할 때는 설교 대지를 나눠주지만, 설교문을 원포인트 형식으로 제안해줘.
그 많은 내용 중에서, 하나님이 오늘 딱 한 가지만 말씀하시고 싶다면 뭘 말씀하실까?
이런 고민을 가진, 한 가지 중심점을 가진 설교면 좋겠어.

서론 작성> 사례, 통계, 역사적 배경을 잘 반영하라. 주의를 끌고, 흥미를 유발하고, 사람들이 듣고 싶어 하고, 필요를 느끼게 하는 내용으로 시작하라. 마음을 여는 이야기, 놀라운 이야기, 간단한 선언, 질문, 통계, 시사, 기억에 남는 명대사로 여는 서론도 좋다.
성경해석> 본문을 정확하게 해석하고, 이해에 필수적인 한두 구절의 원어(헬라어·히브리어) 해석을 포함하라.
결론과 적용> 예를 들거나, 인용하거나, 질문을 던지는 등 구체적인 적용 방향을 제시하라. 설교는 귀납적으로 진행하되, 전체 중심 주제를 따르는 원포인트 형식도 좋다.
마지막에는 주제에 딱 맞는 감동적인 구절과 촌철살인의 한 마디. 기도문과 찬양 추천(찬송가 2곡)도 함께.

[문체 규칙 — 들려지는 설교]
- 한 문장 = 한 줄. 한 줄에 두 문장 금지.
- 문장은 짧게(가급적 30자 이내). 길이에 변화를 주어 호흡 리듬을 만든다.
- "~습니다"체 기본, 사이사이 "~입니까?" 질문으로 환기.
- 문장 중간에 쉼표로 호흡점 표시. 예: "하나님의 역사는, 인간의 거부에, 막히지 않습니다."
- 핵심 단어는 의도적으로 반복해 기억에 박는다.
- 추상 개념은 구체적 장면·감각으로 바꾼다.
- 빈 수식어("정말로/참으로/진정으로") 사용 금지.
- 현장 예화·메모는 예)... 형식으로 삽입.

[신학 안전장치]
- 본문 문맥을 벗어난 자의적 인용(proof-texting) 금지.
- 무리한 알레고리·풍유 금지. 본문이 실제로 말하는 범위 안에서.
- 율법주의("~해야 구원")와 번영복음("믿으면 부자")으로 흐르지 말 것.
- 확정할 수 없는 역사·원어·통계는 단정하지 말고 [Unverified]로 표기.
- 지어낸 인용·출처·일화를 넣지 말 것. 예화가 필요하면 "예)" 메모로 자리만 표시.

[자연스러운 강단 원고로 쓰기]
- 문장 길이를 일부러 불규칙하게. 짧은 문장 연타 뒤 긴 문장 하나. 한 단어 문장도 허용.
- 대지마다 형식을 똑같이 맞추지 말 것. 대칭·운율 강박은 글을 기계처럼 만든다.
- 상투어 금지: "오늘 본문은 우리에게 말씀하고 있습니다", "~가 아닐 수 없습니다", "다름 아닌", "바로 이것입니다", "첫째로/둘째로/마지막으로", "결론적으로", "정리하자면".
- 결론에서 본론을 요약·반복하지 말 것. 한 장면 또는 한 질문으로 닫는다.
- 목회자 1인칭 목소리 자리를 남길 것. 개인 경험이 들어갈 곳은 예)... 로 표시.
- 구체를 살릴 것: "어떤 사람"보다 "새벽 첫차를 타는 사람".
- 질문을 던지고 곧장 답하지 말 것. 침묵의 여백을 둔다.
- 감정을 설명하지 말고 장면으로 보여줄 것. "슬펐습니다" 대신 그 슬픔의 장면.`;
}
function normalize(d) {
  d.settings = Object.assign({
    translation: '개역개정', cpm: 300, model: 'sonnet', apiKey: '',
    style: '', targetMin: 25, editorSize: 17, editorHeight: 0, rules: defaultRules(),
    fontScale: 100, fontFace: 'basic', appPass: '', theme: 'white', brightness: 100,
  }, d.settings || {});
  d.projects = Array.isArray(d.projects) ? d.projects : [];
  d.customForms = Array.isArray(d.customForms) ? d.customForms : [];
  d.materials = Array.isArray(d.materials) ? d.materials : [];
  d.reports = Array.isArray(d.reports) ? d.reports : [];
  d.refPrompts = Array.isArray(d.refPrompts) && d.refPrompts.length ? d.refPrompts : defaultRefPrompts();
  d.promptOverrides = d.promptOverrides || {};
  d.trash = Array.isArray(d.trash) ? d.trash : [];
  d.projects.forEach(normProject);
  return d;
}
function normProject(p) {
  p.inputs = Object.assign({ topic: '', passage: '', reason: '', needs: '', audience: '', purpose: '', date: '', targetMin: 25, season: '', series: '', relation: '', emphasis: '', avoid: '', personal: '', refs: '' }, p.inputs || {});
  p.passage = Object.assign({ ref: '', text: '', confirmed: false, candidates: [], check: null, genre: '', extraReq: '' }, p.passage || {});
  p.central = Object.assign({ done: false }, p.central || {});
  p.draft = Object.assign({ html: '', versions: [], memo: '' }, p.draft || {});
  p.form = Object.assign({ selected: '', fits: {}, pending: null, rec: null }, p.form || {});
  p.rehearsal = Object.assign({ feedback: null, gestures: null, genius: null, stress: null, runs: [], checklist: {}, selfEval: '' }, p.rehearsal || {});
  p.step = p.step || 0;
  p.favorite = !!p.favorite;
  return p;
}
let saveTimer = null;
function save(immediate) {
  $('#save-status').textContent = '저장 중…';
  clearTimeout(saveTimer);
  const doIt = () => {
    localStorage.setItem(LS_KEY, JSON.stringify(DB));
    $('#save-status').textContent = '✓ 저장됨 ' + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };
  if (immediate) doIt(); else saveTimer = setTimeout(doIt, 600);
}

/* 현재 프로젝트 */
let curId = null;
function cur() { return DB.projects.find(p => p.id === curId) || null; }
function touch(p) { (p || cur()).updatedAt = Date.now(); save(); refreshChrome(); }

/* ═══════════════════ AI 클라이언트 ═══════════════════ */
let aiStatus = { backend: 'none', cli: false, envKey: false, serverless: false };
async function fetchStatus(refresh) {
  try {
    const r = await fetch('/api/status' + (refresh ? '?refresh=1' : ''));
    aiStatus = await r.json();
    aiStatus.serverless = false;
  } catch {
    // 서버 없이 열린 단일 파일 모드 — API 키로 Anthropic에 직접 호출
    aiStatus = { backend: 'none', serverless: true };
  }
  const badge = $('#ai-badge');
  const userKey = DB.settings.apiKey;
  if (aiStatus.serverless) {
    if (userKey) { badge.textContent = '● AI 연결됨 (내 API 키 · 직접 호출)'; badge.className = 'ai-badge ok'; }
    else { badge.textContent = '○ AI 미연결 — 설정에서 API 키 입력'; badge.className = 'ai-badge bad'; }
  }
  else if (aiStatus.envKey) { badge.textContent = '● AI 연결됨 (서버 API 키)'; badge.className = 'ai-badge ok'; }
  else if (userKey) { badge.textContent = '● AI 연결됨 (내 API 키)'; badge.className = 'ai-badge ok'; }
  else if (aiStatus.cli) { badge.textContent = '● AI 연결됨 (Claude 로그인)'; badge.className = 'ai-badge ok'; }
  else { badge.textContent = '○ AI 미연결 — 설정에서 연결'; badge.className = 'ai-badge bad'; }
}
function aiConnected() {
  if (aiStatus.serverless) return !!DB.settings.apiKey;
  return aiStatus.envKey || aiStatus.cli || !!DB.settings.apiKey;
}

function getPrompt(key) {
  const base = window.MSGB_PROMPTS[key];
  const ov = DB.promptOverrides[key] || {};
  let system = ov.system || base.system;
  // 프롬프트 서재의 참조 프롬프트를 해당 단계 시스템 지시에 결합 (안내용 괄호 문구는 제거)
  const refs = (DB.refPrompts || [])
    .map(r => ({ name: r.name, target: r.target, text: (r.text || '').replace(/\(여기에 클로드 프로젝트[^)]*\)/g, '').trim() }))
    .filter(r => r.target === key && r.text);
  if (refs.length) {
    system += '\n\n[설교자의 세부작성 프롬프트 — 아래 지침도 함께 따르라]\n' +
      refs.map(r => `《${r.name}》\n${r.text}`).join('\n\n');
  }
  return { system, user: ov.user || base.user, maxTokens: base.maxTokens, label: base.label };
}
function fillSlots(tpl, slots) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (slots[k] == null || slots[k] === '') ? '(없음)' : String(slots[k]));
}

let aiAbort = null;
let aiTimerInt = null;
let progressSub = ''; // showProgress 직전에 setProgressSub()로 지정하는 한 줄 안내
let progressEta = 0;  // 예상 소요(초) — setProgressEta()로 지정
let progressStages = null;
function setProgressSub(t) { progressSub = t; }
function setProgressEta(sec, stages) { progressEta = sec; progressStages = stages || null; }
const RING_LEN = 326.7;
const DEFAULT_STAGES = ['본문과 자료를 읽는 중…', '생각을 정리하는 중…', '문장을 짓는 중…', '다듬어 마무리하는 중…'];
function fmtClock(sec) {
  const m = Math.floor(sec / 60), x = Math.round(sec % 60);
  return m + ':' + String(x).padStart(2, '0');
}
function showProgress(label) {
  clearInterval(aiTimerInt); // 앞선 타이머가 남아 겹치지 않게
  $('#ai-progress-label').textContent = label;
  const sub = $('#ai-progress-sub');
  if (progressSub) { sub.textContent = progressSub; sub.classList.remove('hidden'); }
  else { sub.textContent = ''; sub.classList.add('hidden'); }
  progressSub = '';
  const eta = progressEta || 90;           // 지정이 없으면 90초로 가정
  const stages = progressStages || DEFAULT_STAGES;
  progressEta = 0; progressStages = null;
  const pv = $('#ai-progress-preview');
  pv.textContent = ''; pv.classList.add('hidden');
  const ring = $('#ai-ring-fg');
  ring.style.strokeDashoffset = RING_LEN;
  $('#ai-progress').classList.remove('hidden');
  const t0 = Date.now();
  $('#ai-progress-timer').textContent = '0:00';
  $('#ai-ring-left').textContent = '약 ' + fmtClock(eta) + ' 예상';
  $('#ai-progress-stage').textContent = stages[0];
  aiTimerInt = setInterval(() => {
    const el = (Date.now() - t0) / 1000;
    $('#ai-progress-timer').textContent = fmtClock(el);
    // 진행률 — 예상 시간을 넘어가면 마지막 8%는 아주 천천히 채운다(끝난 척하지 않기)
    let r = el / eta;
    const pct = r < 1 ? r * 0.92 : Math.min(0.99, 0.92 + (1 - Math.exp(-(r - 1) * 0.7)) * 0.07);
    ring.style.strokeDashoffset = RING_LEN * (1 - pct);
    const left = eta - el;
    $('#ai-ring-left').textContent = left > 5 ? '약 ' + fmtClock(left) + ' 남음' : '곧 완성됩니다';
    const si = Math.min(stages.length - 1, Math.floor(r * stages.length));
    $('#ai-progress-stage').textContent = stages[si];
  }, 1000);
}
function hideProgress() {
  $('#ai-progress').classList.add('hidden'); clearInterval(aiTimerInt);
  const pv = $('#ai-progress-preview'); pv.textContent = ''; pv.classList.add('hidden');
}
function progressPreview(fullText) { // 생성 중 원고가 흘러가는 선명한 미리보기
  const pv = $('#ai-progress-preview');
  if (!pv) return;
  pv.classList.remove('hidden');
  pv.textContent = fullText.length > 2600 ? '…' + fullText.slice(-2600) : fullText;
  pv.scrollTop = pv.scrollHeight;
}
$('#ai-cancel').addEventListener('click', () => { if (aiAbort) aiAbort.abort(); });

async function callAI(key, slots, opts = {}) {
  if (!aiConnected()) {
    toast('AI가 연결되지 않았습니다. 설정에서 연결해 주세요.');
    openSettings();
    throw new Error('no-ai');
  }
  const p = getPrompt(key);
  const body = {
    system: fillSlots(p.system, slots),
    prompt: fillSlots(p.user, slots),
    model: DB.settings.model,
    maxTokens: p.maxTokens,
  };
  aiAbort = new AbortController();
  if (!opts.silent) showProgress(opts.label || p.label + ' — AI 작업 중…');
  let full = '';
  try {
    if (aiStatus.serverless) return await callDirect(body, opts);
    const headers = { 'content-type': 'application/json' };
    if (DB.settings.apiKey) headers['x-user-api-key'] = DB.settings.apiKey;
    const r = await fetch('/api/ai', { method: 'POST', headers, body: JSON.stringify(body), signal: aiAbort.signal });
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split('\n\n');
      buf = parts.pop();
      for (const part of parts) {
        const line = part.split('\n').find(l => l.startsWith('data:'));
        if (!line) continue;
        let ev; try { ev = JSON.parse(line.slice(5)); } catch { continue; }
        if (ev.delta) { full += ev.delta; if (opts.onDelta) opts.onDelta(ev.delta, full); }
        if (ev.error) throw new Error(ev.error);
        if (ev.done && ev.text) full = ev.text;
      }
    }
    if (!full.trim()) throw new Error('AI 응답이 비어 있습니다. 다시 시도해 주세요.');
    return full;
  } catch (e) {
    // 연결이 끊기거나 취소돼도, 이미 받은 분량이 충분하면 살려서 돌려준다 (긴 생성물 보호)
    if (full.trim().length > 500) {
      toast('연결이 중간에 끊겨 지금까지 받은 내용까지만 반영했습니다.', 5000);
      return full;
    }
    if (e.name === 'AbortError') throw new Error('사용자가 취소했습니다.');
    throw e;
  } finally {
    if (!opts.silent) hideProgress();
    aiAbort = null;
  }
}
/* 단일 파일 모드: 브라우저에서 Anthropic API를 직접 호출 (키는 이 브라우저에만 저장) */
const MODEL_IDS = { sonnet: 'claude-sonnet-5', opus: 'claude-opus-4-8', haiku: 'claude-haiku-4-5-20251001' };
async function callDirect(body, opts) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal: aiAbort.signal,
    headers: {
      'x-api-key': DB.settings.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL_IDS[body.model] || body.model || 'claude-sonnet-5',
      max_tokens: body.maxTokens || 8000,
      system: body.system || undefined,
      stream: true,
      messages: [{ role: 'user', content: body.prompt }],
    }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    if (r.status === 401) throw new Error('API 키가 올바르지 않습니다. 설정에서 확인해 주세요.');
    throw new Error('AI 호출 오류 (' + r.status + '): ' + t.slice(0, 200));
  }
  let full = '', buf = '';
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      let ev; try { ev = JSON.parse(data); } catch { continue; }
      if (ev.type === 'content_block_delta' && ev.delta && ev.delta.text) {
        full += ev.delta.text;
        if (opts.onDelta) opts.onDelta(ev.delta.text, full);
      }
      if (ev.type === 'error') throw new Error((ev.error && ev.error.message) || 'AI 스트림 오류');
    }
  }
  if (!full.trim()) throw new Error('AI 응답이 비어 있습니다. 다시 시도해 주세요.');
  return full;
}
function parseJSON(text) {
  const a = text.indexOf('{');
  if (a < 0) throw new Error('AI가 JSON 형식으로 답하지 않았습니다.');
  const candidates = [];
  const body = text.slice(a);
  candidates.push(body);
  // 모델이 중간에 ``` 를 넣고 같은 키부터 다시 쓴 경우 → 앞부분을 그 키 직전까지 잘라 병합
  const merged = mergeRestart(body);
  if (merged) candidates.push(merged);
  // 코드펜스 줄만 제거한 버전
  if (body.includes('```')) candidates.push(body.replace(/^```[a-z]*\s*$/gm, ''));
  for (const cand of candidates) {
    const b = cand.lastIndexOf('}');
    if (b >= 0) { try { return JSON.parse(cand.slice(0, b + 1)); } catch {} }
    // 토큰 한도로 잘린 JSON 복구: 뒤에서부터 안전한 지점까지 잘라 가며 닫는다
    let t = cand;
    for (let i = 0; i < 10; i++) {
      try { return JSON.parse(closeJson(t)); } catch {}
      const cut = Math.max(t.lastIndexOf(','), t.lastIndexOf('{'), t.lastIndexOf('['));
      if (cut <= 1) break;
      t = t.slice(0, cut);
    }
  }
  throw new Error('bad-json');
}
function mergeRestart(body) {
  const parts = body.split(/\n?```[a-z]*\n?/);
  if (parts.length < 2) return null;
  const head = parts[0], tail = parts.slice(1).join('');
  const km = tail.match(/^\s*"([^"]+)"\s*:/);
  if (!km) return null;
  const idx = head.lastIndexOf('"' + km[1] + '"');
  if (idx < 0) return null;
  return head.slice(0, idx) + tail.trimStart();
}
function closeJson(s) {
  let inStr = false, esc = false; const stack = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{') stack.push('}');
    else if (c === '[') stack.push(']');
    else if (c === '}' || c === ']') stack.pop();
  }
  let t = s;
  if (inStr) t += '"';
  t = t.replace(/[,\s]+$/, '');
  if (/:$/.test(t)) t += 'null';
  return t + stack.reverse().join('');
}
async function callAIJson(key, slots, opts = {}) {
  const txt = await callAI(key, slots, opts);
  try { return parseJSON(txt); }
  catch (e) { console.warn('JSON 파싱 실패 원문:', txt); throw new Error('AI 응답을 해석하지 못했습니다. 한 번 더 시도해 주세요.'); }
}

/* ═══════════════════ 브랜드 ═══════════════════ */
const APP_VERSION = 'v49 · 2026-07-21';
(() => { const av = document.getElementById('app-ver'); if (av) av.textContent = 'M.Works ' + APP_VERSION; })();
/* ── 화면 글자 크기·글자체 ── */
function applyDisplay() {
  document.documentElement.style.fontSize = Math.round(17 * (DB.settings.fontScale || 100) / 100) + 'px';
  document.body.classList.toggle('serif-ui', DB.settings.fontFace === 'serif');
  document.body.classList.toggle('gothic-ui', DB.settings.fontFace === 'gothic');
  // 화면 색상(테마)
  const themes = { white: '#ffffff', ivory: '#faf6ee', mint: '#f3f8f4', lilac: '#f7f5fc' };
  document.documentElement.style.setProperty('--canvas', themes[DB.settings.theme] || '#ffffff');
  // 화면 밝기 — 화면 전체에 얇은 명암 막을 씌운다
  let ov = document.getElementById('bright-ov');
  if (!ov) { ov = document.createElement('div'); ov.id = 'bright-ov'; document.body.appendChild(ov); }
  const b = DB.settings.brightness || 100;
  if (b < 100) ov.style.background = 'rgba(0,0,0,' + ((100 - b) / 100).toFixed(2) + ')';
  else if (b > 100) ov.style.background = 'rgba(255,255,255,' + ((b - 100) / 100).toFixed(2) + ')';
  else ov.style.background = 'transparent';
}
applyDisplay();
/* ── 앱 잠금(비밀번호) ── */
const encPass = pw => btoa(unescape(encodeURIComponent('mw:' + pw)));
function showLock() {
  const ov = document.createElement('div');
  ov.id = 'app-lock';
  ov.innerHTML = `
    <div class="lock-box">
      <div class="logo-mark" style="width:76px;height:76px;margin:0 auto 14px">${LOGO_SVG}</div>
      <h2 style="margin-bottom:4px">M.Works</h2>
      <p style="font-size:.85rem;color:var(--ink-soft);margin-bottom:16px">비밀번호를 입력해 주세요</p>
      <input type="password" id="lock-pw" autocomplete="off" style="text-align:center;font-size:1.2rem;padding:10px;border:1.5px solid var(--hairline);border-radius:10px;width:220px">
      <div style="margin-top:14px"><button class="btn btn-primary" id="lock-go">열기</button></div>
    </div>`;
  document.body.appendChild(ov);
  const tryGo = () => {
    if (encPass(document.getElementById('lock-pw').value) === DB.settings.appPass) {
      sessionStorage.setItem('mworks_unlock', '1');
      ov.remove();
    } else {
      toast('비밀번호가 다릅니다.');
      document.getElementById('lock-pw').value = '';
      document.getElementById('lock-pw').focus();
    }
  };
  document.getElementById('lock-go').addEventListener('click', tryGo);
  document.getElementById('lock-pw').addEventListener('keydown', e => { if (e.key === 'Enter') tryGo(); });
  setTimeout(() => document.getElementById('lock-pw').focus(), 100);
}
if (DB.settings.appPass && sessionStorage.getItem('mworks_unlock') !== '1') showLock();
/* ── 사용 설명서 ── */
function openManual() {
  modal('사용 설명서 — M.Works ' + APP_VERSION, `
    <div style="font-size:.9rem;line-height:1.8" class="manual">
    <style>.manual p{margin:0 0 14px}.manual h4{margin:26px 0 10px}.manual h4:first-child{margin-top:0}.manual ul{margin:0 0 14px 18px}.manual li{margin-bottom:4px}</style>

    <h4>Message Works 란?</h4>
    <ul>
      <li>"메시지를 만드는 곳"</li>
      <li>"메시지 제작소"</li>
      <li>"메시지 연구소"</li>
    </ul>
    <p>즉, <b>"메시지를 만들어 내는 작업장"</b>이라는 의미를 가집니다.</p>

    <h4>1. 다섯 단계 흐름</h4>
    <p>왼쪽의 <b>새 설교 시작</b>을 눌러 기본 정보(주제·대상·목적·날짜)를 적고 아래 순서로 진행합니다.</p>
    <p>① <b>본문 찾기</b> — 주제를 넣으면 AI가 본문 5곳을 추천합니다. 마음에 없으면 요청사항을 적고 추가 추천을 받으세요. 확정하면 본문 전문을 성경에서 복사해 붙여넣습니다.</p>
    <p>② <b>중심사상</b> — 본문을 로빈슨 12단계로 분석해 한 문장 중심사상을 세웁니다.</p>
    <p>③ <b>설교 작성</b> — [🤖 설교문 작성]을 누르면 나의 작성 규칙·자료 서랍을 반영해 초안을 씁니다. 초안이 생기면 아래 <b>부분 재작성 메뉴</b>(제목 다시, 예화 추가, 추천 도서 추가 등)가 열립니다.</p>
    <p>④ <b>형식 결정</b> — 연역·귀납·4페이지 등 9가지 형식으로 바꿔보고 마음에 들면 승인합니다.</p>
    <p>⑤ <b>연습하기</b> — 피드백·제스처·쉼멈춤 추천을 받고, <b>📄 원고에서 위치 보기</b>로 본문 속 표시(🖐①·∕·⏸)를 확인합니다. 표시를 누르면 옆에 설명이 나옵니다. 리허설 모드로 시간을 재세요.</p>

    <h4>2. AI 연결</h4>
    <p>가장 쉬운 방법: 설정의 <b>간편 연결</b>에 교회 비밀번호를 넣고 [🔑 연결]을 누르면 끝입니다. 휴대폰·태블릿 등 어느 기기든 한 번만 하면 됩니다.</p>
    <p>그 외에 Anthropic API 키를 직접 넣거나, 이 컴퓨터에서 claude 로그인이 되어 있으면 자동 연결됩니다. 왼쪽 아래 배지에서 연결 상태를 확인하세요.</p>
    <p>설교문 생성은 처음 1~3분간 조용히 구상한 뒤 글이 흐르기 시작합니다.</p>

    <h4>3. 자료 서랍</h4>
    <p>왼쪽 메뉴 <b>자료 서랍</b>에 예화·통계·간증·인용을 넣어 두면(파일을 끌어다 놓아도 됨) 설교문 작성 때 자동으로 곳곳에 인용됩니다.</p>
    <p>3단계의 자료 투입 카드로 이미 쓴 원고에 녹일 수도 있습니다.</p>

    <h4>4. 내보내기·인쇄</h4>
    <p>왼쪽 <b>내보내기</b>에서 Word(.doc)·텍스트·인쇄를 선택합니다.</p>
    <p>체크박스로 <b>쉼·멈춤 표시(∕·⏸)</b>와 <b>제스처 위치 표시(🖐①)</b>의 포함 여부를 정할 수 있습니다.</p>
    <p>Word 양식은 나의 작성 규칙의 원고 양식(맑은 고딕 10pt, 한 문장 한 줄)을 따릅니다.</p>

    <h4>5. 저장·백업</h4>
    <p>모든 데이터는 이 기기 브라우저에 자동 저장됩니다(서버 전송 없음).</p>
    <p>보관함의 <b>전체 백업(JSON)</b>으로 파일 백업을 권장합니다. 기기를 바꿀 때 이 파일을 가져오기 하면 됩니다.</p>

    <h4>6. 업데이트·버전</h4>
    <p>왼쪽 아래에 현재 버전(예: ${APP_VERSION})이 표시됩니다.</p>
    <p>새 버전이 배포되면 앱을 열 때 자동으로 확인해 한 번 새로고침하며 적용됩니다.</p>

    <h4>7. 비밀번호 잠금</h4>
    <p>설정 → <b>🔒 비밀번호 걸기</b>로 앱을 열 때 비밀번호를 묻게 할 수 있습니다.</p>
    <p>이 기기에만 저장되므로 잊지 않게 메모해 두세요. <b>나가기</b>를 누르면 다음에 열 때 다시 묻습니다.</p>

    <h4>8. 프롬프트 체계 — 네 가지의 차이</h4>
    <p>설정 → <b>🧩 설교작성·세부작성 프롬프트</b>에 나오는 것들의 관계입니다. <b>설교작성 프롬프트</b> 한 장 안에 <b>시스템 프롬프트(1부)</b>와 <b>작업주문 프롬프트(2부)</b>가 들어 있고, 그 위에 <b>세부작성 프롬프트</b>를 얹는 구조입니다.</p>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.82rem;line-height:1.5">
      <tr style="background:var(--surface-soft)">
        <th style="border:1px solid var(--hairline);padding:7px 8px;text-align:left;white-space:nowrap">이름</th>
        <th style="border:1px solid var(--hairline);padding:7px 8px;text-align:left">무엇인가</th>
        <th style="border:1px solid var(--hairline);padding:7px 8px;text-align:left">언제 쓰이나</th>
        <th style="border:1px solid var(--hairline);padding:7px 8px;text-align:left">고쳐도 되나</th>
      </tr>
      <tr>
        <td style="border:1px solid var(--hairline);padding:7px 8px"><b>① 설교작성<br>프롬프트</b></td>
        <td style="border:1px solid var(--hairline);padding:7px 8px">각 단계별 작업의 기본 지시서 전체. 기능마다 1장(본문 추천용·설교문 작성용…). 아래 ③+④ 두 부분의 묶음이며, 책의 방법론이 구현된 곳</td>
        <td style="border:1px solid var(--hairline);padding:7px 8px">그 단계의 🤖 버튼을 누를 때마다</td>
        <td style="border:1px solid var(--hairline);padding:7px 8px">원칙적으로 그대로 두기. 고치면 [기본값 복원] 가능</td>
      </tr>
      <tr>
        <td style="border:1px solid var(--hairline);padding:7px 8px"><b>② 세부작성<br>프롬프트</b></td>
        <td style="border:1px solid var(--hairline);padding:7px 8px">①에 내가 덧붙이는 추가 지시(예: "본문 추천 — 이런 것을 참조하라"). 적용 단계를 지정하면 자동 결합</td>
        <td style="border:1px solid var(--hairline);padding:7px 8px">지정한 단계가 실행될 때</td>
        <td style="border:1px solid var(--hairline);padding:7px 8px"><b>자유롭게</b> — 무엇을 써도 앱이 망가지지 않는 안전한 자리</td>
      </tr>
      <tr>
        <td style="border:1px solid var(--hairline);padding:7px 8px"><b>③ 시스템<br>프롬프트</b></td>
        <td style="border:1px solid var(--hairline);padding:7px 8px">①의 1부. "너는 누구이고 어떤 원칙으로 일하라" — 역할·방법론·환각 금지·문체. 비유: 직원의 근로계약서</td>
        <td style="border:1px solid var(--hairline);padding:7px 8px">매번 똑같이 적용</td>
        <td style="border:1px solid var(--hairline);padding:7px 8px">웬만하면 그대로</td>
      </tr>
      <tr>
        <td style="border:1px solid var(--hairline);padding:7px 8px"><b>④ 작업주문<br>프롬프트</b></td>
        <td style="border:1px solid var(--hairline);padding:7px 8px">①의 2부. 버튼을 누를 때마다 보내지는 주문서 양식. <code>{{주제}}</code> 같은 빈칸을 앱이 그 프로젝트의 실제 값으로 채움. 비유: 작업 주문서 양식</td>
        <td style="border:1px solid var(--hairline);padding:7px 8px">버튼을 누를 때마다 빈칸이 새로 채워짐</td>
        <td style="border:1px solid var(--hairline);padding:7px 8px">문장만. <code>{{빈칸}}</code>·JSON 형식은 지우면 작동 불능</td>
      </tr>
    </table></div>
    <p style="margin-top:10px"><b>기억할 한 문장</b> — "지시서(①=③+④)는 앱의 것이니 두고, 나는 ② 세부작성 프롬프트에만 쓴다."</p>

    <h4>9. 클로드 프로젝트의 항목별 프롬프트는 어디에?</h4>
    <p>인공지능(클로드 등)에서 프로젝트를 만들 때 쓰던 항목별 프롬프트(dodo·big idea·title·설교형식·honor 같은 것)는 전부 <b>② 세부작성 프롬프트</b>에 넣으면 됩니다. 딱 그 용도로 만든 자리입니다.</p>
    <p>넣는 법: ① 설정 → 🧩 설교작성·세부작성 프롬프트 → [＋ 새 세부작성 프롬프트] ② 이름 칸에 항목 이름(예: big idea) ③ 내용 칸에 프롬프트 전문 붙여넣기 ④ 적용 단계 지정.</p>
    <p>적용 단계 예시 — big idea → <b>중심사상</b> / title(제목) → <b>부분 재작성·제목</b> / 설교형식 → <b>형식 변환</b> / 어디에 쓸지 애매하면 <b>보관만</b>으로 저장해 두었다가 나중에 지정.</p>
    <p>이렇게 하면 클로드 프로젝트에서처럼, 해당 작업이 실행될 때마다 그 프롬프트가 자동으로 함께 적용됩니다.</p>
    </div>`);
}
const LOGO_SVG = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-label="M.Works 로고">
        <rect x="4" y="4" width="72" height="72" rx="18" fill="#FFC000"/>
        <text x="40" y="52" transform="scale(1 1.2)" font-family="-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif" font-size="44" font-weight="800" text-anchor="middle" fill="#ffffff">M</text>
        <rect x="48" y="42" width="44" height="44" rx="12" fill="#FF5600" stroke="#ffffff" stroke-width="3"/>
        <text x="70" y="62.7" transform="scale(1 1.2)" font-family="-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif" font-size="26" font-weight="800" text-anchor="middle" fill="#000000">W</text>
</svg>`;

/* ═══════════════════ 공통 UI ═══════════════════ */
function toast(msg, ms = 3200) {
  const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.add('hidden'), ms);
}
function modal(title, bodyHtml) {
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = bodyHtml;
  $('#modal-backdrop').classList.remove('hidden');
  return $('#modal-body');
}
function closeModal() { $('#modal-backdrop').classList.add('hidden'); }
$('#modal-close').addEventListener('click', closeModal);
$('#modal-backdrop').addEventListener('click', e => { if (e.target.id === 'modal-backdrop') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); } });

/* ═══════════════════ 원고 도우미 ═══════════════════ */
function mdToHtml(md) {
  const lines = md.split('\n');
  let html = '', inList = null, inQuote = false;
  const closeAll = () => { if (inList) { html += `</${inList}>`; inList = null; } if (inQuote) { html += '</blockquote>'; inQuote = false; } };
  for (let raw of lines) {
    const line = raw.trimEnd();
    const inline = s => esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    if (/^### /.test(line)) { closeAll(); html += '<h3>' + inline(line.slice(4)) + '</h3>'; }
    else if (/^## /.test(line)) { closeAll(); html += '<h2>' + inline(line.slice(3)) + '</h2>'; }
    else if (/^# /.test(line)) { closeAll(); html += '<h1>' + inline(line.slice(2)) + '</h1>'; }
    else if (/^> ?/.test(line)) { if (inList) { html += `</${inList}>`; inList = null; } if (!inQuote) { html += '<blockquote>'; inQuote = true; } html += '<p>' + inline(line.replace(/^> ?/, '')) + '</p>'; }
    else if (/^[-•] /.test(line)) { if (inQuote) { html += '</blockquote>'; inQuote = false; } if (inList !== 'ul') { if (inList) html += `</${inList}>`; html += '<ul>'; inList = 'ul'; } html += '<li>' + inline(line.slice(2)) + '</li>'; }
    else if (/^\d+\. /.test(line)) { if (inQuote) { html += '</blockquote>'; inQuote = false; } if (inList !== 'ol') { if (inList) html += `</${inList}>`; html += '<ol>'; inList = 'ol'; } html += '<li>' + inline(line.replace(/^\d+\. /, '')) + '</li>'; }
    else if (line === '') { closeAll(); }
    else { closeAll(); html += '<p>' + inline(line) + '</p>'; }
  }
  closeAll();
  return html;
}
function htmlToText(html) {
  const div = document.createElement('div');
  div.innerHTML = (html || '').replace(/<(h[1-3]|p|li|blockquote|div|br)[^>]*>/gi, '\n$&');
  return div.textContent.replace(/\n{3,}/g, '\n\n').trim();
}
function draftText() { return htmlToText($('#editor') ? $('#editor').innerHTML : (cur() ? cur().draft.html : '')); }
function readingMinutes(text) {
  const chars = (text || '').replace(/\s+/g, ' ').length;
  return chars / (DB.settings.cpm || 300);
}
function fmtMin(m) {
  if (!isFinite(m) || m <= 0) return '0분';
  const mm = Math.floor(m), ss = Math.round((m - mm) * 60);
  return mm + '분 ' + (ss ? ss + '초' : '');
}

/* ═══════════════════ 크롬(상단·내비·우측) ═══════════════════ */
const STEP_NAMES = ['기본 정보', '본문 찾기', '중심사상', '설교 작성', '형식 결정', '연습하기'];
let curView = 'home'; // home | step | archive | forms | settings
let curStep = 0;

function progressOf(p) {
  if (!p) return 0;
  let n = 0;
  if (p.inputs.topic) n++;
  if (p.passage.confirmed) n++;
  if (p.central.done) n++;
  if (htmlToText(p.draft.html).length > 300) n++;
  if (p.form.selected) n++;
  if (p.rehearsal.runs.length || p.rehearsal.feedback) n++;
  return Math.round(n / 6 * 100);
}
function refreshChrome() {
  const p = cur();
  $$('#step-nav li').forEach(li => {
    const s = +li.dataset.step;
    li.classList.toggle('active', curView === 'step' && curStep === s);
    li.classList.toggle('locked', !p && s > 0);
    li.classList.remove('done');
    if (p) {
      if (s === 0 && p.inputs.topic) li.classList.add('done');
      if (s === 1 && p.passage.confirmed) li.classList.add('done');
      if (s === 2 && p.central.done) li.classList.add('done');
      if (s === 3 && htmlToText(p.draft.html).length > 300) li.classList.add('done');
      if (s === 4 && p.form.selected) li.classList.add('done');
      if (s === 5 && (p.rehearsal.runs.length || p.rehearsal.feedback)) li.classList.add('done');
    }
  });
  const prog = progressOf(p);
  $('#nav-progress-bar').style.width = prog + '%';
  $('#nav-progress-label').textContent = '진행률 ' + prog + '%';
  renderContext();
}
function renderContext() {
  const p = cur(), el = $('#ctx-body');
  if (!p) { el.innerHTML = '<div class="ctx-empty">새 설교를 시작하거나 보관함에서 프로젝트를 여세요.</div>'; return; }
  const c = p.central || {};
  const nextGuide = {
    0: '기본 정보를 입력하고 <b>1단계 본문 찾기</b>로 가세요.',
    1: '본문을 확정하면 <b>2단계 중심사상</b>이 열립니다.',
    2: '설교적 문장을 확정하고 <b>3단계 설교 작성</b>으로 가세요.',
    3: '원고를 다듬은 뒤 <b>4단계 형식 결정</b>에서 그릇을 골라 보세요.',
    4: '형식을 정했으면 <b>5단계 연습하기</b>에서 리허설하세요.',
    5: '피드백을 반영하고 리허설로 시간을 재세요. 완료되면 <b>내보내기</b>!',
  }[curView === 'step' ? curStep : (p.step || 0)];
  el.innerHTML = `
    <div class="ctx-item"><div class="k">현재 본문</div><div class="v serif">${esc(p.passage.ref || p.inputs.passage || '미정')}</div></div>
    <div class="ctx-item"><div class="k">중심사상 (설교적 문장)</div><div class="v serif">${esc(c.homiletical || '미정')}</div></div>
    <div class="ctx-item"><div class="k">회중의 필요</div><div class="v">${esc(p.inputs.needs || '—')}</div></div>
    <div class="ctx-item"><div class="k">설교 목적</div><div class="v">${esc(p.inputs.purpose || '—')}</div></div>
    <div class="ctx-item"><div class="k">선택한 형식</div><div class="v">${esc(formName(p.form.selected) || '미정')}</div></div>
    <div class="ctx-item"><div class="k">예상 시간</div><div class="v"><b>${fmtMin(readingMinutes(htmlToText(p.draft.html)))}</b> / 목표 ${p.inputs.targetMin}분</div></div>
    <div class="ctx-item"><div class="k">설교 예정일</div><div class="v">${esc(p.inputs.date || '—')}</div></div>
    <div class="ctx-next">다음 할 일 — ${nextGuide}</div>`;
}
function allForms() { return window.MSGB_FORMS.concat(DB.customForms); }
function formName(key) { const f = allForms().find(f => f.key === key); return f ? f.name : key; }

/* ═══════════════════ 내비 이벤트 ═══════════════════ */
$('#btn-menu').addEventListener('click', () => document.body.classList.toggle('nav-open'));
$('#nav-backdrop').addEventListener('click', () => document.body.classList.remove('nav-open'));
// 메뉴 안 어떤 버튼이든 누르면 (휴대폰에서) 서랍을 닫는다
$('#sidenav').addEventListener('click', e => { if (e.target.closest('button, li')) document.body.classList.remove('nav-open'); });
$('#logo').addEventListener('click', () => { curView = 'home'; render(); });
$('#btn-nav-materials').addEventListener('click', () => { curView = 'materials'; render(); });
$('#btn-nav-exit').addEventListener('click', () => {
  syncEditor(); save(true);
  sessionStorage.removeItem('mworks_unlock'); // 다음에 열 때 비밀번호 다시 묻기
  // 완전 종료: 창 닫기 시도 → 막히면 빈 화면으로 이탈
  window.open('', '_self');
  window.close();
  setTimeout(() => {
    if (!window.closed) location.replace('about:blank');
  }, 250);
});
$('#top-settings').addEventListener('click', openSettings);
$('#btn-back').addEventListener('click', goBack);
$('#btn-save').addEventListener('click', () => { syncEditor(); save(true); toast('저장했습니다.'); });
$('#btn-export').addEventListener('click', openExport);
$$('#step-nav li').forEach(li => li.addEventListener('click', () => {
  const s = +li.dataset.step;
  if (!cur() && s > 0) { toast('먼저 새 설교를 시작해 주세요.'); return; }
  if (s === 0 && !cur()) { newProject(); }   // 새 설교 시작 → 기본 정보 테이블
  else gotoStep(s);
  document.body.classList.remove('nav-open');
}));
function gotoStep(s) {
  syncEditor();
  curView = 'step'; curStep = s;
  const p = cur(); if (p) { p.step = Math.max(p.step || 0, s); }
  render();
}

/* ═══════════════════ 프로젝트 CRUD ═══════════════════ */
function newProject() {
  const p = normProject({
    id: uid(), title: '', createdAt: Date.now(), updatedAt: Date.now(),
    inputs: { targetMin: DB.settings.targetMin },
  });
  DB.projects.unshift(p);
  curId = p.id;
  save(true);
  gotoStep(0);
}
function openProject(id) { syncEditor(); curId = id; curView = 'step'; curStep = cur().step || 0; render(); }
function duplicateProject(id) {
  const src = DB.projects.find(p => p.id === id); if (!src) return;
  const copy = JSON.parse(JSON.stringify(src));
  copy.id = uid(); copy.title = (src.title || src.inputs.topic || '설교') + ' (사본)';
  copy.createdAt = copy.updatedAt = Date.now();
  DB.projects.unshift(copy); save(true); render();
  toast('프로젝트를 복제했습니다.');
}
function trashProject(id) {
  const i = DB.projects.findIndex(p => p.id === id); if (i < 0) return;
  const [p] = DB.projects.splice(i, 1);
  p._trashedAt = Date.now(); DB.trash.unshift(p);
  if (curId === id) curId = null;
  save(true); render(); toast('휴지통으로 이동했습니다. (보관함 하단에서 복원 가능)');
}
function restoreProject(id) {
  const i = DB.trash.findIndex(p => p.id === id); if (i < 0) return;
  const [p] = DB.trash.splice(i, 1); delete p._trashedAt;
  DB.projects.unshift(p); save(true); render(); toast('복원했습니다.');
}

/* ═══════════════════ 뒤로 가기 ═══════════════════ */
const viewHistory = [];
let _lastViewKey = null, _lastViewState = null, _restoringView = false;
function trackView() {
  const state = { view: curView, step: curStep, id: curId };
  const key = state.view + '|' + state.step + '|' + state.id;
  if (!_restoringView && _lastViewKey && _lastViewKey !== key) {
    viewHistory.push(_lastViewState);
    if (viewHistory.length > 40) viewHistory.shift();
  }
  _restoringView = false;
  _lastViewKey = key; _lastViewState = state;
  const bb = $('#btn-back');
  if (bb) bb.style.opacity = viewHistory.length ? '1' : '.3';
}
function goBack() {
  syncEditor();
  if (!viewHistory.length) { curView = 'home'; render(); return; }
  const s = viewHistory.pop();
  _restoringView = true;
  curView = s.view; curStep = s.step;
  if (s.id && DB.projects.find(p => p.id === s.id)) curId = s.id;
  render();
}

/* ═══════════════════ 렌더 라우터 ═══════════════════ */
function render() {
  refreshChrome();
  trackView();
  const m = $('#main');
  document.body.classList.remove('fullscreen-editor');
  if (curView === 'archive') return renderArchive(m);
  if (curView === 'forms') return renderFormsManager(m);
  if (curView === 'materials') return renderMaterials(m);
  if (curView === 'clinic') return renderClinic(m);
  if (curView === 'prompts') return renderPromptLibrary(m);
  if (curView === 'home') return renderHome(m);
  const p = cur();
  if (!p) return renderHome(m);
  [renderStep0, renderStep1, renderStep2, renderStep3, renderStep4, renderStep5][curStep](m, p);
}

/* ═══════════════════ 홈 ═══════════════════ */
function renderHome(m) {
  const recent = DB.projects.slice(0, 5);
  m.innerHTML = `
    <div style="text-align:center; padding:14px 0 30px">
      <h1 style="font-size:2.4rem;font-weight:700;letter-spacing:0em;margin-bottom:6px;font-style:italic">Message Works</h1>
      <p style="color:var(--ink-soft);margin-top:6px;font-size:1.08rem">설교자를 위한 설교 작성 5단계</p>
      <div class="btn-row" style="justify-content:center;margin-top:100px;margin-bottom:56px">
        <button class="btn btn-gold" id="home-new"><svg class="btn-ico" viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>새 설교 시작</button>
        <button class="btn btn-ghost" id="home-import"><svg class="btn-ico" viewBox="0 0 24 24"><path d="M12 3v10m0 0l-4-4m4 4l4-4M4 15v4a2 2 0 002 2h12a2 2 0 002-2v-4"/></svg>설교 가져오기</button>
        <button class="btn btn-ghost" id="home-archive"><svg class="btn-ico" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v9a2 2 0 002 2h10a2 2 0 002-2V9M10 13h4"/></svg>보관함</button>
      </div>
    </div>
    <div class="card">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;text-align:center">
        ${[['① 본문 찾기', 'var(--lime)'], ['② 중심 사상', 'var(--mint)'], ['③ 설교 작성', 'var(--lilac)'], ['④ 형식 결정', 'var(--cream)'], ['⑤ 연습하기', 'var(--pink)']]
          .map(([s, c]) => `<div style="background:${c};border-radius:var(--r-md);padding:14px 8px;font-size:1rem;font-weight:700;color:var(--ink)">${s}</div>`).join('')}
      </div>
    </div>
    ${recent.length ? `<div class="card" style="margin-top:34px"><h3>최근 작업</h3>${recent.map(p => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--cream-2)">
        <span class="proj-title-cell" data-open="${p.id}" style="flex:1">${esc(p.title || p.inputs.topic || '제목 없음')}</span>
        <span class="badge">${esc(p.passage.ref || '본문 미정')}</span>
        <span class="mini-progress"><i style="width:${progressOf(p)}%"></i></span>
        <button class="btn btn-ghost btn-sm" data-open="${p.id}">열기</button>
        <button class="btn btn-ghost btn-sm" data-trash="${p.id}" title="휴지통으로 (보관함에서 복원 가능)">🗑</button>
      </div>`).join('')}</div>` : ''}`;
  $('#home-new').addEventListener('click', newProject);
  $('#home-import').addEventListener('click', openImport);
  $('#home-archive').addEventListener('click', () => { curView = 'archive'; render(); });
  m.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => openProject(b.dataset.open)));
  m.querySelectorAll('[data-trash]').forEach(b => b.addEventListener('click', () => {
    const p = DB.projects.find(x => x.id === b.dataset.trash);
    const name = (p && (p.title || p.inputs.topic)) || '제목 없음';
    if (confirm(`"${name}" 설교를 휴지통으로 옮길까요?\n(보관함 하단 휴지통에서 복원할 수 있어요)`)) trashProject(b.dataset.trash);
  }));
}

/* ═══════════════════ 0단계: 기본 정보 ═══════════════════ */
function renderStep0(m, p) {
  const i = p.inputs;
  m.innerHTML = `
    <div class="step-head">시작</div>
    <h1 class="step-title">기본 정보</h1>
    <p class="step-desc">이번 설교가 놓일 자리를 적어 주세요. 회중의 필요와 상황이 구체적일수록 본문 추천과 원고가 정확해집니다.</p>
    <div class="card">
      <h3>필수 입력</h3>
      <div class="form-grid">
        <div class="field"><label>설교 주제 <span class="req">*</span></label><input id="f-topic" value="${esc(i.topic)}" placeholder="예: 불안 속에서 하나님을 신뢰하기"></div>
        <div class="field"><label>성경 본문 <span class="opt">(정해졌으면 입력, 아니면 비워 두세요)</span></label><input id="f-passage" value="${esc(i.passage)}" placeholder="예: 마가복음 4:35-41"></div>
        <div class="field full"><label>설교가 필요한 상황적 이유 <span class="req">*</span></label><textarea id="f-reason" placeholder="왜 지금 이 설교인가요? 교회·시대·공동체의 상황">${esc(i.reason)}</textarea></div>
        <div class="field full"><label>지금 회중이 겪는 문제와 필요 <span class="req">*</span></label><textarea id="f-needs" placeholder="심방·기도제목·대화에서 들은 실제 필요">${esc(i.needs)}</textarea></div>
        <div class="field"><label>주요 청중 <span class="req">*</span></label><input id="f-audience" value="${esc(i.audience)}" placeholder="예: 장년 중심 주일 2부, 새신자 다수"></div>
        <div class="field"><label>설교 목적 <span class="req">*</span></label><input id="f-purpose" value="${esc(i.purpose)}" placeholder="예: 위로와 신뢰의 회복 / 결단 촉구"></div>
        <div class="field"><label>설교 예정일</label><input id="f-date" type="date" value="${esc(i.date)}"></div>
        <div class="field"><label>목표 설교 시간(분)</label><input id="f-target" type="number" min="5" max="90" value="${esc(i.targetMin)}"></div>
      </div>
    </div>
    <div class="card">
      <h3>선택 입력 <span class="opt" style="font-weight:400;font-size:.8rem">— 채울수록 좋아집니다</span></h3>
      <div class="form-grid">
        <div class="field"><label>교회 절기</label><input id="f-season" value="${esc(i.season)}" placeholder="예: 대림절, 사순절, 감사주일"></div>
        <div class="field"><label>설교 시리즈명</label><input id="f-series" value="${esc(i.series)}" placeholder="예: 2026 가을 [연결] 시리즈"></div>
        <div class="field full"><label>앞뒤 설교와의 관계</label><input id="f-relation" value="${esc(i.relation)}" placeholder="예: 지난주 '풍랑' 다음, 다음주 '거라사' 전"></div>
        <div class="field full"><label>반드시 포함할 목회적 강조점</label><textarea id="f-emphasis">${esc(i.emphasis)}</textarea></div>
        <div class="field full"><label>피해야 할 표현·신학적 오해</label><textarea id="f-avoid">${esc(i.avoid)}</textarea></div>
        <div class="field full"><label>설교자의 개인 경험·메모 <span class="opt">(여기 적은 것만 실제 경험으로 원고에 씁니다)</span></label><textarea id="f-personal">${esc(i.personal)}</textarea></div>
        <div class="field full"><label>참고 자료 메모</label><textarea id="f-refs">${esc(i.refs)}</textarea></div>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" id="f-next">저장하고 1단계 본문 찾기 →</button>
      </div>
    </div>`;
  const grab = () => {
    i.topic = $('#f-topic').value.trim(); i.passage = $('#f-passage').value.trim();
    i.reason = $('#f-reason').value.trim(); i.needs = $('#f-needs').value.trim();
    i.audience = $('#f-audience').value.trim(); i.purpose = $('#f-purpose').value.trim();
    i.date = $('#f-date').value; i.targetMin = +$('#f-target').value || 25;
    i.season = $('#f-season').value.trim(); i.series = $('#f-series').value.trim();
    i.relation = $('#f-relation').value.trim(); i.emphasis = $('#f-emphasis').value.trim();
    i.avoid = $('#f-avoid').value.trim(); i.personal = $('#f-personal').value.trim(); i.refs = $('#f-refs').value.trim();
    p.title = p.title || i.topic;
    touch(p);
  };
  m.querySelectorAll('input,textarea').forEach(el => el.addEventListener('change', grab));
  $('#f-next').addEventListener('click', () => {
    grab();
    if (!i.topic || !i.reason || !i.needs || !i.audience || !i.purpose) { toast('필수 항목(주제·이유·필요·청중·목적)을 채워 주세요.'); return; }
    gotoStep(1);
  });
}

/* ── 자료 서랍 드롭존: 끌어다 놓기 + 붙여넣기 (자료는 설교 작성 때 곳곳에 인용) ── */
function addRefMaterial(type, title, content) {
  DB.materials.unshift({ id: uid(), type, title: title.slice(0, 60), content: String(content).slice(0, 12000), tags: '', createdAt: Date.now() });
  save(true);
  if (curView === 'materials') render();
}
async function ingestRefFile(f) {
  const name = f.name.replace(/\.[^.]+$/, '');
  if (/\.(txt|md|text)$/i.test(f.name) || f.type.startsWith('text/')) {
    const fr = new FileReader();
    fr.onload = () => { addRefMaterial('메모', name, fr.result); toast('"' + name + '" 을 담았습니다.'); };
    fr.readAsText(f);
  } else if (f.type.startsWith('image/') || f.type === 'application/pdf') {
    toast('"' + name + '" 내용을 AI가 읽는 중… (1~3분)', 5000);
    const fr = new FileReader();
    fr.onload = async () => {
      try {
        const j = await (await fetch('/api/ocr', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data: String(fr.result).split(',')[1], mime: f.type, model: DB.settings.model }) })).json();
        if (j.error) return toast('⚠ ' + j.error, 6000);
        addRefMaterial('메모', name, j.text);
        toast('"' + name + '" 내용을 읽어 담았습니다.');
      } catch (e) { toast('⚠ 인식 실패: ' + e.message, 6000); }
    };
    fr.readAsDataURL(f);
  } else {
    toast('한글(HWP)·워드 파일은 내용을 복사해서 붙여넣기 칸에 넣어 주세요.', 5000);
  }
}
function bindRefDrop() {
  const dz = $('#ref-drop'); if (!dz) return;
  const fi = $('#ref-file');
  dz.addEventListener('click', () => fi.click());
  ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('dragover'); }));
  dz.addEventListener('drop', e => { Array.from(e.dataTransfer.files || []).forEach(ingestRefFile); });
  fi.addEventListener('change', e => { Array.from(e.target.files || []).forEach(ingestRefFile); fi.value = ''; });
  const pasteAdd = $('#ref-paste-add');
  pasteAdd.addEventListener('click', () => {
    const t = $('#ref-paste').value.trim();
    if (t.length < 5) return toast('붙여넣은 내용이 없습니다.');
    addRefMaterial('메모', t.split('\n')[0].slice(0, 30), t);
    $('#ref-paste').value = '';
    toast('붙여넣은 자료를 담았습니다.');
  });
}

/* ═══════════════════ 1단계: 본문 찾기 ═══════════════════ */
function renderStep1(m, p) {
  const hasInput = !!p.inputs.passage;
  m.innerHTML = `
    <div class="step-head">1단계</div>
    <h1 class="step-title">본문 찾기</h1>
    <p class="step-desc">하나님의 니즈와 성도의 니즈가 만나는 본문을 찾습니다. 방법은 후보를 좁혀 주고, 기도가 결정을 내립니다.</p>
    <div id="s1-body"></div>`;
  const body = $('#s1-body');

  const confirmedCard = p.passage.confirmed ? `
    <div class="card" style="border-color:var(--gold)">
      <h3>✓ 확정된 본문</h3>
      <div class="cand-ref" style="font-size:1.3rem">${esc(p.passage.ref)}</div>
      ${p.passage.genre ? `<span class="badge">${esc(p.passage.genre)}</span>` : ''}
      <div class="field" style="margin-top:12px">
        <label>본문 전문 (${esc(DB.settings.translation)}) <span class="opt">— 성경에서 복사해 붙여넣어 주세요. 정확한 인용을 위해 AI가 임의로 생성하지 않습니다.</span></label>
        <textarea id="s1-text" style="min-height:120px" placeholder="본문 전문을 붙여넣으면 2·3단계의 분석과 인용이 정확해집니다.">${esc(p.passage.text)}</textarea>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" id="s1-go2">2단계 중심사상으로 →</button>
        <button class="btn btn-ghost" id="s1-unconfirm">본문 다시 정하기</button>
      </div>
    </div>` : '';

  const inputCard = !p.passage.confirmed ? `
    <div class="card">
      <h3>${hasInput ? 'A. 입력한 본문으로 진행' : 'A. 본문이 이미 정해졌다면'}</h3>
      <div class="form-grid">
        <div class="field full"><label>성경 본문</label><input id="s1-ref" value="${esc(p.passage.ref || p.inputs.passage)}" placeholder="예: 마가복음 2:1-12"></div>
      </div>
      <div class="btn-row">
        <button class="btn btn-gold" id="s1-confirm">이 본문으로 확정</button>
        <button class="btn btn-ghost" id="s1-check" ${aiConnected() ? '' : 'disabled'}>단락 확인 (문맥 점검) 🤖</button>
      </div>
      <div id="s1-check-result"></div>
    </div>` : '';

  const recommendCard = !p.passage.confirmed ? `
    <div class="card">
      <h3>B. 본문 추천 받기</h3>
      <p style="font-size:.88rem;color:var(--ink-soft)">주제·상황·회중의 필요·목적을 분석해 성경 전체에서 후보 5개를 찾습니다. 기록 당시의 문제와 오늘의 필요가 본질에서 만나는 본문을 우선합니다.</p>
      <div class="btn-row">
        <button class="btn btn-primary" id="s1-recommend" ${aiConnected() ? '' : 'disabled'}>본문 후보 5개 추천 🤖</button>
        ${!aiConnected() ? '<span style="font-size:.8rem;color:var(--red)">AI 미연결 — 설정에서 연결해 주세요</span>' : ''}
      </div>
      <div id="s1-cands">${renderCands(p)}</div>
      ${p.passage.candidates.length ? `
      <div style="margin-top:18px;border-top:1px solid var(--hairline);padding-top:16px">
        <h4 style="margin-top:0">마음에 드는 본문이 없나요? — 한 번 더 추천</h4>
        <div class="field"><label>추가 요청 사항 <span class="opt">(적으면 최우선으로 반영됩니다)</span></label>
          <textarea id="s1-extra" style="min-height:64px" placeholder="예: 지금까지 혼전, 순결에 대한 주제로 잘 알려지지 않았던 구절 가운데 몇 구절을 찾아줘">${esc(p.passage.extraReq || '')}</textarea></div>
        <div class="btn-row" style="margin-top:8px">
          <button class="btn btn-primary" id="s1-more" ${aiConnected() ? '' : 'disabled'}>요청을 반영해 본문 2~3개 더 찾기 🤖</button>
        </div>
      </div>` : ''}
    </div>` : '';

  body.innerHTML = confirmedCard + inputCard + recommendCard;

  if (p.passage.confirmed) {
    $('#s1-text').addEventListener('change', e => { p.passage.text = e.target.value; touch(p); });
    $('#s1-go2').addEventListener('click', () => { p.passage.text = $('#s1-text').value; touch(p); gotoStep(2); });
    $('#s1-unconfirm').addEventListener('click', () => { p.passage.confirmed = false; touch(p); render(); });
    return;
  }
  $('#s1-confirm').addEventListener('click', () => {
    const ref = $('#s1-ref').value.trim();
    if (!ref) { toast('본문을 입력해 주세요.'); return; }
    if (p.passage.ref && p.passage.ref !== ref) p.passage.text = '';   // 본문이 바뀌면 이전 전문 제거 (다른 구절이 남는 버그 방지)
    p.passage.ref = ref; p.passage.confirmed = true; touch(p); render();
    autoFillPassage(p);
  });
  $('#s1-check').addEventListener('click', async () => {
    const ref = $('#s1-ref').value.trim();
    if (!ref) { toast('본문을 입력해 주세요.'); return; }
    try {
      const r = await callAIJson('passageCheck', { passage: ref, topic: p.inputs.topic, purpose: p.inputs.purpose });
      p.passage.check = r; p.passage.genre = r.genre || ''; touch(p);
      $('#s1-check-result').innerHTML = `
        <div class="fb-item ${r.isCompleteUnit ? '' : 'warn'}" style="margin-top:12px">
          <b>${r.isCompleteUnit ? '온전한 단락입니다' : '단락 확인 필요'}</b>
          ${esc(r.comment)}<br>
          ${r.suggestedRange ? `<br><b>확장 제안: ${esc(r.suggestedRange)}</b> — ${esc(r.suggestReason)}
            <div class="btn-row"><button class="btn btn-sm btn-gold" id="s1-apply-range">제안 범위로 바꾸기</button>
            <button class="btn btn-sm btn-ghost" id="s1-keep-range">지금 범위 유지</button></div>` : ''}
          ${r.cautions ? `<br><b>주의</b> ${esc(r.cautions)}` : ''}
        </div>`;
      const ap = $('#s1-apply-range');
      if (ap) ap.addEventListener('click', () => { $('#s1-ref').value = r.suggestedRange; toast('범위를 바꿨습니다. 확정 버튼을 눌러 주세요.'); });
      const kp = $('#s1-keep-range');
      if (kp) kp.addEventListener('click', () => { toast('현재 범위를 유지합니다.'); });
    } catch (e) { if (e.message !== 'no-ai') toast('오류: ' + e.message); }
  });
  $('#s1-recommend').addEventListener('click', () => recommend(p, 5, false));
  const more = $('#s1-more');
  if (more) more.addEventListener('click', () => {
    p.passage.extraReq = ($('#s1-extra') ? $('#s1-extra').value.trim() : '');
    touch(p);
    recommend(p, '2~3', true);
  });
  const extraTa = $('#s1-extra');
  if (extraTa) extraTa.addEventListener('change', e => { p.passage.extraReq = e.target.value.trim(); touch(p); });
  bindCands(p);
}
function renderCands(p) {
  if (!p.passage.candidates.length) return '';
  return '<div style="margin-top:16px">' + p.passage.candidates.map((c, i) => `
    <div class="cand ${p.passage.ref === c.ref ? 'selected' : ''}" data-i="${i}">
      <div class="cand-head">
        <span class="cand-ref">${esc(c.ref)}</span>
        <span class="cand-title">${esc(c.title)}</span>
        <span class="cand-fit">적합도 ${esc(c.fit)}/10</span>
      </div>
      <div style="font-size:.86rem;color:var(--ink-soft);margin-top:4px">${esc(c.summary)}</div>
      <dl>
        <dt>기록 당시의 문제와 상황</dt><dd>${esc(c.thenProblem)}</dd>
        <dt>본문이 제시하는 해결</dt><dd>${esc(c.thenAnswer)}</dd>
        <dt>오늘 회중의 필요와 만나는 지점</dt><dd>${esc(c.todayLink)}</dd>
        <dt>추천 이유</dt><dd>${esc(c.why)}</dd>
        <dt>해석상 주의</dt><dd>${esc(c.cautions)}</dd>
      </dl>
      <button class="cand-toggle">자세히 보기 ▾</button>
      <div class="btn-row" style="margin-top:8px">
        <button class="btn btn-sm btn-gold" data-pick="${i}">이 본문으로 확정</button>
      </div>
    </div>`).join('') + '</div>';
}
function bindCands(p) {
  $$('#s1-cands .cand-toggle').forEach(b => b.addEventListener('click', e => {
    const card = e.target.closest('.cand'); card.classList.toggle('open');
    b.textContent = card.classList.contains('open') ? '접기 ▴' : '자세히 보기 ▾';
  }));
  $$('#s1-cands [data-pick]').forEach(b => b.addEventListener('click', () => {
    const c = p.passage.candidates[+b.dataset.pick];
    if (p.passage.ref && p.passage.ref !== c.ref) p.passage.text = '';   // 본문이 바뀌면 이전 전문 제거
    p.passage.ref = c.ref; p.passage.genre = c.genre || ''; p.passage.confirmed = true;
    touch(p); render();
    autoFillPassage(p);
  }));
}
/* 본문 확정 시 전문 자동 입력 (AI 연결 시) */
async function autoFillPassage(p) {
  if (!aiConnected() || p.passage.text) return;
  try {
    setProgressEta(35, ['본문을 불러오는 중…', '정리하는 중…']);
    const txt = await callAI('fetchPassage', { ref: p.passage.ref, translation: DB.settings.translation },
      { label: p.passage.ref + ' 전문을 입력하는 중…' });
    if (!p.passage.text) {
      p.passage.text = txt.trim();
      touch(p);
      if (curView === 'step' && curStep === 1) render();
      toast('본문 전문을 자동 입력했습니다. 성경과 한 번 대조해 주세요.', 4500);
    }
  } catch (e) { if (e.message !== 'no-ai') toast('본문 자동 입력 실패 — 직접 붙여넣어 주세요.'); }
}

async function recommend(p, count, isMore) {
  const i = p.inputs;
  const exclude = isMore && p.passage.candidates.length
    ? '[이미 제시한 본문 — 반복 금지] ' + p.passage.candidates.map(c => c.ref).join(', ')
    : '';
  try {
    setProgressEta(75, ['성경 전체를 훑는 중…', '회중의 필요와 맞춰 보는 중…', '후보를 좁히는 중…', '추천 이유를 쓰는 중…']);
    const r = await callAIJson('recommend', {
      count, topic: i.topic, reason: i.reason, needs: i.needs, audience: i.audience,
      purpose: i.purpose, season: i.season, avoid: i.avoid, exclude,
      extra: (isMore && p.passage.extraReq) ? p.passage.extraReq : '',
    }, { label: isMore ? '추가 요청을 반영해 본문을 더 찾는 중…' : '성경 전체에서 본문 후보를 찾는 중…' });
    const cands = (r.candidates || []).map(c => ({ fit: 7, ...c }));
    p.passage.candidates = isMore ? p.passage.candidates.concat(cands) : cands;
    touch(p); render();
    toast(cands.length + '개 본문 후보를 찾았습니다.');
  } catch (e) { if (e.message !== 'no-ai') toast('오류: ' + e.message, 5000); }
}

/* ═══════════════════ 2단계: 중심사상 ═══════════════════ */
function renderStep2(m, p) {
  if (!p.passage.confirmed) {
    m.innerHTML = `<div class="step-head">2단계</div><h1 class="step-title">중심사상</h1>
      <div class="card"><p>먼저 1단계에서 본문을 확정해 주세요.</p>
      <div class="btn-row"><button class="btn btn-primary" onclick="gotoStep(1)">1단계로 가기</button></div></div>`;
    return;
  }
  const c = p.central;
  m.innerHTML = `
    <div class="step-head">2단계 · ${esc(p.passage.ref)}</div>
    <h1 class="step-title">중심사상</h1>
    <p class="step-desc">해돈 로빈슨의 두 질문으로 본문의 한 가지를 캡니다. 주요소(무엇에 관하여?)와 보조요소(무엇이라 말하는가?), 그리고 채플의 FCF까지. <b>설교 시간의 절반을 여기에 걸라</b>는 단계입니다.</p>
    ${!c.done ? `
    <div class="card">
      <h3>본문 분석 시작</h3>
      <p style="font-size:.88rem;color:var(--ink-soft)">문학적 단위 → 문맥 → 반복 단어 → 인물과 갈등 → 구조 → 원청중 메시지 → 주요소 → 보조요소 → 세 문장 → FCF 순서로 분석합니다.</p>
      ${p.passage.text ? '' : '<p class="ai-note">⚠ 본문 전문이 비어 있습니다. 1단계에서 붙여넣으면 분석이 더 정확해집니다.</p>'}
      <div class="btn-row"><button class="btn btn-primary" id="s2-run" ${aiConnected() ? '' : 'disabled'}>중심사상 분석 🤖</button>
      <button class="btn btn-ghost" id="s2-fcf" ${aiConnected() ? '' : 'disabled'}>FCF 찾기 🤖</button>
      <button class="btn btn-ghost" id="s2-manual">AI 없이 직접 작성</button>
      ${!aiConnected() ? '<span style="font-size:.8rem;color:var(--red)">AI 미연결 — 설정에서 연결해 주세요</span>' : ''}</div>
    </div>` : renderCentral(c)}
  `;
  const fcfBtn = $('#s2-fcf');
  if (fcfBtn) fcfBtn.addEventListener('click', () => runFcf(p));
  const run = $('#s2-run');
  if (run) run.addEventListener('click', () => analyzeCentral(p));
  const man = $('#s2-manual');
  if (man) man.addEventListener('click', () => {
    p.central = { done: true, unit: '(직접 작성)', context: '', keywords: '', characters: '', structure: '', originalMessage: '', subject: '', complement: '', exegetical: '', theological: '', homiletical: '', fcf: { textProblem: '', heartProblem: '', todayProblem: '', gospelNeed: '' }, checks: {} };
    touch(p); render();
    toast('빈 양식을 열었습니다. 주요소·보조요소·세 문장을 직접 적어 주세요.');
  });
  if (c.done) bindCentral(p);
}
function renderCentral(c) {
  const fcf = c.fcf || {};
  const checks = c.checks || {};
  const pills = [
    ['oneSentence', '한 문장'], ['oneIdea', '한 가지 생각'], ['textSpecific', '이 본문에서만'],
    ['reflectsStructure', '구조 반영'], ['godAndResponse', '하나님+응답'], ['meaningfulToday', '오늘 의미'], ['completeClaim', '완결된 주장'],
  ].map(([k, l]) => `<span class="check-pill ${checks[k] ? 'ok' : 'no'}">${checks[k] ? '✓' : '✕'} ${l}</span>`).join('');
  return `
    <div class="card">
      <h3>본문 관찰</h3>
      <div class="fb-item"><b>문학적 단위</b>${esc(c.unit)}</div>
      <div class="fb-item"><b>문맥</b>${esc(c.context)}</div>
      <div class="fb-item"><b>반복 단어·핵심 동사</b>${esc(c.keywords)}</div>
      <div class="fb-item"><b>인물과 갈등</b>${esc(c.characters)}</div>
      <div class="fb-item"><b>구조</b>${esc(c.structure)}</div>
      <div class="fb-item"><b>원래 청중에게 말하려던 것</b>${esc(c.originalMessage)}</div>
    </div>
    <div class="card">
      <h3>주요소와 보조요소 <span class="opt" style="font-weight:400;font-size:.78rem">— 직접 고칠 수 있습니다</span></h3>
      <div class="three-sent">
        <div class="sent-box"><span class="tag">주요소 Subject — 저자가 말하려는 것은? (질문 형태)</span><textarea id="c-subject">${esc(c.subject)}</textarea></div>
        <div class="sent-box"><span class="tag">보조요소 Complement — 본문의 답 (절 번호와 함께)</span><textarea id="c-complement">${esc(c.complement)}</textarea></div>
      </div>
      <h3 style="margin-top:20px">중심사상 — 두 번의 번역</h3>
      <div class="three-sent">
        <div class="sent-box exe"><span class="tag">① 석의의 문장 — 그때·거기·그들에게</span><textarea id="c-exegetical">${esc(c.exegetical)}</textarea></div>
        <div class="sent-box theo"><span class="tag">② 원리의 문장 — 시대를 관통하는 진리</span><textarea id="c-theological">${esc(c.theological)}</textarea></div>
        <div class="sent-box hom"><span class="tag">③ 청중의 문장 — 지금·여기·우리에게 (설교적 중심사상)</span><textarea id="c-homiletical">${esc(c.homiletical)}</textarea></div>
      </div>
      <div class="checks">${pills}</div>
      ${checks.comment ? `<p style="font-size:.82rem;color:var(--ink-soft);margin-top:6px">${esc(checks.comment)}</p>` : ''}
      <div class="chip-row" style="margin-top:14px">
        ${['더 간결하게', '더 본문 중심으로', '더 설교적으로', '신학적으로 점검', '다른 중심사상 제안', '원래 의미와 오늘의 적용 비교'].map(r => `<button class="chip" data-refine="${r}">${r} 🤖</button>`).join('')}
      </div>
      <div id="c-refine-note"></div>
    </div>
    <div class="card">
      <h3>FCF — 이 본문은 왜 필요한가 (채플)</h3>
      <div class="three-sent">
        <div class="sent-box"><span class="tag">본문 속 인간의 문제</span><textarea id="c-fcf1">${esc(fcf.textProblem)}</textarea></div>
        <div class="sent-box"><span class="tag">행동 뒤에 있는 마음의 문제</span><textarea id="c-fcf2">${esc(fcf.heartProblem)}</textarea></div>
        <div class="sent-box"><span class="tag">오늘 회중에게 나타나는 같은 문제</span><textarea id="c-fcf3">${esc(fcf.todayProblem)}</textarea></div>
        <div class="sent-box hom"><span class="tag">은혜와 복음이 필요한 이유 — 그리스도 안의 해결</span><textarea id="c-fcf4">${esc(fcf.gospelNeed)}</textarea></div>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" id="s2-go3">중심사상 확정 → 3단계 설교 작성</button>
        <button class="btn btn-ghost" id="s2-redo">처음부터 다시 분석 🤖</button>
        <button class="btn btn-ghost" id="s2-fcf2">FCF 찾기 🤖</button>
      </div>
      <p class="ai-note">AI 분석은 초안입니다. 설교자의 검토와 수정이 우선합니다 — 여기서 고친 문장이 이후 모든 단계에 쓰입니다.</p>
    </div>`;
}
function bindCentral(p) {
  const c = p.central;
  const grab = () => {
    c.subject = $('#c-subject').value; c.complement = $('#c-complement').value;
    c.exegetical = $('#c-exegetical').value; c.theological = $('#c-theological').value;
    c.homiletical = $('#c-homiletical').value;
    c.fcf = c.fcf || {};
    c.fcf.textProblem = $('#c-fcf1').value; c.fcf.heartProblem = $('#c-fcf2').value;
    c.fcf.todayProblem = $('#c-fcf3').value; c.fcf.gospelNeed = $('#c-fcf4').value;
    touch(p);
  };
  $$('#main textarea').forEach(el => el.addEventListener('change', grab));
  $$('#main [data-refine]').forEach(b => b.addEventListener('click', async () => {
    grab();
    try {
      setProgressEta(50, ['요청을 읽는 중…', '문장을 다듬는 중…', '점검하는 중…']);
      const r = await callAIJson('centralRefine', {
        ref: p.passage.ref, subject: c.subject, complement: c.complement,
        exegetical: c.exegetical, theological: c.theological, homiletical: c.homiletical,
        fcf: JSON.stringify(c.fcf), request: b.dataset.refine,
      }, { label: '중심사상을 다듬는 중…' });
      ['subject', 'complement', 'exegetical', 'theological', 'homiletical'].forEach(k => { if (r[k]) c[k] = r[k]; });
      if (r.fcfToday) c.fcf.todayProblem = r.fcfToday;
      touch(p); render();
      if (r.note) { $('#c-refine-note').innerHTML = `<div class="fb-item" style="margin-top:10px"><b>AI 수정 설명</b>${esc(r.note)}</div>`; }
      toast('다듬었습니다. 결과를 검토해 주세요.');
    } catch (e) { if (e.message !== 'no-ai') toast('오류: ' + e.message, 5000); }
  }));
  $('#s2-go3').addEventListener('click', () => {
    grab();
    if (!c.homiletical) { toast('설교적 문장(청중의 문장)을 확정해 주세요.'); return; }
    gotoStep(3);
  });
  $('#s2-redo').addEventListener('click', () => analyzeCentral(p));
  const fcf2 = $('#s2-fcf2');
  if (fcf2) fcf2.addEventListener('click', () => runFcf(p));
}
async function analyzeCentral(p) {
  try {
    setProgressEta(110, ['문학적 단위를 살피는 중…', '반복 단어와 구조를 찾는 중…', '주요소·보조요소를 캐는 중…', '중심사상 세 문장을 짓는 중…']);
    const r = await callAIJson('central', {
      ref: p.passage.ref, passageText: p.passage.text, topic: p.inputs.topic,
      needs: p.inputs.needs, audience: p.inputs.audience, purpose: p.inputs.purpose,
    }, { label: '로빈슨의 두 질문으로 본문을 분석하는 중…' });
    p.central = Object.assign({ done: true }, r, { done: true });
    touch(p); render();
    toast('중심사상 분석 완료. 문장을 검토하고 직접 다듬어 주세요.');
  } catch (e) { if (e.message !== 'no-ai') toast('오류: ' + e.message, 5000); }
}

/* ═══════════════════ 3단계: 설교 작성 ═══════════════════ */
const PARTIAL_REQUESTS = [
  '제목 5개 다시 제안', '제목을 더 목회적으로', '제목을 더 기억하기 쉽게',
  '서론 다시 작성', '서론을 더 짧게', '서론에 질문 추가',
  '본론 설명 보강', '논리 점검', '본문 해설 보강', '배경 설명 추가 (역사·문화·지리)',
  '예화 추가 (가상 예시는 표시)', '예화 교체', '유머 추가 (품위 있게)', '적용 구체화',
  '복음적 연결 점검', '결론 다시 작성', '결론 압축', '촌철살인의 한 문장 5개',
  '전체 분량 늘리기', '전체 분량 줄이기', '목표 시간에 맞게 조절',
  'AI 냄새 제거', '설교자의 기존 문체에 맞게 수정', '지금의 설교로 (요즘 언어·표현으로)',
  '추천 도서 내용을 설교문에 추가 (책 제목 + A4 2쪽 요약)',
];
function renderStep3(m, p) {
  if (!p.central.done) {
    m.innerHTML = `<div class="step-head">3단계</div><h1 class="step-title">설교 작성</h1>
      <div class="card"><p>먼저 2단계에서 중심사상을 확정해 주세요.</p>
      <div class="btn-row"><button class="btn btn-primary" onclick="gotoStep(2)">2단계로 가기</button></div></div>`;
    return;
  }
  const hasDraft = htmlToText(p.draft.html).length > 50;
  m.innerHTML = `
    <div class="step-head">3단계 · ${esc(p.passage.ref)}</div>
    <h1 class="step-title">설교 작성</h1>
    <p class="step-desc">원고는 쓰는 것이 아니라 깎는 것입니다. AI 초안은 재료일 뿐 — 첫 문장과 마지막 문장은 반드시 설교자의 손으로.</p>
    ${!hasDraft ? `
    <div class="card">
      <h3>초안 생성</h3>
      <div class="form-grid">
        <div class="field"><label>목표 시간(분)</label><input id="s3-min" type="number" value="${esc(p.inputs.targetMin)}" min="5" max="90"></div>
        <div class="field"><label>문체·어조 요청</label><input id="s3-style" value="${esc(DB.settings.style)}" placeholder="예: 따뜻한 구어체, 존댓말"></div>
      </div>
      ${DB.materials.length ? `
      <h4 style="margin-top:16px">자료 서랍에서 넣을 자료 <span class="opt" style="font-weight:400;font-size:.74rem">— 선택한 자료를 AI가 적절한 자리에 반영합니다</span></h4>
      <div class="checklist" id="s3-mats">
        ${DB.materials.map(x => `<label><input type="checkbox" data-mat="${x.id}" checked> <span class="badge" style="background:${MAT_COLORS[x.type] || 'var(--surface-soft)'}">${esc(x.type)}</span> ${esc(x.title)}</label>`).join('')}
      </div>` : `<p class="ai-note">🗄 <b>자료 서랍</b>(왼쪽 메뉴)에 예화·통계·자료를 담아 두면, 설교문 곳곳에 인용해 활용합니다.</p>`}
      <p class="ai-note">📏 <b>나의 작성 규칙</b>이 자동 적용됩니다 — 적용 찬송 2곡(이유 포함)과 기도문이 원고 끝에 함께 작성됩니다.</p>
      <div class="btn-row">
        <button class="btn btn-primary" id="s3-gen" ${aiConnected() ? '' : 'disabled'}>설교문 초안 작성 🤖 (2~4분 소요)</button>
        <button class="btn btn-ghost" id="s3-blank">빈 원고에서 직접 쓰기</button>
      </div>
      <div id="s3-stream"></div>
    </div>` : ''}
    <div id="editor-area" class="${hasDraft ? '' : 'hidden'}">
      <div class="btn-row" style="margin:0 0 10px">
        <button class="btn btn-ghost btn-sm" id="s3-backai" ${aiConnected() ? '' : 'disabled'}>🤖 AI 초안 작성으로 돌아가기</button>
        <span style="font-size:.74rem;opacity:.75">지금 원고는 버전 기록에 안전하게 보관됩니다</span>
      </div>
      <div id="editor-wrap">
        <div id="editor-toolbar">
          <button data-cmd="bold" title="굵게"><b>가</b></button>
          <button data-cmd="italic" title="기울임"><i>가</i></button>
          <button data-cmd="underline" title="밑줄"><u>가</u></button>
          <span class="sep"></span>
          <select id="tb-block" title="문단 스타일">
            <option value="p">본문</option><option value="h1">제목</option>
            <option value="h2">큰 소제목</option><option value="h3">소제목</option>
            <option value="blockquote">성경 인용</option>
          </select>
          <select id="tb-size" title="글자 크기">
            <option value="">크기</option><option value="0.9">작게</option>
            <option value="1.05">보통</option><option value="1.25">크게</option><option value="1.5">아주 크게</option>
          </select>
          <span class="sep"></span>
          <button data-cmd="justifyLeft" title="왼쪽 정렬">⇤</button>
          <button data-cmd="justifyCenter" title="가운데 정렬">↔</button>
          <button data-cmd="insertUnorderedList" title="목록">•≡</button>
          <button data-cmd="insertOrderedList" title="번호 목록">1≡</button>
          <span class="sep"></span>
          <button id="tb-stress" title="강세 표시 (노랑 형광)">강세</button>
          <button id="tb-pause" title="멈춤 표시 삽입">⏸멈춤</button>
          <button id="tb-eye" title="시선 표시 삽입">👁시선</button>
          <button id="tb-note" title="강단 메모 (내보내기에서 제외 가능)">메모</button>
          <span class="sep"></span>
          <button data-cmd="undo" title="실행 취소">↶</button>
          <button data-cmd="redo" title="다시 실행">↷</button>
          <span class="sep"></span>
          <button id="tb-find" title="원고 검색">🔍</button>
          <button id="tb-taller" title="편집기 높이 늘리기">↕＋</button><button id="tb-shorter" title="편집기 높이 줄이기">↕−</button>
          <button id="tb-full" title="전체 화면">⛶</button>
        </div>
        <div id="editor" contenteditable="true" spellcheck="false">${p.draft.html}</div>
        <div id="editor-resize" title="끌어서 편집기 높이 조절 · 두 번 누르면 자동 크기로"><span></span></div>
        <div id="editor-status">
          <span>글자 <b id="st-chars">0</b></span>
          <span>단어 <b id="st-words">0</b></span>
          <span>예상 낭독 <b id="st-time">0분</b> (분당 ${DB.settings.cpm}자)</span>
          <span>목표 <b>${esc(p.inputs.targetMin)}분</b></span>
          <span id="st-diff"></span>
        </div>
      </div>
      <div class="card" style="margin-top:16px">
        <h3>자료 투입 <span class="opt" style="font-weight:400;font-size:.78rem">— 모아둔 예화·통계·간증을 골라 원고의 적절한 자리에 녹입니다</span></h3>
        ${DB.materials.length ? `
        <div class="checklist" id="s3w-mats">
          ${DB.materials.map(x => `<label><input type="checkbox" data-wmat="${x.id}"> <span class="badge" style="background:${MAT_COLORS[x.type] || 'var(--surface-soft)'}">${esc(x.type)}</span> ${esc(x.title)}</label>`).join('')}
        </div>` : '<p style="font-size:.84rem;opacity:.7">자료 서랍이 비어 있습니다. 아래 버튼이나 왼쪽 메뉴에서 자료를 넣어 두세요.</p>'}
        <div class="btn-row">
          <button class="btn btn-primary btn-sm" id="s3-weave" ${aiConnected() && DB.materials.length ? '' : 'disabled'}>선택한 자료를 원고에 녹이기 🤖</button>
          <label class="btn btn-ghost btn-sm" style="cursor:pointer">파일에서 자료 추가 (.txt .md)<input id="s3-matfile" type="file" accept=".txt,.md,.text" style="display:none"></label>
          <button class="btn btn-ghost btn-sm" id="s3-matgo">자료 서랍 열기</button>
        </div>
      </div>
      <div class="card">
        <h3>제목 정하기 <span class="opt" style="font-weight:400;font-size:.78rem">— 원고와 자료 서랍의 잡지 구절을 함께 읽고, 아홉 가지 기법으로 제안합니다</span></h3>
        <div class="btn-row" style="margin-top:0">
          <button class="btn btn-primary" id="s3-title" ${aiConnected() ? '' : 'disabled'}>🎯 제목 10개 추천받기 🤖</button>
          <span style="font-size:.76rem;opacity:.8">마음에 드는 제목을 고르면 원고 제목이 바로 바뀝니다</span>
        </div>
      </div>
      <div class="card">
        <h3>부분 재작성 <span class="opt" style="font-weight:400;font-size:.78rem">— 누르면 그 부분이 원고 안 제자리에 바로 반영됩니다. 되돌리기도 한 번에 됩니다.</span></h3>
        <div class="chip-row">${PARTIAL_REQUESTS.map(r => `<button class="chip" data-partial="${esc(r)}">${esc(r)}</button>`).join('')}</div>
      </div>
      ${renderSongCard(p)}
      <div class="card">
        <h3>버전 기록</h3>
        <div id="s3-versions">${renderVersions(p)}</div>
        <div class="btn-row">
          <button class="btn btn-ghost btn-sm" id="s3-snap">현재 원고를 버전으로 저장</button>
          <button class="btn btn-ghost btn-sm" id="s3-regen" ${aiConnected() ? '' : 'disabled'}>초안 전체 다시 생성 🤖</button>
          <button class="btn btn-primary" id="s3-go4" style="margin-left:auto">4단계 형식 결정 →</button>
        </div>
      </div>
    </div>`;
  const gen = $('#s3-gen');
  if (gen) gen.addEventListener('click', () => generateSermon(p));
  const backAi = $('#s3-backai');
  if (backAi) backAi.addEventListener('click', () => {
    if (!confirm('AI 초안 작성 화면으로 돌아갈까요?\n지금 원고는 버전 기록에 보관되어 언제든 되돌릴 수 있습니다.')) return;
    syncEditor();
    if (htmlToText(p.draft.html).trim().length > 0) snapshot(p, '직접 작성 원고 보관');
    p.draft.html = '';
    touch(p); render();
    toast('AI 초안 작성으로 돌아왔습니다. 목표 시간과 자료를 고르고 [설교문 초안 작성]을 누르세요.');
  });
  const blank = $('#s3-blank');
  if (blank) blank.addEventListener('click', () => {
    p.draft.html = `<h1>${esc(p.inputs.topic)}</h1><p><strong>본문</strong> ${esc(p.passage.ref)}</p><p><strong>중심사상</strong> ${esc(p.central.homiletical)}</p><h2>서론</h2><p></p><h2>본론</h2><p></p><h2>적용</h2><p></p><h2>결론</h2><p></p>`;
    touch(p); render();
  });
  if (hasDraft || $('#editor')) bindEditor(p);
}
/* ═══════════════════ 적용 찬양 — 악보·듣기 찾아보기 ═══════════════════ */
/* 원고의 "적용 찬양/찬송" 단락에서 곡을 뽑아낸다 */
function extractSongs(html) {
  const text = htmlToText(html);
  const lines = text.split('\n');
  const start = lines.findIndex(l => /^#*\s*적용\s*(찬양|찬송)/.test(l.trim()));
  if (start < 0) return [];
  const songs = [];
  let group = '';
  for (let i = start + 1; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;
    if (/^#/.test(raw) || /^(기도문|추천 도서|결론)/.test(raw)) break;   // 다음 섹션이면 중단
    if (/^\**\s*(가스펠|CCM|복음성가)\s*\**$/.test(raw)) { group = '가스펠'; continue; }
    if (/^\**\s*(찬송가|새찬송가)/.test(raw)) { group = '찬송가'; continue; }
    // "1. 제목 — 부른이 — 이유" / "1. 79. 제목 — 이유" / (마크다운 목록이면) "79. 제목 — 이유"
    let body = raw.replace(/^[-·*]\s*/, '');
    const nums = [];
    while (nums.length < 2) {                       // 앞머리 숫자를 최대 둘까지 걷어낸다
      const m = body.match(/^([0-9]{1,3})\s*장?\s*[.)．]\s*/);
      if (!m) break;
      nums.push(m[1]); body = body.slice(m[0].length);
    }
    if (!body || body.length < 2) continue;
    // 숫자가 둘이면 뒤엣것이 찬송가 번호, 하나뿐이면 찬송가 항목일 때만 번호로 본다
    let num = nums.length >= 2 ? nums[1] : (nums.length === 1 && group === '찬송가' ? nums[0] : '');
    const parts = body.split(/\s*[—–-]\s*/).map(x => x.trim()).filter(Boolean);
    const title = (parts[0] || '').replace(/^["'‘“]|["'’”]$/g, '').trim();
    if (!title || title.length > 40) continue;
    songs.push({
      group: group || (num ? '찬송가' : '가스펠'),
      num, title,
      artist: (group === '찬송가' || num) ? '' : (parts[1] || ''),
      reason: parts.slice((group === '찬송가' || num) ? 1 : 2).join(' — '),
    });
    if (songs.length >= 8) break;
  }
  return songs;
}
function songSearchUrls(s) {
  const isHymn = s.group === '찬송가' || s.num;
  const base = isHymn ? ('새찬송가 ' + (s.num ? s.num + '장 ' : '') + s.title) : (s.title + (s.artist ? ' ' + s.artist : ''));
  const q = t => encodeURIComponent(t);
  return {
    score:  'https://www.google.com/search?tbm=isch&q=' + q(base + ' 악보'),
    pdf:    'https://www.google.com/search?q=' + q(base + ' 악보 filetype:pdf'),
    buy:    'https://www.google.com/search?q=' + q(base + ' 악보 구매'),
    hymnary: isHymn ? 'https://hymnary.org/search?qu=' + q(s.title) : '',
    listen: 'https://www.youtube.com/results?search_query=' + q(base + (isHymn ? ' 찬송' : '')),
    play:   'https://www.youtube.com/results?search_query=' + q(base + ' 반주'),
    lyrics: 'https://www.google.com/search?q=' + q(base + ' 가사'),
  };
}
function renderSongCard(p) {
  const songs = extractSongs(p.draft.html);
  if (!songs.length) return '';
  return `
    <div class="card">
      <h3>🎵 적용 찬양 <span class="opt" style="font-weight:400;font-size:.78rem">— 곡을 누르면 악보·듣기·가사를 찾아봅니다</span></h3>
      <div class="song-list">
        ${songs.map((s, i) => `
          <button class="song-item" data-song="${i}">
            <span class="song-badge ${s.group === '찬송가' ? 'sb-hymn' : 'sb-gospel'}">${esc(s.group)}</span>
            <span class="song-title">${s.num ? esc(s.num) + '장 ' : ''}${esc(s.title)}</span>
            ${s.artist ? `<span class="song-artist">${esc(s.artist)}</span>` : ''}
            <span class="song-go">악보 보기 →</span>
          </button>`).join('')}
      </div>
      <p class="ai-note" style="margin-top:10px">곡을 누르면 <b>악보 보기 · PDF 내려받기 · 정품 구입 · 듣기</b>로 연결됩니다. 악보·음원은 저작권이 있어 앱에 담지 않습니다 — 예배 사용 시 정품 구입 또는 CCLI 등 사용 허락을 확인해 주세요.</p>
    </div>`;
}
function bindSongCard(p) {
  const songs = extractSongs(p.draft.html);
  $$('#main [data-song]').forEach(b => b.addEventListener('click', () => {
    const s = songs[+b.dataset.song]; if (!s) return;
    const u = songSearchUrls(s);
    const isHymn = s.group === '찬송가' || s.num;
    const body = modal('🎵 ' + (s.num ? s.num + '장 ' : '') + s.title, `
      <div class="fb-item" style="background:${isHymn ? 'var(--mint)' : 'var(--cream)'}">
        <b>${esc(s.group)}</b>${s.artist ? ' · ' + esc(s.artist) : ''}
        ${s.reason ? `<div style="font-size:.84rem;margin-top:6px">${esc(s.reason)}</div>` : ''}
      </div>
      <p style="font-size:.82rem;color:var(--ink-soft);margin:12px 0 6px"><b>악보 보기 · 내려받기</b> (새 창에서 열립니다)</p>
      <div class="chip-row">
        <a class="chip song-link" href="${u.score}" target="_blank" rel="noopener">🎼 악보 보기</a>
        <a class="chip song-link" href="${u.pdf}" target="_blank" rel="noopener">📥 PDF 내려받기</a>
        <a class="chip song-link" href="${u.buy}" target="_blank" rel="noopener">🛒 정품 악보 구입</a>
        ${u.hymnary ? `<a class="chip song-link" href="${u.hymnary}" target="_blank" rel="noopener">🌐 Hymnary (무료 공개 악보)</a>` : ''}
      </div>
      <p style="font-size:.82rem;color:var(--ink-soft);margin:14px 0 6px"><b>듣기 · 가사</b></p>
      <div class="chip-row">
        <a class="chip song-link" href="${u.listen}" target="_blank" rel="noopener">▶ 찬양 듣기</a>
        <a class="chip song-link" href="${u.play}" target="_blank" rel="noopener">🎹 반주 영상</a>
        <a class="chip song-link" href="${u.lyrics}" target="_blank" rel="noopener">📄 가사 보기</a>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary btn-sm" id="song-save">🗄 자료 서랍에 저장</button>
        <button class="btn btn-ghost btn-sm" id="song-copy">📋 곡 이름 복사</button>
      </div>
      <p class="ai-note" style="margin-top:12px"><b>저작권 안내</b> — 새찬송가 악보는 한국찬송가공회, CCM 악보는 각 저작권자에게 권리가 있습니다. 내려받은 악보를 예배에 쓰거나 인쇄·복사할 때는 <b>정품 구입 또는 CCLI 등 사용 허락</b>이 필요합니다. 저작권이 만료된 오래된 찬송은 Hymnary 등에서 무료로 받을 수 있습니다.</p>`);
    body.querySelector('#song-copy').addEventListener('click', () => {
      navigator.clipboard.writeText((s.num ? s.num + '장 ' : '') + s.title + (s.artist ? ' / ' + s.artist : ''));
      toast('복사했습니다.');
    });
    body.querySelector('#song-save').addEventListener('click', () => {
      const name = (s.num ? s.num + '장 ' : '') + s.title;
      DB.materials.unshift({
        id: uid(), type: '메모',
        title: '🎵 ' + name + (s.artist ? ' / ' + s.artist : ''),
        content: [s.group + (s.num ? ' ' + s.num + '장' : ''), s.reason,
          '악보: ' + u.score, 'PDF: ' + u.pdf, '구입: ' + u.buy, '듣기: ' + u.listen].filter(Boolean).join('\n'),
        tags: '찬양,' + s.group,
      });
      save(true); closeModal();
      toast('자료 서랍에 저장했습니다. 링크는 자료 서랍에서 다시 열 수 있습니다.');
    });
  }));
}
function renderVersions(p) {
  if (!p.draft.versions.length) return '<p style="font-size:.85rem;color:var(--ink-soft)">저장된 버전이 없습니다.</p>';
  return p.draft.versions.map((v, i) => `
    <div style="display:flex;gap:10px;align-items:center;padding:6px 0;border-bottom:1px solid var(--cream-2);font-size:.85rem">
      <span style="flex:1">${esc(v.label || '버전')} — ${new Date(v.ts).toLocaleString('ko-KR')}</span>
      <button class="btn btn-ghost btn-sm" data-vdiff="${i}">비교</button>
      <button class="btn btn-ghost btn-sm" data-vrestore="${i}">복원</button>
    </div>`).join('');
}
function snapshot(p, label) {
  p.draft.versions.push({ ts: Date.now(), html: p.draft.html, label: label || '수동 저장' });
  if (p.draft.versions.length > 20) p.draft.versions.shift();
  touch(p);
}
async function generateSermon(p, regen) {
  toast('자료 서랍에 넣어둔 내용들을 활용해 설교문을 작성합니다.', 4500);
  const c = p.central, i = p.inputs;
  const targetMin = $('#s3-min') ? (+$('#s3-min').value || i.targetMin) : i.targetMin;
  i.targetMin = targetMin;
  const streamEl = $('#s3-stream');
  if (streamEl) streamEl.innerHTML = '<div class="stream-preview" id="s3-preview">…</div>';
  hideProgressSafeLabel();
  const matIds = $$('#s3-mats [data-mat]:checked').map(cb => cb.dataset.mat);
  setProgressSub(matIds.length
    ? '🗂 자료 서랍의 자료 ' + matIds.length + '개가 함께 섞여 설교가 만들어지고 있습니다'
    : '📖 중심사상과 나의 작성 규칙을 따라 설교가 지어지고 있습니다');
  setProgressEta(90 + targetMin * 11, [
    '본문과 자료를 읽는 중…', '설교의 뼈대를 세우는 중…', '서론과 본론을 쓰는 중…',
    '예화와 적용을 잇는 중…', '찬양·기도문·추천 도서를 붙이는 중…',
  ]);
  try {
    const md = await callAI('sermon', {
      ref: p.passage.ref, passageText: p.passage.text,
      exegetical: c.exegetical, theological: c.theological, homiletical: c.homiletical,
      fcf: c.fcf ? (c.fcf.todayProblem + ' / 해결: ' + c.fcf.gospelNeed) : '',
      reason: i.reason, needs: i.needs, audience: i.audience, purpose: i.purpose,
      emphasis: i.emphasis, avoid: i.avoid, personal: i.personal,
      style: ($('#s3-style') ? $('#s3-style').value : DB.settings.style),
      materials: matIds.length ? materialsSlot(matIds) : '(없음)',
      rules: DB.settings.rules,
      targetMin, cpm: DB.settings.cpm, targetChars: targetMin * DB.settings.cpm,
    }, {
      label: targetMin + '분 설교문을 짓는 중… (처음 1~3분은 구상 시간이라 조용합니다)',
      onDelta: (d, full) => {
        progressPreview(full);
        const pv = $('#s3-preview');
        if (pv) { pv.textContent = full.slice(-1500); pv.scrollTop = pv.scrollHeight; }
      },
    });
    if (regen) snapshot(p, '재생성 전 원고');
    p.draft.html = mdToHtml(md);
    touch(p); render();
    toast('초안이 완성됐습니다. 이제 깎을 차례입니다 — 첫 문장과 마지막 문장은 직접 쓰세요.');
  } catch (e) { if (e.message !== 'no-ai') toast('오류: ' + e.message, 6000); }
}
function hideProgressSafeLabel() { /* 스트리밍 프리뷰와 진행 오버레이 공존용 자리 */ }

function syncEditor() {
  const ed = $('#editor');
  const p = cur();
  if (ed && p && curView === 'step' && curStep === 3) { p.draft.html = ed.innerHTML; save(); }
}
function updateEditorStatus(p) {
  const ed = $('#editor'); if (!ed) return;
  const text = htmlToText(ed.innerHTML);
  const chars = text.replace(/\s+/g, ' ').length;
  const words = text.split(/\s+/).filter(Boolean).length;
  const min = readingMinutes(text);
  $('#st-chars').textContent = chars.toLocaleString();
  $('#st-words').textContent = words.toLocaleString();
  $('#st-time').textContent = fmtMin(min);
  const diff = min - p.inputs.targetMin;
  $('#st-diff').textContent = Math.abs(diff) < 1.5 ? '👍 목표에 맞음' : (diff > 0 ? '⚠ ' + fmtMin(diff) + ' 초과' : fmtMin(-diff) + ' 여유');
  $('#st-diff').style.color = Math.abs(diff) < 1.5 ? 'var(--green-600)' : (diff > 0 ? 'var(--red)' : 'var(--ink-soft)');
}
function bindEditor(p) {
  const ed = $('#editor'); if (!ed) return;
  ed.style.fontSize = (DB.settings.editorSize || 17) + 'px';
  updateEditorStatus(p);
  let edTimer;
  ed.addEventListener('input', () => {
    clearTimeout(edTimer);
    edTimer = setTimeout(() => { p.draft.html = ed.innerHTML; touch(p); updateEditorStatus(p); }, 800);
  });
  $$('#editor-toolbar [data-cmd]').forEach(b => b.addEventListener('click', () => {
    document.execCommand(b.dataset.cmd, false, null); ed.focus();
  }));
  $('#tb-block').addEventListener('change', e => {
    document.execCommand('formatBlock', false, e.target.value === 'p' ? 'p' : e.target.value);
    e.target.value = 'p'; ed.focus();
  });
  $('#tb-size').addEventListener('change', e => {
    if (!e.target.value) return;
    const sel = window.getSelection();
    if (sel.rangeCount && !sel.isCollapsed) {
      const span = document.createElement('span');
      span.style.fontSize = e.target.value + 'em';
      try { sel.getRangeAt(0).surroundContents(span); } catch { toast('여러 문단에 걸친 선택은 크기를 바꿀 수 없습니다.'); }
    }
    e.target.value = ''; ed.focus();
  });
  const wrapMark = (cls, txt) => {
    const sel = window.getSelection();
    if (txt) { document.execCommand('insertHTML', false, `<span class="${cls}" contenteditable="false">${txt}</span>&nbsp;`); return; }
    if (!sel.rangeCount || sel.isCollapsed) { toast('강세를 줄 부분을 먼저 선택해 주세요.'); return; }
    const span = document.createElement('span'); span.className = cls;
    try { sel.getRangeAt(0).surroundContents(span); } catch { toast('한 문단 안에서만 선택해 주세요.'); }
  };
  $('#tb-stress').addEventListener('click', () => { wrapMark('stress-mark'); ed.focus(); });
  $('#tb-pause').addEventListener('click', () => { wrapMark('pause-mark', '⏸'); ed.focus(); });
  $('#tb-eye').addEventListener('click', () => { wrapMark('eye-mark', '👁'); ed.focus(); });
  $('#tb-note').addEventListener('click', () => {
    const memo = prompt('강단 메모 (원고에 노란 쪽지로 붙습니다):');
    if (memo) document.execCommand('insertHTML', false, `<span class="note-mark" contenteditable="false">[메모: ${esc(memo)}]</span>&nbsp;`);
  });
  $('#tb-find').addEventListener('click', () => {
    const q = prompt('찾을 말:'); if (!q) return;
    const found = window.find && window.find(q);
    if (!found) toast('찾지 못했습니다.');
  });
  $('#tb-full').addEventListener('click', () => document.body.classList.toggle('fullscreen-editor'));
  // ── 편집기 높이 조절: 손잡이 끌기 + 버튼 ──
  // 높이를 직접 지정하면 그 크기의 스크롤 창이 되고, 0이면 내용에 맞춰 자동으로 늘어난다
  const setEdH = h => {
    if (!h) { // 자동(내용에 맞춤)
      DB.settings.editorHeight = 0;
      ed.style.height = ''; ed.style.minHeight = '480px';
      return;
    }
    const v = Math.max(240, Math.min(3000, Math.round(h)));
    DB.settings.editorHeight = v;
    ed.style.height = v + 'px'; ed.style.minHeight = '';
  };
  const curEdH = () => DB.settings.editorHeight || Math.round(ed.getBoundingClientRect().height);
  setEdH(DB.settings.editorHeight || 0);
  const taller = $('#tb-taller'), shorter = $('#tb-shorter');
  if (taller) taller.addEventListener('click', () => { setEdH(curEdH() + 200); save(true); toast('편집기를 키웠습니다. 손잡이를 끌어 세밀하게 맞출 수 있습니다.'); });
  if (shorter) shorter.addEventListener('click', () => { setEdH(curEdH() - 200); save(true); });
  const grip = $('#editor-resize');
  if (grip) {
    const start = e => {
      e.preventDefault();
      const y0 = (e.touches ? e.touches[0].clientY : e.clientY);
      const h0 = ed.getBoundingClientRect().height;
      document.body.classList.add('resizing-editor');
      const move = ev => setEdH(h0 + ((ev.touches ? ev.touches[0].clientY : ev.clientY) - y0));
      const end = () => {
        document.body.classList.remove('resizing-editor');
        window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', end);
        window.removeEventListener('touchmove', move); window.removeEventListener('touchend', end);
        save(true);
      };
      window.addEventListener('mousemove', move); window.addEventListener('mouseup', end);
      window.addEventListener('touchmove', move, { passive: false }); window.addEventListener('touchend', end);
    };
    grip.addEventListener('mousedown', start);
    grip.addEventListener('touchstart', start, { passive: false });
    grip.addEventListener('dblclick', () => { setEdH(0); save(true); toast('원고 길이에 맞춰 자동으로 되돌렸습니다.'); });
  }

  $$('#main [data-partial]').forEach(b => b.addEventListener('click', () => partialRewrite(p, b.dataset.partial)));
  const weaveBtn = $('#s3-weave');
  if (weaveBtn) weaveBtn.addEventListener('click', () => weaveMaterials(p));
  const matFile = $('#s3-matfile');
  if (matFile) matFile.addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const fr = new FileReader();
    fr.onload = () => {
      DB.materials.unshift({ id: uid(), type: '메모', title: f.name.replace(/\.(txt|md|text)$/i, ''), content: String(fr.result).slice(0, 8000), tags: '', createdAt: Date.now() });
      save(true); render(); toast('파일을 자료 서랍에 넣었습니다. 체크해서 원고에 녹여 보세요.');
    };
    fr.readAsText(f);
  });
  const matGo = $('#s3-matgo');
  if (matGo) matGo.addEventListener('click', () => { curView = 'materials'; render(); });
  const snapBtn = $('#s3-snap');
  if (snapBtn) snapBtn.addEventListener('click', () => { syncEditor(); snapshot(p, '수동 저장'); render(); toast('버전을 저장했습니다.'); });
  bindSongCard(p);
  const titleBtn = $('#s3-title');
  if (titleBtn) titleBtn.addEventListener('click', () => suggestTitles(p));
  const regenBtn = $('#s3-regen');
  if (regenBtn) regenBtn.addEventListener('click', () => {
    if (confirm('원고 전체를 다시 생성할까요? 현재 원고는 버전으로 보관됩니다.')) generateSermon(p, true);
  });
  const go4 = $('#s3-go4');
  if (go4) go4.addEventListener('click', () => { syncEditor(); gotoStep(4); });
  $$('#main [data-vrestore]').forEach(b => b.addEventListener('click', () => {
    const v = p.draft.versions[+b.dataset.vrestore];
    if (confirm('이 버전으로 되돌릴까요? 현재 원고는 새 버전으로 보관됩니다.')) {
      snapshot(p, '복원 전 원고'); p.draft.html = v.html; touch(p); render();
    }
  }));
  $$('#main [data-vdiff]').forEach(b => b.addEventListener('click', () => {
    const v = p.draft.versions[+b.dataset.vdiff];
    modal('버전 비교 — ' + new Date(v.ts).toLocaleString('ko-KR'), `
      <div class="compare">
        <div class="col"><h4>저장된 버전 (${fmtMin(readingMinutes(htmlToText(v.html)))})</h4><div style="max-height:44vh;overflow:auto;background:#fff;padding:12px;border-radius:8px;font-family:var(--serif);font-size:.9rem">${v.html}</div></div>
        <div class="col"><h4>현재 원고 (${fmtMin(readingMinutes(draftText()))})</h4><div style="max-height:44vh;overflow:auto;background:#fff;padding:12px;border-radius:8px;font-family:var(--serif);font-size:.9rem">${$('#editor').innerHTML}</div></div>
      </div>`);
  }));
}
/* 선택한 자료를 기존 원고에 녹이기 (승인제) */
async function weaveMaterials(p) {
  syncEditor();
  const ids = $$('#s3w-mats [data-wmat]:checked').map(cb => cb.dataset.wmat);
  if (!ids.length) return toast('녹일 자료를 먼저 체크해 주세요.');
  try {
    setProgressEta(170, ['원고 흐름을 읽는 중…', '자료가 놓일 자리를 찾는 중…', '문장에 녹이는 중…', '앞뒤를 다듬는 중…']);
    const out = await callAI('weave', {
      homiletical: p.central.homiletical, draft: draftText(), materials: materialsSlot(ids),
    }, { label: '자료를 원고에 녹이는 중… (2~4분)' });
    const changes = (out.match(/\[변경점\]([\s\S]*?)\[원고\]/) || [])[1] || '';
    const script = (out.match(/\[원고\]([\s\S]*)/) || [])[1] || out;
    const body = modal('자료 투입 결과 검토', `
      <h4 style="margin-top:0">무엇이 어디에 들어갔나</h4>
      ${mdToHtml(changes.trim())}
      <h4 style="margin:14px 0 6px">새 원고 미리보기</h4>
      <div class="stream-preview" style="max-height:38vh">${mdToHtml(script.trim())}</div>
      <div class="btn-row">
        <button class="btn btn-primary" id="wv-apply">승인 — 원고에 반영 (현재 원고는 버전 보관)</button>
        <button class="btn btn-ghost" id="wv-cancel">취소</button>
      </div>`);
    body.querySelector('#wv-cancel').addEventListener('click', closeModal);
    body.querySelector('#wv-apply').addEventListener('click', () => {
      snapshot(p, '자료 투입 전');
      p.draft.html = mdToHtml(script.trim());
      touch(p); closeModal(); render();
      toast('자료를 원고에 반영했습니다.');
    });
  } catch (e) { if (e.message !== 'no-ai') toast('오류: ' + e.message, 6000); }
}
/* 제목 추천 — 원고 + 자료 서랍(잡지 구절)을 읽고 아홉 기법으로 */
async function suggestTitles(p) {
  syncEditor();
  try {
    setProgressEta(85, ['원고를 읽는 중…', '자료 서랍의 구절을 훑는 중…', '기법별로 제목을 짓는 중…', '가장 좋은 것을 고르는 중…']);
    const r = await callAIJson('titleSuggest', {
      ref: p.passage.ref, homiletical: p.central.homiletical,
      purpose: p.inputs.purpose, audience: p.inputs.audience,
      draft: htmlToText(p.draft.html).slice(0, 12000),
      materials: materialsSlot(null),
    }, { label: '듣고 싶어지는 제목을 짓는 중…' });
    const list = (r.titles || []).filter(t => t && t.title);
    if (!list.length) { toast('제목을 만들지 못했습니다. 다시 시도해 주세요.'); return; }
    const body = modal('제목 추천 — ' + esc(p.passage.ref), `
      ${r.best ? `<div class="rec-best" style="margin-bottom:14px">
        <div class="rec-name">첫손 — ${esc(r.best)}</div>
        ${r.bestWhy ? `<p>${esc(r.bestWhy)}</p>` : ''}
        ${r.subtitle ? `<div class="meta"><b>부제 제안</b> ${esc(r.subtitle)}</div>` : ''}
      </div>` : ''}
      <div id="tt-list">
        ${list.map((t, i) => `
          <div class="fb-item" style="background:var(--surface-soft);display:flex;gap:10px;align-items:flex-start">
            <div style="flex:1">
              <div style="font-size:1rem;font-weight:700;letter-spacing:-0.02em;margin-bottom:3px">${esc(t.title)}</div>
              <div style="font-size:.76rem;opacity:.85">${esc(t.technique || '')}${t.why ? ' — ' + esc(t.why) : ''}</div>
              ${t.borrowed ? `<div style="font-size:.74rem;opacity:.75;margin-top:3px">📎 빌려온 구절: ${esc(t.borrowed)}</div>` : ''}
            </div>
            <button class="btn btn-primary btn-sm" data-tt="${i}" style="flex-shrink:0">이 제목 쓰기</button>
          </div>`).join('')}
      </div>
      <div class="btn-row"><button class="btn btn-ghost btn-sm" id="tt-again" ${aiConnected() ? '' : 'disabled'}>다시 추천받기 🤖</button>
      <button class="btn btn-ghost btn-sm" id="tt-copy">📋 전체 복사</button></div>`);
    body.querySelectorAll('[data-tt]').forEach(b => b.addEventListener('click', () => {
      applyTitle(p, list[+b.dataset.tt].title);
    }));
    body.querySelector('#tt-again').addEventListener('click', () => { closeModal(); suggestTitles(p); });
    body.querySelector('#tt-copy').addEventListener('click', () => {
      navigator.clipboard.writeText(list.map(t => t.title + '  (' + (t.technique || '') + ')').join('\n'));
      toast('제목 목록을 복사했습니다.');
    });
  } catch (e) { if (e.message !== 'no-ai') toast('오류: ' + e.message, 5000); }
}
function applyTitle(p, title) {
  p.title = title;
  const div = document.createElement('div');
  div.innerHTML = p.draft.html;
  const h1 = div.querySelector('h1');
  if (h1) h1.textContent = title;
  else div.insertAdjacentHTML('afterbegin', '<h1>' + esc(title) + '</h1>');
  p.draft.html = div.innerHTML;
  touch(p); closeModal(); render();
  toast('제목을 "' + title + '"(으)로 바꿨습니다.');
}
/* 부분 재작성 결과가 들어갈 자리 규칙 */
const PARTIAL_PLACE = [
  // 구체적인 규칙을 먼저 — '추천 도서…(책 제목…)'이 제목 규칙에 걸리지 않도록
  { re: /추천 도서|유머/, mode: 'end' },
  { re: /배경 설명/, mode: 'before', heads: ['본문', '설명', '본론'] },
  { re: /제목/, mode: 'title' },
  { re: /서론/, mode: 'section', heads: ['서론', '도입'] },
  { re: /결론|촌철살인/, mode: 'section', heads: ['결론', '맺음', '마무리'] },
  { re: /적용/, mode: 'section', heads: ['적용', '오늘의 적용'] },
  { re: /복음적 연결/, mode: 'section', heads: ['복음', '복음적 연결'] },
  { re: /예화/, mode: 'section', heads: ['예화'] },
  { re: /본론|본문 해설|논리|설명 보강/, mode: 'section', heads: ['본론', '본문 설명', '본문'] },
  { re: /분량|목표 시간|AI 냄새|문체|지금의 설교로/, mode: 'whole' },
];
function placeRuleFor(request) {
  const r = PARTIAL_PLACE.find(x => x.re.test(request));
  return r || { mode: 'end' };
}
/* 결과 HTML을 원고의 알맞은 자리에 넣는다. 반환: 어디에 넣었는지 설명 */
function applyPartial(p, request, outMd) {
  const rule = placeRuleFor(request);
  const outHtml = mdToHtml(outMd);
  const div = document.createElement('div');
  div.innerHTML = p.draft.html;
  const heads = () => Array.from(div.querySelectorAll('h1,h2,h3'));
  const findHead = names => heads().find(h => names.some(n => h.textContent.replace(/\s/g, '').includes(n.replace(/\s/g, ''))));

  if (rule.mode === 'title') {
    // 제목: 결과에서 첫 줄만 뽑아 h1 교체
    const first = outMd.split('\n').map(x => x.replace(/^[#\-*\d.\s"'‘“]+/, '').replace(/["'’”]+$/, '').trim()).find(x => x.length > 1 && x.length < 40);
    if (first) {
      p.title = first;
      const h1 = div.querySelector('h1');
      if (h1) h1.textContent = first; else div.insertAdjacentHTML('afterbegin', '<h1>' + esc(first) + '</h1>');
      p.draft.html = div.innerHTML;
      return '제목을 "' + first + '"(으)로 바꿨습니다';
    }
  }
  if (rule.mode === 'whole') {
    const h1 = div.querySelector('h1');
    const keepTitle = h1 ? h1.outerHTML : '';
    const titleTxt = h1 ? h1.textContent.replace(/\s/g, '') : '';
    const body = document.createElement('div');
    body.innerHTML = outHtml;
    // 결과가 제목을 다시 달았으면(h1이든 첫 문단이든) 지운다
    for (let i = 0; i < 3 && body.firstElementChild; i++) {
      const el = body.firstElementChild;
      const t = el.textContent.replace(/\s/g, '');
      const isTitleDup = titleTxt && t === titleTxt;
      const isRefLine = /^([가-힣]{1,10}\s?\d+[:：]\d+([-~]\d+)?)$/.test(el.textContent.trim());
      if (el.tagName === 'H1' || isTitleDup || isRefLine) { el.remove(); continue; }
      break;
    }
    // AI가 남긴 자리표시([날짜·시리즈] 같은 대괄호 안내)를 지운다
    body.querySelectorAll('p,h1,h2,h3,li').forEach(el => {
      const t = el.textContent.trim();
      if (/^[\[［].{1,40}[\]］]$/.test(t)) el.remove();
    });
    p.draft.html = (keepTitle || '') + body.innerHTML;
    return '원고 전체를 새 원고로 바꿨습니다';
  }
  if (rule.mode === 'section' || rule.mode === 'before') {
    const target = findHead(rule.heads || []);
    if (target) {
      if (rule.mode === 'before') {
        target.insertAdjacentHTML('beforebegin', outHtml);
        p.draft.html = div.innerHTML;
        return '"' + target.textContent.trim() + '" 앞에 넣었습니다';
      }
      // section: 해당 제목 다음부터 다음 제목 전까지를 교체
      const level = +target.tagName[1];
      const remove = [];
      let n = target.nextElementSibling;
      while (n && !(/^H[1-3]$/.test(n.tagName) && +n.tagName[1] <= level)) { remove.push(n); n = n.nextElementSibling; }
      remove.forEach(el => el.remove());
      const frag = document.createElement('div');
      frag.innerHTML = outHtml;
      frag.querySelectorAll('h1,h2,h3').forEach(h => { // 결과가 같은 제목을 또 달았으면 제거
        if (h === frag.firstElementChild && h.textContent.replace(/\s/g, '').includes(target.textContent.replace(/\s/g, '').slice(0, 4))) h.remove();
      });
      target.insertAdjacentHTML('afterend', frag.innerHTML);
      p.draft.html = div.innerHTML;
      return '"' + target.textContent.trim() + '" 부분을 새 내용으로 바꿨습니다';
    }
  }
  // 자리를 못 찾았거나 end 규칙 → 원고 끝에 붙인다
  p.draft.html = div.innerHTML + outHtml;
  return '원고 끝에 붙였습니다';
}
async function partialRewrite(p, request) {
  syncEditor();
  // 짧은 메뉴 이름을 상세 지시로 확장
  let fullRequest = request;
  if (request.includes('지금의 설교로')) {
    fullRequest = '이 원고는 시간이 지난 설교다. **내용과 신학과 구조는 그대로 두고**, 오늘의 강단에서 그대로 읽어도 자연스럽도록 언어와 표현만 살짝 손보라. 큰 수술이 아니라 옷을 갈아입히는 작업이다.\n' +
      '고칠 것: ①낡은 한자어·문어투를 지금 쓰는 말로(예: "~하는 바입니다" → "~합니다") ②지나치게 긴 문장을 끊어 짧게 — 다만 설교자의 호흡은 살릴 것 ③시대가 지난 예화의 배경·소품·물가·기기를 오늘의 것으로 바꾸되, 예화의 뼈대와 교훈은 그대로 둘 것 ④오늘 회중에게 어색하거나 상처가 될 수 있는 표현(성별 역할 고정, 장애·질병·가난·직업을 낮추는 말투, 시대에 맞지 않는 비유)을 자연스럽게 다듬을 것 ⑤설교체 상투구("~하시기 바랍니다"의 반복, 과장된 수사)를 덜어낼 것.\n' +
      '지킬 것: 본문 해석과 신학적 주장, 중심사상, 대지 구조, 인용한 성경 구절, 설교자 개인의 경험과 목소리는 **바꾸지 마라**. 새 내용을 지어 넣지 마라. 분량은 원래와 비슷하게 유지하라.\n' +
      '원고 맨 끝에 "---" 한 줄을 두고 그 아래 "### 손본 곳"이라는 제목으로, 무엇을 왜 바꿨는지 5~8줄로 정리하라(예: "「~하는 바입니다」 → 「~합니다」 · 문어투 정리").';
  }
  if (request.includes('유머')) {
    fullRequest = '이 설교의 알맞은 자리에 넣을 유머를 만들라. 규칙: ①회중을 웃기려고 설교를 멈추지 말 것 — 유머는 메시지로 가는 다리여야 하고, 웃음 직후 반드시 본론으로 이어지는 한 문장이 따라붙어야 한다 ②설교자 자신을 낮추는 자기 비하형이나, 누구나 겪는 일상의 관찰형으로 할 것 ③특정 인물·직업·세대·성별·지역·외모를 웃음거리로 삼지 말 것 ④정치·시사 풍자 금지 ⑤성경 인물이나 하나님을 가볍게 만들지 말 것 ⑥한국 강단의 품위를 지킬 것 — 억지 개그·유행어 남용 금지 ⑦지어낸 실화를 설교자의 경험처럼 쓰지 말 것(가상 예시는 "(가상 예시)" 표시). 서로 다른 자리에 쓸 유머 2~3개를 제안하되, 각각 ⓐ들어갈 위치(어느 대목 뒤) ⓑ그대로 읽을 수 있는 완성된 문장 ⓒ이어지는 연결 문장 ⓓ웃음이 안 터졌을 때의 대비책 한 줄을 함께 쓰라.';
  }
  if (request.includes('배경 설명')) {
    fullRequest = '이 설교의 본문을 회중이 그림처럼 볼 수 있도록 [배경 설명] 단락을 써서 원고의 알맞은 자리(대개 본문 설명 앞이나 첫 대지 초입)에 넣을 수 있게 하라. 담을 것: ①역사적 배경 — 이 사건·기록이 놓인 시대와 정치·종교 상황 ②문화적 배경 — 당시 사람들의 관습·직업·신분·일상 중 이 본문을 이해하는 데 꼭 필요한 것 ③지리적 배경 — 장소의 실제 모습, 거리, 기후, 그곳에 서면 무엇이 보이는지 ④언어적 배경 — 핵심 단어의 원어 뉘앙스(확실한 것만) ⑤"그래서 원청중은 이 대목에서 무엇을 느꼈는가" 한 문장. 규칙: 설교 원고에 그대로 넣어 읽을 수 있는 구어체 문장으로 쓸 것(백과사전식 나열 금지). 분량은 1~2분(400~600자). 확실하지 않은 사실·연대·숫자는 쓰지 말거나 "(확인 필요)"를 붙일 것. 학자 이름과 출처를 지어내지 말 것.';
  }
  if (request.includes('추천 도서')) {
    fullRequest = '이 설교의 중심내용과 궤를 같이하는, 실제 존재하는 책 2권을 "## 추천 도서" 섹션으로 작성하라. 각 책마다 ①제목·저자 ②추천 이유(2~3문장) ③책 내용 요약(각각 약 A4 두 페이지, 3,000자 안팎 — 핵심 논지·구조·이 설교와 만나는 지점 중심). 존재가 불확실한 책은 추천하지 말고, 세부 정보가 불확실하면 "(확인 필요)"를 붙여라. 원고 끝에 붙일 수 있는 형태로 섹션 전체만 출력하라.';
  }
  const rule = placeRuleFor(request);
  if (rule.mode === 'whole') {
    fullRequest += ' 이 요청을 반영한 **설교문 전체**를 처음부터 끝까지 다시 출력하라(일부만 출력하지 말 것).' +
      ' 원고 본문만 출력하라 — 제목 줄을 다시 붙이지 말고, [날짜·시리즈]·[여기에 ~]처럼 대괄호로 된 자리표시나 작성 안내를 넣지 마라.';
  } else if (rule.mode !== 'title') {
    fullRequest += ' 원고에 그대로 넣을 수 있는 완성된 문장으로, 해당 부분만 출력하라. 설명·머리말·"다음과 같이" 같은 안내 문구는 붙이지 마라.';
  }
  try {
    setProgressEta(rule.mode === 'whole' ? 200 : 90, ['원고를 읽는 중…', '요청대로 새로 쓰는 중…', '다듬는 중…', '원고에 넣는 중…']);
    const out = await callAI('partial', {
      homiletical: p.central.homiletical, ref: p.passage.ref,
      needs: p.inputs.needs, purpose: p.inputs.purpose,
      rules: DB.settings.rules,
      draft: draftText(), request: fullRequest,
    }, { label: '"' + request + '" 작업 중…' });
    // 되돌릴 수 있도록 먼저 버전 보관 → 원고에 자동 반영
    snapshot(p, request + ' 전 원고');
    const where = applyPartial(p, request, out);
    touch(p); render();
    const body = modal('반영 완료 — ' + request, `
      <div class="fb-item" style="background:var(--lime)"><b>원고에 바로 넣었습니다</b>${esc(where)}. 되돌리려면 아래 [되돌리기]를 누르거나, 3단계 <b>버전 기록</b>에서 "${esc(request)} 전 원고"를 복원하세요.</div>
      <div class="stream-preview" style="max-height:40vh">${esc(out)}</div>
      <div class="btn-row">
        <button class="btn btn-primary" id="pr-ok">확인 — 원고 보기</button>
        <button class="btn btn-ghost" id="pr-undo">되돌리기</button>
        <button class="btn btn-ghost" id="pr-copy">📋 복사</button>
      </div>`);
    body.querySelector('#pr-ok').addEventListener('click', () => {
      closeModal();
      const ed = $('#editor'); if (ed) ed.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    body.querySelector('#pr-copy').addEventListener('click', () => { navigator.clipboard.writeText(out); toast('복사했습니다.'); });
    body.querySelector('#pr-undo').addEventListener('click', () => {
      const v = p.draft.versions.pop();
      if (v) { p.draft.html = v.html; touch(p); }
      closeModal(); render();
      toast('되돌렸습니다.');
    });
  } catch (e) { if (e.message !== 'no-ai') toast('오류: ' + e.message, 5000); }
}

/* ═══════════════════ 4단계: 형식 결정 ═══════════════════ */
function renderStep4(m, p) {
  if (htmlToText(p.draft.html).length < 50) {
    m.innerHTML = `<div class="step-head">4단계</div><h1 class="step-title">형식 결정</h1>
      <div class="card"><p>먼저 3단계에서 원고를 작성해 주세요. 형식은 완성된 재료를 담는 그릇입니다.</p>
      <div class="btn-row"><button class="btn btn-primary" onclick="gotoStep(3)">3단계로 가기</button></div></div>`;
    return;
  }
  const fits = p.form.fits || {};
  m.innerHTML = `
    <div class="step-head">4단계 · ${esc(p.passage.ref)}</div>
    <h1 class="step-title">형식 결정</h1>
    <p class="step-desc">형식은 그릇입니다. 같은 내용도 그릇이 바뀌면 다른 맛이 납니다. 기준은 세 축 — <b>본문의 성격 × 청중의 상태 × 설교의 목적</b>. 중심사상은 어떤 그릇에서도 보존됩니다.</p>
    <div class="btn-row" style="margin-bottom:16px">
      <button class="btn btn-primary" id="s4-rec" ${aiConnected() ? '' : 'disabled'}>내 원고를 읽고 형식 추천받기 🤖</button>
      <button class="btn btn-ghost" id="s4-fit" ${aiConnected() ? '' : 'disabled'}>형식별 적합도 점수 🤖</button>
      <button class="btn btn-ghost" id="s4-addform">＋ 사용자 정의 형식 만들기</button>
      ${p.form.selected ? `<span class="badge" style="margin-left:auto">현재 형식: ${esc(formName(p.form.selected))}</span>` : ''}
    </div>
    <div id="s4-recbox">${p.form.rec ? renderFormatRec(p, p.form.rec) : ''}</div>
    ${renderFormGroups(p, fits)}
    <div class="btn-row" style="margin-top:20px">
      <button class="btn btn-primary" id="s4-go5" style="margin-left:auto">5단계 연습하기 →</button>
    </div>`;
  $('#s4-fit').addEventListener('click', async () => {
    try {
      setProgressEta(55, ['본문 성격을 보는 중…', '형식별로 견주는 중…', '점수를 매기는 중…']);
      const r = await callAIJson('formatFit', {
        ref: p.passage.ref, genre: p.passage.genre, homiletical: p.central.homiletical,
        audience: p.inputs.audience, purpose: p.inputs.purpose,
        formatList: allForms().map(f => f.key + '=' + f.name).join(', '),
      }, { label: '형식 적합도를 평가하는 중…' });
      p.form.fits = {};
      (r.fits || []).forEach(f => { p.form.fits[f.key] = f; });
      touch(p); render();
    } catch (e) { if (e.message !== 'no-ai') toast('오류: ' + e.message, 5000); }
  });
  $('#s4-rec').addEventListener('click', () => recommendFormat(p));
  const recConv = $('#s4-rec-convert');
  if (recConv) recConv.addEventListener('click', () => convertFormat(p, recConv.dataset.key));
  const recAgain = $('#s4-rec-again');
  if (recAgain) recAgain.addEventListener('click', () => recommendFormat(p));
  $('#s4-addform').addEventListener('click', () => openFormEditor(null, () => render()));
  $('#s4-go5').addEventListener('click', () => gotoStep(5));
  $$('#main [data-conv]').forEach(b => b.addEventListener('click', () => convertFormat(p, b.dataset.conv)));
}
/* 원고를 읽고 형식 추천 */
async function recommendFormat(p) {
  syncEditor();
  try {
    setProgressEta(80, ['원고 전체를 읽는 중…', '지금의 흐름을 진단하는 중…', '형식들과 견주는 중…', '추천 이유를 쓰는 중…']);
    const r = await callAIJson('formatRecommend', {
      ref: p.passage.ref, genre: p.passage.genre || '(미상)',
      homiletical: p.central.homiletical, audience: p.inputs.audience, purpose: p.inputs.purpose,
      targetMin: p.inputs.targetMin,
      draft: htmlToText(p.draft.html).slice(0, 14000),
      formatList: allForms().map(f => f.key + '=' + f.name).join(', '),
    }, { label: '원고를 읽고 어울리는 형식을 찾는 중…' });
    p.form.rec = r; p.form.recAt = Date.now();
    touch(p); render();
    const box = $('#s4-recbox');
    if (box) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (e) { if (e.message !== 'no-ai') toast('오류: ' + e.message, 5000); }
}
function renderFormatRec(p, r) {
  const b = r.best || {};
  const alts = (r.alternatives || []).filter(a => a && a.key);
  return `
    <div class="card rec-card">
      <h3 style="margin-top:0">🤖 AI 형식 추천 <span class="opt" style="font-weight:400;font-size:.74rem">— 내 원고를 읽고 판단한 결과</span></h3>
      ${r.currentShape ? `<div class="fb-item" style="background:var(--surface-soft)"><b>지금 원고의 흐름</b>${esc(r.currentShape)}</div>` : ''}
      <div class="rec-best">
        <div class="rec-name">추천 — ${esc(formName(b.key) || b.key || '')}</div>
        ${b.reason ? `<p>${esc(b.reason)}</p>` : ''}
        ${b.whatChanges ? `<div class="meta"><b>바뀌는 점</b> ${esc(b.whatChanges)}</div>` : ''}
        ${b.risk ? `<div class="meta"><b>주의</b> ${esc(b.risk)}</div>` : ''}
        ${b.key ? `<div class="btn-row" style="margin-top:10px">
          <button class="btn btn-primary btn-sm" id="s4-rec-convert" data-key="${esc(b.key)}" ${aiConnected() ? '' : 'disabled'}>이 형식으로 변환 🤖</button>
          <button class="btn btn-ghost btn-sm" id="s4-rec-again" ${aiConnected() ? '' : 'disabled'}>다시 추천받기 🤖</button>
        </div>` : ''}
      </div>
      ${alts.length ? `<div style="margin-top:12px"><b style="font-size:.86rem">차선책</b>
        ${alts.map(a => `<div class="meta"><b>${esc(formName(a.key) || a.key)}</b> ${esc(a.reason || '')}</div>`).join('')}</div>` : ''}
      ${r.keepAsIs ? `<div class="ai-note" style="margin-top:12px"><b>형식을 바꾸지 않아도 되는 이유</b> — ${esc(r.keepAsIs)}</div>` : ''}
    </div>`;
}
const FORM_GROUPS = [
  ['deductive', '연역적 형식', '중심사상을 앞에 두고 설명해 내려간다', 'var(--mint)'],
  ['inductive', '귀납적 형식', '질문과 이야기에서 출발해 중심사상에 도달한다', 'var(--lilac)'],
  ['practical', '실전 틀', '검증된 설득의 순서', 'var(--cream)'],
  ['custom', '내 형식', '직접 만든 형식', 'var(--lime)'],
];
function renderFormGroups(p, fits) {
  const fcard = f => `
    <div class="fcard ${p.form.selected === f.key ? 'selected' : ''}">
      <h4>${esc(f.name)} ${fits[f.key] ? `<span class="fit-badge">적합도 ${fits[f.key].fit}/10</span>` : ''}</h4>
      <p>${esc(f.desc)}</p>
      <div class="meta"><b>순서</b> ${esc(f.steps)}</div>
      <div class="meta"><b>어울림</b> ${esc(f.fitFor)}</div>
      <div class="meta"><b>장점</b> ${esc(f.strengths)}</div>
      <div class="meta"><b>주의</b> ${esc(f.cautions)}</div>
      ${fits[f.key] ? `<div class="meta"><b>AI 평가</b> ${esc(fits[f.key].reason)}</div>` : ''}
      <button class="btn btn-sm ${p.form.selected === f.key ? 'btn-ghost' : 'btn-primary'}" data-conv="${f.key}" ${aiConnected() ? '' : 'disabled'}>
        ${p.form.selected === f.key ? '이 형식으로 다시 변환 🤖' : '이 형식으로 변환 🤖'}</button>
    </div>`;
  return FORM_GROUPS.map(([g, title, sub, color]) => {
    const forms = allForms().filter(f => (f.custom ? 'custom' : (f.group || 'practical')) === g);
    if (!forms.length) return '';
    return `
      <div style="display:flex;align-items:baseline;gap:10px;margin:26px 0 12px">
        <span style="display:inline-block;width:12px;height:12px;border-radius:4px;background:${color}"></span>
        <h3 style="font-size:1.15rem">${title}</h3>
        <span style="font-size:.78rem;opacity:.858">${sub}</span>
      </div>
      <div class="form-cards">${forms.map(fcard).join('')}</div>`;
  }).join('');
}
async function convertFormat(p, key) {
  const f = allForms().find(f => f.key === key);
  try {
    setProgressEta(190, ['원고를 해체하는 중…', '형식의 뼈대에 맞추는 중…', '문장을 다시 잇는 중…', '분량을 맞추며 마무리하는 중…']);
    const out = await callAI('formatConvert', {
      formatName: f.name, formatDesc: f.desc, formatSteps: f.steps,
      homiletical: p.central.homiletical, ref: p.passage.ref, draft: draftText(),
    }, { label: '"' + f.name + '" 형식으로 재구성 중… (2~4분)' });
    // 파싱: [개요-이전] [개요-이후] [원고]
    const before = (out.match(/\[개요-이전\]([\s\S]*?)\[개요-이후\]/) || [])[1] || '';
    const after = (out.match(/\[개요-이후\]([\s\S]*?)\[원고\]/) || [])[1] || '';
    const script = (out.match(/\[원고\]([\s\S]*)/) || [])[1] || out;
    const body = modal(f.name + ' — 변환 결과 검토', `
      <p style="font-size:.82rem;color:var(--ink-soft)">중심사상·본문 의미·주요 예화는 보존됩니다. 승인해야 원고에 반영됩니다.</p>
      <div class="compare">
        <div class="col"><h4>변환 전 개요</h4>${mdToHtml(before.trim())}</div>
        <div class="col"><h4>변환 후 개요 (${esc(f.name)})</h4>${mdToHtml(after.trim())}</div>
      </div>
      <h4 style="margin:14px 0 6px">새 원고 미리보기</h4>
      <div class="stream-preview" style="max-height:34vh">${mdToHtml(script.trim())}</div>
      <div class="btn-row">
        <button class="btn btn-gold" id="cv-apply">승인 — 원고에 반영 (현재 원고는 버전으로 보관)</button>
        <button class="btn btn-ghost" id="cv-cancel">취소</button>
      </div>`);
    body.querySelector('#cv-cancel').addEventListener('click', closeModal);
    body.querySelector('#cv-apply').addEventListener('click', () => {
      snapshot(p, '형식 변환 전 (' + (formName(p.form.selected) || '기본') + ')');
      p.draft.html = mdToHtml(script.trim());
      p.form.selected = key;
      touch(p); closeModal(); render();
      toast(f.name + ' 형식으로 반영했습니다.');
    });
  } catch (e) { if (e.message !== 'no-ai') toast('오류: ' + e.message, 6000); }
}
/* 사용자 정의 형식 편집기 */
function openFormEditor(existing, onDone) {
  const f = existing || { key: 'custom_' + uid(), name: '', desc: '', steps: '', fitFor: '', strengths: '', cautions: '', custom: true };
  const body = modal(existing ? '형식 수정' : '사용자 정의 형식 만들기', `
    <div class="form-grid">
      <div class="field full"><label>형식 이름 *</label><input id="fe-name" value="${esc(f.name)}" placeholder="예: 우리 교회 새벽 3단"></div>
      <div class="field full"><label>형식 설명</label><textarea id="fe-desc">${esc(f.desc)}</textarea></div>
      <div class="field full"><label>진행 순서 (→ 로 구분) *</label><textarea id="fe-steps" placeholder="예: ① 질문 → ② 본문 → ③ 한 가지 적용">${esc(f.steps)}</textarea></div>
      <div class="field"><label>적합한 본문·목적</label><input id="fe-fit" value="${esc(f.fitFor)}"></div>
      <div class="field"><label>장점</label><input id="fe-str" value="${esc(f.strengths)}"></div>
      <div class="field full"><label>주의할 점</label><input id="fe-cau" value="${esc(f.cautions)}"></div>
    </div>
    <div class="btn-row">
      <button class="btn btn-gold" id="fe-save">저장</button>
      ${existing ? '<button class="btn btn-danger" id="fe-del">삭제</button>' : ''}
      <button class="btn btn-ghost" id="fe-cancel">취소</button>
    </div>`);
  body.querySelector('#fe-cancel').addEventListener('click', closeModal);
  body.querySelector('#fe-save').addEventListener('click', () => {
    f.name = $('#fe-name').value.trim(); f.desc = $('#fe-desc').value.trim();
    f.steps = $('#fe-steps').value.trim(); f.fitFor = $('#fe-fit').value.trim();
    f.strengths = $('#fe-str').value.trim(); f.cautions = $('#fe-cau').value.trim();
    if (!f.name || !f.steps) { toast('이름과 진행 순서는 필수입니다.'); return; }
    if (!existing) DB.customForms.push(f);
    save(true); closeModal(); if (onDone) onDone();
    toast('형식을 저장했습니다. 모든 프로젝트에서 사용할 수 있습니다.');
  });
  const del = body.querySelector('#fe-del');
  if (del) del.addEventListener('click', () => {
    DB.customForms = DB.customForms.filter(x => x.key !== f.key);
    save(true); closeModal(); if (onDone) onDone();
  });
}
function renderFormsManager(m) {
  m.innerHTML = `
    <div class="step-head">라이브러리</div>
    <h1 class="step-title">나의 설교 형식</h1>
    <p class="step-desc">기본 9가지 형식에 나만의 형식을 더할 수 있습니다. 저장한 형식은 모든 설교 프로젝트의 4단계에 나타납니다.</p>
    <div class="btn-row" style="margin-bottom:16px"><button class="btn btn-gold" id="fm-add">＋ 새 형식 만들기</button></div>
    <div class="form-cards">
      ${allForms().map(f => `
        <div class="fcard">
          <h4>${esc(f.name)} ${f.custom ? '<span class="badge">내 형식</span>' : ''}</h4>
          <p>${esc(f.desc)}</p>
          <div class="meta"><b>순서</b> ${esc(f.steps)}</div>
          ${f.custom ? `<button class="btn btn-sm btn-ghost" data-edit="${f.key}">수정</button>` : ''}
        </div>`).join('')}
    </div>`;
  $('#fm-add').addEventListener('click', () => openFormEditor(null, () => renderFormsManager(m)));
  m.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => {
    openFormEditor(DB.customForms.find(f => f.key === b.dataset.edit), () => renderFormsManager(m));
  }));
}

/* ═══════════════════ 5단계: 연습하기 ═══════════════════ */
const CHECKLIST = [
  '원고를 두 번 이상 소리 내어 읽었다',
  '실제 시간을 측정했다',
  '중심사상을 원고 없이 말할 수 있다',
  '첫 문장과 마지막 문장을 기억한다',
  '성경 인용과 통계의 출처를 확인했다',
  '지나치게 긴 문장을 고쳤다',
  '회중을 바라볼 지점을 정했다',
  '몸과 목소리를 준비했다',
];
function renderStep5(m, p) {
  if (htmlToText(p.draft.html).length < 50) {
    m.innerHTML = `<div class="step-head">5단계</div><h1 class="step-title">연습하기</h1>
      <div class="card"><p>먼저 3단계에서 원고를 작성해 주세요.</p>
      <div class="btn-row"><button class="btn btn-primary" onclick="gotoStep(3)">3단계로 가기</button></div></div>`;
    return;
  }
  const r = p.rehearsal;
  m.innerHTML = `
    <div class="step-head">5단계 · ${esc(p.passage.ref)}</div>
    <h1 class="step-title">연습하기</h1>
    <p class="step-desc">문어체 원고를 구어체 설교로 바꾸는 유일한 방법은 소리 내어 읽는 것입니다. 입에서 걸리는 문장은 잘못된 문장입니다.</p>
    <div class="card">
      <h3>원고 점검</h3>
      <div class="btn-row" style="margin-top:0">
        <button class="btn btn-primary" id="s5-feedback" ${aiConnected() ? '' : 'disabled'}>내용 + 전달 피드백 받기 🤖</button>
        <button class="btn btn-ghost" id="s5-gestures" ${aiConnected() ? '' : 'disabled'}>제스처 5~10개 제안 🤖</button>
        <button class="btn btn-ghost" id="s5-breaths" ${aiConnected() ? '' : 'disabled'}>쉼·멈춤 자리 찾기 🤖</button>
        <button class="btn btn-ghost" id="s5-stress" ${aiConnected() ? '' : 'disabled'}>강약 자리 찾기 🤖</button>
        <button class="btn btn-primary" id="s5-marked">📖 낭독 표시 원고 보기</button>
        <button class="btn btn-ai" id="s5-genius" ${aiConnected() ? '' : 'disabled'}>💎 천재화 — 평가와 아이디어 🤖</button>
        <button class="btn btn-gold" id="s5-rehearse">🎤 리허설 모드 시작</button>
      </div>
      <div id="s5-br">${r.breaths ? renderBreaths(r.breaths) : ''}</div>
      <div id="s5-st">${r.stress ? renderStress(r.stress) : ''}</div>
      <div id="s5-fb">${r.feedback ? renderFeedback(r.feedback, p) : ''}</div>
      <div id="s5-gs">${r.gestures ? renderGestures(r.gestures) : ''}</div>
      <div id="s5-gn">${r.genius ? renderGenius(p, r.genius) : ''}</div>
    </div>
    ${renderSongCard(p)}
    <div class="card">
      <h3>연습 기록</h3>
      ${r.runs.length ? `<table class="proj-table" style="margin-bottom:12px"><tr><th>회차</th><th>날짜</th><th>실측 시간</th><th>목표 대비</th></tr>
        ${r.runs.map((run, i) => `<tr><td>${i + 1}회</td><td>${new Date(run.ts).toLocaleString('ko-KR')}</td><td><b>${fmtMin(run.seconds / 60)}</b></td>
        <td>${run.seconds / 60 > p.inputs.targetMin ? '<span style="color:var(--red)">+' + fmtMin(run.seconds / 60 - p.inputs.targetMin) + '</span>' : '-' + fmtMin(p.inputs.targetMin - run.seconds / 60)}</td></tr>`).join('')}</table>`
      : '<p style="font-size:.86rem;color:var(--ink-soft)">아직 연습 기록이 없습니다. 리허설 모드에서 시간을 재 보세요.</p>'}
      <div class="field"><label>연습 후 자기 평가</label><textarea id="s5-eval" placeholder="걸린 문장, 고칠 부분, 다음 연습에서 할 것">${esc(r.selfEval)}</textarea></div>
    </div>
    <div class="card">
      <h3>최종 점검표</h3>
      <div class="checklist">
        ${CHECKLIST.map((c, i) => `<label><input type="checkbox" data-chk="${i}" ${r.checklist[i] ? 'checked' : ''}> ${esc(c)}</label>`).join('')}
      </div>
      <div class="btn-row"><button class="btn btn-primary" id="s5-export">완료 — 문서 내보내기 📄</button></div>
    </div>`;
  $('#s5-feedback').addEventListener('click', () => getFeedback(p));
  $('#s5-gestures').addEventListener('click', () => getGestures(p));
  $('#s5-breaths').addEventListener('click', () => getBreaths(p));
  $('#s5-genius').addEventListener('click', () => getGenius(p));
  bindSongCard(p);
  $('#s5-stress').addEventListener('click', () => getStress(p));
  $('#s5-marked').addEventListener('click', () => openMarkedScript(p, 'all'));
  const stIns = $('#s5-st-insert');
  if (stIns) stIns.addEventListener('click', () => insertStressMarks(p));
  const stView = $('#s5-st-view');
  if (stView) stView.addEventListener('click', () => openMarkedScript(p, 'stress'));
  const gnApply = $('#s5-gn-open');
  if (gnApply) gnApply.addEventListener('click', () => { syncEditor(); gotoStep(3); });
  const gnAgain = $('#s5-gn-again');
  if (gnAgain) gnAgain.addEventListener('click', () => getGenius(p));
  const gnWord = $('#s5-gn-word');
  if (gnWord) gnWord.addEventListener('click', () => saveGeniusDoc(p));
  const brIns = $('#s5-br-insert');
  if (brIns) brIns.addEventListener('click', () => insertBreathMarks(p));
  const gsView = $('#s5-gs-view');
  if (gsView) gsView.addEventListener('click', () => openMarkedScript(p, 'gestures'));
  const brView = $('#s5-br-view');
  if (brView) brView.addEventListener('click', () => openMarkedScript(p, 'breaths'));
  $('#s5-rehearse').addEventListener('click', () => startRehearsal(p));
  $('#s5-eval').addEventListener('change', e => { r.selfEval = e.target.value; touch(p); });
  $$('#main [data-chk]').forEach(cb => cb.addEventListener('change', () => { r.checklist[cb.dataset.chk] = cb.checked; touch(p); }));
  $('#s5-export').addEventListener('click', openExport);
}
function renderFeedback(fb, p) {
  const c = fb.content || {}, d = fb.delivery || {};
  const li = arr => Array.isArray(arr) && arr.length ? '<ul>' + arr.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '—';
  return `
    <h4 style="margin-top:18px">A. 내용 피드백</h4>
    <div class="fb-section">
      ${[['중심사상 유지', c.oneIdea], ['단락 점검', c.paragraphCheck], ['본문 설명', c.textExplain], ['본문↔적용 다리', c.bridge], ['목적 달성', c.purpose], ['중복', c.duplicates], ['삭제 후보', c.cuttable], ['보강할 부분', c.needMore], ['소외될 수 있는 청중', c.excluded]]
        .map(([k, v]) => v ? `<div class="fb-item"><b>${k}</b>${esc(v)}</div>` : '').join('')}
      ${c.theologyRisk ? `<div class="fb-item warn"><b>신학적 오해 위험</b>${esc(c.theologyRisk)}</div>` : ''}
      ${c.factCheck ? `<div class="fb-item warn"><b>확인해야 할 사실·출처</b>${esc(c.factCheck)}</div>` : ''}
    </div>
    <h4>B. 전달 피드백 — 예상 ${d.estMinutes ? d.estMinutes + '분' : fmtMin(readingMinutes(htmlToText(p.draft.html)))}</h4>
    <div class="fb-section">
      <div class="fb-item"><b>문어체로 들리는 문장</b>${li(d.written)}</div>
      <div class="fb-item"><b>입에서 걸릴 문장</b>${li(d.tongueTwisters)}</div>
      <div class="fb-item"><b>지나치게 긴 문장</b>${li(d.tooLong)}</div>
      <div class="fb-item"><b>반복되는 어미</b>${esc(d.endings || '—')}</div>
      <div class="fb-item"><b>속도를 늦출 부분</b>${li(d.slowDown)}</div>
      <div class="fb-item"><b>강조할 단어</b>${li(d.stress)}</div>
      <div class="fb-item"><b>멈춤이 필요한 지점</b>${li(d.pause)}</div>
      <div class="fb-item"><b>회중을 바라볼 지점</b>${li(d.eyeContact)}</div>
      <div class="fb-item"><b>시간 조정</b>${esc(d.timeDiff || '—')}</div>
    </div>`;
}
/* ═══════════════════ 제스처 동작 그림 ═══════════════════ */
/* 앱 안에 직접 그린 선화 — 인터넷 없이도 즉시 표시된다 */
function gestureFigure(arms, extra) {
  return `<svg viewBox="0 0 120 145" class="g-fig" xmlns="http://www.w3.org/2000/svg">
    <g fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="60" cy="24" r="12.5"/>
      <path d="M60 37v58"/>
      <path d="M46 52h28"/>
      <path d="M60 95l-13 34M60 95l13 34"/>
      ${arms}
    </g>
    ${extra || ''}
  </svg>`;
}
const HAND = (x, y) => `<circle cx="${x}" cy="${y}" r="5" fill="currentColor" stroke="none"/>`;
const GESTURE_ART = {
  open:    { label: '양팔 벌리기', tip: '품는 동작 — 초대·환영·모두를 향할 때',
             svg: () => gestureFigure(`<path d="M46 52L26 44"/><path d="M74 52l20-8"/>` + HAND(22, 43) + HAND(98, 43)) },
  oneUp:   { label: '한 손 들기', tip: '선언·강조 — 하나의 핵심을 세울 때',
             svg: () => gestureFigure(`<path d="M74 52l12-14 4-22"/><path d="M46 52l-6 20 2 16"/>` + HAND(90, 14) + HAND(42, 90)) },
  bothUp:  { label: '두 손 들기', tip: '찬양·높임 — 하나님을 향할 때',
             svg: () => gestureFigure(`<path d="M46 52L32 30l-4-18"/><path d="M74 52l14-22 4-18"/>` + HAND(28, 10) + HAND(92, 10)) },
  pray:    { label: '두 손 모으기', tip: '기도·간구 — 낮아지고 구할 때',
             svg: () => gestureFigure(`<path d="M46 52L34 68l20 6"/><path d="M74 52l12 16-20 6"/>` + HAND(60, 75)) },
  chest:   { label: '가슴에 손', tip: '진심·고백 — 나의 이야기를 꺼낼 때',
             svg: () => gestureFigure(`<path d="M74 52l10 14-20 8"/><path d="M46 52l-6 20 2 16"/>` + HAND(60, 72) + HAND(42, 90)) },
  point:   { label: '가리키기', tip: '지목·지금 여기 — 청중을 향해 짚을 때',
             svg: () => gestureFigure(`<path d="M74 52l14 4 14-6"/><path d="M46 52l-6 20 2 16"/>` + HAND(100, 50) + `<path d="M106 50h9" stroke-width="3.4"/>` + HAND(42, 90)) },
  fist:    { label: '주먹 쥐기', tip: '결단·힘 — 단호한 한 마디에',
             svg: () => gestureFigure(`<path d="M74 52l12 10-4 -20"/><path d="M46 52l-6 20 2 16"/>` + `<rect x="74" y="26" width="17" height="15" rx="5" fill="currentColor" stroke="none"/>` + HAND(42, 90)) },
  palmDown:{ label: '손바닥 아래로', tip: '진정·안정 — 흥분을 가라앉히고 낮출 때',
             svg: () => gestureFigure(`<path d="M46 52L30 63"/><path d="M74 52l16 11"/>` + HAND(28, 64) + HAND(92, 64) + `<path d="M18 74h20M82 74h20" stroke-width="3"/>`) },
  palmUp:  { label: '손바닥 위로', tip: '제시·초대 — 내어놓고 권할 때',
             svg: () => gestureFigure(`<path d="M46 52L28 62"/><path d="M74 52l18 10"/>` + `<path d="M18 66q9 8 18 0M84 66q9 8 18 0" stroke-width="3.4"/>`) },
  reach:   { label: '앞으로 내밀기', tip: '다가감 — 회중에게 건네줄 때',
             svg: () => gestureFigure(`<path d="M46 52l-2 18"/><path d="M74 52l2 18"/>` + `<circle cx="44" cy="76" r="7" fill="currentColor" stroke="none"/><circle cx="76" cy="76" r="7" fill="currentColor" stroke="none"/>`) },
  count:   { label: '손가락으로 세기', tip: '열거 — 첫째·둘째를 짚을 때',
             svg: () => gestureFigure(`<path d="M74 52l12-6 2-12"/><path d="M46 52l-6 20 2 16"/>` + HAND(88, 33) + `<path d="M85 29V15M93 30V19" stroke-width="3"/>` + HAND(42, 90)) },
  still:   { label: '가만히 서기', tip: '침묵·멈춤 — 말없이 여백을 둘 때',
             svg: () => gestureFigure(`<path d="M46 52l-5 22 2 16"/><path d="M74 52l5 22-2 16"/>` + HAND(43, 92) + HAND(77, 92)) },
};
/* AI가 쓴 제스처 설명을 읽고 어울리는 그림을 고른다 */
function gestureArtFor(x) {
  const t = [x.gesture, x.hands, x.body, x.face].filter(Boolean).join(' ');
  const has = (...ws) => ws.some(w => t.includes(w));
  if (has('가만', '멈추', '멈춤', '정지', '침묵', '가만히')) return GESTURE_ART.still;
  if (has('주먹', '움켜', '쥐고', '단호')) return GESTURE_ART.fist;
  if (has('가리키', '지목', '손가락으로 청중', '짚')) return GESTURE_ART.point;
  if (has('첫째', '둘째', '세', '손가락 두', '하나씩')) return GESTURE_ART.count;
  if (has('가슴', '심장', '자기 몸', '가슴에')) return GESTURE_ART.chest;
  if (has('기도', '모으', '합장', '두 손을 모')) return GESTURE_ART.pray;
  if (has('두 손을 들', '양손을 들', '위로 들어', '높이 들', '찬양')) return GESTURE_ART.bothUp;
  if (has('한 손을 들', '손을 들어', '들어 올')) return GESTURE_ART.oneUp;
  if (has('아래로', '내리', '누르', '가라앉')) return GESTURE_ART.palmDown;
  if (has('벌리', '펼치', '양팔', '품', '감싸', '넓게')) return GESTURE_ART.open;
  if (has('내밀', '앞으로', '뻗', '건네')) return GESTURE_ART.reach;
  if (has('손바닥', '위로', '펴')) return GESTURE_ART.palmUp;
  return GESTURE_ART.open;
}
function gestureArtHtml(x, size) {
  const a = gestureArtFor(x);
  return `<div class="g-art ${size === 'sm' ? 'g-art-sm' : ''}">
    <div class="g-art-fig">${a.svg()}</div>
    <div class="g-art-cap"><b>${esc(a.label)}</b><span>${esc(a.tip)}</span></div>
  </div>`;
}
function renderGestures(g) {
  const list = g.gestures || [];
  return `<h4 style="margin-top:18px">C. 제스처 제안 (${list.length}곳) <span class="opt" style="font-size:.75rem;font-weight:400">— 과장 없이, 의미를 돕는 동작만</span></h4>` +
    list.map(x => `
    <div class="gesture">
      <div class="g-sent">"${esc(x.sentence)}" <span class="badge">${esc(x.position)}</span></div>
      ${gestureArtHtml(x, 'sm')}
      <div style="font-size:.9rem;margin-bottom:6px">${esc(x.gesture)}</div>
      <div class="g-grid">
        <span><b>손</b> ${esc(x.hands)}</span><span><b>몸</b> ${esc(x.body)}</span>
        <span><b>시선</b> ${esc(x.eyes)}</span><span><b>표정</b> ${esc(x.face)}</span>
        <span><b>속도</b> ${esc(x.pace)}</span><span><b>멈춤</b> ${esc(x.pauseSec)}초</span>
      </div>
      <div style="font-size:.8rem;color:var(--ink-soft);margin-top:6px">이유 — ${esc(x.why)}</div>
    </div>`).join('') +
    '<div class="btn-row"><button class="btn btn-primary btn-sm" id="s5-gs-view">📄 원고에서 위치 보기</button></div>';
}
/* 쉼·멈춤 자리 */
function renderBreaths(b) {
  const list = b.marks || [];
  if (!list.length) return '';
  return `<h4 style="margin-top:18px">쉼 ∕ · 멈춤 ⏸ 자리 (${list.length}곳)</h4>
    ${list.map(x => `
      <div class="fb-item" style="background:${x.kind === '멈춤' ? 'var(--lilac)' : 'var(--mint)'}">
        <b>${x.kind === '멈춤' ? '⏸ 멈춤 ' + esc(x.seconds) + '초' : '∕ 쉼'}</b>
        "${esc(x.sentence)}"
        ${x.posture ? `<div style="font-size:.78rem;margin-top:4px"><b style="display:inline;opacity:1">포즈</b> ${esc(x.posture)}</div>` : ''}
        <div style="font-size:.76rem;opacity:.85;margin-top:2px">${esc(x.why)}</div>
      </div>`).join('')}
    <div class="btn-row"><button class="btn btn-primary btn-sm" id="s5-br-insert">원고에 ∕·⏸ 표시 자동 삽입</button><button class="btn btn-ghost btn-sm" id="s5-br-view">📄 원고에서 위치 보기</button>
    <span style="font-size:.74rem;opacity:.858">삽입 후 3단계 편집기와 리허설 모드에 표시됩니다</span></div>`;
}
/* 강약 자리 찾기 */
async function getStress(p) {
  syncEditor();
  try {
    setProgressEta(120, ['원고를 소리로 읽어 보는 중…', '힘이 실릴 낱말을 고르는 중…', '흘려보낼 대목을 찾는 중…', '정리하는 중…']);
    const r = await callAIJson('stress', { draft: htmlToText(p.draft.html).slice(0, 16000) },
      { label: '강약을 줄 자리를 찾는 중…' });
    p.rehearsal.stress = r; touch(p); render();
    const box = $('#s5-st'); if (box) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) { if (e.message !== 'no-ai') toast('오류: ' + e.message, 5000); }
}
const HOW_ICON = { '높여서': '↗', '낮춰서': '↘', '늘려서': '〜', '끊어서': '｜' };
function renderStress(st) {
  const list = (st.marks || []).filter(x => x && x.word);
  const soft = (st.soften || []).filter(x => x && x.sentence);
  if (!list.length) return '';
  return `<h4 style="margin-top:18px">강약 자리 (${list.length}곳) <span class="opt" style="font-size:.75rem;font-weight:400">— 한 문장에 하나면 충분합니다</span></h4>
    <div class="st-list">
      ${list.map(x => `<div class="st-item ${x.level === '강' ? 'st-strong' : ''}">
        <span class="st-word">${esc(x.word)}</span>
        <span class="st-how">${HOW_ICON[x.how] || '↗'} ${esc(x.how || '')}</span>
        <span class="st-lv">${esc(x.level || '')}</span>
        <div class="st-why">${esc(x.why || '')}</div>
      </div>`).join('')}
    </div>
    ${soft.length ? `<div class="ai-note" style="margin-top:10px"><b>힘을 빼고 흘릴 대목</b><br>${soft.map(x => '· ' + esc(x.sentence) + ' — ' + esc(x.why)).join('<br>')}</div>` : ''}
    <div class="btn-row">
      <button class="btn btn-primary btn-sm" id="s5-st-insert">원고에 강약 표시 삽입</button>
      <button class="btn btn-ghost btn-sm" id="s5-st-view">📄 원고에서 위치 보기</button>
    </div>`;
}
/* 원고에 강약 표시(형광) 삽입 — 문장을 찾아 그 안의 낱말만 감싼다 */
function insertStressMarks(p) {
  const marks = (p.rehearsal.stress && p.rehearsal.stress.marks) || [];
  const div = document.createElement('div');
  div.innerHTML = p.draft.html;
  const norm = t => t.replace(/\s+/g, ' ').trim();
  let ok = 0;
  for (const mk of marks) {
    const word = (mk.word || '').trim();
    if (word.length < 2) continue;
    const tail = norm(mk.sentence || '').slice(-20);
    const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
    let node, done = false;
    while (!done && (node = walker.nextNode())) {
      if (node.parentElement && node.parentElement.closest('.stress-mark')) continue;
      const txt = node.textContent;
      if (tail.length > 5 && norm(txt).indexOf(tail.slice(-10)) < 0 && norm(txt).indexOf(word) < 0) continue;
      const idx = txt.indexOf(word);
      if (idx < 0) continue;
      const before = txt.slice(0, idx), after = txt.slice(idx + word.length);
      const span = document.createElement('span');
      span.className = 'stress-mark';
      span.textContent = word;
      span.title = (mk.how || '') + ' — ' + (mk.why || '');
      const parent = node.parentNode;
      parent.insertBefore(document.createTextNode(before), node);
      parent.insertBefore(span, node);
      parent.insertBefore(document.createTextNode(after), node);
      parent.removeChild(node);
      ok++; done = true;
    }
  }
  p.draft.html = div.innerHTML;
  touch(p); render();
  toast(ok + '곳에 강약 표시를 넣었습니다.' + (ok < marks.length ? ' (' + (marks.length - ok) + '곳은 문장을 찾지 못했습니다)' : ''));
}
async function getBreaths(p) {
  try {
    setProgressEta(80, ['문장을 소리로 재는 중…', '쉼과 멈춤 자리를 찾는 중…', '정리하는 중…']);
    const r = await callAIJson('breaths', { draft: htmlToText(p.draft.html) }, { label: '낭독 호흡을 분석하는 중…' });
    p.rehearsal.breaths = r; touch(p); render();
  } catch (e) { if (e.message !== 'no-ai') toast('오류: ' + e.message, 5000); }
}
function insertBreathMarks(p) {
  const marks = (p.rehearsal.breaths && p.rehearsal.breaths.marks) || [];
  const div = document.createElement('div');
  div.innerHTML = p.draft.html;
  let ok = 0;
  const norm = s => s.replace(/\s+/g, ' ').trim();
  for (const mk of marks) {
    const tail = norm(mk.sentence).slice(-24); // 문장 끝부분으로 위치를 찾는다
    if (tail.length < 6) continue;
    const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const t = norm(node.textContent);
      const idx = t.indexOf(tail);
      if (idx < 0) continue;
      // 원본 텍스트에서 tail 끝 위치 찾기 (공백 차이를 감안해 마지막 8자로 재탐색)
      const rawIdx = node.textContent.indexOf(tail.slice(-8));
      if (rawIdx < 0) break;
      const cut = rawIdx + 8;
      const rest = node.textContent.slice(cut);
      node.textContent = node.textContent.slice(0, cut);
      const span = document.createElement('span');
      span.contentEditable = 'false';
      if (mk.kind === '멈춤') { span.className = 'pause-mark'; span.textContent = '⏸' + (mk.seconds || 2) + '초'; span.title = mk.posture || ''; }
      else { span.className = 'breath-mark'; span.textContent = '∕'; }
      const after = document.createTextNode(rest);
      node.parentNode.insertBefore(span, node.nextSibling);
      node.parentNode.insertBefore(after, span.nextSibling);
      ok++;
      break;
    }
  }
  p.draft.html = div.innerHTML;
  touch(p); render();
  toast(ok + '곳에 표시를 삽입했습니다.' + (ok < marks.length ? ' (' + (marks.length - ok) + '곳은 문장을 찾지 못했습니다)' : ''));
}
/* ── 원고 위치 보기: 제스처·쉼멈춤을 본문에 표시하고, 표시를 누르면 옆에 설명 ── */
const CIRC = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩','⑪','⑫','⑬','⑭','⑮','⑯','⑰','⑱','⑲','⑳'];
function markScriptHtml(html, items, spanFor) {
  const div = document.createElement('div');
  div.innerHTML = html;
  const norm = t => t.replace(/\s+/g, ' ').trim();
  let found = 0;
  items.forEach((it, i) => {
    const tail = norm(it.sentence || '').slice(-24);
    if (tail.length < 6) return;
    const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const t = norm(node.textContent);
      if (t.indexOf(tail) < 0) continue;
      const rawIdx = node.textContent.indexOf(tail.slice(-8));
      if (rawIdx < 0) break;
      const cut = rawIdx + 8;
      const rest = node.textContent.slice(cut);
      node.textContent = node.textContent.slice(0, cut);
      const tmp = document.createElement('span');
      tmp.innerHTML = spanFor(it, i);
      const el = tmp.firstChild;
      const after = document.createTextNode(rest);
      node.parentNode.insertBefore(el, node.nextSibling);
      node.parentNode.insertBefore(after, el.nextSibling);
      found++;
      break;
    }
  });
  return { html: div.innerHTML, found };
}
function openMarkedScript(p, type) {
  const r = p.rehearsal || {};
  const G = (r.gestures && r.gestures.gestures) || [];
  const B = (r.breaths && r.breaths.marks) || [];
  const S = (r.stress && r.stress.marks) || [];
  // 한 종류만 볼 때 / 세 가지를 함께 볼 때
  const want = type === 'all' ? ['gestures', 'breaths', 'stress']
             : type === 'gestures' ? ['gestures'] : type === 'stress' ? ['stress'] : ['breaths'];
  const pool = [];
  if (want.includes('gestures')) G.forEach((x, i) => pool.push({ kindType: 'gestures', it: x, n: i }));
  if (want.includes('breaths')) B.forEach((x, i) => pool.push({ kindType: 'breaths', it: x, n: i }));
  if (want.includes('stress')) S.forEach((x, i) => pool.push({ kindType: 'stress', it: x, n: i }));
  if (!pool.length) {
    toast(type === 'all'
      ? '먼저 위의 [제스처] · [쉼·멈춤] · [강약] 중 하나 이상을 받아 주세요.'
      : '먼저 추천을 받아 주세요.', 4500);
    return;
  }
  // ① 문장 끝에 붙는 표시(제스처·쉼멈춤)를 먼저 심는다
  const endMarks = pool.filter(x => x.kindType !== 'stress');
  const res = markScriptHtml(p.draft.html, endMarks.map(x => x.it), (it, i) => {
    const e = endMarks[i];
    const gi = pool.indexOf(e);
    return e.kindType === 'gestures'
      ? `<button class="gmark" data-mi="${gi}" title="누르면 설명이 나옵니다">🖐${CIRC[e.n] || (e.n + 1)}</button>`
      : `<button class="gmark bmark" data-mi="${gi}" title="누르면 설명이 나옵니다">${it.kind === '멈춤' ? '⏸' + (it.seconds || 2) + '초' : '∕'}</button>`;
  });
  // ② 강약은 문장 속 낱말을 감싼다
  let html = res.html, stressFound = 0;
  if (want.includes('stress') && S.length) {
    const d = document.createElement('div');
    d.innerHTML = html;
    for (const e of pool.filter(x => x.kindType === 'stress')) {
      const word = (e.it.word || '').trim();
      if (word.length < 2) continue;
      const gi = pool.indexOf(e);
      const walker = document.createTreeWalker(d, NodeFilter.SHOW_TEXT);
      let node, done = false;
      while (!done && (node = walker.nextNode())) {
        if (node.parentElement && node.parentElement.closest('.smark,.gmark')) continue;
        const idx = node.textContent.indexOf(word);
        if (idx < 0) continue;
        const txt = node.textContent;
        const btn = document.createElement('button');
        btn.className = 'smark' + (e.it.level === '강' ? ' smark-strong' : '');
        btn.dataset.mi = gi; btn.textContent = word; btn.title = '누르면 설명이 나옵니다';
        const parent = node.parentNode;
        parent.insertBefore(document.createTextNode(txt.slice(0, idx)), node);
        parent.insertBefore(btn, node);
        parent.insertBefore(document.createTextNode(txt.slice(idx + word.length)), node);
        parent.removeChild(node);
        stressFound++; done = true;
      }
    }
    html = d.innerHTML;
  }
  const titles = { all: '낭독 표시 원고 — 제스처 · 쉼멈춤 · 강약', gestures: '제스처 위치 — 설교 원고', breaths: '쉼·멈춤 위치 — 설교 원고', stress: '강약 위치 — 설교 원고' };
  const legend = [
    want.includes('gestures') && G.length ? '<span class="lg"><b class="gmark" style="pointer-events:none">🖐</b> 제스처</span>' : '',
    want.includes('breaths') && B.length ? '<span class="lg"><b class="gmark bmark" style="pointer-events:none">∕ ⏸</b> 쉼·멈춤</span>' : '',
    want.includes('stress') && S.length ? '<span class="lg"><b class="smark smark-strong" style="pointer-events:none">강약</b> 힘주는 낱말</span>' : '',
  ].filter(Boolean).join('');
  const body = modal(titles[type] || titles.all, `
    <div class="ms-legend">${legend}<span style="opacity:.75;font-size:.76rem">표시를 누르면 오른쪽에 설명이 나옵니다 · ${res.found + stressFound}곳 표시됨</span></div>
    <div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap">
      <div class="stream-preview" id="ms-text" style="flex:2;min-width:260px;max-height:56vh;overflow:auto">${html}</div>
      <div id="ms-side" style="flex:1;min-width:200px"><p style="font-size:.84rem;color:var(--ink-soft)">👈 본문의 표시를 눌러 보세요.</p></div>
    </div>`);
  body.querySelectorAll('.gmark,.smark').forEach(el => el.addEventListener('click', () => {
    body.querySelectorAll('.on').forEach(x => x.classList.remove('on'));
    el.classList.add('on');
    const e = pool[+el.dataset.mi];
    if (!e) return;
    const it = e.it;
    $('#ms-side').innerHTML =
      e.kindType === 'gestures' ? `
      <div class="gesture" style="margin:0">
        <div class="g-sent">${CIRC[e.n] || ''} "${esc(it.sentence)}" <span class="badge">${esc(it.position || '')}</span></div>
        ${gestureArtHtml(it)}
        <div style="font-size:.9rem;margin:6px 0"><b>${esc(it.gesture)}</b></div>
        <div class="g-grid">
          <span><b>손</b> ${esc(it.hands)}</span><span><b>몸</b> ${esc(it.body)}</span>
          <span><b>시선</b> ${esc(it.eyes)}</span><span><b>표정</b> ${esc(it.face)}</span>
          <span><b>속도</b> ${esc(it.pace)}</span><span><b>멈춤</b> ${esc(it.pauseSec)}초</span>
        </div>
        <div style="font-size:.8rem;color:var(--ink-soft);margin-top:6px">이유 — ${esc(it.why)}</div>
      </div>`
      : e.kindType === 'stress' ? `
      <div class="fb-item" style="background:var(--lime);margin:0">
        <b>${HOW_ICON[it.how] || '↗'} ${esc(it.word)}</b>
        <div style="font-size:.84rem;margin-top:4px"><b>${esc(it.level || '')}</b> · ${esc(it.how || '')}</div>
        <div style="font-size:.8rem;margin-top:6px;opacity:.9">"${esc(it.sentence)}"</div>
        <div style="font-size:.78rem;opacity:.85;margin-top:4px">${esc(it.why || '')}</div>
      </div>` : `
      <div class="fb-item" style="background:${it.kind === '멈춤' ? 'var(--lilac)' : 'var(--mint)'};margin:0">
        <b>${it.kind === '멈춤' ? '⏸ 멈춤 ' + esc(it.seconds) + '초' : '∕ 쉼'}</b>
        "${esc(it.sentence)}"
        ${it.posture ? `<div style="font-size:.8rem;margin-top:4px"><b>포즈</b> ${esc(it.posture)}</div>` : ''}
        <div style="font-size:.78rem;opacity:.85;margin-top:4px">${esc(it.why)}</div>
      </div>`;
  }));
}
async function getFeedback(p) {
  try {
    setProgressEta(200, ['내용을 점검하는 중…', '전달을 점검하는 중…', '문장을 하나씩 보는 중…', '피드백을 정리하는 중…']);
    const r = await callAIJson('feedback', {
      homiletical: p.central.homiletical, purpose: p.inputs.purpose, audience: p.inputs.audience,
      targetMin: p.inputs.targetMin, cpm: DB.settings.cpm, draft: draftText() || htmlToText(p.draft.html),
    }, { label: '원고를 점검하는 중…' });
    p.rehearsal.feedback = r; touch(p); render();
  } catch (e) { if (e.message !== 'no-ai') toast('오류: ' + e.message, 5000); }
}
/* 천재화 — 평가와 아이디어 */
async function getGenius(p) {
  syncEditor();
  try {
    setProgressEta(230, ['원고를 정독하는 중…', '가장 빛나는 문장을 찾는 중…', '힘 빠지는 대목을 짚는 중…', '천재화 아이디어를 짓는 중…', '정리하는 중…']);
    const r = await callAIJson('genius', {
      ref: p.passage.ref, homiletical: p.central.homiletical,
      purpose: p.inputs.purpose, audience: p.inputs.audience, targetMin: p.inputs.targetMin,
      draft: htmlToText(p.draft.html).slice(0, 16000),
    }, { label: '천재 설교 코치의 눈으로 원고를 다시 보는 중…' });
    p.rehearsal.genius = r; p.rehearsal.geniusAt = Date.now();
    touch(p); render();
    const box = $('#s5-gn');
    if (box) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) { if (e.message !== 'no-ai') toast('오류: ' + e.message, 5000); }
}
function renderGenius(p, g) {
  const sc = g.score || {};
  const bars = [['한 가지 선명함', sc.clarity], ['기억에 남음', sc.memorability], ['긴장과 흡인력', sc.tension], ['구체성', sc.concreteness], ['복음적 깊이', sc.gospel]]
    .filter(([, v]) => typeof v === 'number');
  const dull = (g.dullest || []).filter(x => x && x.sentence);
  const ideas = (g.geniusIdeas || []).filter(x => x && x.idea);
  const cuts = (g.cutList || []).filter(Boolean);
  return `
    <div class="genius-box">
      <h4 style="margin-top:18px">💎 천재화 — 평가와 아이디어</h4>
      ${g.verdict ? `<div class="gn-verdict">${esc(g.verdict)}</div>` : ''}
      ${bars.length ? `<div class="gn-scores">
        ${bars.map(([k, v]) => `<div class="gn-score"><span class="gn-k">${k}</span>
          <span class="gn-bar"><i style="width:${v * 10}%"></i></span><span class="gn-v">${v}</span></div>`).join('')}
      </div>${sc.comment ? `<p class="gn-note">${esc(sc.comment)}</p>` : ''}` : ''}

      ${g.brightest && g.brightest.sentence ? `
      <div class="gn-card gn-bright">
        <div class="gn-title">✨ 가장 빛나는 문장</div>
        <blockquote>"${esc(g.brightest.sentence)}"</blockquote>
        ${g.brightest.why ? `<p>${esc(g.brightest.why)}</p>` : ''}
        ${g.brightest.howToBuildAround ? `<div class="meta"><b>이 문장을 축으로 재구성하려면</b> ${esc(g.brightest.howToBuildAround)}</div>` : ''}
      </div>` : ''}

      ${dull.length ? `<div class="gn-card">
        <div class="gn-title">🪫 힘이 빠지는 문장</div>
        ${dull.map(d => `<div class="gn-dull">
          <blockquote>"${esc(d.sentence)}"</blockquote>
          ${d.problem ? `<div class="meta"><b>문제</b> ${esc(d.problem)}</div>` : ''}
          ${d.rewrite ? `<div class="meta gn-fix"><b>이렇게</b> ${esc(d.rewrite)}</div>` : ''}
        </div>`).join('')}
      </div>` : ''}

      ${ideas.length ? `<div class="gn-card gn-ideas">
        <div class="gn-title">💡 천재화 아이디어</div>
        ${ideas.map((x, i) => `<div class="gn-idea">
          <b>${i + 1}. ${esc(x.idea)}</b>
          ${x.how ? `<p>${esc(x.how)}</p>` : ''}
          ${x.effect ? `<div class="meta"><b>기대 효과</b> ${esc(x.effect)}</div>` : ''}
        </div>`).join('')}
      </div>` : ''}

      ${g.oneImage ? `<div class="gn-card"><div class="gn-title">🖼 하나의 이미지로 관통하기</div><p>${esc(g.oneImage)}</p></div>` : ''}
      ${(g.openingLine || g.closingLine) ? `<div class="gn-card">
        <div class="gn-title">🎬 첫 문장 · 마지막 문장</div>
        ${g.openingLine ? `<div class="meta"><b>첫 문장</b> ${esc(g.openingLine)}</div>` : ''}
        ${g.closingLine ? `<div class="meta"><b>마지막 문장</b> ${esc(g.closingLine)}</div>` : ''}
      </div>` : ''}
      ${cuts.length ? `<div class="gn-card"><div class="gn-title">✂️ 잘라낼 것</div>
        ${cuts.map(c => `<div class="meta">${esc(c)}</div>`).join('')}</div>` : ''}
      ${g.riskCheck ? `<div class="ai-note"><b>놓치고 있는 것</b> — ${esc(g.riskCheck)}</div>` : ''}

      <div class="btn-row">
        <button class="btn btn-primary btn-sm" id="s5-gn-open">3단계로 가서 고치기</button>
        <button class="btn btn-ghost btn-sm" id="s5-gn-word">Word로 저장</button>
        <button class="btn btn-ghost btn-sm" id="s5-gn-again" ${aiConnected() ? '' : 'disabled'}>다시 받기 🤖</button>
      </div>
    </div>`;
}
function saveGeniusDoc(p) {
  const g = p.rehearsal.genius; if (!g) return;
  const esc2 = t => esc(t || '');
  const parts = [`<h1>천재화 리포트 — ${esc2(p.title || p.inputs.topic)}</h1>`,
    `<p><b>${esc2(p.passage.ref)}</b> · ${today()}</p>`,
    g.verdict ? `<p><b>진단</b> ${esc2(g.verdict)}</p>` : ''];
  if (g.brightest) parts.push(`<h2>가장 빛나는 문장</h2><p>"${esc2(g.brightest.sentence)}"</p><p>${esc2(g.brightest.why)}</p><p>${esc2(g.brightest.howToBuildAround)}</p>`);
  (g.dullest || []).forEach(d => parts.push(`<h3>고칠 문장</h3><p>"${esc2(d.sentence)}"</p><p>문제: ${esc2(d.problem)}</p><p>대안: ${esc2(d.rewrite)}</p>`));
  (g.geniusIdeas || []).forEach((x, i) => parts.push(`<h3>아이디어 ${i + 1} — ${esc2(x.idea)}</h3><p>${esc2(x.how)}</p><p>기대 효과: ${esc2(x.effect)}</p>`));
  if (g.oneImage) parts.push(`<h2>하나의 이미지</h2><p>${esc2(g.oneImage)}</p>`);
  if (g.openingLine) parts.push(`<p><b>첫 문장</b> ${esc2(g.openingLine)}</p>`);
  if (g.closingLine) parts.push(`<p><b>마지막 문장</b> ${esc2(g.closingLine)}</p>`);
  if ((g.cutList || []).length) parts.push(`<h2>잘라낼 것</h2>` + g.cutList.map(c => `<p>${esc2(c)}</p>`).join(''));
  if (g.riskCheck) parts.push(`<h2>놓치고 있는 것</h2><p>${esc2(g.riskCheck)}</p>`);
  const doc = `<html xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><style>${wordCss()}</style></head><body>${parts.join('')}</body></html>`;
  saveFileAs('천재화리포트_' + (p.title || p.inputs.topic || '설교').replace(/[\\/:*?"<>|]/g, '') + '.doc', doc, 'application/msword', 'Word 문서');
}
async function getGestures(p) {
  try {
    setProgressEta(90, ['원고의 결을 읽는 중…', '몸짓이 필요한 자리를 찾는 중…', '동작을 적는 중…']);
    const r = await callAIJson('gestures', { draft: htmlToText(p.draft.html) }, { label: '제스처 지점을 찾는 중…' });
    p.rehearsal.gestures = r; touch(p); render();
  } catch (e) { if (e.message !== 'no-ai') toast('오류: ' + e.message, 5000); }
}
/* FCF 찾기 (채플) */
async function runFcf(p) {
  try {
    setProgressEta(60, ['본문 속 인간의 문제를 찾는 중…', '오늘의 회중과 잇는 중…', '정리하는 중…']);
    const md = await callAI('fcf', {
      ref: p.passage.ref, passage: (p.passage.text || '').slice(0, 6000),
      needs: p.inputs.needs || p.inputs.purpose || '(입력 없음)',
    }, { label: '본문의 FCF를 찾는 중…' });
    p.central.fcfNote = md; touch(p);
    const body = modal('FCF 찾기 — ' + p.passage.ref, `
      <div class="stream-preview" style="max-height:56vh">${mdToHtml(md)}</div>
      <div class="btn-row"><button class="btn btn-ghost btn-sm" id="fcf-copy">📋 복사</button>
      <span style="font-size:.76rem;opacity:.85">결과는 프로젝트에 자동 저장되었습니다. 프롬프트는 설정 → 프롬프트 관리의 "2단계 · FCF 찾기"에서 수정할 수 있습니다.</span></div>`);
    body.querySelector('#fcf-copy').addEventListener('click', () => { navigator.clipboard.writeText(md); toast('복사했습니다.'); });
  } catch (e) { if (e.message !== 'no-ai') toast('오류: ' + e.message, 5000); }
}
/* 리허설 모드 */
function startRehearsal(p) {
  const paras = htmlToParas(p.draft.html);
  if (!paras.length) { toast('원고가 비어 있습니다.'); return; }
  const ov = document.createElement('div');
  ov.id = 'rehearsal';
  ov.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;max-width:900px;margin:0 auto 10px;width:100%">
      <div style="font-family:var(--serif);color:var(--gold-light)">${esc(p.title || p.inputs.topic)} · ${esc(p.passage.ref)} · 목표 ${p.inputs.targetMin}분</div>
      <button id="rh-close" style="background:none;border:none;color:var(--cream);font-size:1.5rem;cursor:pointer">✕</button>
    </div>
    <div id="rehearsal-text">${paras.map((h, i) => `<div class="para ${i === 0 ? 'now' : ''}" data-i="${i}">${h}</div>`).join('')}</div>
    <div id="rehearsal-bar">
      <button id="rh-prev">◀ 이전</button>
      <span class="timer" id="rh-timer">00:00</span>
      <button id="rh-startstop">▶ 시작</button>
      <button id="rh-next">다음 ▶</button>
      <button id="rh-finish">끝내고 기록</button>
    </div>`;
  document.body.appendChild(ov);
  let idx = 0, t0 = null, elapsed = 0, tick = null;
  const upd = () => {
    ov.querySelectorAll('.para').forEach((el, i) => el.classList.toggle('now', i === idx));
    const now = ov.querySelector('.para.now');
    if (now) now.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };
  const fmt = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  const startstop = () => {
    if (tick) { elapsed += (Date.now() - t0) / 1000; clearInterval(tick); tick = null; $('#rh-startstop').textContent = '▶ 계속'; }
    else { t0 = Date.now(); tick = setInterval(() => { $('#rh-timer').textContent = fmt(elapsed + (Date.now() - t0) / 1000); }, 500); $('#rh-startstop').textContent = '⏸ 일시정지'; }
  };
  const nav = d => { idx = Math.max(0, Math.min(paras.length - 1, idx + d)); upd(); };
  $('#rh-startstop').addEventListener('click', startstop);
  $('#rh-prev').addEventListener('click', () => nav(-1));
  $('#rh-next').addEventListener('click', () => nav(1));
  const keyH = e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); nav(1); }
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); nav(-1); }
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', keyH);
  const close = () => { clearInterval(tick); document.removeEventListener('keydown', keyH); ov.remove(); };
  $('#rh-close').addEventListener('click', close);
  $('#rh-finish').addEventListener('click', () => {
    const total = elapsed + (tick ? (Date.now() - t0) / 1000 : 0);
    if (total > 5) {
      p.rehearsal.runs.push({ ts: Date.now(), seconds: Math.round(total) });
      touch(p);
      toast('연습 기록 저장: ' + fmt(total) + ' (목표 ' + p.inputs.targetMin + '분)');
    }
    close(); render();
  });
}
function htmlToParas(html) {
  const div = document.createElement('div'); div.innerHTML = html;
  return Array.from(div.children).map(el => el.outerHTML).filter(h => htmlToText(h).trim().length > 0);
}

/* ═══════════════════ 자료 서랍 ═══════════════════ */
const MAT_TYPES = ['예화', '통계', '간증', '인용', '메모'];
const MAT_COLORS = { '예화': 'var(--cream)', '통계': 'var(--mint)', '간증': 'var(--pink)', '인용': 'var(--lilac)', '메모': 'var(--lime)' };
function renderMaterials(m) {
  m.innerHTML = `
    <div class="step-head">MATERIALS</div>
    <h1 class="step-title">자료 서랍</h1>
    <p class="step-desc">예화·통계·간증·인용·메모를 모아 두는 서랍입니다. 여기 담긴 자료는 설교문 작성 때 AI가 필요한 곳곳에 인용해 활용합니다.</p>
    <div class="card">
      <h3>자료 담기 — 끌어다 놓기 · 붙여넣기</h3>
      <div id="ref-drop" class="dropzone">
        <svg class="nav-ico" viewBox="0 0 24 24" style="width:22px;height:22px"><path d="M12 3v10m0 0l-4-4m4 4l4-4M4 15v4a2 2 0 002 2h12a2 2 0 002-2v-4"/></svg>
        <span>여기에 자료를 끌어다 놓으세요 (또는 클릭해서 파일 선택)<br><small>텍스트·마크다운은 바로 담고, 사진·PDF는 AI가 내용을 읽어 담습니다</small></span>
        <input id="ref-file" type="file" multiple accept=".txt,.md,.text,image/png,image/jpeg,image/webp,application/pdf" style="display:none">
      </div>
      <div class="paste-row">
        <textarea id="ref-paste" placeholder="한글(HWP)·워드 등에서 복사한 자료를 여기 붙여넣고 → 담기"></textarea>
        <button class="btn btn-ghost btn-sm" id="ref-paste-add">담기</button>
      </div>
    </div>
    <div class="card">
      <h3>직접 적어 넣기</h3>
      <div class="form-grid">
        <div class="field"><label>종류</label><select id="mat-type">${MAT_TYPES.map(t => `<option>${t}</option>`).join('')}</select></div>
        <div class="field"><label>제목 *</label><input id="mat-title" placeholder="예: 등대지기 이야기"></div>
        <div class="field full"><label>내용 *</label><textarea id="mat-content" style="min-height:100px" placeholder="자료 본문. 출처가 있으면 함께 적어 두세요."></textarea></div>
        <div class="field full"><label>태그 <span class="opt">(쉼표로 구분 — 예: 위로, 믿음)</span></label><input id="mat-tags"></div>
      </div>
      <div class="btn-row"><button class="btn btn-primary" id="mat-add">서랍에 넣기</button></div>
    </div>
    <div class="proj-toolbar"><input id="mat-q" placeholder="🔍 자료 검색 (제목·내용·태그)"></div>
    <div id="mat-list">${renderMatList('')}</div>`;
  $('#mat-add').addEventListener('click', () => {
    const t = $('#mat-title').value.trim(), c = $('#mat-content').value.trim();
    if (!t || !c) { toast('제목과 내용을 채워 주세요.'); return; }
    DB.materials.unshift({ id: uid(), type: $('#mat-type').value, title: t, content: c, tags: $('#mat-tags').value.trim(), createdAt: Date.now() });
    save(true); render(); toast('서랍에 넣었습니다.');
  });
  $('#mat-q').addEventListener('input', e => { $('#mat-list').innerHTML = renderMatList(e.target.value); bindMatList(); });
  bindMatList();
  bindRefDrop();
}
function renderMatList(q) {
  let list = DB.materials;
  if (q) { const s = q.toLowerCase(); list = list.filter(x => (x.title + x.content + x.tags + x.type).toLowerCase().includes(s)); }
  if (!list.length) return '<div class="card"><p style="opacity:.858">아직 자료가 없습니다. 위에서 첫 자료를 넣어 보세요.</p></div>';
  return list.map(x => `
    <div class="card" style="padding:18px 20px">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <span class="badge" style="background:${MAT_COLORS[x.type] || 'var(--surface-soft)'}">${esc(x.type)}</span>
        <b style="flex:1">${esc(x.title)}</b>
        ${x.tags ? `<span style="font-size:.7rem;opacity:.858">${esc(x.tags)}</span>` : ''}
        <button class="btn btn-danger btn-sm" data-matdel="${x.id}">삭제</button>
      </div>
      <div style="font-size:.86rem;margin-top:8px;white-space:pre-wrap">${esc(x.content)}</div>
    </div>`).join('');
}
function bindMatList() {
  $$('#mat-list [data-matdel]').forEach(b => b.addEventListener('click', () => {
    if (confirm('이 자료를 삭제할까요?')) { DB.materials = DB.materials.filter(x => x.id !== b.dataset.matdel); save(true); render(); }
  }));
}
function materialsSlot(ids) {
  const sel = DB.materials.filter(x => !ids || ids.includes(x.id));
  if (!sel.length) return '(없음)';
  return sel.map(x => `- [${x.type}] ${x.title}: ${x.content}${x.tags ? ' (태그: ' + x.tags + ')' : ''}`).join('\n');
}

/* ═══════════════════ 설교 피드백 클리닉 ═══════════════════ */
function renderClinic(m) {
  m.innerHTML = `
    <div class="step-head">FEEDBACK CLINIC</div>
    <h1 class="step-title">설교 피드백</h1>
    <p class="step-desc">설교 원고나 영상을 넣으면 『들리는 설교, 끌리는 설교』의 기준 — 원고 내용·시선·발음·완급·유머·제스처 — 으로 진단하고 <b>종합 리포트</b>를 작성합니다.</p>
    <div class="card">
      <h3>진단할 설교 넣기</h3>
      <div class="chip-row">
        ${cur() && htmlToText(cur().draft.html).length > 100 ? `<button class="chip" id="cl-current">현재 프로젝트 원고 불러오기</button>` : ''}
        <label class="chip" style="cursor:pointer">📄 워드·텍스트 파일<input id="cl-file" type="file" accept=".docx,.txt,.md,.text" style="display:none"></label>
        <label class="chip" style="cursor:pointer">📷 사진·PDF 원고 인식 🤖<input id="cl-img" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" style="display:none"></label>
      </div>
      <div class="field" style="margin-top:8px"><label>▶ 유튜브 설교 영상 (자막으로 진단)</label>
        <div style="display:flex;gap:8px"><input id="cl-yt" placeholder="https://www.youtube.com/watch?v=..." style="flex:1">
        <button class="btn btn-ghost btn-sm" id="cl-yt-go">자막 가져오기</button></div>
        <div class="hint">음성·영상 파일 직접 분석은 다음 버전에서 지원합니다. 영상은 유튜브 링크(자막)로 넣어 주세요.</div></div>
      <div class="field" style="margin-top:8px"><label>설교 원고 / 자막</label>
        <textarea id="cl-text" style="min-height:160px" placeholder="원고를 붙여넣거나, 위에서 가져오세요"></textarea></div>
      <div id="cl-status" style="font-size:.8rem;margin:6px 0"></div>
      <div class="btn-row">
        <button class="btn btn-primary" id="cl-run" ${aiConnected() ? '' : 'disabled'}>피드백 리포트 작성 🤖 (2~5분)</button>
        ${!aiConnected() ? '<span style="font-size:.78rem;color:var(--magenta)">AI 미연결 — 설정에서 연결해 주세요</span>' : ''}
      </div>
    </div>
    <div id="cl-report"></div>
    ${DB.reports.length ? `<div class="card"><h3>지난 리포트 (${DB.reports.length})</h3>
      ${DB.reports.map((r, i) => `<div style="display:flex;gap:10px;align-items:center;padding:7px 0;border-bottom:1px solid var(--hairline-soft);font-size:.86rem">
        <span style="flex:1"><b>${esc(r.title)}</b> — ${new Date(r.ts).toLocaleString('ko-KR')}</span>
        <button class="btn btn-ghost btn-sm" data-rview="${i}">보기</button>
        <button class="btn btn-ghost btn-sm" data-rsave="${i}">Word 저장</button>
        <button class="btn btn-danger btn-sm" data-rdel="${i}">삭제</button>
      </div>`).join('')}</div>` : ''}`;
  const setStatus = (msg, working) => { $('#cl-status').innerHTML = working ? '⏳ ' + esc(msg) : esc(msg); };
  if (clinicPrefill) {
    $('#cl-text').value = clinicPrefill; clinicPrefill = '';
    setStatus('가져오기에서 원고를 불러왔습니다. 아래 [피드백 리포트 작성]을 누르세요.');
  }
  const curBtn = $('#cl-current');
  if (curBtn) curBtn.addEventListener('click', () => { $('#cl-text').value = htmlToText(cur().draft.html); setStatus('현재 프로젝트 원고를 불러왔습니다.'); });
  $('#cl-file').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      setStatus('파일을 읽는 중…', true);
      $('#cl-text').value = await readDroppedFile(f, m => setStatus(m, true));
      setStatus('✓ ' + f.name + ' 을 읽었습니다.');
    } catch (err) { setStatus('⚠ ' + err.message); }
  });
  $('#cl-img').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    setStatus('사진에서 원고를 인식하는 중… (1~3분)', true);
    const fr = new FileReader();
    fr.onload = async () => {
      try {
        const j = await (await fetch('/api/ocr', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data: String(fr.result).split(',')[1], mime: f.type, model: DB.settings.model }) })).json();
        if (j.error) return setStatus('⚠ ' + j.error);
        $('#cl-text').value = j.text; setStatus('원고를 인식했습니다.');
      } catch (err) { setStatus('⚠ 인식 실패: ' + err.message); }
    };
    fr.readAsDataURL(f);
  });
  $('#cl-yt-go').addEventListener('click', async () => {
    const u = $('#cl-yt').value.trim(); if (!u) return toast('유튜브 주소를 넣어 주세요.');
    setStatus('유튜브 자막을 가져오는 중…', true);
    try {
      const j = await (await fetch('/api/youtube?url=' + encodeURIComponent(u))).json();
      if (j.error) return setStatus('⚠ ' + j.error);
      $('#cl-text').value = (j.title ? j.title + '\n\n' : '') + j.text;
      setStatus('자막을 가져왔습니다: ' + (j.title || ''));
    } catch (err) { setStatus('⚠ 실패: ' + err.message); }
  });
  $('#cl-run').addEventListener('click', async () => {
    const text = $('#cl-text').value.trim();
    if (text.length < 100) return toast('진단할 원고가 너무 짧습니다.');
    try {
      setProgressEta(300, ['원고를 정독하는 중…', '내용을 진단하는 중…', '전달을 진단하는 중…', '리포트를 쓰는 중…']);
      const md = await callAI('sermonReport', {
        text: text.slice(0, 30000),
        source: $('#cl-yt').value.trim() || '직접 입력',
      }, { label: '책의 기준으로 설교를 진단하는 중… (처음 1~3분은 분석 시간입니다)' });
      const title = (md.match(/\*\*분석 대상\*\*\s*([^\n·]+)/) || md.match(/^# ?(.+)/m) || [, '설교 리포트'])[1].trim().slice(0, 60);
      DB.reports.unshift({ ts: Date.now(), title, md });
      if (DB.reports.length > 30) DB.reports.pop();
      save(true); render();
      $('#cl-report').innerHTML = `<div class="card"><h3>📋 방금 작성된 리포트</h3>${mdToHtml(md)}</div>`;
      $('#cl-report').scrollIntoView({ behavior: 'smooth' });
    } catch (e) { if (e.message !== 'no-ai') toast('오류: ' + e.message, 6000); }
  });
  m.querySelectorAll('[data-rview]').forEach(b => b.addEventListener('click', () => {
    const r = DB.reports[+b.dataset.rview];
    $('#cl-report').innerHTML = `<div class="card"><h3>📋 ${esc(r.title)}</h3>${mdToHtml(r.md)}</div>`;
    $('#cl-report').scrollIntoView({ behavior: 'smooth' });
  }));
  m.querySelectorAll('[data-rsave]').forEach(b => b.addEventListener('click', () => {
    const r = DB.reports[+b.dataset.rsave];
    const doc = `<html xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><style>${wordCss()}</style></head><body>${mdToHtml(r.md)}</body></html>`;
    saveFileAs('설교피드백_' + r.title.replace(/[\\/:*?"<>|]/g, '') + '.doc', doc, 'application/msword', 'Word 문서');
  }));
  m.querySelectorAll('[data-rdel]').forEach(b => b.addEventListener('click', () => {
    if (confirm('이 리포트를 삭제할까요?')) { DB.reports.splice(+b.dataset.rdel, 1); save(true); render(); }
  }));
}

let clinicPrefill = '';
/* ═══════════════════ 프롬프트 서재 ═══════════════════ */
const PROMPT_TARGETS = [
  ['', '보관만 (자동 적용 안 함)'], ['sermon', '설교문 작성'], ['central', '중심사상'],
  ['partial', '부분 재작성·제목'], ['formatConvert', '형식 변환'], ['sermonReport', '설교 피드백'],
  ['recommend', '본문 추천'], ['feedback', '연습하기 피드백'],
];
function renderPromptLibrary(m) {
  const keys = Object.keys(window.MSGB_PROMPTS);
  m.innerHTML = `
    <div class="step-head">PROMPT LIBRARY</div>
    <h1 class="step-title">프롬프트 서재</h1>
    <p class="step-desc"><b>설교작성 프롬프트</b>는 각 단계별 작업의 기본 지시서(안에 <b>시스템 프롬프트</b>와 <b>작업주문 프롬프트</b> 두 부분이 있음)이고, <b>세부작성 프롬프트</b>는 그 위에 내가 덧붙이는 추가 지시입니다. 네 가지의 특성과 차이는 설정 → 사용 설명서 8번에 표로 정리되어 있습니다.</p>

    <div class="card">
      <h3>세부작성 프롬프트 <span class="opt" style="font-weight:400;font-size:.76rem">— 내가 덧붙이는 추가 지시. 지정한 단계에 자동 결합됩니다</span></h3>
      <div id="pl-refs">
        ${DB.refPrompts.map((r, i) => `
          <div class="fb-item" style="background:var(--surface-soft)">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px">
              <input data-rpname="${i}" value="${esc(r.name)}" style="flex:1;min-width:160px;padding:7px 10px;border:1px solid var(--hairline);border-radius:8px;font-weight:600">
              <select data-rptarget="${i}" style="padding:7px 10px;border:1px solid var(--hairline);border-radius:8px">
                ${PROMPT_TARGETS.map(([v, l]) => `<option value="${v}" ${r.target === v ? 'selected' : ''}>${l}</option>`).join('')}
              </select>
              <button class="btn btn-danger btn-sm" data-rpdel="${i}">삭제</button>
            </div>
            <textarea data-rptext="${i}" style="width:100%;min-height:90px;padding:10px;border:1px solid var(--hairline);border-radius:8px;font-size:.84rem;line-height:1.6">${esc(r.text)}</textarea>
          </div>`).join('')}
      </div>
      <div class="btn-row">
        <button class="btn btn-primary btn-sm" id="pl-refsave">세부작성 프롬프트 저장</button>
        <button class="btn btn-ghost btn-sm" id="pl-refadd">＋ 새 세부작성 프롬프트</button>
      </div>
      <p class="ai-note"><b>클로드 프로젝트의 항목별 프롬프트를 넣는 자리가 바로 여기입니다.</b> ① [＋ 새 세부작성 프롬프트] → ② 이름 칸에 항목 이름(예: big idea) → ③ 내용 칸에 프롬프트 전문 붙여넣기 → ④ 적용 단계 지정(예: big idea→중심사상, title→부분 재작성·제목, 설교형식→형식 변환. 애매하면 "보관만").<br>
<b>dodo 프롬프트</b>는 원문 그대로 옮겨 심어 설교문 작성에 이미 적용 중이고, big idea·설교형식·honor는 내용만 채우면 됩니다.</p>
    </div>

    <div class="card">
      <h3>설교작성 프롬프트 <span class="opt" style="font-weight:400;font-size:.76rem">— 각 단계별 작업의 기본 지시서. 수정하면 이 브라우저에 저장됩니다</span></h3>
      <div class="field"><label>프롬프트 선택</label>
        <select id="pl-key">${keys.map(k => `<option value="${k}">${esc(window.MSGB_PROMPTS[k].label)} ${DB.promptOverrides[k] ? '(수정됨)' : ''}</option>`).join('')}</select></div>
      <div class="field"><label>시스템 프롬프트 <span class="opt">(1부 — 역할과 원칙)</span></label><textarea id="pl-system" style="min-height:110px;font-family:var(--mono);font-size:.74rem"></textarea></div>
      <div class="field"><label>작업주문 프롬프트 <span class="opt">(2부 — 매번 보내는 주문서. {{빈칸}}은 앱이 채우는 자리, 지우지 마세요)</span></label><textarea id="pl-user" style="min-height:180px;font-family:var(--mono);font-size:.74rem"></textarea></div>
      <div class="btn-row">
        <button class="btn btn-primary btn-sm" id="pl-save">저장</button>
        <button class="btn btn-ghost btn-sm" id="pl-reset">기본값 복원</button>
      </div>
    </div>`;
  const grabRefs = () => {
    DB.refPrompts.forEach((r, i) => {
      const n = m.querySelector(`[data-rpname="${i}"]`), t = m.querySelector(`[data-rptarget="${i}"]`), x = m.querySelector(`[data-rptext="${i}"]`);
      if (n) { r.name = n.value.trim(); r.target = t.value; r.text = x.value; }
    });
  };
  $('#pl-refsave').addEventListener('click', () => { grabRefs(); save(true); toast('세부작성 프롬프트를 저장했습니다. 지정한 단계에 적용됩니다.'); });
  $('#pl-refadd').addEventListener('click', () => { grabRefs(); DB.refPrompts.push({ id: uid(), name: '새 프롬프트', target: '', text: '' }); save(true); render(); });
  m.querySelectorAll('[data-rpdel]').forEach(b => b.addEventListener('click', () => {
    if (confirm('이 세부작성 프롬프트를 삭제할까요?')) { grabRefs(); DB.refPrompts.splice(+b.dataset.rpdel, 1); save(true); render(); }
  }));
  const loadK = () => {
    const k = $('#pl-key').value;
    const base = window.MSGB_PROMPTS[k], ov = DB.promptOverrides[k] || {};
    $('#pl-system').value = ov.system || base.system;
    $('#pl-user').value = ov.user || base.user;
  };
  loadK();
  $('#pl-key').addEventListener('change', loadK);
  $('#pl-save').addEventListener('click', () => {
    DB.promptOverrides[$('#pl-key').value] = { system: $('#pl-system').value, user: $('#pl-user').value };
    save(true); toast('저장했습니다.');
  });
  $('#pl-reset').addEventListener('click', () => { delete DB.promptOverrides[$('#pl-key').value]; save(true); loadK(); toast('기본값으로 복원했습니다.'); });
}

/* ═══════════════════ 나의 작성 규칙 ═══════════════════ */
function openRules() {
  const s = DB.settings;
  const body = modal('나의 작성 규칙', `
    <p style="font-size:.84rem;opacity:.855">설교문 작성·부분 재작성 때 AI가 <b>반드시 지키는 규칙</b>입니다. 쓰면서 발견한 나만의 원칙을 여기에 계속 쌓아 가세요 — 모든 프로젝트에 적용됩니다.</p>
    <div class="field" style="margin-top:12px"><label>작성 규칙</label>
      <textarea id="ru-rules" style="min-height:180px;font-size:.9rem;line-height:1.7">${esc(s.rules)}</textarea></div>
    <div class="form-grid" style="margin-top:8px">
      <div class="field"><label>기본 문체·어조</label><input id="ru-style" value="${esc(s.style)}" placeholder="예: 따뜻한 존댓말 구어체"></div>
      <div class="field"><label>원고 글자 크기(px)</label><input id="ru-size" type="number" min="13" max="30" value="${s.editorSize}"></div>
      <div class="field"><label>낭독 속도(분당 글자)</label><input id="ru-cpm" type="number" min="180" max="450" value="${s.cpm}"></div>
      <div class="field"><label>기본 목표 시간(분)</label><input id="ru-min" type="number" min="5" max="90" value="${s.targetMin}"></div>
    </div>
    <div class="btn-row">
      <button class="btn btn-primary" id="ru-save">규칙 저장</button>
      <button class="btn btn-ghost" id="ru-reset">기본 규칙으로 되돌리기</button>
    </div>`);
  body.querySelector('#ru-save').addEventListener('click', () => {
    s.rules = $('#ru-rules').value; s.style = $('#ru-style').value.trim();
    s.editorSize = +$('#ru-size').value || 17; s.cpm = +$('#ru-cpm').value || 300;
    s.targetMin = +$('#ru-min').value || 25;
    save(true); closeModal(); render(); toast('규칙을 저장했습니다. 이후 모든 작성에 적용됩니다.');
  });
  body.querySelector('#ru-reset').addEventListener('click', () => { $('#ru-rules').value = defaultRules(); });
}

/* ═══════════════════ 가져오기 (파일·사진·유튜브) ═══════════════════ */
/* ═══════════════════ 워드(.docx) 파일 읽기 ═══════════════════ */
/* docx는 ZIP 안의 word/document.xml — 브라우저 내장 기능만으로 풀어 읽는다 */
async function readDocx(file) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('이 브라우저는 워드 파일 열기를 지원하지 않습니다. 크롬·사파리 최신 버전을 쓰거나, 워드에서 텍스트를 복사해 붙여넣어 주세요.');
  }
  const buf = new Uint8Array(await file.arrayBuffer());
  const dv = new DataView(buf.buffer);
  // ZIP 끝 기록(EOCD) 찾기
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('워드(.docx) 파일이 아닌 것 같습니다.');
  const count = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  let target = null;
  const dec = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(off, true) !== 0x02014b50) break;
    const method = dv.getUint16(off + 10, true);
    const compSize = dv.getUint32(off + 20, true);
    const nameLen = dv.getUint16(off + 28, true);
    const extraLen = dv.getUint16(off + 30, true);
    const cmtLen = dv.getUint16(off + 32, true);
    const localOff = dv.getUint32(off + 42, true);
    const name = dec.decode(buf.subarray(off + 46, off + 46 + nameLen));
    if (name === 'word/document.xml') { target = { method, compSize, localOff }; break; }
    off += 46 + nameLen + extraLen + cmtLen;
  }
  if (!target) throw new Error('문서 본문을 찾지 못했습니다. (.doc 옛 형식이면 워드에서 .docx로 저장해 주세요)');
  const lo = target.localOff;
  if (dv.getUint32(lo, true) !== 0x04034b50) throw new Error('파일이 손상된 것 같습니다.');
  const dataStart = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true);
  const data = buf.subarray(dataStart, dataStart + target.compSize);
  let xml;
  if (target.method === 0) xml = dec.decode(data);
  else {
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    xml = await new Response(stream).text();
  }
  return docxXmlToText(xml);
}
function docxXmlToText(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (!doc.documentElement) throw new Error('문서를 읽지 못했습니다.');
  const paras = [];
  (function walk(node) {
    for (const ch of node.children) {
      if (ch.localName === 'p') { paras.push(ch); continue; }
      walk(ch);
    }
  })(doc.documentElement);
  const text = paras.map(p => {
    let t = '';
    (function walk(n) {
      for (const ch of n.children) {
        const ln = ch.localName;
        if (ln === 't') t += ch.textContent;
        else if (ln === 'tab') t += '\t';
        else if (ln === 'br' || ln === 'cr') t += '\n';
        else walk(ch);
      }
    })(p);
    return t.trim();
  }).join('\n');
  return text.replace(/\n{3,}/g, '\n\n').trim();
}
/* 어떤 파일이든 알맞게 읽어 준다 */
async function readDroppedFile(file, onStatus) {
  const name = (file.name || '').toLowerCase();
  const say = m => { if (onStatus) onStatus(m); };
  if (name.endsWith('.docx')) {
    say('워드 파일을 여는 중…');
    const t = await readDocx(file);
    if (!t || t.length < 20) throw new Error('워드 파일에서 글을 찾지 못했습니다.');
    return t;
  }
  if (name.endsWith('.doc')) {
    throw new Error('옛 워드 형식(.doc)입니다. 워드에서 [다른 이름으로 저장] → .docx 로 저장한 뒤 다시 넣어 주세요.');
  }
  if (name.endsWith('.hwp') || name.endsWith('.hwpx')) {
    throw new Error('아래아한글 파일은 아직 지원하지 않습니다. 한글에서 [파일 → 다른 이름으로 저장] → 서식 있는 문서(.docx)나 텍스트(.txt)로 저장해 주세요.');
  }
  if (/^image\//.test(file.type) || name.endsWith('.pdf')) {
    if (aiStatus.serverless) throw new Error('사진·PDF 인식은 로컬 서버(실행.command)로 열었을 때만 됩니다.');
    say('사진에서 원고를 인식하는 중… (1~3분)');
    const b64 = await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result).split(',')[1]);
      fr.onerror = rej; fr.readAsDataURL(file);
    });
    const j = await (await fetch('/api/ocr', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: b64, mime: file.type, model: DB.settings.model }) })).json();
    if (j.error) throw new Error(j.error);
    return j.text;
  }
  say('파일을 읽는 중…');
  return await file.text();
}
function openImport() {
  const body = modal('가져오기 — 예전 설교를 M.Works로', `
    <p style="font-size:.84rem;opacity:.855">워드 파일을 끌어다 놓으면 바로 열립니다. 사진·PDF·유튜브·붙여넣기도 됩니다. 원고 전문이 아래 상자에 들어오므로 자유롭게 고치고, 새 프로젝트로 만들거나 바로 피드백 리포트를 받을 수 있습니다.</p>
    <label class="dropzone" id="im-drop" style="margin-top:14px">
      <span>📄 <b>여기로 파일을 끌어다 놓으세요</b> — 워드(.docx) · 텍스트(.txt .md) · 사진 · PDF</span>
      <small>또는 눌러서 파일 고르기 · 워드 파일은 바로 열려 이어서 작업할 수 있습니다</small>
      <input id="im-file" type="file" accept=".docx,.txt,.md,.text,image/png,image/jpeg,image/webp,application/pdf" style="display:none">
    </label>
    <div class="field" style="margin-top:10px"><label>▶ 유튜브 설교 영상 (자막을 원고로 추출)</label>
      <div style="display:flex;gap:8px"><input id="im-yt" placeholder="https://www.youtube.com/watch?v=..." style="flex:1">
      <button class="btn btn-ghost btn-sm" id="im-yt-go">자막 가져오기</button></div></div>
    <div class="field" style="margin-top:10px"><label>또는 원고 붙여넣기</label>
      <textarea id="im-paste" style="min-height:120px" placeholder="설교 원고 전체를 붙여넣으세요"></textarea></div>
    <div id="im-status" style="font-size:.8rem;margin-top:6px"></div>
    <div class="field" style="margin-top:10px"><label>가져온 뒤 시작할 단계</label>
      <div class="chip-row">
        <label class="chip" style="cursor:pointer"><input type="radio" name="im-step" value="3" checked> ③ 설교문 수정</label>
        <label class="chip" style="cursor:pointer"><input type="radio" name="im-step" value="4"> ④ 형식 결정</label>
        <label class="chip" style="cursor:pointer"><input type="radio" name="im-step" value="5"> ⑤ 연습·리허설</label>
      </div></div>
    <div class="btn-row">
      <button class="btn btn-primary" id="im-make">새 프로젝트로 만들기</button>
      <button class="btn btn-ghost" id="im-feedback">🩺 이 원고로 피드백 리포트 🤖</button>
      <button class="btn btn-ghost btn-sm" id="im-copy">📋 원고 복사</button>
    </div>
    <p style="font-size:.74rem;opacity:.8;margin-top:6px">AI 연결 시 제목·본문·중심사상을 자동 추출합니다. 유튜브 영상 진단은 자막(음성 원고)을 기준으로 하며, 몸짓·표정 등 화면 요소는 다음 버전에서 지원합니다.</p>`);
  let gotText = '';
  const setStatus = (msg, working) => { $('#im-status').innerHTML = working ? '⏳ ' + esc(msg) : esc(msg); };
  const takeFile = async f => {
    if (!f) return;
    try {
      setStatus('파일을 읽는 중…', true);
      const t = await readDroppedFile(f, m => setStatus(m, true));
      gotText = t;
      $('#im-paste').value = t;
      const chars = t.replace(/\s/g, '').length;
      setStatus('✓ ' + f.name + ' 을 읽었습니다 (' + chars.toLocaleString() + '자). 내용을 확인하고 아래에서 시작 단계를 고르세요.');
    } catch (err) { setStatus('⚠ ' + err.message); }
  };
  body.querySelector('#im-file').addEventListener('change', e => takeFile(e.target.files[0]));
  const dz = body.querySelector('#im-drop');
  ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); dz.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); dz.classList.remove('dragover'); }));
  dz.addEventListener('drop', e => takeFile(e.dataTransfer.files[0]));
  // 모달 어디에 떨어뜨려도 받아 준다
  body.addEventListener('dragover', e => e.preventDefault());
  body.addEventListener('drop', e => {
    if (e.target.closest('#im-drop')) return;
    e.preventDefault();
    if (e.dataTransfer.files[0]) takeFile(e.dataTransfer.files[0]);
  });
  body.querySelector('#im-yt-go').addEventListener('click', async () => {
    const u = $('#im-yt').value.trim(); if (!u) { toast('유튜브 주소를 넣어 주세요.'); return; }
    setStatus('유튜브 자막을 가져오는 중…', true);
    try {
      const j = await (await fetch('/api/youtube?url=' + encodeURIComponent(u))).json();
      if (j.error) { setStatus('⚠ ' + j.error); return; }
      gotText = (j.title ? j.title + '\n\n' : '') + j.text;
      $('#im-paste').value = gotText;
      setStatus('자막을 가져왔습니다 (' + (j.lang || '') + '). 내용을 확인해 주세요.');
    } catch (err) { setStatus('⚠ 실패: ' + err.message); }
  });
  body.querySelector('#im-make').addEventListener('click', async () => {
    const text = ($('#im-paste').value || gotText || '').trim();
    if (text.length < 50) { toast('원고가 너무 짧습니다. 먼저 내용을 가져와 주세요.'); return; }
    closeModal();
    let info = { title: '', ref: '', topic: '', purpose: '', homiletical: '' };
    if (aiConnected()) {
      setProgressEta(60, ['원고를 읽는 중…', '제목·본문을 찾는 중…', '중심사상을 뽑는 중…']);
      try { info = await callAIJson('importAnalyze', { text: text.slice(0, 9000) }, { label: '가져온 원고를 분석하는 중…' }); }
      catch (e) { /* 분석 실패해도 가져오기는 진행 */ }
    }
    const p = normProject({ id: uid(), title: info.title || '가져온 설교', createdAt: Date.now(), updatedAt: Date.now() });
    p.inputs.topic = info.topic || info.title || '가져온 설교';
    p.inputs.purpose = info.purpose || '';
    p.passage.ref = info.ref || ''; p.passage.confirmed = !!info.ref;
    p.central = Object.assign(p.central, { done: true, unit: '(가져온 원고)', homiletical: info.homiletical || '' });
    p.draft.html = textToHtml(text);
    const startStep = +(body.querySelector('input[name="im-step"]:checked') || { value: 3 }).value;
    p.step = startStep;
    DB.projects.unshift(p); curId = p.id; save(true);
    gotoStep(startStep);
    toast('가져오기 완료 — ' + startStep + '단계에서 시작합니다.');
  });
  body.querySelector('#im-copy').addEventListener('click', () => {
    const text = ($('#im-paste').value || gotText || '').trim();
    if (!text) return toast('복사할 원고가 없습니다.');
    navigator.clipboard.writeText(text); toast('원고를 복사했습니다.');
  });
  body.querySelector('#im-feedback').addEventListener('click', () => {
    const text = ($('#im-paste').value || gotText || '').trim();
    if (text.length < 100) return toast('원고가 너무 짧습니다. 먼저 내용을 가져와 주세요.');
    clinicPrefill = text;
    closeModal(); curView = 'clinic'; render();
  });
}
function textToHtml(text) {
  return text.split(/\n{2,}/).map(par => {
    const t = par.trim(); if (!t) return '';
    return '<p>' + esc(t).replace(/\n/g, '<br>') + '</p>';
  }).join('');
}

/* ═══════════════════ 보관함 ═══════════════════ */
let archiveQuery = '', archiveSort = 'updated';
function renderArchive(m) {
  let list = DB.projects.slice();
  if (archiveQuery) {
    const q = archiveQuery.toLowerCase();
    list = list.filter(p => (p.title + p.inputs.topic + p.passage.ref + p.inputs.series).toLowerCase().includes(q));
  }
  list.sort((a, b) => {
    if (archiveSort === 'updated') return (b.updatedAt || 0) - (a.updatedAt || 0);
    if (archiveSort === 'date') return (a.inputs.date || '9999') < (b.inputs.date || '9999') ? -1 : 1;
    if (archiveSort === 'fav') return (b.favorite - a.favorite) || (b.updatedAt - a.updatedAt);
    return 0;
  });
  const seriesGroups = {};
  list.forEach(p => { const s = p.inputs.series || ''; if (s) (seriesGroups[s] = seriesGroups[s] || []).push(p); });
  m.innerHTML = `
    <div class="step-head">보관함</div>
    <h1 class="step-title">프로젝트 보관함</h1>
    <p class="step-desc">모든 설교가 이 브라우저에 자동 저장됩니다. 중요한 원고는 <b>내보내기</b>와 <b>전체 백업</b>으로 파일로도 보관하세요.</p>
    <div class="proj-toolbar">
      <input id="ar-q" placeholder="🔍 제목·본문·시리즈 검색" value="${esc(archiveQuery)}">
      <select id="ar-sort">
        <option value="updated" ${archiveSort === 'updated' ? 'selected' : ''}>최근 수정순</option>
        <option value="date" ${archiveSort === 'date' ? 'selected' : ''}>설교 예정일순</option>
        <option value="fav" ${archiveSort === 'fav' ? 'selected' : ''}>즐겨찾기 먼저</option>
      </select>
      <button class="btn btn-gold btn-sm" id="ar-new">＋ 새 설교</button>
      <button class="btn btn-ghost btn-sm" id="ar-backup">전체 백업(JSON)</button>
      <button class="btn btn-ghost btn-sm" id="ar-import">가져오기</button>
    </div>
    ${Object.keys(seriesGroups).length ? `<div class="chip-row">${Object.entries(seriesGroups).map(([s, ps]) => `<span class="chip">📁 ${esc(s)} (${ps.length})</span>`).join('')}</div>` : ''}
    ${list.length ? `
    <table class="proj-table">
      <tr><th></th><th>설교 제목</th><th>본문</th><th>예정일</th><th>단계</th><th>완성도</th><th>형식</th><th>예상</th><th></th></tr>
      ${list.map(p => `
        <tr>
          <td><span class="proj-fav" data-fav="${p.id}">${p.favorite ? '★' : '☆'}</span></td>
          <td class="proj-title-cell" data-open="${p.id}">${esc(p.title || p.inputs.topic || '제목 없음')}${p.inputs.series ? `<br><small style="color:var(--ink-soft)">${esc(p.inputs.series)}</small>` : ''}</td>
          <td>${esc(p.passage.ref || '—')}</td>
          <td>${esc(p.inputs.date || '—')}</td>
          <td><span class="badge">${STEP_NAMES[p.step || 0]}</span></td>
          <td><span class="mini-progress"><i style="width:${progressOf(p)}%"></i></span> ${progressOf(p)}%</td>
          <td>${esc(formName(p.form.selected) || '—')}</td>
          <td>${fmtMin(readingMinutes(htmlToText(p.draft.html)))}</td>
          <td style="white-space:nowrap">
            <button class="btn btn-ghost btn-sm" data-open="${p.id}">열기</button>
            <button class="btn btn-ghost btn-sm" data-dup="${p.id}">복제</button>
            <button class="btn btn-danger btn-sm" data-del="${p.id}">삭제</button>
          </td>
        </tr>`).join('')}
    </table>` : '<div class="card"><p>프로젝트가 없습니다. 새 설교를 시작해 보세요.</p></div>'}
    ${DB.trash.length ? `
    <div class="card" style="margin-top:20px">
      <h3>🗑 휴지통 (${DB.trash.length})</h3>
      ${DB.trash.map(p => `<div style="display:flex;gap:10px;align-items:center;padding:6px 0;font-size:.86rem">
        <span style="flex:1">${esc(p.title || p.inputs.topic || '제목 없음')} — ${esc(p.passage.ref || '')}</span>
        <button class="btn btn-ghost btn-sm" data-restore="${p.id}">복원</button>
        <button class="btn btn-danger btn-sm" data-purge="${p.id}">영구 삭제</button>
      </div>`).join('')}
    </div>` : ''}`;
  $('#ar-q').addEventListener('input', e => { archiveQuery = e.target.value; renderArchive(m); $('#ar-q').focus(); const v = $('#ar-q'); v.setSelectionRange(v.value.length, v.value.length); });
  $('#ar-sort').addEventListener('change', e => { archiveSort = e.target.value; renderArchive(m); });
  $('#ar-new').addEventListener('click', newProject);
  $('#ar-backup').addEventListener('click', () => {
    download('MWORKS_백업_' + today() + '.json', JSON.stringify(DB, null, 2), 'application/json');
  });
  $('#ar-import').addEventListener('click', () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json';
    inp.onchange = () => {
      const fr = new FileReader();
      fr.onload = () => {
        try {
          const d = normalize(JSON.parse(fr.result));
          const ids = new Set(DB.projects.map(p => p.id));
          let n = 0;
          d.projects.forEach(p => { if (!ids.has(p.id)) { DB.projects.push(p); n++; } });
          save(true); render(); toast(n + '개 프로젝트를 가져왔습니다.');
        } catch { toast('백업 파일을 읽지 못했습니다.'); }
      };
      fr.readAsText(inp.files[0]);
    };
    inp.click();
  });
  m.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => openProject(b.dataset.open)));
  m.querySelectorAll('[data-dup]').forEach(b => b.addEventListener('click', () => duplicateProject(b.dataset.dup)));
  m.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => trashProject(b.dataset.del)));
  m.querySelectorAll('[data-fav]').forEach(b => b.addEventListener('click', () => {
    const p = DB.projects.find(p => p.id === b.dataset.fav); p.favorite = !p.favorite; save(true); renderArchive(m);
  }));
  m.querySelectorAll('[data-restore]').forEach(b => b.addEventListener('click', () => restoreProject(b.dataset.restore)));
  m.querySelectorAll('[data-purge]').forEach(b => b.addEventListener('click', () => {
    if (confirm('영구 삭제합니다. 되돌릴 수 없습니다. 계속할까요?')) {
      DB.trash = DB.trash.filter(p => p.id !== b.dataset.purge); save(true); renderArchive(m);
    }
  }));
}
function today() { const d = new Date(); return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); }
function download(name, content, mime) {
  const blob = content instanceof Blob ? content : new Blob(['﻿' + content], { type: mime + ';charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
/* 저장 위치를 직접 고르는 저장 (지원 브라우저에서는 대화상자, 아니면 다운로드 폴더) */
async function saveFileAs(name, content, mime, desc) {
  const blob = new Blob(['﻿' + content], { type: mime + ';charset=utf-8' });
  if (window.showSaveFilePicker) {
    try {
      const ext = '.' + name.split('.').pop();
      const handle = await window.showSaveFilePicker({
        suggestedName: name,
        types: [{ description: desc || '문서', accept: { [mime]: [ext] } }],
      });
      const w = await handle.createWritable();
      await w.write(blob); await w.close();
      toast('저장했습니다: ' + handle.name);
      return;
    } catch (e) {
      if (e.name === 'AbortError') return; // 사용자가 취소
      /* 실패 시 다운로드로 대체 */
    }
  }
  download(name, content, mime);
  toast('다운로드 폴더에 저장했습니다.');
}

/* ═══════════════════ 내보내기 ═══════════════════ */
function openExport() {
  const p = cur();
  if (!p) { toast('열려 있는 프로젝트가 없습니다.'); return; }
  syncEditor();
  const body = modal('문서 내보내기', `
    <h4 style="margin-top:0">포함할 내용</h4>
    <div class="checklist" style="columns:2">
      <label><input type="checkbox" id="ex-title" checked> 제목·본문 표기</label>
      <label><input type="checkbox" id="ex-central" checked> 중심사상</label>
      <label><input type="checkbox" id="ex-passage"> 본문 전문</label>
      <label><input type="checkbox" id="ex-draft" checked> 설교문</label>
      <label><input type="checkbox" id="ex-marks"> 강세·시선 표시 유지</label>
      <label><input type="checkbox" id="ex-bmarks" checked> 쉼·멈춤 표시 (∕·⏸)</label>
      <label><input type="checkbox" id="ex-gmarks"> 제스처 위치 표시 (🖐①)</label>
      <label><input type="checkbox" id="ex-memo"> 강단 메모 유지</label>
      <label><input type="checkbox" id="ex-gestures"> 제스처 제안</label>
      <label><input type="checkbox" id="ex-feedback"> 피드백 요약</label>
    </div>
    <h4>형식</h4>
    <div class="btn-row" style="margin-top:6px">
      <button class="btn btn-gold" data-ex="doc">Word 문서 (.doc)</button>
      <button class="btn btn-ghost" data-ex="txt">텍스트 (.txt)</button>
      <button class="btn btn-ghost" data-ex="md">마크다운 (.md)</button>
      <button class="btn btn-ghost" data-ex="print">인쇄용 원고 🖨</button>
      <button class="btn btn-ghost" data-ex="print-large">강단용 큰 글씨 🖨</button>
    </div>
    <p class="ai-note" style="margin-top:14px"><b>아래한글 안내</b> — .doc 파일은 아래한글에서 그대로 열립니다(파일 → 불러오기). .hwp 형식의 직접 생성은 지원하지 않으며, 정식 .hwpx 내보내기는 다음 버전에서 제공할 예정입니다.<br>
    <b>성경 저작권 안내</b> — 개역개정 등 번역본 전문을 포함해 배포할 경우 해당 번역본의 사용 허락 규정을 확인하세요.</p>`);
  body.querySelectorAll('[data-ex]').forEach(b => b.addEventListener('click', () => doExport(p, b.dataset.ex)));
}
function buildExportHtml(p, opt) {
  const c = p.central || {};
  const div = document.createElement('div'); div.innerHTML = p.draft.html || '';
  if (!opt.marks) div.querySelectorAll('.eye-mark').forEach(el => el.remove());
  if (!opt.marks) div.querySelectorAll('.stress-mark').forEach(el => { el.replaceWith(...el.childNodes); });
  if (!opt.memo) div.querySelectorAll('.note-mark').forEach(el => el.remove());
  // 쉼·멈춤 표시: 체크 해제 시 제거, 체크 시(원고에 없으면) 분석 결과로 삽입
  if (!opt.bmarks) div.querySelectorAll('.breath-mark,.pause-mark').forEach(el => el.remove());
  else {
    const bm = (p.rehearsal.breaths && p.rehearsal.breaths.marks) || [];
    if (bm.length && !div.querySelector('.breath-mark,.pause-mark')) {
      div.innerHTML = markScriptHtml(div.innerHTML, bm, it => it.kind === '멈춤'
        ? '<span class="pause-mark">⏸' + (it.seconds || 2) + '초</span>' : '<span class="breath-mark">∕</span>').html;
    }
  }
  // 제스처 위치 표시(🖐①) + 표시 안내
  let gLegend = '';
  if (opt.gmarks) {
    const gs = (p.rehearsal.gestures && p.rehearsal.gestures.gestures) || [];
    if (gs.length) {
      div.innerHTML = markScriptHtml(div.innerHTML, gs, (it, i) => '<b>🖐' + (CIRC[i] || (i + 1)) + '</b>').html;
      gLegend = '<hr><h2>제스처 표시 안내</h2>' + gs.map((g, i) =>
        `<p><b>🖐${CIRC[i] || (i + 1)}</b> ${esc(g.gesture)} — 손: ${esc(g.hands)} / 시선: ${esc(g.eyes)} / 멈춤: ${esc(g.pauseSec)}초 · ${esc(g.why)}</p>`).join('');
    }
  }
  const draftHtml = div.innerHTML;
  let html = '';
  // 예시 원고 머리 양식: 제목(14pt 굵게) → 본문 장절(굵게) → 날짜·시리즈(굵게)
  if (opt.title) {
    html += `<h1>${esc(p.title || p.inputs.topic)}</h1>`;
    if (p.passage.ref) html += `<p><b>${esc(p.passage.ref)}</b></p>`;
    const meta = [p.inputs.date, p.inputs.series].filter(Boolean).join(' ');
    if (meta) html += `<p><b>${esc(meta)}</b></p>`;
  }
  if (opt.central && c.homiletical) html += `<p><b>중심사상: ${esc(c.homiletical)}</b></p>`;
  if (opt.passage && p.passage.text) html += `<blockquote>${esc(p.passage.text).replace(/\n/g, '<br>')}</blockquote>`;
  if (opt.draft) { html += '<hr>' + draftHtml; if (gLegend) html += gLegend; }
  if (opt.gestures && p.rehearsal.gestures) {
    html += '<hr><h2>제스처 제안</h2>' + (p.rehearsal.gestures.gestures || []).map(g =>
      `<p><b>"${esc(g.sentence)}"</b> (${esc(g.position)})<br>${esc(g.gesture)} — 손: ${esc(g.hands)} / 시선: ${esc(g.eyes)} / 멈춤: ${esc(g.pauseSec)}초</p>`).join('');
  }
  if (opt.feedback && p.rehearsal.feedback) {
    const d = p.rehearsal.feedback.delivery || {};
    html += `<hr><h2>피드백 요약</h2><p>예상 시간: ${esc(d.estMinutes || '')}분 — ${esc(d.timeDiff || '')}</p>`;
  }
  return html;
}
function grabExportOpts() {
  return {
    title: $('#ex-title').checked, central: $('#ex-central').checked,
    passage: $('#ex-passage').checked, draft: $('#ex-draft').checked,
    marks: $('#ex-marks').checked, memo: $('#ex-memo').checked,
    bmarks: $('#ex-bmarks').checked, gmarks: $('#ex-gmarks').checked,
    gestures: $('#ex-gestures').checked, feedback: $('#ex-feedback').checked,
  };
}
function doExport(p, kind) {
  const opt = grabExportOpts();
  const name = (p.title || p.inputs.topic || '설교') + '_' + today();
  const inner = buildExportHtml(p, opt);
  if (kind === 'doc') {
    const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(name)}</title>
<style>
 ${wordCss()}
</style></head><body>${inner}</body></html>`;
    saveFileAs(name + '.doc', doc, 'application/msword', 'Word 문서');
  } else if (kind === 'txt') {
    saveFileAs(name + '.txt', htmlToText(inner), 'text/plain', '텍스트');
  } else if (kind === 'md') {
    saveFileAs(name + '.md', htmlToMd(inner), 'text/markdown', '마크다운');
  } else if (kind === 'print' || kind === 'print-large') {
    const w = window.open('', '_blank');
    if (!w) { toast('팝업이 차단되어 인쇄 창을 열 수 없습니다. 브라우저에서 팝업을 허용해 주세요.', 5000); return; }
    const large = kind === 'print-large';
    w.document.write('<html><head><meta charset="utf-8"><title>' + esc(name) + '</title><style>' +
      'body{font-family:"Apple SD Gothic Neo","Malgun Gothic",sans-serif;color:#000;background:#fff;max-width:760px;margin:24px auto;line-height:1.8;font-size:' + (large ? '20pt' : '12pt') + ';padding:0 16px}' +
      'h1{font-size:' + (large ? '27pt' : '16pt') + ';margin-bottom:6px} h2{font-size:' + (large ? '22pt' : '13pt') + ';margin:16px 0 6px}' +
      'p{margin:0 0 4px} blockquote{border-left:3px solid #888;margin:12px 0;padding:4px 14px}' +
      '.pause-mark,.breath-mark{font-weight:700} .stress-mark{font-weight:700;text-decoration:underline} .eye-mark{font-weight:700} .note-mark{background:#eee;padding:0 4px}' +
      '</style></head><body>' + inner + '</body></html>');
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 400);
    return;
  }
}
function htmlToMd(html) {
  const div = document.createElement('div'); div.innerHTML = html;
  let md = '';
  const walk = el => {
    for (const n of el.childNodes) {
      if (n.nodeType === 3) { md += n.textContent; continue; }
      const tag = n.tagName ? n.tagName.toLowerCase() : '';
      if (tag === 'h1') md += '\n# ' + n.textContent + '\n';
      else if (tag === 'h2') md += '\n## ' + n.textContent + '\n';
      else if (tag === 'h3') md += '\n### ' + n.textContent + '\n';
      else if (tag === 'p' || tag === 'div') { md += '\n'; walk(n); md += '\n'; }
      else if (tag === 'blockquote') md += '\n> ' + n.textContent.trim().replace(/\n/g, '\n> ') + '\n';
      else if (tag === 'li') { md += '\n- '; walk(n); }
      else if (tag === 'strong' || tag === 'b') md += '**' + n.textContent + '**';
      else if (tag === 'em' || tag === 'i') md += '*' + n.textContent + '*';
      else if (tag === 'hr') md += '\n\n---\n\n';
      else if (tag === 'br') md += '\n';
      else walk(n);
    }
  };
  walk(div);
  return md.replace(/\n{3,}/g, '\n\n').trim();
}

/* ═══════════════════ 설정 ═══════════════════ */
function openSettings() {
  const s = DB.settings;
  const body = modal('설정', `
    <h4 style="margin-top:0">AI 연결</h4>
    <div id="set-ai-status" class="fb-item">확인 중…</div>
    <div class="field" style="margin-top:10px">
      <label>간편 연결 <span class="opt">(교회 비밀번호만 넣으면 연결 — 다른 기기에서 이 방법을 쓰세요)</span></label>
      <div style="display:flex;gap:8px">
        <input id="set-proxy-pass" type="password" placeholder="연결 비밀번호" style="flex:1" autocomplete="off">
        <button class="btn btn-primary btn-sm" id="set-proxy-go">🔑 연결</button>
      </div>
      <div class="hint">한 번 연결하면 이 기기에 저장되어 계속 사용됩니다.</div>
    </div>
    <div class="field" style="margin-top:10px">
      <label>Anthropic API 키 직접 입력 <span class="opt">(이 브라우저에만 저장되며, AI 호출에만 사용됩니다)</span></label>
      <input id="set-key" type="password" value="${esc(s.apiKey)}" placeholder="sk-ant-...  (선택 사항)">
      <div class="hint">키가 없어도, 이 컴퓨터의 터미널에서 <b>claude</b> 를 실행해 로그인돼 있으면 자동으로 연결됩니다.</div>
    </div>
    <div class="form-grid" style="margin-top:8px">
      <div class="field"><label>AI 모델</label>
        <select id="set-model">
          <option value="sonnet" ${s.model === 'sonnet' ? 'selected' : ''}>Sonnet (권장 — 균형)</option>
          <option value="opus" ${s.model === 'opus' ? 'selected' : ''}>Opus (가장 깊음, 느림)</option>
          <option value="haiku" ${s.model === 'haiku' ? 'selected' : ''}>Haiku (빠름, 가벼움)</option>
        </select></div>
      <div class="field"><label>성경 번역본</label>
        <select id="set-trans">
          ${['개역개정', '새번역', '공동번역', '직접 입력'].map(t => `<option ${s.translation === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
        <div class="hint">본문 전문은 저작권 문제로 앱이 생성하지 않습니다. 성경에서 복사해 붙여넣어 주세요.</div></div>
      <div class="field"><label>낭독 속도 (분당 글자 수)</label><input id="set-cpm" type="number" value="${s.cpm}" min="180" max="450">
        <div class="hint">보통 270~330. 시간 예측의 기준입니다.</div></div>
      <div class="field"><label>기본 목표 시간(분)</label><input id="set-target" type="number" value="${s.targetMin}" min="5" max="90"></div>
      <div class="field full"><label>기본 문체·어조</label><input id="set-style" value="${esc(s.style)}" placeholder="예: 따뜻한 존댓말 구어체, 단문 위주"></div>
      <div class="field"><label>화면 글자 크기</label>
        <select id="set-fscale">
          ${[[90, '작게'], [100, '보통'], [112, '크게'], [125, '아주 크게']].map(([v, n]) => `<option value="${v}" ${(s.fontScale || 100) === v ? 'selected' : ''}>${n} (${v}%)</option>`).join('')}
        </select></div>
      <div class="field"><label>글자체</label>
        <select id="set-fface">
          <option value="basic" ${s.fontFace === 'basic' || !s.fontFace ? 'selected' : ''}>기본 (모던 산세리프)</option>
          <option value="gothic" ${s.fontFace === 'gothic' ? 'selected' : ''}>고딕 (맑은 고딕 계열)</option>
          <option value="serif" ${s.fontFace === 'serif' ? 'selected' : ''}>명조 (세리프)</option>
        </select></div>
      <div class="field"><label>화면 색상 (테마)</label>
        <select id="set-theme">
          <option value="white" ${s.theme === 'white' || !s.theme ? 'selected' : ''}>화이트 (기본)</option>
          <option value="ivory" ${s.theme === 'ivory' ? 'selected' : ''}>아이보리 (따뜻한 종이색)</option>
          <option value="mint" ${s.theme === 'mint' ? 'selected' : ''}>연민트 (차분한 초록빛)</option>
          <option value="lilac" ${s.theme === 'lilac' ? 'selected' : ''}>연라일락 (은은한 보랏빛)</option>
        </select></div>
      <div class="field"><label>화면 밝기 — <span id="set-bright-val">${s.brightness || 100}%</span></label>
        <input type="range" id="set-bright" min="70" max="115" step="5" value="${s.brightness || 100}">
        <div class="hint">낮추면 눈이 편하고, 높이면 더 환해집니다. 움직이면 바로 화면에 적용됩니다.</div></div>
      <div class="field full"><label>앱 잠금</label>
        <div class="btn-row" style="margin-top:4px">
          <button class="btn btn-ghost btn-sm" id="set-pass">🔒 ${s.appPass ? '비밀번호 변경' : '비밀번호 걸기'}</button>
          ${s.appPass ? '<button class="btn btn-ghost btn-sm" id="set-pass-off">잠금 해제 (비밀번호 제거)</button>' : ''}
        </div>
        <div class="hint">앱을 열 때 비밀번호를 묻습니다. 이 기기에만 저장되며, 잊으면 풀 수 없으니 메모해 두세요.</div>
      </div>
    </div>
    <div class="btn-row">
      <button class="btn btn-gold" id="set-save">설정 저장</button>
      <button class="btn btn-ghost" id="set-recheck">AI 연결 다시 확인</button>
      <button class="btn btn-ghost" id="set-rules">📏 나의 작성 규칙</button>
      <button class="btn btn-ghost" id="set-prompts">🧩 설교작성·세부작성 프롬프트</button>
      <button class="btn btn-ghost" id="set-manual">📖 사용 설명서</button>
    </div>
    <p class="ai-note"><b>개인정보</b> — 모든 설교 데이터는 이 컴퓨터의 브라우저에만 저장됩니다. AI 호출 시 해당 프로젝트의 입력 내용만 Anthropic 서버로 전송됩니다.</p>`);
  const updStatus = () => {
    const el = $('#set-ai-status');
    if (aiStatus.serverless) {
      el.innerHTML = DB.settings.apiKey
        ? '<b>연결됨</b> 단일 파일 모드 — 입력한 API 키로 Anthropic에 직접 호출합니다'
        : `<b style="color:var(--red)">미연결</b> 단일 파일 모드입니다. 아래에 Anthropic API 키를 입력해 주세요 (console.anthropic.com에서 발급).<br>Claude 로그인(터미널) 방식은 <b>M.WORKS 실행.command</b>로 열었을 때만 사용할 수 있습니다.`;
      return;
    }
    if (aiStatus.envKey) el.innerHTML = '<b>연결됨</b> 서버 환경변수 API 키 사용 중';
    else if (DB.settings.apiKey) el.innerHTML = '<b>연결됨</b> 입력한 API 키 사용 중';
    else if (aiStatus.cli) el.innerHTML = '<b>연결됨</b> 이 컴퓨터의 Claude 로그인(claude CLI) 사용 중';
    else el.innerHTML = `<b style="color:var(--red)">미연결</b> 두 가지 방법 중 하나를 선택하세요:<br>
      ① 아래에 Anthropic API 키 입력 (console.anthropic.com에서 발급)<br>
      ② 터미널을 열고 <b>claude</b> 실행 → <b>/login</b> 으로 로그인 후 "다시 확인"`;
  };
  updStatus();
  body.querySelector('#set-save').addEventListener('click', () => {
    s.apiKey = $('#set-key').value.trim(); s.model = $('#set-model').value;
    s.translation = $('#set-trans').value; s.cpm = +$('#set-cpm').value || 300;
    s.targetMin = +$('#set-target').value || 25; s.style = $('#set-style').value.trim();
    s.fontScale = +$('#set-fscale').value || 100; s.fontFace = $('#set-fface').value;
    s.theme = $('#set-theme').value; s.brightness = +$('#set-bright').value || 100;
    applyDisplay();
    save(true); fetchStatus(); closeModal(); toast('설정을 저장했습니다.');
  });
  body.querySelector('#set-recheck').addEventListener('click', async () => {
    $('#set-ai-status').textContent = '확인 중…';
    await fetchStatus(true); updStatus();
  });
  body.querySelector('#set-proxy-go').addEventListener('click', async () => {
    const pw = $('#set-proxy-pass').value.trim();
    if (!pw) { toast('비밀번호를 입력해 주세요.'); return; }
    if (!(window.crypto && crypto.subtle)) { toast('이 환경에서는 간편 연결을 쓸 수 없습니다. API 키를 직접 입력해 주세요.', 5000); return; }
    const btn = $('#set-proxy-go'); btn.disabled = true; btn.textContent = '연결 중…';
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw));
      const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
      const res = await fetch('https://hansung-tsj.netlify.app/.netlify/functions/mworks-key', {
        method: 'POST', headers: { 'x-auth': hash },
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) { toast('비밀번호가 다릅니다.'); }
      else if (res.status === 503) { toast('서버에 API 키가 아직 등록되지 않았습니다. 관리자(Netlify 환경변수) 설정이 필요합니다.', 6000); }
      else if (res.ok && data.key) {
        s.apiKey = data.key; $('#set-key').value = data.key;
        save(true); await fetchStatus(true); updStatus();
        toast('연결되었습니다! 이제 이 기기에서 AI를 쓸 수 있습니다.');
      } else { toast('연결에 실패했습니다. 인터넷 연결을 확인해 주세요.', 5000); }
    } catch (e) { toast('연결 실패: ' + e.message, 5000); }
    btn.disabled = false; btn.textContent = '🔑 연결';
  });
  body.querySelector('#set-bright').addEventListener('input', e => {
    DB.settings.brightness = +e.target.value;
    $('#set-bright-val').textContent = e.target.value + '%';
    applyDisplay();
  });
  body.querySelector('#set-theme').addEventListener('change', e => {
    DB.settings.theme = e.target.value; applyDisplay();
  });
  body.querySelector('#set-rules').addEventListener('click', openRules);
  body.querySelector('#set-manual').addEventListener('click', () => { closeModal(); openManual(); });
  body.querySelector('#set-pass').addEventListener('click', () => {
    if (s.appPass) {
      const cur = prompt('현재 비밀번호를 입력하세요');
      if (cur === null) return;
      if (encPass(cur) !== s.appPass) { toast('비밀번호가 다릅니다.'); return; }
    }
    const pw = prompt('새 비밀번호를 입력하세요 (4자 이상)');
    if (pw === null) return;
    if (pw.trim().length < 4) { toast('4자 이상으로 정해 주세요.'); return; }
    s.appPass = encPass(pw.trim());
    save(true); closeModal(); toast('비밀번호를 걸었습니다. 다음에 열 때부터 묻습니다.');
  });
  const passOff = body.querySelector('#set-pass-off');
  if (passOff) passOff.addEventListener('click', () => {
    const cur = prompt('현재 비밀번호를 입력하세요');
    if (cur === null) return;
    if (encPass(cur) !== s.appPass) { toast('비밀번호가 다릅니다.'); return; }
    s.appPass = '';
    save(true); closeModal(); toast('잠금을 해제했습니다.');
  });
  body.querySelector('#set-prompts').addEventListener('click', () => { closeModal(); curView = 'prompts'; render(); });
}
/* 프롬프트 관리(관리자) */
function openPromptManager() {
  const keys = Object.keys(window.MSGB_PROMPTS);
  const body = modal('설교작성 프롬프트', `
    <p style="font-size:.84rem;color:var(--ink-soft)">각 단계의 AI 지시문을 앱 재배포 없이 수정할 수 있습니다. 수정본은 이 브라우저에 저장되며, <b>기본값 복원</b>으로 언제든 되돌립니다. <code>{{슬롯}}</code> 표기는 앱이 자동으로 채우는 자리이므로 지우지 마세요.</p>
    <div class="field"><label>프롬프트 선택</label>
      <select id="pm-key">${keys.map(k => `<option value="${k}">${esc(window.MSGB_PROMPTS[k].label)} ${DB.promptOverrides[k] ? '(수정됨)' : ''}</option>`).join('')}</select></div>
    <div class="field"><label>시스템 프롬프트 <span class="opt">(1부 — 역할과 원칙)</span></label><textarea id="pm-system" style="min-height:120px;font-family:monospace;font-size:.78rem"></textarea></div>
    <div class="field"><label>작업주문 프롬프트 <span class="opt">(2부 — 주문서 양식)</span></label><textarea id="pm-user" style="min-height:200px;font-family:monospace;font-size:.78rem"></textarea></div>
    <div class="btn-row">
      <button class="btn btn-gold" id="pm-save">저장</button>
      <button class="btn btn-ghost" id="pm-reset">기본값 복원</button>
      <button class="btn btn-ghost" id="pm-back">← 설정으로</button>
    </div>`);
  const loadK = () => {
    const k = $('#pm-key').value, pr = getPrompt(k);
    $('#pm-system').value = pr.system; $('#pm-user').value = pr.user;
  };
  loadK();
  body.querySelector('#pm-key').addEventListener('change', loadK);
  body.querySelector('#pm-save').addEventListener('click', () => {
    const k = $('#pm-key').value;
    DB.promptOverrides[k] = { system: $('#pm-system').value, user: $('#pm-user').value };
    save(true); toast('프롬프트를 저장했습니다.');
  });
  body.querySelector('#pm-reset').addEventListener('click', () => {
    delete DB.promptOverrides[$('#pm-key').value]; save(true); loadK(); toast('기본값으로 복원했습니다.');
  });
  body.querySelector('#pm-back').addEventListener('click', openSettings);
}

/* ═══════════════════ AI 버튼 색 (Fin Orange) ═══════════════════ */
// 🤖 표시가 있는 버튼 = AI 실행 버튼 → Fin Orange 악센트 자동 적용
function paintAiButtons() {
  $$('.btn').forEach(b => { if (b.textContent.includes('🤖')) b.classList.add('btn-ai'); });
}
new MutationObserver(paintAiButtons).observe(document.body, { childList: true, subtree: true });

/* ═══════════════════ 오른쪽 패널 도구: 성경 구절 · 유의어 ═══════════════════ */
(function bindCtxTools() {
  const run = async (inputId, outId, promptKey, slotName, emptyMsg) => {
    const q = $(inputId).value.trim();
    if (!q) return toast(emptyMsg);
    if (!aiConnected()) { toast('AI가 연결되지 않았습니다. 설정에서 연결해 주세요.'); return; }
    const out = $(outId);
    out.textContent = '⏳ 불러오는 중…';
    try {
      const md = await callAI(promptKey, { [slotName]: q }, { silent: true });
      out.innerHTML = mdToHtml(md);
    } catch (e) { out.textContent = '⚠ ' + e.message; }
  };
  const vGo = () => run('#tool-verse-in', '#tool-verse-out', 'verse', 'ref', '구절을 입력해 주세요. 예) 요 3:16');
  const sGo = () => run('#tool-syn-in', '#tool-syn-out', 'thesaurus', 'word', '단어를 입력해 주세요.');
  $('#tool-verse-go').addEventListener('click', vGo);
  $('#tool-syn-go').addEventListener('click', sGo);
  $('#tool-verse-in').addEventListener('keydown', e => { if (e.key === 'Enter') vGo(); });
  $('#tool-syn-in').addEventListener('keydown', e => { if (e.key === 'Enter') sGo(); });
})();

/* ═══════════════════ 시작 ═══════════════════ */
window.gotoStep = gotoStep; // 잠금 카드의 onclick 용
(function init() {
  // 가장 최근 프로젝트 자동 열기
  if (DB.projects.length) { curId = DB.projects[0].id; curView = 'home'; }
  render();
  fetchStatus();
  setInterval(() => { syncEditor(); }, 30000); // 편집 중 주기 저장
  window.addEventListener('beforeunload', () => { syncEditor(); save(true); });
})();
