// Каталог моделей, перевірка сумісності з обладнанням, вибір моделі за складністю завдання.
const CATALOG = [
  { tag: 'qwen2.5-coder:1.5b', label: 'Qwen2.5-Coder 1.5B', paramsB: 1.5, sizeGB: 1.0, tier: 'fast', vision: false, ctxK: 32, desc: 'Найшвидша, прості питання' },
  { tag: 'llama3.2:3b', label: 'Llama 3.2 3B', paramsB: 3, sizeGB: 2.0, tier: 'fast', vision: false, ctxK: 128, desc: 'Загальна компактна модель' },
  { tag: 'deepseek-coder:6.7b', label: 'DeepSeek Coder 6.7B', paramsB: 6.7, sizeGB: 3.8, tier: 'balanced', vision: false, ctxK: 16, desc: 'Код, збалансована' },
  { tag: 'qwen2.5-coder:7b', label: 'Qwen2.5-Coder 7B', paramsB: 7, sizeGB: 4.7, tier: 'balanced', vision: false, ctxK: 128, desc: 'Код, хороший баланс швидкості та якості' },
  { tag: 'qwen2.5-coder:14b', label: 'Qwen2.5-Coder 14B', paramsB: 14, sizeGB: 9.0, tier: 'power', vision: false, ctxK: 128, desc: 'Сильніший код' },
  { tag: 'deepseek-coder-v2:16b', label: 'DeepSeek Coder V2 16B (MoE)', paramsB: 16, sizeGB: 8.9, tier: 'power', vision: false, ctxK: 160, desc: 'MoE, швидка для свого розміру' },
  { tag: 'qwen3-coder:30b', label: 'Qwen3-Coder 30B (MoE)', paramsB: 30, sizeGB: 19, tier: 'power', vision: false, ctxK: 256, desc: 'Топ для коду, довгий контекст' },
  { tag: 'qwen2.5-coder:32b', label: 'Qwen2.5-Coder 32B', paramsB: 32, sizeGB: 20, tier: 'power', vision: false, ctxK: 32, desc: 'Максимальна якість класу 32B' },
  { tag: 'gpt-oss:120b', label: 'gpt-oss 120B', paramsB: 120, sizeGB: 65, tier: 'huge', vision: false, ctxK: 128, desc: 'Клас 100B+, тільки для потужних ПК' },
  { tag: 'gemma3:4b', label: 'Gemma 3 4B (фото)', paramsB: 4, sizeGB: 3.3, tier: 'fast', vision: true, ctxK: 128, desc: 'Розуміє зображення' },
  { tag: 'qwen2.5vl:7b', label: 'Qwen2.5-VL 7B (фото)', paramsB: 7, sizeGB: 6.0, tier: 'balanced', vision: true, ctxK: 128, desc: 'Зображення, скриншоти, OCR' },
  { tag: 'llava:7b', label: 'LLaVA 7B (фото)', paramsB: 7, sizeGB: 4.7, tier: 'balanced', vision: true, ctxK: 4, desc: 'Зображення (старіша)' },
  { tag: 'llama3.2-vision:11b', label: 'Llama 3.2 Vision 11B', paramsB: 11, sizeGB: 7.8, tier: 'power', vision: true, ctxK: 128, desc: 'Зображення, сильніша' }
];

const CLOUD = [
  { id: 'openai', name: 'OpenAI (GPT)' },
  { id: 'anthropic', name: 'Anthropic (Claude)' },
  { id: 'google', name: 'Google (Gemini)' }
]; // Потребують API-ключа; у цій версії не підключені — тільки статус, без імітації.

const VISION_RE = /(llava|vision|qwen\d(\.\d)?-?vl|minicpm-v|gemma3|moondream|bakllava)/i;
const isVision = (name) => VISION_RE.test(String(name || ''));

function sizeOf(name) {
  const c = CATALOG.find((m) => m.tag === name);
  if (c) return c.sizeGB;
  const m = String(name).match(/(\d+(?:\.\d+)?)b/i);
  return m ? Math.max(0.5, parseFloat(m[1]) * 0.6) : 4;
}

// hw: { ramGB, vramGB, freeDiskGB }
function compat(model, hw) {
  const size = typeof model === 'number' ? model : model.sizeGB;
  const need = +(size * 1.2 + 1.5).toFixed(1);
  const ram = hw.ramGB || 0, vram = hw.vramGB || 0;
  if (hw.freeDiskGB != null && hw.freeDiskGB < size + 3) return { level: 'no', need, reason: 'disk' };
  if (vram >= need) return { level: 'gpu', need };
  if (vram > 0 && vram + ram * 0.7 >= need * 1.1) return { level: 'hybrid', need };
  if (ram * 0.75 >= need * 1.1) return { level: 'cpu', need };
  return { level: 'no', need, reason: 'ram' };
}

function recommend(hw, catalog = CATALOG) {
  const cands = catalog.filter((m) => !m.vision && m.tier !== 'huge').map((m) => ({ m, c: compat(m, hw) })).filter((x) => x.c.level !== 'no');
  if (!cands.length) return catalog.find((m) => m.tag === 'qwen2.5-coder:1.5b');
  const gpu = cands.filter((x) => x.c.level === 'gpu' && x.m.sizeGB <= (hw.vramGB || 0) * 0.75).sort((a, b) => b.m.sizeGB - a.m.sizeGB);
  if (gpu.length) return gpu[0].m;
  const slow = cands.filter((x) => x.m.sizeGB <= (hw.ramGB || 0) * 0.3).sort((a, b) => b.m.sizeGB - a.m.sizeGB);
  if (slow.length) return slow[0].m;
  return cands.sort((a, b) => a.m.sizeGB - b.m.sizeGB)[0].m;
}

function classifyTask(text, o = {}) {
  const s = String(text || '');
  let score = 0;
  if (s.length > 400) score++;
  if (s.length > 1500) score++;
  if (/```/.test(s)) score++;
  if (/(refactor|рефактор|архітектур|архитектур|architecture|optimi[sz]e|оптимі|оптими|створи проєкт|создай проект|create (a )?project|багато файл|multi-?file|migrate|міграц|алгоритм|algorithm|debug|налагод|відлад|не працює|doesn'?t work|error|помилк|ошибк|stack ?trace)/i.test(s)) score += 2;
  if (o.hasProject) score++;
  if (o.hasActive) score++;
  if (o.images) score++;
  if ((o.turns || 0) > 8) score++;
  if (s.length < 120 && score === 0) return 'simple';
  return score >= 4 ? 'complex' : score >= 2 ? 'medium' : 'simple';
}

function pickModel(names, hw, complexity) {
  if (!names || !names.length) return null;
  const items = names.map((n) => ({ n, size: sizeOf(n), c: compat(sizeOf(n), hw) })).sort((a, b) => a.size - b.size);
  const ok = items.filter((x) => x.c.level !== 'no');
  if (!ok.length) return items[0].n;
  if (complexity === 'simple') return ok[0].n;
  if (complexity === 'medium') {
    const mid = ok.filter((x) => x.size <= 10);
    return (mid.length ? mid[mid.length - 1] : ok[0]).n;
  }
  const fast = ok.filter((x) => x.c.level === 'gpu' || x.c.level === 'hybrid');
  return (fast.length ? fast : ok).slice(-1)[0].n;
}

module.exports = { CATALOG, CLOUD, isVision, sizeOf, compat, recommend, classifyTask, pickModel };
