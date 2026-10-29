// Запуск файлу в ізольованій тимчасовій копії проєкту (лише за явною командою користувача).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { IGNORE_DIRS } = require('./indexer');

function dirSizeExceeds(dir, limit) {
  let total = 0;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (IGNORE_DIRS.has(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (walk(p)) return true; } else { try { total += fs.statSync(p).size; } catch (_) {} if (total > limit) return true; }
    }
    return false;
  };
  return walk(dir);
}

function safeEnv() {
  const env = {};
  for (const k of Object.keys(process.env)) if (!/(KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL)/i.test(k)) env[k] = process.env[k];
  return env;
}

function plan(file) {
  const ext = path.extname(file).toLowerCase();
  const win = process.platform === 'win32';
  switch (ext) {
    case '.py': return [{ cmd: win ? 'python' : 'python3', args: [file] }];
    case '.js': case '.mjs': case '.cjs': return [{ cmd: process.execPath, args: [file], env: { ELECTRON_RUN_AS_NODE: '1' } }];
    case '.ts': return [{ cmd: 'npx', args: ['--yes', 'tsx', file], shell: true }];
    case '.lua': return [{ cmd: 'lua', args: [file] }];
    case '.c': return [{ cmd: 'gcc', args: [file, '-o', 'revex_out'] }, { cmd: path.join('.', win ? 'revex_out.exe' : 'revex_out'), args: [] }];
    case '.cpp': case '.cc': return [{ cmd: 'g++', args: [file, '-o', 'revex_out'] }, { cmd: path.join('.', win ? 'revex_out.exe' : 'revex_out'), args: [] }];
    default: return null;
  }
}

function killTree(child) {
  try {
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
    else child.kill('SIGKILL');
  } catch (_) {}
}

class Runner {
  constructor() { this.child = null; }
  stop() { if (this.child) killTree(this.child); }

  async run(root, rel, emit, timeoutMs = 60000) {
    const steps = plan(rel);
    if (!steps) throw new Error('UNSUPPORTED_EXT');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'revex-run-'));
    emit({ type: 'info', text: `Тимчасова копія: ${tmp}\n` });
    if (dirSizeExceeds(root, 100 * 1024 * 1024)) {
      fs.mkdirSync(path.join(tmp, path.dirname(rel)), { recursive: true });
      fs.copyFileSync(path.join(root, rel), path.join(tmp, rel));
      emit({ type: 'info', text: 'Проєкт завеликий — скопійовано лише файл.\n' });
    } else {
      fs.cpSync(root, tmp, { recursive: true, filter: (s) => !IGNORE_DIRS.has(path.basename(s)) });
    }
    let code = 0;
    for (const st of steps) {
      code = await new Promise((resolve) => {
        const child = spawn(st.cmd, st.args, { cwd: tmp, env: Object.assign(safeEnv(), st.env || {}), shell: !!st.shell, windowsHide: true });
        this.child = child;
        const timer = setTimeout(() => { emit({ type: 'err', text: '\n[timeout]\n' }); killTree(child); }, timeoutMs);
        child.stdout.on('data', (d) => emit({ type: 'out', text: d.toString() }));
        child.stderr.on('data', (d) => emit({ type: 'err', text: d.toString() }));
        child.on('error', (e) => { clearTimeout(timer); emit({ type: 'err', text: `${e.code === 'ENOENT' ? `Не знайдено "${st.cmd}" — встановіть його і додайте в PATH.` : e.message}\n` }); resolve(-1); });
        child.on('exit', (c) => { clearTimeout(timer); resolve(c == null ? -1 : c); });
      });
      this.child = null;
      if (code !== 0) break;
    }
    emit({ type: 'exit', code });
    setTimeout(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {} }, 5000);
    return code;
  }
}
module.exports = Runner;
