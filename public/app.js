/* AI Hacker Practice Simulator — client. No dependencies. */
'use strict';

const $ = (sel) => document.querySelector(sel);
const state = { scenarios: [], journal: [], writeups: [], selected: null, messages: [], armed: {} };

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, 3500);
}

function showError(el, msg) {
  el.textContent = msg;
  el.hidden = false;
}
function hideError(el) { el.hidden = true; el.textContent = ''; }

async function api(path, method, body) {
  const opts = { method: method || 'GET', headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || ('Request failed (' + res.status + ')'));
    err.status = res.status;
    throw err;
  }
  return data;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ------------------------------------------------------------------ tabs --
function switchTab(name) {
  for (const n of ['scenarios', 'journal', 'portfolio']) {
    $('#tab-' + n).setAttribute('aria-selected', String(n === name));
    $('#panel-' + n).hidden = n !== name;
  }
  if (name === 'journal') renderJournal();
  if (name === 'portfolio') renderWriteups();
}
$('#tab-scenarios').addEventListener('click', () => switchTab('scenarios'));
$('#tab-journal').addEventListener('click', () => switchTab('journal'));
$('#tab-portfolio').addEventListener('click', () => switchTab('portfolio'));

// -------------------------------------------------------------- scenarios --
function statusBadge(p) {
  if (p.status === 'solved') return '<span class="badge solved">Solved</span>';
  if (p.status === 'in_progress') return '<span class="badge progress">In progress · stage ' + p.stage + '/5</span>';
  return '<span class="badge fresh">Not started</span>';
}

function renderScenarioList() {
  $('#scenarioList').innerHTML = state.scenarios.map((sc) => {
    const p = sc.progress;
    return '<button type="button" class="scenario-item' + (state.selected === sc.key ? ' active' : '') + '" data-key="' + esc(sc.key) + '">' +
      '<span class="sc-num">' + sc.num + '</span>' +
      '<span class="sc-main"><strong>' + esc(sc.title) + '</strong><small>' + esc(sc.level) + ' · ' + esc(sc.owasp) + '</small></span>' +
      statusBadge(p) + '</button>';
  }).join('');
  document.querySelectorAll('.scenario-item').forEach((el) => {
    el.addEventListener('click', () => selectScenario(el.getAttribute('data-key')));
  });
}

function stageBar(sc) {
  const p = sc.progress;
  return '<ol class="stages">' + sc.stage_names.map((name, i) =>
    '<li class="' + (i < p.stage ? 'done' : i === p.stage ? 'current' : '') + '">' + esc(name) + '</li>'
  ).join('') + '</ol>';
}

function renderDetail() {
  const sc = state.scenarios.find((s) => s.key === state.selected);
  if (!sc) {
    $('#scenarioDetail').innerHTML = '<p class="empty-note">Select a scenario to begin.</p>';
    return;
  }
  const p = sc.progress;
  const solved = p.status === 'solved';
  $('#scenarioDetail').innerHTML =
    '<article class="card detail-card">' +
    '<h2>' + sc.num + '. ' + esc(sc.title) + '</h2>' +
    '<p class="meta">' + esc(sc.level) + ' · ' + esc(sc.owasp) + ' · ' + esc(sc.source) + '</p>' +
    '<p><strong>Objective:</strong> ' + esc(sc.objective) + '</p>' +
    '<p>' + esc(sc.briefing) + '</p>' +
    stageBar(sc) +
    '<p class="meta">Attempts: ' + p.attempts + ' · Hints used: ' + p.hints_used + (solved && p.solved_at ? ' · Solved: ' + esc(p.solved_at.slice(0, 10)) : '') + '</p>' +
    '<div class="detail-actions">' +
      '<button type="button" id="hintBtn">Hint</button>' +
      (sc.has_victim_sim ? '<button type="button" id="victimBtn">Run victim simulation</button>' : '') +
      (solved ? '<button type="button" id="genWriteupBtn">Generate writeup</button>' : '') +
      '<button type="button" class="danger" id="resetBtn">Reset scenario</button>' +
    '</div>' +
    '<p class="form-error" id="detailError" role="alert" hidden></p>' +
    '</article>' +
    '<div class="chat card">' +
      '<h3>' + esc(sc.bot_name) + '</h3>' +
      '<div id="chatLog" class="chat-log" aria-live="polite"></div>' +
      '<form id="chatForm" class="chat-form">' +
        '<input id="chatInput" maxlength="2000" required autocomplete="off" placeholder="Type your prompt to the bot…" aria-label="Message to the bot">' +
        '<button type="submit">Send</button>' +
      '</form>' +
      '<p class="form-error" id="chatError" role="alert" hidden></p>' +
    '</div>';

  renderMessages();
  $('#chatForm').addEventListener('submit', onSendMessage);
  $('#hintBtn').addEventListener('click', onHint);
  const vb = $('#victimBtn');
  if (vb) vb.addEventListener('click', onVictim);
  const gw = $('#genWriteupBtn');
  if (gw) gw.addEventListener('click', onGenerateWriteup);
  $('#resetBtn').addEventListener('click', onReset);
}

