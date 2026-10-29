// Перевірка клієнта Ollama на локальному фейковому сервері: стрімінг, pull, show, abort.
const http = require('http');
const assert = require('assert');
const Ollama = require('../src/main/ollama');

const server = http.createServer((req, res) => {
  let body = ''; req.on('data', (d) => (body += d));
  req.on('end', () => {
    if (req.url === '/api/version') return res.end(JSON.stringify({ version: '0.0-mock' }));
    if (req.url === '/api/tags') return res.end(JSON.stringify({ models: [{ name: 'qwen2.5-coder:7b', size: 4.7e9, details: { family: 'qwen2', parameter_size: '7B' } }] }));
    if (req.url === '/api/show') return res.end(JSON.stringify({ details: { parameter_size: '7B' }, model_info: { 'qwen2.context_length': 32768 } }));
    if (req.url === '/api/chat') {
      const parts = ['Hel', 'lo', ' wor', 'ld'];
      let i = 0;
      const iv = setInterval(() => {
        if (i < parts.length) { const line = JSON.stringify({ message: { content: parts[i++] }, done: false }) + '\n'; res.write(line.slice(0, 10)); setTimeout(() => res.write(line.slice(10)), 5); }
        else { clearInterval(iv); res.end(JSON.stringify({ done: true, done_reason: 'stop', eval_count: 4, eval_duration: 2e9 }) + '\n'); }
      }, 20);
      res.on('close', () => clearInterval(iv));
      return;
    }
    if (req.url === '/api/pull') {
      res.write(JSON.stringify({ status: 'pulling x', digest: 'x', total: 100, completed: 50 }) + '\n');
      return res.end(JSON.stringify({ status: 'success' }) + '\n');
    }
    res.statusCode = 404; res.end('no');
  });
});

server.listen(0, '127.0.0.1', async () => {
  const o = new Ollama(() => `http://127.0.0.1:${server.address().port}`);
  try {
    assert.ok(await o.isRunning());
    assert.strictEqual((await o.tags())[0].name, 'qwen2.5-coder:7b');
    assert.strictEqual((await o.show('x')).maxCtx, 32768);
    let text = '', fin = null;
    await o.chat({ model: 'm', messages: [], options: {} }, (j) => { if (j.message) text += j.message.content; if (j.done) fin = j; });
    assert.strictEqual(text, 'Hello world'); assert.strictEqual(fin.eval_count, 4);
    const ctrl = new AbortController(); let got = '';
    await o.chat({ model: 'm', messages: [], options: {}, signal: ctrl.signal }, (j) => { if (j.message) { got += j.message.content; if (got.length >= 3) ctrl.abort(); } }).then(() => assert.fail('must abort'), (e) => assert.strictEqual(e.name, 'AbortError'));
    const ev = []; await o.pull('m', (j) => ev.push(j.status));
    assert.deepStrictEqual(ev, ['pulling x', 'success']);
    console.log('ollama mock: all ok');
  } catch (e) { console.error('FAIL', e); process.exitCode = 1; }
  server.closeAllConnections(); server.close(); process.exit(process.exitCode || 0);
});
