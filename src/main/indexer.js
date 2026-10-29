// Індексація проєкту: чанки, BM25-пошук (RAG), короткі резюме файлів, граф залежностей.
const fs = require('fs');
const path = require('path');

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.venv', 'venv', '__pycache__', '.idea', '.vscode', 'target', 'bin', 'obj', '.next', 'coverage', '.gradle']);
const TEXT_EXT = new Set(['.lua', '.luau', '.py', '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.html', '.htm', '.css', '.scss', '.json', '.md', '.txt', '.sql', '.c', '.h', '.cpp', '.hpp', '.cc', '.cs', '.java', '.kt', '.go', '.rs', '.php', '.rb', '.sh', '.bat', '.cmd', '.ps1', '.yml', '.yaml', '.toml', '.xml', '.gradle', '.properties', '.ini', '.cfg', '.vue', '.svelte']);
const MAX_FILE = 512 * 1024;
const MAX_FILES = 5000;
const CHUNK_LINES = 60;
const CHUNK_CHARS = 2400;
const estTokens = (s) => Math.ceil(s.length / 3.5);

function tokenize(s) {
  const out = [];
  for (const w of s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(/[^\p{L}\p{N}]+/u)) if (w.length > 1 && w.length < 40) out.push(w);
  return out;
}

function symbolsOf(text) {
  const re = /^\s*(?:export\s+)?(?:async\s+)?(?:local\s+)?(?:function|class|def|struct|interface|enum|type|const|let|var)\s+([A-Za-z_][\w.:]*)/gm;
  const out = []; let m;
  while ((m = re.exec(text)) && out.length < 12) out.push(m[1]);
  return out;
}

function importsOf(text) {
  const out = []; let m;
  const res = [/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]/g, /require\(\s*['"]([^'"]+)['"]\s*\)/g, /^\s*import\s+['"]([^'"]+)['"]/gm,
    /^\s*from\s+([\w.]+)\s+import/gm, /^\s*import\s+([\w.]+)/gm, /#include\s+"([^"]+)"/g, /require\(?\s*["']([\w./-]+)["']\s*\)?/g];
  for (const re of res) while ((m = re.exec(text))) out.push(m[1]);
  return out;
}

class ProjectIndex {
  constructor(root) {
    this.root = root; this.files = new Map(); this.chunks = []; this.ready = false;
    this.df = new Map(); this.avgLen = 1; this.deps = new Map(); this.rdeps = new Map();
  }

  async build(onProgress) {
    this.ready = false; this.files.clear(); this.chunks = [];
    const list = [];
    const walk = async (dir) => {
      let ents; try { ents = await fs.promises.readdir(dir, { withFileTypes: true }); } catch (_) { return; }
      for (const e of ents) {
        if (list.length >= MAX_FILES) return;
        if (e.isDirectory()) { if (!IGNORE_DIRS.has(e.name) && !e.name.startsWith('.')) await walk(path.join(dir, e.name)); }
        else if (e.isFile() && TEXT_EXT.has(path.extname(e.name).toLowerCase())) list.push(path.join(dir, e.name));
      }
    };
    await walk(this.root);
    let n = 0;
    for (const abs of list) {
      await this._addFile(abs);
      if (++n % 40 === 0) { onProgress && onProgress({ state: 'building', files: n, total: list.length }); await new Promise((r) => setImmediate(r)); }
    }
    this._finalize();
    this.ready = true;
    onProgress && onProgress({ state: 'ready', files: this.files.size, chunks: this.chunks.length });
    return { files: this.files.size, chunks: this.chunks.length };
  }