function renderMessages() {
  const log = $('#chatLog');
  if (!log) return;
  log.innerHTML = state.messages.map((m) =>
    '<div class="msg ' + esc(m.role) + '"><span class="msg-role">' + esc(m.role) + '</span><div class="msg-text">' + esc(m.text) + '</div></div>'
  ).join('');
  log.scrollTop = log.scrollHeight;
}

async function selectScenario(key) {
  state.selected = key;
  renderScenarioList();
  try {
    const data = await api('/api/messages?scenario_key=' + encodeURIComponent(key));
    state.messages = data.messages;
  } catch (e) {
    toast('Could not load the chat: ' + e.message);
    state.messages = [];
  }
  renderDetail();
}

async function onSendMessage(ev) {
  ev.preventDefault();
  const input = $('#chatInput');
  const text = input.value.trim();
  if (!text) return;
  hideError($('#chatError'));
  input.value = '';
  input.disabled = true;
  try {
    const data = await api('/api/messages', 'POST', { scenario_key: state.selected, text });
    state.messages.push({ role: 'user', text });
    for (const r of data.replies) state.messages.push(r);
    updateProgress(data.progress);
    renderMessages();
    renderScenarioList();
  } catch (e) {
    showError($('#chatError'), e.message + ' — your message was not sent. Retry.');
  } finally {
    input.disabled = false;
    input.focus();
  }
}

async function onHint() {
  hideError($('#detailError'));
  try {
    const data = await api('/api/hint', 'POST', { scenario_key: state.selected });
    toast('Hint (' + data.hints_used + ' used): ' + data.hint);
    updateProgress(data.progress);
    renderDetail();
  } catch (e) {
    showError($('#detailError'), e.message);
  }
}

async function onVictim() {
  hideError($('#detailError'));
  try {
    const data = await api('/api/victim', 'POST', { scenario_key: state.selected });
    for (const r of data.replies) state.messages.push(r);
    updateProgress(data.progress);
    renderMessages();
    renderDetail();
  } catch (e) {
    showError($('#detailError'), e.message);
  }
}

async function onGenerateWriteup() {
  hideError($('#detailError'));
  try {
    const data = await api('/api/writeups/generate', 'POST', { scenario_key: state.selected });
    state.writeups.unshift(data.writeup);
    renderWriteupCounts();
    toast('Writeup generated: ' + data.writeup.title);
    switchTab('portfolio');
  } catch (e) {
    showError($('#detailError'), e.message);
  }
}

// Two-step confirm: first click arms the button for 4 seconds, second confirms.
function armConfirm(btn, actionLabel, fn) {
  const key = btn.id;
  if (state.armed[key]) {
    clearTimeout(state.armed[key].timer);
    delete state.armed[key];
    btn.textContent = btn.dataset.label;
    fn();
    return;
  }
  btn.dataset.label = btn.textContent;
  btn.textContent = 'Click again to confirm: ' + actionLabel;
  btn.classList.add('armed');
  state.armed[key] = { timer: setTimeout(() => {
    delete state.armed[key];
    btn.textContent = btn.dataset.label;
    btn.classList.remove('armed');
  }, 4000) };
}

async function onReset(ev) {
  const btn = ev.currentTarget;
  armConfirm(btn, 'reset this scenario', async () => {
    hideError($('#detailError'));
    try {
      const data = await api('/api/reset', 'POST', { scenario_key: state.selected });
      state.messages = data.messages;
      updateProgress(data.progress);
      renderMessages();
      renderScenarioList();
      renderDetail();
      toast('Scenario reset — fresh run.');
    } catch (e) {
      showError($('#detailError'), e.message);
    }
  });
}

function updateProgress(p) {
  const sc = state.scenarios.find((s) => s.key === p.scenario_key);
  if (sc) sc.progress = p;
}

// --------------------------------------------------------------- journal --
function renderJournal() {
  const list = $('#journalList');
  if (state.journal.length === 0) {
    list.innerHTML = '<p class="empty-note">No journal entries yet. Log your first prompt above.</p>';
    return;
  }
  list.innerHTML = state.journal.map((e) =>
    '<article class="card entry">' +
    '<header><strong>Entry ' + e.id + '</strong>' + (e.scenario_key ? ' · <span>' + esc(e.scenario_key) + '</span>' : '') +
    ' · <span class="result-' + esc(e.result) + '">' + esc(e.result) + '</span>' +
    '<span class="entry-date">' + esc(e.created_at.slice(0, 10)) + '</span></header>' +
    '<p class="prompt-text">“' + esc(e.prompt) + '”</p>' +
    '<p class="meta">Intent: ' + esc(e.intent) + ' · Technique: ' + esc(e.technique) + ' · Evasion: ' + esc(e.evasion) + ' · Channel: ' + esc(e.input_channel) + '</p>' +
    (e.notes ? '<p>' + esc(e.notes) + '</p>' : '') +
    '<div class="entry-actions"><button type="button" class="danger small" data-del-journal="' + e.id + '">Delete entry</button></div>' +
    '</article>'
  ).join('');
  list.querySelectorAll('[data-del-journal]').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      const id = Number(btn.getAttribute('data-del-journal'));
      armConfirm(ev.currentTarget, 'delete this entry', async () => {
        try {
          await api('/api/journal/' + id, 'DELETE');
          state.journal = state.journal.filter((x) => x.id !== id);
          renderJournal();
          renderWriteupCounts();
          toast('Journal entry deleted.');
        } catch (e) { toast('Delete failed: ' + e.message); }
      });
    });
  });
}

