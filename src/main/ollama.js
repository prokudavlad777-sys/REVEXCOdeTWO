const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFile } = require('child_process');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readNdjson(res, onObj) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (line) { try { onObj(JSON.parse(line)); } catch (e) { if (e instanceof SyntaxError) continue; throw e; } }
    }
  }
  if (buf.trim()) { try { onObj(JSON.parse(buf)); } catch (e) { if (!(e instanceof SyntaxError)) throw e; } }
}

class Ollama {
  constructor(getUrl) { this.getUrl = getUrl; }
  get url() { return this.getUrl().replace(/\/+$/, ''); }

  async _fetch(p, opt = {}) { return fetch(this.url + p, opt); }

  async isRunning() {
    try { const r = await this._fetch('/api/version', { signal: AbortSignal.timeout(1500) }); return r.ok; } catch (_) { return false; }
  }
  async version() {
    try { const r = await this._fetch('/api/version', { signal: AbortSignal.timeout(1500) }); return (await r.json()).version; } catch (_) { return null; }
  }

  async findBinary() {
    const c = [];
    if (process.platform === 'win32') {
      if (process.env.LOCALAPPDATA) c.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'Ollama', 'ollama.exe'));
      if (process.env.ProgramFiles) c.push(path.join(process.env.ProgramFiles, 'Ollama', 'ollama.exe'));
    }
    for (const p of c) if (fs.existsSync(p)) return p;
    return new Promise((res) => execFile(process.platform === 'win32' ? 'where' : 'which', ['ollama'], { windowsHide: true }, (e, out) => res(e ? null : String(out).split(/\r?\n/)[0].trim() || null)));
  }

  async status() {
    const running = await this.isRunning();
    const bin = running ? true : await this.findBinary();
    return { running, version: running ? await this.version() : null, installed: !!bin, url: this.url };
  }

  async start() {
    if (await this.isRunning()) return { ok: true, already: true };
    const bin = await this.findBinary();
    if (!bin) return { ok: false, reason: 'not_installed' };
    const child = spawn(bin, ['serve'], { detached: true, stdio: 'ignore', windowsHide: true });
    child.on('error', () => {});
    child.unref();
    for (let i = 0; i < 40; i++) { await sleep(500); if (await this.isRunning()) return { ok: true }; }
    return { ok: false, reason: 'timeout' };
  }

  // Завантаження офіційного інсталятора Ollama і тиха установка (лише Windows).
  async install(onProgress) {
    if (process.platform !== 'win32') return { ok: false, reason: 'unsupported_os' };
    const file = path.join(os.tmpdir(), 'OllamaSetup.exe');
    const res = await fetch('https://ollama.com/download/OllamaSetup.exe', { redirect: 'follow' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const total = +res.headers.get('content-length') || 0;
    const out = fs.createWriteStream(file);
    const reader = res.body.getReader();
    let got = 0, t0 = Date.now();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      got += value.length;
      if (!out.write(value)) await new Promise((r) => out.once('drain', r));
      onProgress && onProgress({ phase: 'download', completed: got, total, speed: got / Math.max(0.5, (Date.now() - t0) / 1000) });
    }
    await new Promise((r) => out.end(r));
    onProgress && onProgress({ phase: 'install' });
    await new Promise((resolve, reject) => {
      const p = spawn(file, ['/SILENT', '/NORESTART'], { stdio: 'ignore', windowsHide: false });
      p.on('error', reject); p.on('exit', () => resolve());
      setTimeout(resolve, 300000);
    });
    return this.start();
  }

  async tags() {
    const r = await this._fetch('/api/tags', { signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return ((await r.json()).models || []).map((m) => ({ name: m.name, size: m.size, sizeGB: +(m.size / 1073741824).toFixed(1), family: m.details && m.details.family, params: m.details && m.details.parameter_size }));
  }

  async show(name) {
    const r = await this._fetch('/api/show', { method: 'POST', body: JSON.stringify({ model: name }), signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    let maxCtx = 0;
    for (const k in j.model_info || {}) if (k.endsWith('.context_length')) maxCtx = +j.model_info[k] || 0;
    return { maxCtx, params: j.details && j.details.parameter_size, family: j.details && j.details.family, capabilities: j.capabilities || [] };
  }

  async del(name) {
    const r = await this._fetch('/api/delete', { method: 'DELETE', body: JSON.stringify({ model: name }) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
  }

  async pull(name, onEvent, signal) {
    const r = await this._fetch('/api/pull', { method: 'POST', body: JSON.stringify({ model: name, stream: true }), signal });
    if (!r.ok) throw new Error(await r.text());
    await readNdjson(r, (j) => { if (j.error) throw new Error(j.error); onEvent(j); });
  }

  async chat({ model, messages, options, signal }, onObj) {
    const r = await this._fetch('/api/chat', { method: 'POST', body: JSON.stringify({ model, messages, stream: true, options, keep_alive: '30m' }), signal });
    if (!r.ok) { let t = ''; try { t = await r.text(); } catch (_) {} throw new Error(t || 'HTTP ' + r.status); }
    await readNdjson(r, onObj);
  }
}
module.exports = Ollama;
