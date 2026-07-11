// Uncode review panel — webview script. No network access; talks to the extension host
// only via postMessage. (Secret filtering / AI I/O is host-side by design.)
(function () {
  const vscode = acquireVsCodeApi();

  const els = {
    context: document.getElementById('context'),
    ctxTitle: document.getElementById('ctxTitle'),
    ctxDetail: document.getElementById('ctxDetail'),
    ctxFiles: document.getElementById('ctxFiles'),
    empty: document.getElementById('empty'),
    explainBody: document.getElementById('explainBody'),
    segs: Array.from(document.querySelectorAll('.seg')),
  };

  function setLevel(level, notifyHost) {
    els.segs.forEach((seg) => {
      const active = seg.dataset.level === level;
      seg.setAttribute('aria-checked', active ? 'true' : 'false');
    });
    if (notifyHost) {
      vscode.postMessage({ type: 'levelChanged', level });
    }
  }

  function showReview(request) {
    els.ctxTitle.textContent = request.title;
    els.ctxDetail.textContent = request.detail;
    els.ctxFiles.innerHTML = '';
    request.files.slice(0, 50).forEach((f) => {
      const li = document.createElement('li');
      li.textContent = f;
      li.title = f;
      els.ctxFiles.appendChild(li);
    });
    els.context.hidden = false;
    els.empty.hidden = true;
    els.explainBody.hidden = false;
    setLevel(request.level, false);
  }

  // Level selector (keyboard + click)
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

  // Outcome actions
  const actionMap = {
    understand: 'understand',
    explainDiff: 'explainDifferently',
    testMe: 'testMe',
  };
  Object.keys(actionMap).forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener('click', () =>
        vscode.postMessage({ type: 'action', action: actionMap[id] }),
      );
    }
  });

  const dashboard = document.getElementById('dashboard');
  if (dashboard) {
    dashboard.addEventListener('click', () => vscode.postMessage({ type: 'openDashboard' }));
  }

  // Host -> webview
  window.addEventListener('message', (event) => {
    const msg = event.data;
    switch (msg.type) {
      case 'review':
        showReview(msg.request);
        break;
      case 'level':
        setLevel(msg.level, false);
        break;
      case 'clear':
        els.context.hidden = true;
        els.explainBody.hidden = true;
        els.empty.hidden = false;
        break;
    }
  });

  vscode.postMessage({ type: 'ready' });
})();
