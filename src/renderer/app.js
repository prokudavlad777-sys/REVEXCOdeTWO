(function () {
  const RX = window.RX, $ = RX.$, api = window.revex, t = (...a) => RX.t(...a);
  const S = {
    settings: null, hw: null, status: { running: false, installed: false }, installed: [], catalog: [], cloud: [], recommended: null,
    chats: [], chat: null, project: { root: null, name: null }, attachments: [], gen: null, pulls: {}, info: {}, lastDone: null, installProg: null
  };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const lastOf = (role) => { for (let i = S.chat.messages.length - 1; i >= 0; i--) if (S.chat.messages[i].role === role) return S.chat.messages[i]; return null; };
  const errText = (e) => {
    const s = String((e && e.message) || e || '');
    if (s === 'NO_MODELS') return t('err.noModels');
    if (s.startsWith('MODEL_NOT_INSTALLED')) return t('err.modelMissing', { m: s.split(':').slice(1).join(':') });
    if (/fetch failed|ECONNREFUSED|Failed to fetch/i.test(s)) return t('err.engine');
    if (s === 'NO_PROJECT') return t('err.noProject');
    return s;
  };

  // ───────── чати ─────────
  const chatForDisk = (c) => ({
    id: c.id, title: c.title, created: c.created, updated: c.updated,
    messages: c.messages.map((m) => ({ role: m.role, content: m.content, ocr: m.ocr, meta: m.meta, error: m.error, images: (m.images || []).map((i) => ({ name: i.name })) }))
  });
  async function persist() {
    if (!S.chat || !S.chat.messages.length) return;
    try { await api.chatSave(chatForDisk(S.chat)); await loadChats(); } catch (e) { RX.toast(errText(e)); }
  }
  async function loadChats() { S.chats = await api.chatsList(); renderChatList(); }
  function newChat() {
    if (S.gen) return;
    S.chat = { id: uid(), title: t('chat.untitled'), created: Date.now(), messages: [] };
    renderChatList(); renderMessages();
  }
  async function openChat(id) {
    if (S.gen) return;
    try { S.chat = await api.chatGet(id); } catch (e) { return RX.toast(errText(e)); }
    renderChatList(); renderMessages();
  }
  function renderChatList() {
    const box = $('chatList'); box.innerHTML = '';
    for (const c of S.chats) {
      const el = document.createElement('div');
      el.className = 'item' + (S.chat && c.id === S.chat.id ? ' on' : '');
      el.innerHTML = `<span class="t">${RX.esc(c.title)}</span><button class="x" title="${t('chat.delete')}">×</button>`;
      el.onclick = (e) => {
        if (e.target.classList.contains('x')) {
          if (!confirm(t('chat.confirmDelete'))) return;
          api.chatDelete(c.id).then(async () => { if (S.chat && S.chat.id === c.id) newChat(); await loadChats(); });
        } else openChat(c.id);
      };
      box.appendChild(el);
    }
    $('chatTitle').textContent = S.chat ? S.chat.title : '';
  }

  // ───────── повідомлення ─────────
  function footText(m) {
    const x = m.meta; if (!x) return '';
    const p = [x.model];
    if (x.cached) p.push(t('msg.cached'));
    if (x.tps) p.push(x.tps + ' tok/s');
    if (x.ttft != null && !x.cached) p.push(t('msg.ttft', { n: x.ttft }));
    if (x.stopped) p.push(t('msg.stopped'));
    if (x.reason === 'length') p.push(t('msg.length'));
    if (x.files && x.files.length) p.push(t('msg.files', { n: x.files.length }));
    return p.filter(Boolean).join(' · ');
  }
  function fillMsg(el, m) {
    const body = el.querySelector('.body');
    if (m.role === 'user') {
      let h = '';
      if (m.images && m.images.length) h += '<div class="imgs">' + m.images.map((i) => i.dataUrl ? `<img src="${i.dataUrl}" alt="${RX.esc(i.name)}">` : `<span class="badge">${RX.esc(i.name)}</span>`).join('') + '</div>';
      body.innerHTML = h + `<div style="white-space:pre-wrap">${RX.esc(m.content)}</div>`;
    } else {
      body.innerHTML = RX.renderMessage(m.content) + (m.error ? `<div class="err">${RX.esc(m.error)}</div>` : '');
      body.classList.toggle('cursor', !!m.streaming);
    }
    el.querySelector('.foot').textContent = footText(m);
  }
  function msgEl(m, i) {
    const el = document.createElement('div');
    el.className = 'msg ' + m.role; el.dataset.i = i;
    el.innerHTML = `<div class="role">${m.role === 'user' ? t('msg.you') : 'REVEX'}</div><div class="body"></div><div class="foot"></div>`;
    fillMsg(el, m);
    return el;
  }
  function renderMessages() {
    const box = $('messages'); box.innerHTML = '';
    if (!S.chat || !S.chat.messages.length) {
      box.innerHTML = `<div class="welcome"><h2>${t('welcome.title')}</h2><p>${t('welcome.text')}</p></div>`;
    } else S.chat.messages.forEach((m, i) => box.appendChild(msgEl(m, i)));
    RX.colorize(box); box.scrollTop = box.scrollHeight;
    $('chatTitle').textContent = S.chat ? S.chat.title : '';
    updateGenBar();
  }
  let rafPending = false;
  function updateLast(final) {
    if (rafPending && !final) return; rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      const box = $('messages'), el = box.lastElementChild;
      if (!el || !S.chat) return;
      const m = S.chat.messages[S.chat.messages.length - 1];
      const near = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
      fillMsg(el, m);
      if (final) RX.colorize(el);
      if (near) box.scrollTop = box.scrollHeight;
    });
  }
  function updateGenBar() {
    const last = S.chat && S.chat.messages[S.chat.messages.length - 1];
    const canAct = !S.gen && last && last.role === 'assistant';
    $('btnStop').classList.toggle('hidden', !S.gen);
    $('btnContinue').classList.toggle('hidden', !canAct);
    $('btnRetry').classList.toggle('hidden', !canAct);
    $('btnSend').disabled = !!S.gen;
    if (!S.gen) $('liveTps').textContent = '';
  }

  // ───────── відправка ─────────
  async function send(o = {}) {
    if (S.gen) return;
    if (!S.installed.length) { RX.toast(t('err.noModels')); setTab('models'); return; }
    const input = $('input');
    if (!S.chat) newChat();
    const msgs = S.chat.messages;
    if (o.regenerate) { while (msgs.length && msgs[msgs.length - 1].role === 'assistant') msgs.pop(); if (!msgs.length) return; }
    else if (!o.cont) {
      const text = input.value.trim();
      if (!text && !S.attachments.length) return;
      msgs.push({ role: 'user', content: text, images: S.attachments.slice() });
      if (msgs.length === 1) S.chat.title = (text || S.attachments[0].name).replace(/\s+/g, ' ').slice(0, 44);
      input.value = ''; input.style.height = ''; S.attachments = []; renderAttach();
    }
    const lastUserIdx = (() => { for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].role === 'user') return i; return -1; })();
    const payload = msgs.map((m, i) => ({
      role: m.role, content: m.content, ocr: m.ocr,
      images: i === lastUserIdx ? (m.images || []).filter((x) => x.dataUrl) : undefined
    }));
    let am;
    if (o.cont) { am = msgs[msgs.length - 1]; am.streaming = true; }
    else { am = { role: 'assistant', content: '', streaming: true }; msgs.push(am); }
    const reqId = uid();
    S.gen = { reqId, msg: am, chunks: 0, tFirst: 0, promptTokens: 0, numCtx: 0, cont: !!o.cont };
    renderMessages();
    const act = RX.ed.getActive && $('editorPane').classList.contains('hidden') === false ? RX.ed.getActive() : null;
    try {
      await api.chatSend({
        reqId, model: S.settings.model, messages: payload, options: S.settings.gen, lang: RX.lang,
        useProject: !!(S.settings.useProject && S.project.root), active: act, regenerate: !!o.regenerate, continue: !!o.cont
      });
    } catch (e) { finishGen({ type: 'error', error: errText(e) }); }
  }
  function finishGen(ev) {
    const g = S.gen; if (!g) return;
    const m = g.msg; m.streaming = false;
    m.meta = Object.assign({}, m.meta || {}, {});
    if (ev.type === 'error') m.error = errText(ev.error);
    else {
      Object.assign(m.meta, { tps: ev.tps, ttft: ev.ttft, stopped: ev.stopped, reason: ev.doneReason, cached: ev.cached });
      S.lastDone = { tps: ev.tps, ttft: ev.ttft, used: (ev.promptEval || 0) + (ev.evalCount || 0), numCtx: g.numCtx, model: m.meta.model, cached: ev.cached };
    }
    S.gen = null;
    updateLast(true); updateGenBar(); updateStats(); persist();
  }
  api.on('chat:event', (ev) => {
    const g = S.gen; if (!g || ev.reqId !== g.reqId) return;
    const m = g.msg;
    if (ev.type === 'status') $('liveTps').textContent = t('msg.ocr');
    else if (ev.type === 'meta') {
      g.promptTokens = ev.promptTokens; g.numCtx = ev.numCtx; g.maxCtx = ev.maxCtx;
      m.meta = Object.assign(m.meta || {}, { model: ev.model, files: ev.files, cached: ev.cached });
      if (ev.ocr) { const u = lastOf('user'); if (u) u.ocr = ev.ocr; }
      $('stModel').textContent = ev.model;
      updateStats();
    } else if (ev.type === 'chunk') {
      if (!g.tFirst) g.tFirst = performance.now();
      g.chunks++; m.content += ev.text; updateLast();
      const el = (performance.now() - g.tFirst) / 1000;
      if (el > 0.4) $('liveTps').textContent = '≈ ' + (g.chunks / el).toFixed(1) + ' tok/s';
    } else if (ev.type === 'done' || ev.type === 'error') finishGen(ev);
  });

  function updateStats() {
    const d = S.lastDone, g = S.gen;
    if (g) {
      const used = g.promptTokens + g.chunks;
      setCtx(used, g.numCtx, g.maxCtx);
    } else if (d) {
      $('stTps').textContent = d.cached ? t('msg.cached') : (d.tps ? d.tps + ' tok/s' : '—');
      $('stTtft').textContent = d.ttft != null ? d.ttft + ' ms' : '—';
      $('stModel').textContent = d.model || '—';
      setCtx(d.used, d.numCtx, S.info[d.model] && S.info[d.model].maxCtx);
    }
  }
  function setCtx(used, num, max) {
    const pct = num ? Math.min(100, used / num * 100) : 0;
    const bar = $('ctxBar'); bar.style.width = pct + '%'; bar.className = pct > 90 ? 'max' : pct > 70 ? 'hi' : '';
    $('ctxTxt').textContent = num ? `${RX.fmtK(used)} / ${RX.fmtK(num)}` : '—';
    $('ctxNote').textContent = max ? (max >= 1e6 ? t('ctx.million', { n: RX.fmtK(max) }) : t('ctx.max', { n: RX.fmtK(max) })) : '';
  }

  // ───────── вкладення ─────────
  function renderAttach() {
    const box = $('attachBar'); box.innerHTML = '';
    S.attachments.forEach((a, i) => {
      const d = document.createElement('div'); d.className = 'att';
      d.innerHTML = `<img src="${a.dataUrl}" alt="${RX.esc(a.name)}" title="${RX.esc(a.name)}"><button title="${t('chat.remove')}">×</button>`;
      d.querySelector('button').onclick = () => { S.attachments.splice(i, 1); renderAttach(); };
      box.appendChild(d);
    });
  }
  async function addFiles(files) {
    for (const f of files) {
      if (S.attachments.length >= 6) { RX.toast(t('att.max')); break; }
      try { S.attachments.push(await RX.readImage(f)); }
      catch (e) { RX.toast(e.message === 'size' ? t('att.size') : t('att.type')); }
    }
    renderAttach();
  }

  // ───────── вкладки / праві налаштування ─────────
  function setTab(name) {
    document.querySelectorAll('#leftTabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
    document.querySelectorAll('.tabpane').forEach((p) => p.classList.toggle('on', p.id === 'tab-' + name));
    if (name === 'models') refreshModels();
  }
  function renderEngine() {
    const s = S.status;
    $('engDot').classList.toggle('on', !!s.running);
    $('engText').textContent = s.running ? t('eng.running', { v: s.version || '' }) : s.installed ? t('eng.stopped') : t('eng.missing');
    const b = $('engStart');
    b.classList.toggle('hidden', !!s.running);
    b.textContent = s.installed ? t('eng.start') : t('eng.install');
    if (S.installProg) $('engText').textContent = S.installProg;
  }
  async function engineAction() {
    if (S.status.installed) {
      $('engText').textContent = t('eng.starting');
      const r = await api.engineStart();
      if (!r.ok) RX.toast(t('eng.failed'));
    } else await installEngine();
    await refreshStatus(); await refreshModels();
  }
  async function installEngine() {
    if (!confirm(t('eng.confirmInstall'))) return;
    try {
      const r = await api.engineInstall();
      S.installProg = null;
      if (!r.ok) RX.toast(r.reason === 'unsupported_os' ? t('eng.unsupported') : t('eng.failed'), 4000);
    } catch (e) { S.installProg = null; RX.toast(errText(e), 5000); }
  }
  api.on('ollama:install', (p) => {
    S.installProg = p.phase === 'download' ? t('eng.downloading', { p: p.total ? Math.round(p.completed / p.total * 100) : '…', s: (p.speed / 1048576).toFixed(1) }) : t('eng.installing');
    renderEngine(); const w = $('wzProg'); if (w) w.textContent = S.installProg;
  });
  async function refreshStatus() { try { S.status = await api.engineStatus(); } catch (_) { S.status = { running: false, installed: false }; } renderEngine(); }

  function renderModelSelect() {
    const sel = $('modelSel'); sel.innerHTML = '';
    const add = (v, l) => { const o = document.createElement('option'); o.value = v; o.textContent = l; sel.appendChild(o); };
    add('auto', t('r.auto'));
    for (const m of S.installed) add(m.name, `${m.name}${m.vision ? ' 🖼' : ''} (${m.sizeGB} GB)`);
    if (![...sel.options].some((o) => o.value === S.settings.model)) S.settings.model = 'auto';
    sel.value = S.settings.model;
    $('modelNote').textContent = S.settings.model === 'auto' ? t('r.autoNote') : (S.info[S.settings.model] ? `${S.info[S.settings.model].params || ''} · ctx ${RX.fmtK(S.info[S.settings.model].maxCtx || 0)}` : '');
    renderCtxOptions();
  }
  function renderCtxOptions() {
    const sel = $('pCtx');
    let max = S.settings.model === 'auto' ? Math.max(0, ...S.installed.map((m) => (S.info[m.name] || {}).maxCtx || 0)) : ((S.info[S.settings.model] || {}).maxCtx || 0);
    if (!max) max = 32768;
    const all = [2048, 4096, 8192, 16384, 32768, 65536, 131072, 262144, 524288, 1048576].filter((n) => n <= max);
    sel.innerHTML = all.map((n) => `<option value="${n}">${RX.fmtK(n)}${n >= 65536 ? ' ⚠' : ''}</option>`).join('');
    const cur = Math.min(S.settings.gen.num_ctx, all[all.length - 1] || 8192);
    sel.value = String(all.includes(cur) ? cur : all[all.length - 1]);
    S.settings.gen.num_ctx = +sel.value;
  }
  function bindParams() {
    const g = S.settings.gen;
    $('pTemp').value = g.temperature; $('vTemp').textContent = g.temperature;
    $('pTopP').value = g.top_p; $('vTopP').textContent = g.top_p;
    $('pPredict').value = g.num_predict; $('pCache').checked = S.settings.cacheEnabled !== false;
    $('useProject').checked = !!S.settings.useProject; $('langSel').value = RX.lang;
  }
  const saveGen = () => api.saveSettings({ gen: S.settings.gen });
  function wireParams() {
    $('pTemp').oninput = (e) => { S.settings.gen.temperature = +e.target.value; $('vTemp').textContent = e.target.value; saveGen(); };
    $('pTopP').oninput = (e) => { S.settings.gen.top_p = +e.target.value; $('vTopP').textContent = e.target.value; saveGen(); };
    $('pCtx').onchange = (e) => { S.settings.gen.num_ctx = +e.target.value; saveGen(); if (+e.target.value >= 65536) RX.toast(t('ctx.warn')); };
    $('pPredict').onchange = (e) => { S.settings.gen.num_predict = Math.max(0, +e.target.value || 0); saveGen(); };
    $('pCache').onchange = (e) => { S.settings.cacheEnabled = e.target.checked; api.saveSettings({ cacheEnabled: e.target.checked }); };
    $('useProject').onchange = (e) => { S.settings.useProject = e.target.checked; api.saveSettings({ useProject: e.target.checked }); };
    $('modelSel').onchange = (e) => { S.settings.model = e.target.value; api.saveSettings({ model: e.target.value }); renderModelSelect(); };
    $('btnClearCache').onclick = async () => { await api.cacheClear(); RX.toast(t('r.cacheCleared')); };
    $('langSel').onchange = (e) => setLang(e.target.value);
  }
  function setLang(l) {
    RX.lang = l; S.settings.lang = l; api.saveSettings({ lang: l });
    RX.applyI18n(); renderAll();
    if (RX.ed.editor) RX.ed.registerActions();
  }

  // ───────── моделі ─────────
  async function refreshModels() {
    try {
      const r = await api.modelsList();
      S.installed = r.installed; S.catalog = r.catalog;
      await Promise.all(S.installed.map(async (m) => { if (!S.info[m.name]) { try { S.info[m.name] = await api.modelInfo(m.name); } catch (_) {} } }));
    } catch (_) { S.installed = []; }
    renderModelSelect(); renderModelsTab();
  }
  const levelLabel = (c) => t('lvl.' + c.level);
  function renderModelsTab() {
    const hw = S.hw;
    if (hw) $('hwBox').innerHTML = `<b>${t('hw.title')}</b><br>${RX.esc(hw.os)} · ${hw.cores} ${t('hw.cores')}<br>${RX.esc(hw.cpu)}<br>RAM ${hw.ramGB} GB · ${t('hw.gpu')}: ${RX.esc(hw.gpuName || t('hw.none'))}${hw.vramGB ? ' · VRAM ' + hw.vramGB + ' GB' : ''}<br>${t('hw.disk')}: ${hw.freeDiskGB != null ? hw.freeDiskGB + ' GB' : '?'}`;
    const il = $('installedList'); il.innerHTML = '';
    if (!S.installed.length) il.innerHTML = `<div class="muted small pad">${S.status.running ? t('models.none') : t('eng.stopped')}</div>`;
    for (const m of S.installed) {
      const d = document.createElement('div'); d.className = 'mcard';
      d.innerHTML = `<div class="h"><b>${RX.esc(m.name)}</b>${m.vision ? '<span class="badge vis">🖼</span>' : ''}<span class="muted small">${m.sizeGB} GB</span></div>
        <div class="row"><button class="btn sm" data-a="test">${t('models.test')}</button><button class="btn sm danger" data-a="del">${t('models.delete')}</button><span class="small muted" data-r></span></div>`;
      d.querySelector('[data-a=test]').onclick = async (e) => {
        const r = d.querySelector('[data-r]'); r.textContent = '…';
        try { const x = await api.modelTest(m.name); r.textContent = `${x.text || 'OK'} · ${x.firstTokenMs} ms · ${x.tps || '?'} tok/s`; } catch (er) { r.textContent = errText(er); }
      };
      d.querySelector('[data-a=del]').onclick = async () => {
        if (!confirm(t('models.confirmDelete', { m: m.name }))) return;
        try { await api.modelDelete(m.name); delete S.info[m.name]; await refreshModels(); } catch (er) { RX.toast(errText(er)); }
      };
      il.appendChild(d);
    }
    const cl = $('catalogList'); cl.innerHTML = '';
    for (const m of S.catalog) {
      const p = S.pulls[m.tag];
      const d = document.createElement('div'); d.className = 'mcard'; d.dataset.pn = m.tag;
      let act;
      if (m.installed) act = `<span class="badge gpu">${t('models.installedBadge')}</span>`;
      else if (p && !p.paused && !p.error) act = `<div class="pbar"><i style="width:${p.pct || 0}%"></i></div><div class="row"><span class="small muted" data-pt>${pullText(p)}</span><span class="sp"></span><button class="btn sm" data-a="pause">${t('models.pause')}</button><button class="btn sm danger" data-a="cancel">${t('models.cancel')}</button></div>`;
      else if (p && p.paused) act = `<div class="pbar"><i style="width:${p.pct || 0}%"></i></div><div class="row"><span class="small muted">${t('models.paused')}</span><span class="sp"></span><button class="btn sm primary" data-a="get">${t('models.resume')}</button><button class="btn sm danger" data-a="cancel">${t('models.cancel')}</button></div>`;
      else act = `${p && p.error ? `<div class="small err">${RX.esc(p.error)}</div>` : ''}<button class="btn sm primary" data-a="get">${t('models.download')}</button>`;
      d.innerHTML = `<div class="h"><b>${RX.esc(m.label)}</b>${m.vision ? '<span class="badge vis">🖼</span>' : ''}<span class="badge ${m.compat.level}">${levelLabel(m.compat)}</span></div>
        <div class="small muted">${RX.esc(m.desc)} · ${m.sizeGB} GB · ${t('models.needs', { n: m.compat.need })}${m.compat.reason ? ' · ' + t('models.not.' + m.compat.reason) : ''}${m.tag === S.recommended ? ' · ⭐ ' + t('models.recommended') : ''}</div>${act}`;
      d.querySelector('[data-a=get]') && (d.querySelector('[data-a=get]').onclick = () => startPull(m));
      d.querySelector('[data-a=pause]') && (d.querySelector('[data-a=pause]').onclick = () => { S.pulls[m.tag].pausing = true; api.modelPullCancel(m.tag); });
      d.querySelector('[data-a=cancel]') && (d.querySelector('[data-a=cancel]').onclick = () => { delete S.pulls[m.tag]; api.modelPullCancel(m.tag); renderModelsTab(); });
      cl.appendChild(d);
    }
    const cc = $('cloudList'); cc.innerHTML = '';
    for (const c of S.cloud) cc.innerHTML += `<div class="mcard"><div class="h"><b>${RX.esc(c.name)}</b><span class="badge no">${t('cloud.status')}</span></div></div>`;
  }
  const pullText = (p) => `${p.status || ''} ${p.pct ? p.pct + '%' : ''} ${p.speed ? '· ' + (p.speed / 1048576).toFixed(1) + ' MB/s' : ''} ${p.total ? '· ' + RX.fmtBytes(p.completed) + ' / ' + RX.fmtBytes(p.total) : ''}`;
  async function startPull(m) {
    if (!S.status.running) { RX.toast(t('err.engine')); return; }
    if (m.compat.level === 'no' && !confirm(t('models.warnNo', { m: m.label }))) return;
    S.pulls[m.tag] = { status: 'start', pct: 0 };
    renderModelsTab();
    try { await api.modelPull(m.tag); } catch (e) { S.pulls[m.tag] = { error: errText(e) }; renderModelsTab(); }
  }
  api.on('models:progress', async (ev) => {
    const p = S.pulls[ev.name] || (S.pulls[ev.name] = {});
    if (ev.done) { delete S.pulls[ev.name]; RX.toast(t('models.done', { m: ev.name })); await refreshModels(); if (RX.$('wzProg')) renderWizard(); return; }
    if (ev.error) { S.pulls[ev.name] = { error: ev.error }; renderModelsTab(); if ($('wzProg')) renderWizard(); return; }
    if (ev.cancelled) { if (p.pausing) { p.paused = true; p.pausing = false; } else delete S.pulls[ev.name]; renderModelsTab(); if ($('wzProg')) renderWizard(); return; }
    p.status = ev.status; p.completed = ev.completed; p.total = ev.total; p.speed = ev.speed; p.pct = ev.total ? Math.round(ev.completed / ev.total * 100) : p.pct || 0;
    const card = document.querySelector(`[data-pn="${CSS.escape(ev.name)}"]`);
    if (card) { const i = card.querySelector('.pbar i'), tx = card.querySelector('[data-pt]'); if (i) i.style.width = p.pct + '%'; if (tx) tx.textContent = pullText(p); }
    const w = $('wzProg'); if (w && w.dataset.m === ev.name) { w.textContent = pullText(p); }
  });

  // ───────── майстер першого запуску ─────────
  function renderWizard() {
    const hw = S.hw, rec = S.catalog.find((m) => m.tag === S.recommended);
    const textModels = S.installed.filter((m) => !m.vision);
    const pull = rec && S.pulls[rec.tag];
    const step = (ok, title, body, acts = '') => `<div class="step"><span class="s">${ok ? '✅' : '⬜'}</span><div><b>${title}</b><div class="small muted">${body}</div></div><div class="acts">${acts}</div></div>`;
    const box = RX.modal(`<h2>${t('wz.title')}</h2><div class="small muted">${t('wz.intro')}</div>` +
      step(true, t('wz.hw'), `${RX.esc(hw.os)} · RAM ${hw.ramGB} GB · ${RX.esc(hw.gpuName || t('hw.none'))}${hw.vramGB ? ' · VRAM ' + hw.vramGB + ' GB' : ''} · ${t('hw.disk')} ${hw.freeDiskGB != null ? hw.freeDiskGB + ' GB' : '?'}`) +
      step(S.status.running, t('wz.engine'), S.status.running ? t('eng.running', { v: S.status.version || '' }) : S.status.installed ? t('eng.stopped') : t('wz.engineMissing'),
        S.status.running ? '' : `<button class="btn sm primary" data-w="engine">${S.status.installed ? t('eng.start') : t('eng.install')}</button><span id="wzProg" class="small muted">${RX.esc(S.installProg || '')}</span>`) +
      step(textModels.length > 0, t('wz.model'), rec ? `${RX.esc(rec.label)} · ${rec.sizeGB} GB · ${levelLabel(rec.compat)}` : '—',
        !S.status.running ? '' : textModels.length ? `<span class="badge gpu">${t('models.installedBadge')}</span>` :
          pull && !pull.paused && !pull.error ? `<span id="wzProg" data-m="${rec.tag}" class="small muted">${pullText(pull)}</span><button class="btn sm" data-w="pause">${t('models.pause')}</button><button class="btn sm danger" data-w="cancel">${t('models.cancel')}</button>` :
          `${pull && pull.error ? `<span class="small err">${RX.esc(pull.error)}</span>` : ''}<button class="btn sm primary" data-w="get">${pull && pull.paused ? t('models.resume') : t('wz.download')}</button>`) +
      step(!!(S.wzTest && S.wzTest.ok), t('wz.test'), S.wzTest ? RX.esc(S.wzTest.text) : t('wz.testHint'),
        textModels.length ? `<button class="btn sm" data-w="test">${t('wz.runTest')}</button>` : '') +
      `<div class="row" style="margin-top:14px"><span class="sp"></span><button class="btn primary" data-w="done">${t('wz.done')}</button></div>`);
    box.onclick = async (e) => {
      const a = e.target.dataset && e.target.dataset.w; if (!a) return;
      if (a === 'done') { RX.closeModal(); S.settings.firstRunDone = true; api.saveSettings({ firstRunDone: true }); return; }
      if (a === 'engine') { await engineAction(); renderWizard(); }
      if (a === 'get') { await startPull(rec); renderWizard(); }
      if (a === 'pause') { S.pulls[rec.tag].pausing = true; api.modelPullCancel(rec.tag); }
      if (a === 'cancel') { delete S.pulls[rec.tag]; api.modelPullCancel(rec.tag); renderWizard(); }
      if (a === 'test') {
        S.wzTest = { ok: false, text: '…' }; renderWizard();
        try { const x = await api.modelTest(textModels[0].name); S.wzTest = { ok: true, text: `${textModels[0].name}: «${x.text}» · ${x.firstTokenMs} ms · ${x.tps || '?'} tok/s` }; }
        catch (er) { S.wzTest = { ok: false, text: errText(er) }; }
        renderWizard();
      }
    };
  }

  // ───────── проєкт ─────────
  function renderProjInfo(p) {
    const el = $('projInfo');
    if (!S.project.root) { el.textContent = t('proj.none'); return; }
    let s = `<b>${RX.esc(S.project.name)}</b><br>`;
    if (p && p.state === 'building') s += t('proj.indexing', { n: p.files, t: p.total });
    else if (p && p.state === 'ready') s += t('proj.indexed', { f: p.files, c: p.chunks });
    else if (p && p.state === 'error') s += RX.esc(p.error);
    el.innerHTML = s + ' <button class="btn sm" id="btnReindex">' + t('proj.reindex') + '</button>';
    $('btnReindex').onclick = () => api.projectReindex();
  }
  api.on('project:index', renderProjInfo);
  async function setProject(r) {
    if (!r) return;
    S.project = { root: r.root, name: r.name };
    renderProjInfo({ state: 'building', files: 0, total: '…' });
    $('tree').innerHTML = ''; await loadDir('', $('tree'));
    if (!S.settings.useProject) { /* користувач вимкнув контекст проєкту */ }
  }
  async function loadDir(dir, container) {
    let items; try { items = await api.projectList(dir); } catch (e) { return RX.toast(errText(e)); }
    for (const it of items) {
      const n = document.createElement('div'); n.className = 'node ' + (it.dir ? 'dir' : 'file'); n.textContent = it.name; n.title = it.path;
      container.appendChild(n);
      if (it.dir) {
        const kids = document.createElement('div'); kids.className = 'kids hidden'; container.appendChild(kids);
        n.onclick = async () => {
          if (!kids.dataset.loaded) { kids.dataset.loaded = '1'; await loadDir(it.path, kids); }
          kids.classList.toggle('hidden'); n.classList.toggle('open');
        };
      } else n.onclick = () => openFile(it.path);
    }
  }
  async function openFile(path, line) {
    showEditor(true);
    try { await RX.ed.open(path, line); } catch (e) { RX.toast(errText(e)); }
  }
  async function doSearch() {
    const q = $('projSearch').value.trim(); const box = $('searchRes'); box.innerHTML = '';
    if (!q) return;
    if (!S.project.root) return RX.toast(t('err.noProject'));
    const hits = await api.projectSearch(q);
    if (!hits.length) box.innerHTML = `<div class="muted small pad">${t('proj.noHits')}</div>`;
    for (const h of hits) {
      const d = document.createElement('div'); d.className = 'hit';
      d.innerHTML = `<b class="small">${RX.esc(h.file)}:${h.line}</b><pre>${RX.esc(h.snippet)}</pre>`;
      d.onclick = () => openFile(h.file, h.line); box.appendChild(d);
    }
  }

  // ───────── редактор / запуск ─────────
  function showEditor(v) {
    $('editorPane').classList.toggle('hidden', !v); $('splitter').classList.toggle('hidden', !v);
    if (v && !RX.ed.editor) RX.ed.init().then(() => RX.ed.renderTabs()).catch((e) => RX.toast('Monaco: ' + e.message, 6000));
  }
  RX.onAiAction = (kind) => {
    const s = RX.ed.getSelection(); if (!s) return;
    const act = RX.ed.getActive();
    const code = s.text || (act && act.content) || '';
    const lang = RX.ed.langFor(s.path);
    $('input').value = t('ai.p.' + kind, { f: s.path }) + '\n\n```' + lang + ' ' + s.path + '\n' + code + '\n```';
    send();
  };
  async function applyBlock(i, n) {
    const m = S.chat.messages[i]; if (!m) return;
    const seg = RX.blocks.parse(m.content).filter((s) => s.type === 'code')[n]; if (!seg) return;
    if (!S.project.root) return RX.toast(t('err.noProject'));
    let path = (seg.path || RX.ed.active || '').replace(/^\.?\//, '');
    if (!path) return RX.toast(t('err.noTarget'));
    showEditor(true);
    let original = '', isNew = false;
    const open = RX.ed.files.get(path);
    if (open) original = open.model.getValue();
    else { try { original = await api.projectRead(path); } catch (_) { isNew = true; } }
    RX.ed.showDiff({ path, original, modified: seg.code + '\n', isNew });
  }
  async function copyText(s) {
    try { await navigator.clipboard.writeText(s); }
    catch (_) { const ta = document.createElement('textarea'); ta.value = s; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
    RX.toast(t('cb.copied'), 1200);
  }
  api.on('run:event', (ev) => {
    const out = $('termOut'); $('term').classList.remove('hidden');
    if (ev.type === 'exit') { out.textContent += `\n[exit ${ev.code}]\n`; $('edRun').classList.remove('hidden'); $('edRunStop').classList.add('hidden'); }
    else out.textContent += ev.text;
    out.scrollTop = out.scrollHeight;
  });
  async function runActive() {
    if (!RX.ed.active) return RX.toast(t('ed.empty'));
    if (RX.ed.isDirty(RX.ed.active)) await RX.ed.save();
    $('termOut').textContent = ''; $('term').classList.remove('hidden');
    try {
      const r = await api.runFile(RX.ed.active);
      if (r && r.started) { $('edRun').classList.add('hidden'); $('edRunStop').classList.remove('hidden'); }
    } catch (e) { RX.toast(e.message === 'UNSUPPORTED_EXT' ? t('ed.unsupportedRun') : errText(e), 4000); }
  }

  // ───────── живі показники ─────────
  const setMeter = (bar, txt, used, total) => {
    if (total == null) { bar.style.width = '0'; txt.textContent = t('hw.na'); return; }
    const p = Math.min(100, used / total * 100); bar.style.width = p + '%'; bar.className = p > 90 ? 'max' : p > 75 ? 'hi' : '';
    txt.textContent = `${used} / ${total} GB`;
  };
  async function pollLive() {
    try { const s = await api.hwLive(); setMeter($('ramBar'), $('ramTxt'), s.ramUsedGB, s.ramTotalGB); setMeter($('vramBar'), $('vramTxt'), s.vramUsedGB, s.vramTotalGB); } catch (_) {}
  }

  function renderAll() {
    renderChatList(); renderMessages(); renderEngine(); renderModelSelect(); renderModelsTab(); bindParams(); renderProjInfo(); updateStats();
    $('engWizard').textContent = t('r.wizard');
  }

  // ───────── події інтерфейсу ─────────
  function wireUi() {
    document.querySelectorAll('#leftTabs button').forEach((b) => (b.onclick = () => setTab(b.dataset.tab)));
    $('newChat').onclick = newChat;
    $('btnSend').onclick = () => send();
    $('btnStop').onclick = () => S.gen && api.chatStop(S.gen.reqId);
    $('btnRetry').onclick = () => send({ regenerate: true });
    $('btnContinue').onclick = () => send({ cont: true });
    $('input').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });
    $('input').addEventListener('input', (e) => { e.target.style.height = 'auto'; e.target.style.height = Math.min(200, e.target.scrollHeight) + 'px'; });
    $('input').addEventListener('paste', (e) => {
      const files = [...(e.clipboardData ? e.clipboardData.items : [])].filter((i) => i.kind === 'file' && i.type.startsWith('image/')).map((i) => i.getAsFile());
      if (files.length) { e.preventDefault(); addFiles(files); }
    });
    $('btnAttach').onclick = () => $('fileIn').click();
    $('fileIn').onchange = (e) => { addFiles([...e.target.files]); e.target.value = ''; };
    const cp = $('chatPane');
    cp.addEventListener('dragover', (e) => { e.preventDefault(); cp.classList.add('drop'); });
    cp.addEventListener('dragleave', (e) => { if (e.target === cp) cp.classList.remove('drop'); });
    cp.addEventListener('drop', (e) => { e.preventDefault(); cp.classList.remove('drop'); const f = [...e.dataTransfer.files]; if (f.length) addFiles(f); });
    $('messages').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-act]'); if (!b) return;
      const cb = b.closest('.cb'), msg = b.closest('.msg'); const i = +msg.dataset.i, n = +cb.dataset.n;
      if (b.dataset.act === 'copy') { const seg = RX.blocks.parse(S.chat.messages[i].content).filter((s) => s.type === 'code')[n]; if (seg) copyText(seg.code); }
      else applyBlock(i, n);
    });
    $('toggleEditor').onclick = () => showEditor($('editorPane').classList.contains('hidden'));
    $('openFolder').onclick = async () => { try { await setProject(await api.projectOpen()); } catch (e) { RX.toast(errText(e)); } };
    $('projSearch').addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
    $('engStart').onclick = engineAction;
    $('engWizard').onclick = () => { S.wzTest = null; renderWizard(); };
    $('edSave').onclick = () => RX.ed.save().catch((e) => RX.toast(errText(e)));
    $('edUndo').onclick = () => RX.ed.undo();
    $('edRevert').onclick = () => RX.ed.revert().catch((e) => RX.toast(errText(e)));
    $('edRun').onclick = runActive;
    $('edRunStop').onclick = () => api.runStop();
    $('termClose').onclick = () => $('term').classList.add('hidden');
    $('termClear').onclick = () => ($('termOut').textContent = '');
    $('modal').addEventListener('mousedown', (e) => { if (e.target.id === 'modal') RX.closeModal(); });
    // роздільник чат ↔ редактор
    $('splitter').addEventListener('mousedown', (e) => {
      e.preventDefault();
      const c = $('center').getBoundingClientRect();
      const move = (ev) => { const w = Math.max(340, Math.min(c.width - 340, c.right - ev.clientX)); $('editorPane').style.width = w + 'px'; };
      const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
      window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
    });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') RX.closeModal(); });
    wireParams();
  }

  async function boot() {
    wireUi();
    let init;
    try { init = await api.init(); } catch (e) { document.body.innerHTML = '<pre style="padding:20px;color:#ff6b7a">' + RX.esc(e.message) + '</pre>'; return; }
    S.settings = init.settings; S.hw = init.hw; S.status = init.status; S.installed = init.installed; S.catalog = init.catalog; S.cloud = init.cloud; S.recommended = init.recommended;
    RX.lang = S.settings.lang || 'uk'; RX.applyI18n();
    await Promise.all(S.installed.map(async (m) => { try { S.info[m.name] = await api.modelInfo(m.name); } catch (_) {} }));
    await loadChats(); newChat(); renderAll();
    pollLive(); setInterval(pollLive, 3000);
    setTimeout(() => RX.ed.load().then(() => RX.colorize($('messages'))).catch(() => {}), 400);
    setInterval(async () => { const was = S.status.running; await refreshStatus(); if (S.status.running && !was) refreshModels(); }, 10000);
    if (init.lastProject) { try { await setProject(await api.projectOpenLast()); } catch (_) {} }
    if (!S.settings.firstRunDone || !S.installed.length) renderWizard();
  }
  window.addEventListener('DOMContentLoaded', boot);
})();
