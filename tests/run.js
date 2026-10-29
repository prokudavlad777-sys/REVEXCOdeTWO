// Тести чистої логіки (без Electron): node tests/run.js
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const blocks = require('../src/shared/blocks');
const M = require('../src/main/models');
const Cache = require('../src/main/cache');
const Store = require('../src/main/store');
const { ProjectIndex } = require('../src/main/indexer');

let passed = 0;
const test = async (name, fn) => { try { await fn(); passed++; console.log('  ok  ' + name); } catch (e) { console.error('FAIL  ' + name + '\n', e); process.exitCode = 1; } };

(async () => {
  await test('blocks: path in info string', () => {
    const s = blocks.parse('Ось:\n```js src/app.js\nconsole.log(1)\n```\nГотово').filter((x) => x.type === 'code');
    assert.strictEqual(s.length, 1); assert.strictEqual(s[0].lang, 'js'); assert.strictEqual(s[0].path, 'src/app.js'); assert.ok(s[0].closed);
  });
  await test('blocks: lang:path, lone path, FILE comment, windows slashes', () => {
    assert.strictEqual(blocks.parseInfo('python:tools/run.py').path, 'tools/run.py');
    assert.deepStrictEqual(blocks.parseInfo('main.py'), { lang: '', path: 'main.py' });
    assert.deepStrictEqual(blocks.parseInfo('lua'), { lang: 'lua', path: '' });
    assert.strictEqual(blocks.parseInfo('js src\\a.js').path, 'src/a.js');
    assert.strictEqual(blocks.parse('```lua\n-- FILE: scripts/a.lua\nprint(1)\n```').find((x) => x.type === 'code').path, 'scripts/a.lua');
  });
  await test('blocks: unclosed block while streaming', () => {
    const s = blocks.parse('text\n```py\nprint(1)\nprint(2)');
    const c = s.find((x) => x.type === 'code');
    assert.ok(c && !c.closed); assert.ok(c.code.includes('print(2)'));
  });
  await test('blocks: several blocks keep order/index', () => {
    const c = blocks.parse('```a x.js\n1\n```\ntxt\n```b y.js\n2\n```').filter((x) => x.type === 'code');
    assert.deepStrictEqual(c.map((x) => [x.index, x.path]), [[0, 'x.js'], [1, 'y.js']]);
  });

  await test('models: compat levels', () => {
    assert.strictEqual(M.compat(4.7, { ramGB: 16, vramGB: 12, freeDiskGB: 100 }).level, 'gpu');
    assert.strictEqual(M.compat(19, { ramGB: 32, vramGB: 8, freeDiskGB: 100 }).level, 'hybrid');
    assert.strictEqual(M.compat(4.7, { ramGB: 16, vramGB: 0, freeDiskGB: 100 }).level, 'cpu');
    assert.strictEqual(M.compat(65, { ramGB: 32, vramGB: 8, freeDiskGB: 500 }).level, 'no');
    assert.strictEqual(M.compat(4.7, { ramGB: 64, vramGB: 24, freeDiskGB: 3 }).reason, 'disk');
  });
  await test('models: 120B is never recommended on a normal PC', () => {
    const r = M.recommend({ ramGB: 16, vramGB: 8, freeDiskGB: 200 });
    assert.ok(r.sizeGB < 10 && r.tier !== 'huge' && !r.vision, r.tag);
    assert.ok(M.recommend({ ramGB: 8, vramGB: 0, freeDiskGB: 50 }).sizeGB <= 3);
    assert.strictEqual(M.compat(M.CATALOG.find((m) => m.tag === 'gpt-oss:120b'), { ramGB: 16, vramGB: 8, freeDiskGB: 500 }).level, 'no');
  });
  await test('models: task classification and model pick', () => {
    assert.strictEqual(M.classifyTask('привіт', {}), 'simple');
    assert.strictEqual(M.classifyTask('зроби рефакторинг архітектури, помилка в ' + 'x'.repeat(500), { hasProject: true, hasActive: true }), 'complex');
    const hw = { ramGB: 32, vramGB: 24, freeDiskGB: 200 };
    const names = ['qwen2.5-coder:1.5b', 'qwen2.5-coder:7b', 'qwen3-coder:30b'];
    assert.strictEqual(M.pickModel(names, hw, 'simple'), 'qwen2.5-coder:1.5b');
    assert.strictEqual(M.pickModel(names, hw, 'medium'), 'qwen2.5-coder:7b');
    assert.strictEqual(M.pickModel(names, hw, 'complex'), 'qwen3-coder:30b');
    assert.strictEqual(M.pickModel(names, { ramGB: 8, vramGB: 0, freeDiskGB: 50 }, 'complex'), 'qwen2.5-coder:1.5b');
    assert.ok(M.isVision('qwen2.5vl:7b') && M.isVision('llava:7b') && !M.isVision('qwen2.5-coder:7b'));
  });

  await test('indexer: search, overview, deps, update', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rx-idx-'));
    fs.mkdirSync(path.join(root, 'src')); fs.mkdirSync(path.join(root, 'node_modules'));
    fs.writeFileSync(path.join(root, 'src', 'auth.js'), '// login helpers\nfunction checkPassword(user, pass) {\n  return hash(pass) === user.hash;\n}\nmodule.exports = { checkPassword };\n');
    fs.writeFileSync(path.join(root, 'src', 'main.js'), 'const { checkPassword } = require("./auth");\nfunction startServer() { console.log("listen"); }\nstartServer();\n');
    fs.writeFileSync(path.join(root, 'node_modules', 'junk.js'), 'function checkPassword() {}');
    fs.writeFileSync(path.join(root, 'bin.dat'), Buffer.from([0, 1, 2]));
    const idx = new ProjectIndex(root);
    const r = await idx.build();
    assert.strictEqual(r.files, 2);
    const hits = idx.search('check password hash');
    assert.strictEqual(hits[0].file, 'src/auth.js');
    assert.ok(idx.overview().includes('checkPassword'));
    assert.deepStrictEqual(idx.deps.get('src/main.js'), ['src/auth.js']);
    const ctx = idx.getContext('startServer listen', { budgetTokens: 800 });
    assert.ok(ctx.text.includes('startServer') && ctx.files.includes('src/main.js'));
    fs.writeFileSync(path.join(root, 'src', 'extra.js'), 'function brandNewFeatureZeta() {}\n');
    await idx.updateFile('src/extra.js');
    assert.strictEqual(idx.search('brandNewFeatureZeta')[0].file, 'src/extra.js');
    fs.rmSync(root, { recursive: true, force: true });
  });

  await test('cache: LRU + persistence', () => {
    const f = path.join(os.tmpdir(), 'rx-cache-' + Date.now() + '.json');
    const c = new Cache(f, 2);
    c.set('a', '1'); c.set('b', '2'); c.get('a'); c.set('c', '3');
    assert.strictEqual(c.get('b'), null); assert.strictEqual(c.get('a'), '1');
    c.flush(); assert.strictEqual(new Cache(f, 2).get('c'), '3');
    assert.notStrictEqual(c.key({ x: 1 }), c.key({ x: 2 }));
    fs.unlinkSync(f);
  });

  await test('store: settings merge + chats + id validation', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rx-store-'));
    const s = new Store(dir);
    assert.strictEqual(s.getSettings().gen.temperature, 0.2);
    s.saveSettings({ lang: 'en', gen: { temperature: 0.5 } });
    const g = s.getSettings(); assert.strictEqual(g.lang, 'en'); assert.strictEqual(g.gen.temperature, 0.5); assert.strictEqual(g.gen.top_p, 0.9);
    s.saveChat({ id: 'abc-1', title: 'T', messages: [] });
    assert.strictEqual(s.listChats()[0].id, 'abc-1');
    assert.throws(() => s.getChat('../evil'));
    s.deleteChat('abc-1'); assert.strictEqual(s.listChats().length, 0);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  console.log(`\n${passed} passed`);
})();
