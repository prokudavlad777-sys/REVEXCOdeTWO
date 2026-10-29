const { app, BrowserWindow, ipcMain, dialog, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('./store');
const Cache = require('./cache');
const Ollama = require('./ollama');
const Runner = require('./runner');
const ocr = require('./ocr');
const M = require('./models');
const { getHardware, liveStats } = require('./hardware');
const { ProjectIndex, IGNORE_DIRS, estTokens } = require('./indexer');
const { systemPrompt } = require('./prompts');

let win, store, cache, ollama, index = null, projectRoot = null, hwCache = null;
const runner = new Runner();
const gens = new Map();
const pulls = new Map();
const send = (ch, p) => { if (win && !win.isDestroyed()) win.webContents.send(ch, p); };

const handle = (ch, fn) => ipcMain.handle(ch, async (_e, ...a) => {
  try { return await fn(...a); } catch (err) { return { __err: String((err && err.message) || err) }; }
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

function createWindow() {
  win = new BrowserWindow({
    width: 1500, height: 920, minWidth: 1100, minHeight: 640, backgroundColor: '#0e1016', title: 'REVEX CODE',
    icon: path.join(__dirname, '../../assets/icon.png'), autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, '../renderer/index.html'));
  // Замість CSP-мети (Monaco потребує воркерів з data: і eval) — жорсткі обмеження навігації й дозволів.
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file://')) e.preventDefault(); });
  session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(perm === 'clipboard-sanitized-write'));
  session.defaultSession.setPermissionCheckHandler((_wc, perm) => perm === 'clipboard-sanitized-write');
}

function inRoot(rel) {
  if (!projectRoot) throw new Error('NO_PROJECT');
  const abs = path.resolve(projectRoot, rel || '.');
  const r = path.relative(projectRoot, abs);
  if (r.startsWith('..') || path.isAbsolute(r)) throw new Error('OUTSIDE_PROJECT');
  if (fs.existsSync(abs)) {
    const real = path.relative(fs.realpathSync(projectRoot), fs.realpathSync(abs));
    if (real.startsWith('..') || path.isAbsolute(real)) throw new Error('OUTSIDE_PROJECT');
  }
  return abs;
}

async function getHw(force) {
  if (!hwCache || force) hwCache = await getHardware(app.getPath('home'));
  return hwCache;
}

function catalogView(hw, installedNames) {
  return M.CATALOG.map((m) => Object.assign({}, m, { compat: M.compat(m, hw), installed: installedNames.includes(m.tag) }));
}

async function installedModels() {
  try { return (await ollama.tags()).map((m) => Object.assign(m, { vision: M.isVision(m.name) })); } catch (_) { return []; }
}

async function openProject(root) {
  projectRoot = root; index = new ProjectIndex(root);
  store.saveSettings({ lastProject: root });
  index.build((p) => send('project:index', p)).catch((e) => send('project:index', { state: 'error', error: String(e.message || e) }));
  return { root, name: path.basename(root) };
}

// ───── app / settings / hardware ─────
handle('app:init', async () => {
  const settings = store.getSettings();
  const hw = await getHw(true);
  let status = await ollama.status();
  if (!status.running && status.installed && settings.autoStartEngine) { await ollama.start(); status = await ollama.status(); }
  const installed = status.running ? await installedModels() : [];
  return {
    settings, hw, status, installed, catalog: catalogView(hw, installed.map((m) => m.name)), cloud: M.CLOUD,
    recommended: M.recommend(hw).tag, version: app.getVersion(), lastProject: settings.lastProject && fs.existsSync(settings.lastProject) ? settings.lastProject : null
  };
});
handle('settings:save', (p) => store.saveSettings(p));
handle('hw:refresh', () => getHw(true));
handle('hw:live', () => liveStats());
handle('shell:open', (u) => { if (/^https:\/\//i.test(u)) shell.openExternal(u); });

// ───── engine ─────
handle('engine:status', () => ollama.status());
handle('engine:start', () => ollama.start());
handle('engine:install', () => ollama.install((p) => send('ollama:install', p)));

// ───── models ─────
handle('models:list', async () => {
  const hw = await getHw();
  const installed = await installedModels();
  return { installed, catalog: catalogView(hw, installed.map((m) => m.name)) };
});
handle('models:info', (n) => ollama.show(n));
handle('models:delete', (n) => ollama.del(n));
handle('models:pull', async (name) => {
  if (pulls.has(name)) return true;
  const ctrl = new AbortController(); pulls.set(name, ctrl);
  (async () => {
    let t0 = Date.now(), last = { c: 0, t: Date.now() }, speed = 0, lastDigest = '';
    try {
      await ollama.pull(name, (j) => {
        const now = Date.now();
        if (j.digest !== lastDigest) { lastDigest = j.digest; last = { c: j.completed || 0, t: now }; }
        if (j.completed != null && now - last.t > 700) { speed = (j.completed - last.c) / ((now - last.t) / 1000); last = { c: j.completed, t: now }; }
        send('models:progress', { name, status: j.status, completed: j.completed || 0, total: j.total || 0, speed });
      }, ctrl.signal);
      send('models:progress', { name, done: true });
    } catch (e) {
      send('models:progress', ctrl.signal.aborted ? { name, cancelled: true } : { name, error: String(e.message || e) });
    } finally { pulls.delete(name); }
  })();
  return true;
});
handle('models:pull-cancel', (name) => { const c = pulls.get(name); if (c) c.abort(); return true; });
handle('models:test', async (name) => {
  const t0 = Date.now(); let tFirst = 0, text = '', fin = null;
  await ollama.chat({ model: name, messages: [{ role: 'user', content: 'Reply with the single word: OK' }], options: { num_predict: 12, temperature: 0 } }, (j) => {
    const c = j.message && j.message.content;
    if (c) { if (!tFirst) tFirst = Date.now(); text += c; }
    if (j.done) fin = j;
  });
  return { ok: true, text: text.trim(), firstTokenMs: tFirst ? tFirst - t0 : null, tps: fin && fin.eval_duration ? +(fin.eval_count / (fin.eval_duration / 1e9)).toFixed(1) : null };
});

// ───── chats ─────
handle('chats:list', () => store.listChats());
handle('chats:get', (id) => store.getChat(id));
handle('chats:save', (c) => store.saveChat(c));
handle('chats:delete', (id) => store.deleteChat(id));
handle('cache:clear', () => { cache.clear(); return true; });

// ───── project ─────
handle('project:open', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
  if (r.canceled || !r.filePaths[0]) return null;
  return openProject(r.filePaths[0]);
});
handle('project:open-last', async () => {
  const p = store.getSettings().lastProject;
  return p && fs.existsSync(p) ? openProject(p) : null;
});
handle('project:reindex', async () => { if (!index) return null; return index.build((p) => send('project:index', p)); });
handle('project:list', async (dir) => {
  const abs = inRoot(dir || '.');
  const ents = await fs.promises.readdir(abs, { withFileTypes: true });
  return ents.filter((e) => !(e.isDirectory() && IGNORE_DIRS.has(e.name)) && e.name !== '.git')
    .map((e) => ({ name: e.name, dir: e.isDirectory(), path: path.relative(projectRoot, path.join(abs, e.name)).split(path.sep).join('/') }))
    .sort((a, b) => (b.dir - a.dir) || a.name.localeCompare(b.name));
});
handle('project:read', async (rel) => {
  const abs = inRoot(rel);
  const st = await fs.promises.stat(abs);
  if (st.size > 5 * 1024 * 1024) throw new Error('FILE_TOO_BIG');
  return fs.promises.readFile(abs, 'utf8');
});
handle('project:write', async (rel, text) => {
  const abs = inRoot(rel);
  await fs.promises.writeFile(abs, text, 'utf8');
  if (index) index.updateFile(rel.replace(/\\/g, '/')).catch(() => {});
  return true;
});
handle('project:create', async (rel, text) => {
  const abs = inRoot(rel);
  if (fs.existsSync(abs)) throw new Error('EXISTS');
  await fs.promises.mkdir(path.dirname(abs), { recursive: true });
  await fs.promises.writeFile(abs, text, 'utf8');
  if (index) index.updateFile(rel.replace(/\\/g, '/')).catch(() => {});
  return true;
});
handle('project:search', (q) => (index && index.ready ? index.search(q, 12).map((h) => ({ file: h.file, line: h.start, snippet: h.text.split('\n').slice(0, 4).join('\n'), score: h.score })) : []));

// ───── run (explicit, temp copy) ─────
handle('run:file', async (rel) => {
  inRoot(rel);
  const lang = store.getSettings().lang;
  const r = await dialog.showMessageBox(win, {
    type: 'question', buttons: [lang === 'en' ? 'Run' : 'Запустити', lang === 'en' ? 'Cancel' : 'Скасувати'], defaultId: 1, cancelId: 1,
    message: lang === 'en' ? `Run ${rel} in an isolated temporary copy of the project?` : `Запустити ${rel} в ізольованій тимчасовій копії проєкту?`
  });
  if (r.response !== 0) return { cancelled: true };
  runner.run(projectRoot, rel, (ev) => send('run:event', ev)).catch((e) => send('run:event', { type: 'err', text: String(e.message || e) + '\n' }));
  return { started: true };
});
handle('run:stop', () => { runner.stop(); return true; });

// ───── chat ─────
handle('chat:stop', (id) => { const c = gens.get(id); if (c) c.abort(); return true; });
handle('chat:send', (req) => {
  const ctrl = new AbortController(); gens.set(req.reqId, ctrl);
  runChat(req, ctrl)
    .catch((e) => send('chat:event', { reqId: req.reqId, type: 'error', error: String((e && e.message) || e) }))
    .finally(() => gens.delete(req.reqId));
  return true;
});

async function runChat(req, ctrl) {
  const reqId = req.reqId;
  const st = store.getSettings();
  const lang = req.lang || st.lang || 'uk';
  const opts = Object.assign({}, st.gen, req.options || {});
  const installed = (await ollama.tags()).map((m) => m.name);
  if (!installed.length) throw new Error('NO_MODELS');

  const msgs = req.messages.map((m) => ({ role: m.role, content: m.content || '', images: m.images, ocr: m.ocr }));
  let li = -1; for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].role === 'user') { li = i; break; }
  const last = li >= 0 ? msgs[li] : null;
  const hasImg = !!(last && last.images && last.images.length);
  const useProj = !!(req.useProject && index && index.ready);
  const hw = await getHw();
  const complexity = M.classifyTask(last ? last.content : '', { hasProject: useProj, hasActive: !!req.active, images: hasImg, turns: msgs.length });

  let model = req.model;
  if (!model || model === 'auto') {
    const vis = installed.filter(M.isVision), txt = installed.filter((n) => !M.isVision(n));
    model = hasImg && vis.length ? M.pickModel(vis, hw, complexity) : M.pickModel(txt.length ? txt : installed, hw, complexity);
  }
  if (!installed.includes(model)) throw new Error('MODEL_NOT_INSTALLED:' + model);

  // Зображення: vision-модель бачить їх напряму, інакше — OCR.
  const modelVision = M.isVision(model);
  let ocrText = null;
  if (hasImg && !modelVision && !last.ocr) {
    send('chat:event', { reqId, type: 'status', text: 'ocr' });
    const parts = [];
    for (const img of last.images) parts.push(await ocr.recognize(img.dataUrl, path.join(app.getPath('userData'), 'ocr')));
    ocrText = parts.map((t, i) => `[OCR image ${i + 1}]\n${t || '(no text found)'}`).join('\n\n');
    last.ocr = ocrText;
  }

  let maxCtx = 0;
  try { maxCtx = (await ollama.show(model)).maxCtx || 0; } catch (_) {}
  let numCtx = opts.num_ctx || 8192;
  if (maxCtx) numCtx = Math.min(numCtx, maxCtx);
  const reserve = Math.min(opts.num_predict > 0 ? opts.num_predict : 2048, Math.floor(numCtx / 3));

  const sys = systemPrompt(lang);
  const lastText = last ? last.content + (last.ocr ? '\n\n' + last.ocr : '') : '';
  let avail = numCtx - reserve - estTokens(sys) - estTokens(lastText) - 50;
  if (avail < 200) avail = 200;

  let ctxText = '', ctxFiles = [];
  if (useProj || req.active) {
    const projBudget = Math.floor(avail * 0.55);
    let activeBlock = '';
    if (req.active && req.active.content) {
      const maxChars = Math.floor(projBudget * 3.5 * 0.5);
      activeBlock = `\n\nACTIVE FILE ${req.active.path}:\n\`\`\`\n${req.active.content.slice(0, maxChars)}${req.active.content.length > maxChars ? '\n… (truncated)' : ''}\n\`\`\``;
    }
    if (useProj) {
      const c = index.getContext(lastText, { budgetTokens: Math.max(300, projBudget - estTokens(activeBlock)), activeFile: req.active && req.active.path });
      ctxText = '\n\n' + c.text; ctxFiles = c.files;
    }
    ctxText += activeBlock;
  }
  const histBudget = avail - estTokens(ctxText);
  const toApi = (m) => {
    const o = { role: m.role, content: m.content + (m.ocr ? '\n\n' + m.ocr : '') };
    if (m === last && modelVision && hasImg) o.images = last.images.map((i) => i.dataUrl.split(',')[1]);
    return o;
  };
  const hist = []; let used = 0;
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (i === li) continue;
    const t = estTokens(msgs[i].content + (msgs[i].ocr || ''));
    if (used + t > histBudget && hist.length) break;
    used += t; hist.unshift(i);
  }
  const final = [{ role: 'system', content: sys + ctxText }];
  const order = [...hist, ...(li >= 0 ? [li] : [])].sort((a, b) => a - b);
  for (const i of order) final.push(toApi(msgs[i]));
  if (req.continue) final.push({ role: 'user', content: lang === 'en' ? 'Continue exactly where you stopped. Do not repeat anything.' : 'Продовжуй точно з місця, де зупинився. Нічого не повторюй.' });

  const options = { temperature: opts.temperature, top_p: opts.top_p, num_ctx: numCtx };
  if (opts.num_predict > 0) options.num_predict = opts.num_predict;
  const promptTokens = estTokens(final.map((m) => m.content).join('\n'));

  // Кеш: лише детерміновані запити без зображень.
  const cacheable = st.cacheEnabled !== false && !hasImg && !req.regenerate && !req.continue && (opts.temperature || 0) <= 0.3;
  const ckey = cacheable ? cache.key({ model, final, options }) : null;
  const meta = { reqId, type: 'meta', model, numCtx, maxCtx, promptTokens, files: ctxFiles, complexity, ocr: ocrText };
  if (ckey) {
    const hit = cache.get(ckey);
    if (hit) {
      send('chat:event', Object.assign({}, meta, { cached: true }));
      send('chat:event', { reqId, type: 'chunk', text: hit });
      send('chat:event', { reqId, type: 'done', cached: true, stopped: false, tps: null, ttft: 0, evalCount: estTokens(hit), promptEval: promptTokens, doneReason: 'stop', totalMs: 0 });
      return;
    }
  }
  send('chat:event', Object.assign({}, meta, { cached: false }));

  const t0 = Date.now(); let tFirst = 0, chunks = 0, full = '', fin = null, stopped = false;
  try {
    await ollama.chat({ model, messages: final, options, signal: ctrl.signal }, (j) => {
      if (j.error) throw new Error(j.error);
      const c = j.message && j.message.content;
      if (c) { if (!tFirst) tFirst = Date.now(); chunks++; full += c; send('chat:event', { reqId, type: 'chunk', text: c }); }
      if (j.done) fin = j;
    });
  } catch (e) {
    if (e.name === 'AbortError' || ctrl.signal.aborted) stopped = true; else throw e;
  }
  const now = Date.now();
  const tps = fin && fin.eval_duration ? +(fin.eval_count / (fin.eval_duration / 1e9)).toFixed(1) : (tFirst && now > tFirst ? +(chunks / ((now - tFirst) / 1000)).toFixed(1) : null);
  const reason = fin ? fin.done_reason : stopped ? 'stopped' : '';
  if (ckey && !stopped && reason === 'stop' && full) cache.set(ckey, full);
  send('chat:event', { reqId, type: 'done', stopped, tps, ttft: tFirst ? tFirst - t0 : null, evalCount: fin ? fin.eval_count : chunks, promptEval: fin ? fin.prompt_eval_count : promptTokens, doneReason: reason, totalMs: now - t0, cached: false });
}

app.whenReady().then(() => {
  if (!gotLock) return;
  const ud = app.getPath('userData');
  store = new Store(ud);
  cache = new Cache(path.join(ud, 'cache.json'));
  ollama = new Ollama(() => store.getSettings().ollamaUrl);
  createWindow();
});
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => { runner.stop(); ocr.shutdown(); cache && cache.flush(); app.quit(); });