$('#journalForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  hideError($('#journalError'));
  const entry = {
    prompt: $('#jPrompt').value.trim(),
    intent: $('#jIntent').value.trim(),
    technique: $('#jTechnique').value.trim(),
    evasion: $('#jEvasion').value.trim() || undefined,
    input_channel: $('#jChannel').value.trim() || undefined,
    scenario_key: $('#jScenario').value || null,
    result: $('#jResult').value,
    notes: $('#jNotes').value.trim() || undefined,
  };
  try {
    const data = await api('/api/journal', 'POST', entry);
    state.journal.unshift(data.entry);
    ev.target.reset();
    renderJournal();
    renderWriteupCounts();
    toast('Journal entry added.');
  } catch (e) {
    showError($('#journalError'), e.message);
  }
});

// ------------------------------------------------------------- portfolio --
function renderWriteups() {
  const list = $('#writeupList');
  if (state.writeups.length === 0) {
    list.innerHTML = '<p class="empty-note">No writeups yet. Solve a scenario and generate one, or write one by hand above.</p>';
    return;
  }
  list.innerHTML = state.writeups.map((w) =>
    '<article class="card entry">' +
    '<header><strong>' + esc(w.title) + '</strong> · <span>' + esc(w.status) + '</span>' +
    '<span class="entry-date">' + esc(w.created_at.slice(0, 10)) + '</span></header>' +
    (w.owasp ? '<p class="meta">' + esc(w.owasp) + '</p>' : '') +
    '<pre class="writeup-body">' + esc(w.body) + '</pre>' +
    '<div class="entry-actions"><button type="button" class="danger small" data-del-writeup="' + w.id + '">Delete writeup</button></div>' +
    '</article>'
  ).join('');
  list.querySelectorAll('[data-del-writeup]').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      const id = Number(btn.getAttribute('data-del-writeup'));
      armConfirm(ev.currentTarget, 'delete this writeup', async () => {
        try {
          await api('/api/writeups/' + id, 'DELETE');
          state.writeups = state.writeups.filter((x) => x.id !== id);
          renderWriteups();
          renderWriteupCounts();
          toast('Writeup deleted.');
        } catch (e) { toast('Delete failed: ' + e.message); }
      });
    });
  });
}

$('#writeupForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  hideError($('#writeupError'));
  try {
    const data = await api('/api/writeups', 'POST', {
      title: $('#wTitle').value.trim(),
      owasp: $('#wOwasp').value.trim(),
      body: $('#wBody').value,
    });
    state.writeups.unshift(data.writeup);
    ev.target.reset();
    renderWriteups();
    renderWriteupCounts();
    toast('Writeup created.');
  } catch (e) {
    showError($('#writeupError'), e.message);
  }
});

// --------------------------------------------------------------- export --
$('#exportBtn').addEventListener('click', async () => {
  try {
    const data = await api('/api/export');
    const stamp = data.generated_at.slice(0, 10);
    const blob = new Blob([data.markdown], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'practice-simulator-training-record-' + stamp + '.md';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Training record exported as Markdown.');
  } catch (e) {
    toast('Export failed: ' + e.message);
  }
});

function renderWriteupCounts() {
  $('#journalCount').textContent = state.journal.length ? '(' + state.journal.length + ')' : '';
  $('#writeupCount').textContent = state.writeups.length ? '(' + state.writeups.length + ')' : '';
}

// ------------------------------------------------------------------ init --
(async function init() {
  try {
    const data = await api('/api/state');
    state.scenarios = data.scenarios;
    state.journal = data.journal;
    state.writeups = data.writeups;
    const sel = $('#jScenario');
    for (const sc of state.scenarios) {
      const opt = document.createElement('option');
      opt.value = sc.key;
      opt.textContent = sc.num + '. ' + sc.title;
      sel.appendChild(opt);
    }
    renderScenarioList();
    renderWriteupCounts();
    $('#saveState').textContent = 'Progress saved on this server';
  } catch (e) {
    document.querySelector('main').innerHTML = '<p class="empty-note">Could not load the simulator: ' + esc(e.message) + '</p>';
  }
})();
