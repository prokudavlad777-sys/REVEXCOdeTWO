// OCR скриншотів/фото для моделей без підтримки зображень (tesseract.js, мови: eng+ukr+rus).
let worker = null, starting = null;

async function getWorker(cacheDir) {
  if (worker) return worker;
  if (!starting) {
    starting = (async () => {
      const { createWorker } = require('tesseract.js');
      worker = await createWorker(['eng', 'ukr', 'rus'], 1, { cachePath: cacheDir });
      return worker;
    })().catch((e) => { starting = null; throw e; });
  }
  return starting;
}

async function recognize(dataUrl, cacheDir) {
  const m = /^data:image\/(png|jpe?g|webp);base64,(.+)$/i.exec(dataUrl || '');
  if (!m) throw new Error('BAD_IMAGE');
  const w = await getWorker(cacheDir);
  const { data } = await w.recognize(Buffer.from(m[2], 'base64'));
  return (data.text || '').trim();
}

async function shutdown() { if (worker) { try { await worker.terminate(); } catch (_) {} worker = null; starting = null; } }
module.exports = { recognize, shutdown };
