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
    controls: $('controls'),
    followup: $('followup'),
    followupInput: $('followupInput'),
    segs: Array.from(document.querySelectorAll('.seg')),
  };

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
    hide(els.empty, els.preview, els.blocked, els.explain, els.controls, els.followup);
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

  function streamStart() {
    els.explainBody.textContent = '';
    els.explainMeta.hidden = true;
    show(els.explain, els.controls, els.followup);
    hide(els.empty, els.preview, els.blocked);
  }

  function appendToken(text) {
    els.explainBody.textContent += text;
  }

  function streamDone(mock) {
    if (mock) {
      els.explainMeta.textContent = 'Mock explanation — set ANTHROPIC_API_KEY on the Uncode service for real analysis.';
      els.explainMeta.hidden = false;
    }
  }

  function streamError(message) {
    show(els.explain);
    els.explainBody.textContent = 'Could not complete the review: ' + message;
  }

  function showOffline() {
    show(els.explain);
    els.explainBody.textContent = 'You appear to be offline. Uncode will retry when a connection is available.';
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
      case 'streamDone': streamDone(msg.mock); break;
      case 'streamError': streamError(msg.message); break;
      case 'offline': showOffline(); break;
      case 'clear':
        hide(els.context, els.preview, els.blocked, els.explain, els.controls, els.followup);
        show(els.empty);
        break;
    }
  });

  vscode.postMessage({ type: 'ready' });
})();