  async _addFile(abs) {
    let st; try { st = await fs.promises.stat(abs); } catch (_) { return; }
    if (st.size > MAX_FILE || st.size === 0) return;
    let text; try { text = await fs.promises.readFile(abs, 'utf8'); } catch (_) { return; }
    if (text.includes('\u0000')) return;
    const rel = path.relative(this.root, abs).split(path.sep).join('/');
    const lines = text.split(/\r?\n/);
    const first = (lines.find((l) => /^\s*(\/\/|#|--|\/\*|\*|"""|<!--)/.test(l)) || '').replace(/^\s*(\/\/|#|--|\/\*|\*|"""|<!--)\s*/, '').slice(0, 100);
    this.files.set(rel, { rel, lines: lines.length, size: st.size, summary: first, symbols: symbolsOf(text), imports: importsOf(text) });
    let start = 0;
    while (start < lines.length) {
      let end = start, chars = 0;
      while (end < lines.length && end - start < CHUNK_LINES && chars < CHUNK_CHARS) chars += lines[end++].length + 1;
      const body = lines.slice(start, end).join('\n');
      if (body.trim()) {
        const tf = Object.create(null); let len = 0;
        for (const w of tokenize(rel + ' ' + body)) { tf[w] = (tf[w] || 0) + 1; len++; }
        this.chunks.push({ file: rel, start: start + 1, end, text: body, tf, len });
      }
      start = Math.max(end - 5, start + 1);
      if (end >= lines.length) break;
    }
  }

  _finalize() {
    this.df = new Map(); let total = 0;
    for (const c of this.chunks) { total += c.len; for (const w in c.tf) this.df.set(w, (this.df.get(w) || 0) + 1); }
    this.avgLen = this.chunks.length ? total / this.chunks.length : 1;
    // граф залежностей
    this.deps = new Map(); this.rdeps = new Map();
    const names = [...this.files.keys()];
    for (const f of this.files.values()) {
      const out = new Set();
      for (const imp of f.imports) {
        const base = imp.replace(/^[./\\]+/, '').replace(/\./g, '/').split('/').pop().replace(/\.(js|ts|py|lua|h|hpp|cpp|c|jsx|tsx)$/, '');
        if (!base) continue;
        for (const n of names) {
          if (n === f.rel) continue;
          const nb = n.split('/').pop().replace(/\.[^.]+$/, '');
          if (nb === base) out.add(n);
        }
      }
      this.deps.set(f.rel, [...out]);
      for (const o of out) { if (!this.rdeps.has(o)) this.rdeps.set(o, []); this.rdeps.get(o).push(f.rel); }
    }
  }

  async updateFile(rel) {
    const abs = path.join(this.root, rel);
    this.chunks = this.chunks.filter((c) => c.file !== rel);
    this.files.delete(rel);
    if (fs.existsSync(abs) && TEXT_EXT.has(path.extname(rel).toLowerCase())) await this._addFile(abs);
    this._finalize();
  }

  search(query, k = 8, boostFiles = []) {
    const q = [...new Set(tokenize(query))];
    if (!q.length || !this.chunks.length) return [];
    const N = this.chunks.length, k1 = 1.2, b = 0.75, boost = new Set(boostFiles);
    const scored = [];
    for (const c of this.chunks) {
      let s = 0;
      for (const w of q) {
        const f = c.tf[w]; if (!f) continue;
        const df = this.df.get(w) || 0;
        s += Math.log(1 + (N - df + 0.5) / (df + 0.5)) * (f * (k1 + 1)) / (f + k1 * (1 - b + b * c.len / this.avgLen));
      }
      if (s > 0) { if (boost.has(c.file)) s *= 1.3; scored.push({ c, s }); }
    }
    scored.sort((a, b2) => b2.s - a.s);
    return scored.slice(0, k).map((x) => ({ file: x.c.file, start: x.c.start, end: x.c.end, text: x.c.text, score: +x.s.toFixed(2) }));
  }

  overview(maxFiles = 80) {
    const rows = [...this.files.values()].slice(0, maxFiles).map((f) => {
      const deps = (this.deps.get(f.rel) || []).slice(0, 4);
      return `- ${f.rel} (${f.lines} lines)${f.symbols.length ? ' [' + f.symbols.slice(0, 6).join(', ') + ']' : ''}${f.summary ? ' — ' + f.summary : ''}${deps.length ? ' → uses: ' + deps.join(', ') : ''}`;
    });
    return rows.join('\n') + (this.files.size > maxFiles ? `\n… +${this.files.size - maxFiles} more files` : '');
  }

  // Контекст для промпта в межах бюджету токенів.
  getContext(query, { budgetTokens = 4000, activeFile = null } = {}) {
    if (!this.ready || !this.files.size) return { text: '', files: [], tokens: 0 };
    const budget = budgetTokens * 3.5;
    let text = `PROJECT FILES (${this.files.size}):\n`;
    const ov = this.overview(Math.max(10, Math.min(80, Math.floor(budgetTokens / 40))));
    text += ov.slice(0, Math.floor(budget * 0.25)) + '\n\nRELEVANT CODE:\n';
    const boost = activeFile ? [activeFile, ...(this.deps.get(activeFile) || []), ...(this.rdeps.get(activeFile) || [])] : [];
    const hits = this.search(query, 24, boost);
    const used = new Set();
    for (const h of hits) {
      const block = `\n### ${h.file}:${h.start}-${h.end}\n${h.text}\n`;
      if (text.length + block.length > budget) break;
      text += block; used.add(h.file);
    }
    return { text, files: [...used], tokens: estTokens(text) };
  }
}

module.exports = { ProjectIndex, IGNORE_DIRS, TEXT_EXT, estTokens };
