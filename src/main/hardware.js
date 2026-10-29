const os = require('os');
const fs = require('fs');
const { execFile } = require('child_process');

function run(cmd, args, timeout = 4000) {
  return new Promise((res) => execFile(cmd, args, { timeout, windowsHide: true }, (err, out) => res(err ? null : String(out))));
}

async function gpus() {
  const out = await run('nvidia-smi', ['--query-gpu=name,memory.total,memory.used', '--format=csv,noheader,nounits']);
  if (out) {
    return out.trim().split(/\r?\n/).filter(Boolean).map((l) => {
      const [name, total, used] = l.split(',').map((s) => s.trim());
      return { name, vendor: 'nvidia', totalMB: +total || 0, usedMB: +used || 0 };
    });
  }
  if (process.platform === 'win32') {
    const j = await run('powershell', ['-NoProfile', '-Command', 'Get-CimInstance Win32_VideoController | Select-Object Name | ConvertTo-Json -Compress'], 6000);
    try {
      let a = JSON.parse(j); if (!Array.isArray(a)) a = [a];
      // Не-NVIDIA: VRAM не рахуємо (консервативно), показуємо лише назву.
      return a.filter((x) => x && x.Name).map((x) => ({ name: x.Name, vendor: 'other', totalMB: 0, usedMB: 0 }));
    } catch (_) {}
  }
  return [];
}

async function freeDiskGB(dir) {
  try { const s = await fs.promises.statfs(dir); return +((s.bavail * s.bsize) / 1073741824).toFixed(1); } catch (_) { return null; }
}

async function getHardware(diskDir) {
  const g = await gpus();
  const nv = g.filter((x) => x.vendor === 'nvidia');
  return {
    os: `${os.type()} ${os.release()}`, arch: os.arch(),
    cpu: (os.cpus()[0] || {}).model || '?', cores: os.cpus().length,
    ramGB: +(os.totalmem() / 1073741824).toFixed(1),
    gpus: g, gpuName: g.length ? g.map((x) => x.name).join(', ') : null,
    vramGB: nv.length ? +(Math.max(...nv.map((x) => x.totalMB)) / 1024).toFixed(1) : 0,
    freeDiskGB: await freeDiskGB(diskDir)
  };
}

async function liveStats() {
  const total = os.totalmem(), free = os.freemem();
  const g = (await gpus()).filter((x) => x.vendor === 'nvidia');
  return {
    ramUsedGB: +((total - free) / 1073741824).toFixed(1), ramTotalGB: +(total / 1073741824).toFixed(1),
    vramUsedGB: g.length ? +(g.reduce((s, x) => s + x.usedMB, 0) / 1024).toFixed(1) : null,
    vramTotalGB: g.length ? +(g.reduce((s, x) => s + x.totalMB, 0) / 1024).toFixed(1) : null
  };
}
module.exports = { getHardware, liveStats };
