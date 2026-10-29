// Monaco: кілька файлів, diff-перегляд змін від ШІ, прийняття/відхилення, скасування (Ctrl+Z), AI-дії в контекстному меню.
(function () {
  const RX = window.RX, $ = RX.$;
  const base = new URL('../../node_modules/monaco-editor/min/', document.baseURI).href;
  const ed = { files: new Map(), active: null, editor: null, diffEditor: null, monaco: null, langMap: null, actions: [] };
  RX.ed = ed;

  // Monaco вантажиться у фоні (≈14 МБ), щоб не гальмувати старт.
  ed.load = () => ed._p || (ed._p = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = base + 'vs/loader.js';
    s.onerror = () => reject(new Error('Monaco loader not found'));
    s.onload = () => {
      window.require.config({ paths: { vs: base + 'vs' } });
      window.MonacoEnvironment = {
        getWorkerUrl: () => 'data:text/javascript;charset=utf-8,' + encodeURIComponent(
          `self.MonacoEnvironment={baseUrl:'${base}'};importScripts('${base}vs/base/worker/workerMain.js');`)
      };
      window.require(['vs/editor/editor.main'], () => resolve(window.monaco), reject);
    };
    document.head.appendChild(s);
  }));

  ed.normLang = (l) => {
    l = (l || '').toLowerCase();
    const alias = { js: 'javascript', ts: 'typescript', py: 'python', 'c++': 'cpp', cs: 'csharp', 'c#': 'csharp', sh: 'shell', bash: 'shell', ps1: 'powershell', yml: 'yaml', md: 'markdown', luau: 'lua', jsx: 'javascript', tsx: 'typescript' };
    return alias[l] || l || 'plaintext';
  };
  ed.langFor = (path) => {
    if (!ed.langMap) {
      ed.langMap = {};
      for (const l of ed.monaco.languages.getLanguages()) for (const e of l.extensions || []) ed.langMap[e.toLowerCase()] = l.id;
      ed.langMap['.luau'] = 'lua';
    }
    const m = /\.[^./\\]+$/.exec(path);
    return (m && ed.langMap[m[0].toLowerCase()]) || 'plaintext';
  };

  ed.init = async () => {
    const monaco = ed.monaco = await ed.load();
    monaco.editor.defineTheme('revex', {
      base: 'vs-dark', inherit: true,
      rules: [{ token: 'comment', foreground: '6b7699', fontStyle: 'italic' }, { token: 'keyword', foreground: '8b7bff' }, { token: 'string', foreground: '78ffd6' }, { token: 'number', foreground: 'ffc857' }],
      colors: { 'editor.background': '#0b0e15', 'editor.lineHighlightBackground': '#141a29', 'editorLineNumber.foreground': '#3d4767', 'editorCursor.foreground': '#78ffd6' }
    });
    monaco.editor.setTheme('revex');
    ed.editor = monaco.editor.create($('monaco'), {
      theme: 'revex', automaticLayout: true, fontSize: 13, fontFamily: 'Cascadia Code, Consolas, monospace', fontLigatures: true,
      minimap: { enabled: true }, lineNumbers: 'on', quickSuggestions: true, suggestOnTriggerCharacters: true,
      wordBasedSuggestions: 'allDocuments', tabCompletion: 'on', scrollBeyondLastLine: false, model: null, renderWhitespace: 'selection'
    });
    ed.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => ed.save());
    ed.registerActions();
  };

  ed.registerActions = () => {
    ed.actions.forEach((d) => d.dispose()); ed.actions = [];
    ['explain', 'fix', 'refactor', 'tests'].forEach((k, i) => {
      ed.actions.push(ed.editor.addAction({
        id: 'revex.' + k, label: RX.t('ai.' + k), contextMenuGroupId: 'revex', contextMenuOrder: i,
        run: () => RX.onAiAction && RX.onAiAction(k)
      }));
    });
  };

  const isDirty = (f) => f.model.getAlternativeVersionId() !== f.saved;
  ed.isDirty = (p) => { const f = ed.files.get(p); return !!f && isDirty(f); };

  ed.renderTabs = () => {
    const box = $('edTabs'); box.innerHTML = '';
    for (const [p, f] of ed.files) {
      const el = document.createElement('div');
      el.className = 'etab' + (p === ed.active ? ' on' : '');
      el.innerHTML = `<span>${RX.esc(p.split('/').pop())}</span>${isDirty(f) ? '<span class="d">●</span>' : ''}<button title="×">×</button>`;
      el.title = p;
      el.onclick = (e) => { if (e.target.tagName === 'BUTTON') ed.close(p); else ed.activate(p); };
      box.appendChild(el);
    }
    $('edEmpty').classList.toggle('hidden', ed.files.size > 0);
  };

  ed.activate = (p, line) => {
    const f = ed.files.get(p); if (!f) return;
    ed.active = p; ed.editor.setModel(f.model);
    if (line) { ed.editor.revealLineInCenter(line); ed.editor.setPosition({ lineNumber: line, column: 1 }); }
    ed.renderTabs(); ed.editor.focus();
  };

  ed.open = async (p, line) => {
    await ed.load(); if (!ed.editor) await ed.init();
    if (!ed.files.has(p)) {
      const text = await window.revex.projectRead(p);
      const model = ed.monaco.editor.createModel(text, ed.langFor(p), ed.monaco.Uri.from({ scheme: 'revex', path: '/' + p }));
      const f = { path: p, model, saved: model.getAlternativeVersionId() };
      model.onDidChangeContent(() => ed.renderTabs());
      ed.files.set(p, f);
    }
    ed.activate(p, line);
  };

  ed.close = (p) => {
    const f = ed.files.get(p); if (!f) return;
    if (isDirty(f) && !confirm(RX.t('ed.confirmClose', { f: p }))) return;
    f.model.dispose(); ed.files.delete(p);
    if (ed.active === p) { ed.active = null; const next = [...ed.files.keys()].pop(); if (next) ed.activate(next); else { ed.editor.setModel(null); } }
    ed.renderTabs();
  };

  ed.save = async () => {
    const f = ed.files.get(ed.active); if (!f) return;
    await window.revex.projectWrite(f.path, f.model.getValue());
    f.saved = f.model.getAlternativeVersionId(); ed.renderTabs(); RX.toast(RX.t('ed.saved'));
  };
  ed.undo = () => { if (ed.editor && ed.active) ed.editor.trigger('revex', 'undo', null); };
  ed.revert = async () => {
    const f = ed.files.get(ed.active); if (!f) return;
    if (isDirty(f) && !confirm(RX.t('ed.confirmRevert'))) return;
    const text = await window.revex.projectRead(f.path);
    f.model.pushEditOperations([], [{ range: f.model.getFullModelRange(), text }], () => null);
    f.saved = f.model.getAlternativeVersionId(); ed.renderTabs();
  };

  ed.getActive = () => { const f = ed.files.get(ed.active); return f ? { path: f.path, content: f.model.getValue() } : null; };
  ed.getSelection = () => {
    if (!ed.editor || !ed.active) return null;
    const sel = ed.editor.getSelection(); const m = ed.editor.getModel();
    const text = sel && !sel.isEmpty() ? m.getValueInRange(sel) : '';
    return { path: ed.active, text, whole: !text };
  };

  // diff-перегляд запропонованої зміни; accept → правка у моделі (скасовується Ctrl+Z), файл зберігається окремо
  ed.showDiff = async ({ path, original, modified, isNew }) => {
    await ed.load(); if (!ed.editor) await ed.init();
    const monaco = ed.monaco;
    $('diffView').classList.remove('hidden');
    $('diffTitle').textContent = (isNew ? RX.t('ed.newFile') + ': ' : '') + path;
    if (ed.diffEditor) { ed.diffEditor.dispose(); }
    ed.diffEditor = monaco.editor.createDiffEditor($('diffEd'), { theme: 'revex', automaticLayout: true, renderSideBySide: false, readOnly: true, originalEditable: false, fontSize: 13 });
    const lang = ed.langFor(path);
    const o = monaco.editor.createModel(original || '', lang), m = monaco.editor.createModel(modified, lang);
    ed.diffEditor.setModel({ original: o, modified: m });
    const close = () => { $('diffView').classList.add('hidden'); if (ed.diffEditor) { ed.diffEditor.setModel(null); ed.diffEditor.dispose(); ed.diffEditor = null; } o.dispose(); m.dispose(); };
    $('diffReject').onclick = close;
    $('diffAccept').onclick = async () => {
      try {
        if (isNew) { await window.revex.projectCreate(path, modified); await ed.open(path); }
        else {
          await ed.open(path);
          const f = ed.files.get(path);
          f.model.pushEditOperations([], [{ range: f.model.getFullModelRange(), text: modified }], () => null);
          ed.renderTabs();
        }
        RX.toast(RX.t('ed.applied'));
      } catch (e) { RX.toast(String(e.message || e), 4000); }
      close();
    };
  };
})();
