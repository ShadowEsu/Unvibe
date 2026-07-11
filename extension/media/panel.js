// Uncode review panel — webview script. No network access; talks to the extension host
// only via postMessage. (Secret filtering / AI I/O is host-side by design.)
(function () {
  const vscode = acquireVsCodeApi();

  const $ = (id) => document.getElementById(id);
  const els = {
    context: $('context'),
    ctxTitle: $('ctxTitle'),
    ctxDetail: $('ctxDetail'),
    ctxFiles: $('ctxFiles'),
    empty: $('empty'),
    preview: $('preview'),
    previewNote: $('previewNote'),
    previewText: $('previewText'),
    blocked: $('blocked'),
    blockedList: $('blockedList'),
    explain: $('explain'),
    explainBody: $('explainBody'),
    explainMeta: $('explainMeta'),
    comprehension: $('comprehension'),
    compQuestion: $('compQuestion'),
    compOptions: $('compOptions'),
    compCheck: $('compCheck'),
    compResult: $('compResult'),
    stats: $('stats'),
    statsList: $('statsList'),
    controls: $('controls'),
    followup: $('followup'),
    followupInput: $('followupInput'),
    segs: Array.from(document.querySelectorAll('.seg')),
  };

  var compSelected = -1;

  function hide(...nodes) {
    nodes.forEach((n) => n && (n.hidden = true));
  }
  function show(...nodes) {
    nodes.forEach((n) => n && (n.hidden = false));
  }

  function setLevel(level, notifyHost) {
    els.segs.forEach((seg) => {
      const active = seg.dataset.level === level;
      seg.setAttribute('aria-checked', active ? 'true' : 'false');
      seg.tabIndex = active ? 0 : -1;
    });
    if (notifyHost) {
      vscode.postMessage({ type: 'levelChanged', level });
    }
  }

  function showContext(request) {
    els.ctxTitle.textContent = request.title;
    els.ctxDetail.textContent = request.detail;
    els.ctxFiles.innerHTML = '';
    (request.files || []).slice(0, 50).forEach((f) => {
      const li = document.createElement('li');
      li.textContent = f;
      li.title = f;
      els.ctxFiles.appendChild(li);
    });
    show(els.context);
    hide(els.empty, els.preview, els.blocked, els.explain, els.comprehension, els.stats, els.controls, els.followup);
    setLevel(request.level, false);
  }

  function showPreview(text, suspects) {
    els.previewText.textContent = text;
    if (suspects && suspects.length) {
      els.previewNote.textContent =
        suspects.length + ' high-entropy value(s) will be sent — confirm they are not secrets.';
    } else {
      els.previewNote.textContent = 'This is everything Uncode will send. Nothing is sent until you confirm.';
    }
    show(els.preview);
    hide(els.empty, els.blocked, els.explain, els.controls, els.followup);
  }

  function showBlocked(findings) {
    els.blockedList.innerHTML = '';
    (findings || []).forEach((f) => {
      const li = document.createElement('li');
      li.textContent = f.rule + ' — ' + f.file + ':' + f.line + '  ' + f.masked;
      els.blockedList.appendChild(li);
    });
    show(els.blocked);
    hide(els.empty, els.preview, els.explain, els.controls, els.followup);
  }

  var rawExplanation = '';
  var CITE_RE = /\[\[cite:([^\]:]+):(\d+)(?:-(\d+))?\]\]/g;
  var PARTIAL_TAIL = /\[\[cite:[^\]]*$/;

  function base(path) {
    var p = String(path).replace(/\\/g, '/');
    return p.slice(p.lastIndexOf('/') + 1);
  }

  function stripLive(text) {
    return text
      .replace(CITE_RE, function (_full, file, start) { return base(file) + ':' + start; })
      .replace(PARTIAL_TAIL, '');
  }

  function streamStart() {
    rawExplanation = '';
    els.explainBody.textContent = '';
    els.explainMeta.hidden = true;
    show(els.explain, els.controls, els.followup);
    hide(els.empty, els.preview, els.blocked, els.comprehension, els.stats);
  }

  function appendToken(text) {
    rawExplanation += text;
    els.explainBody.textContent = stripLive(rawExplanation);
  }

  function renderSegments(segments, unverified) {
    els.explainBody.textContent = '';
    (segments || []).forEach(function (s) {
      if (s.type === 'text') {
        els.explainBody.appendChild(document.createTextNode(s.value));
        return;
      }
      var btn = document.createElement('button');
      btn.className = 'cite' + (s.verified ? '' : ' cite--unverified');
      btn.type = 'button';
      btn.textContent = base(s.file) + ':' + s.startLine + (s.endLine ? '-' + s.endLine : '');
      btn.title = (s.verified ? '' : 'Not in the sent context — verify. ') + s.file;
      btn.addEventListener('click', function () {
        vscode.postMessage({ type: 'openCitation', file: s.file, startLine: s.startLine });
      });
      els.explainBody.appendChild(btn);
    });
    if (unverified > 0) {
      var warn = document.createElement('p');
      warn.className = 'explanation__warn';
      warn.textContent = unverified + ' citation(s) reference files that were not sent — treat with caution.';
      els.explainBody.appendChild(warn);
    }
  }

  function streamDone(mock) {
    if (mock) {
      els.explainMeta.textContent = 'Mock explanation — set ANTHROPIC_API_KEY on the Uncode service for real analysis.';
      els.explainMeta.hidden = false;
    }
  }

  function streamError(message) {
    show(els.explain);
    els.explainBody.textContent = '';
    var p = document.createElement('p');
    p.className = 'explanation__warn';
    p.textContent = 'Could not complete the review: ' + message;
    els.explainBody.appendChild(p);
    var retry = document.createElement('button');
    retry.className = 'btn';
    retry.type = 'button';
    retry.textContent = 'Retry';
    retry.addEventListener('click', function () { vscode.postMessage({ type: 'retry' }); });
    els.explainBody.appendChild(retry);
  }

  function showOffline() {
    show(els.explain);
    els.explainBody.textContent = 'You appear to be offline. Uncode will retry when a connection is available.';
  }

  function comprehensionLoading() {
    compSelected = -1;
    els.compQuestion.textContent = 'Preparing a question…';
    els.compOptions.innerHTML = '';
    els.compResult.hidden = true;
    els.compCheck.disabled = true;
    show(els.comprehension);
    hide(els.explain, els.controls, els.followup, els.stats, els.empty, els.preview, els.blocked);
  }

  function showComprehension(question, options) {
    compSelected = -1;
    els.compQuestion.textContent = question;
    els.compOptions.innerHTML = '';
    els.compResult.hidden = true;
    els.compCheck.disabled = false;
    (options || []).forEach(function (opt, i) {
      var b = document.createElement('button');
      b.className = 'opt';
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', 'false');
      b.textContent = opt;
      b.addEventListener('click', function () {
        compSelected = i;
        Array.prototype.forEach.call(els.compOptions.children, function (c, ci) {
          c.setAttribute('aria-checked', ci === i ? 'true' : 'false');
        });
      });
      els.compOptions.appendChild(b);
    });
    show(els.comprehension);
    hide(els.explain, els.controls, els.followup, els.stats);
  }

  function showComprehensionResult(pass, rationale) {
    els.compResult.hidden = false;
    els.compResult.textContent = (pass ? '✓ Correct. ' : '✗ Not quite. ') + rationale;
    els.compResult.className = 'comprehension__result' + (pass ? ' is-pass' : ' is-fail');
    els.compCheck.disabled = true;
    Array.prototype.forEach.call(els.compOptions.children, function (c) { c.disabled = true; });
  }

  function showStats(p) {
    var rows = [
      ['Reviews', p.totalReviews],
      ['Understood', p.understood],
      ['Needs review', p.needsReview],
      ['Concepts understood', p.conceptsUnderstood],
      ['Concepts to review', p.conceptsNeedReview],
      ['Current streak', p.currentStreakDays + (p.currentStreakDays === 1 ? ' day' : ' days')],
    ];
    els.statsList.innerHTML = '';
    rows.forEach(function (r) {
      var li = document.createElement('li');
      var k = document.createElement('span');
      k.className = 'stats__k';
      k.textContent = r[0];
      var v = document.createElement('span');
      v.className = 'stats__v';
      v.textContent = String(r[1]);
      li.appendChild(k);
      li.appendChild(v);
      els.statsList.appendChild(li);
    });
    show(els.stats);
    hide(els.empty, els.preview, els.blocked, els.explain, els.comprehension, els.controls, els.followup);
  }

  // Level selector (click + arrow keys)
  els.segs.forEach((seg) => {
    seg.addEventListener('click', () => setLevel(seg.dataset.level, true));
    seg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const idx = els.segs.indexOf(seg);
        const next =
          e.key === 'ArrowRight'
            ? els.segs[(idx + 1) % els.segs.length]
            : els.segs[(idx - 1 + els.segs.length) % els.segs.length];
        next.focus();
        setLevel(next.dataset.level, true);
      }
    });
  });

  // Consent
  const consentSend = $('consentSend');
  const consentCancel = $('consentCancel');
  if (consentSend) consentSend.addEventListener('click', () => vscode.postMessage({ type: 'consent', granted: true }));
  if (consentCancel) consentCancel.addEventListener('click', () => vscode.postMessage({ type: 'consent', granted: false }));

  // Outcome actions
  const actionMap = { understand: 'understand', explainDiff: 'explainDifferently', testMe: 'testMe' };
  Object.keys(actionMap).forEach((id) => {
    const btn = $(id);
    if (btn) btn.addEventListener('click', () => vscode.postMessage({ type: 'action', action: actionMap[id] }));
  });

  // Follow-up
  if (els.followupInput) {
    els.followupInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && els.followupInput.value.trim()) {
        vscode.postMessage({ type: 'question', text: els.followupInput.value.trim() });
        els.followupInput.value = '';
      }
    });
  }

  if (els.compCheck) {
    els.compCheck.addEventListener('click', function () {
      if (compSelected < 0) {
        els.compResult.hidden = false;
        els.compResult.className = 'comprehension__result';
        els.compResult.textContent = 'Select an answer first.';
        return;
      }
      vscode.postMessage({ type: 'comprehensionAnswer', selectedIndex: compSelected });
    });
  }

  const dashboard = $('dashboard');
  if (dashboard) dashboard.addEventListener('click', () => vscode.postMessage({ type: 'openDashboard' }));

  // Host -> webview
  window.addEventListener('message', (event) => {
    const msg = event.data;
    switch (msg.type) {
      case 'review': showContext(msg.request); break;
      case 'level': setLevel(msg.level, false); break;
      case 'preview': showPreview(msg.text, msg.suspects); break;
      case 'blocked': showBlocked(msg.findings); break;
      case 'streamStart': streamStart(); break;
      case 'token': appendToken(msg.text); break;
      case 'rendered': renderSegments(msg.segments, msg.unverified); break;
      case 'streamDone': streamDone(msg.mock); break;
      case 'streamError': streamError(msg.message); break;
      case 'comprehensionLoading': comprehensionLoading(); break;
      case 'comprehension': showComprehension(msg.question, msg.options); break;
      case 'comprehensionResult': showComprehensionResult(msg.pass, msg.rationale); break;
      case 'stats': showStats(msg.progress); break;
      case 'offline': showOffline(); break;
      case 'clear':
        hide(els.context, els.preview, els.blocked, els.explain, els.controls, els.followup);
        show(els.empty);
        break;
    }
  });

  vscode.postMessage({ type: 'ready' });
})();
