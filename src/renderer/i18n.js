window.RX = window.RX || {};
RX.dict = {
  uk: {
    'tab.chats': 'Чати', 'tab.project': 'Проєкт', 'tab.models': 'Моделі',
    'chat.new': '+ Новий чат', 'chat.untitled': 'Новий чат', 'chat.delete': 'Видалити', 'chat.confirmDelete': 'Видалити цей чат?',
    'chat.ph': 'Запитайте про код або прикріпіть скриншот помилки… (Enter — надіслати, Shift+Enter — новий рядок)',
    'chat.send': 'Надіслати', 'chat.stop': '■ Зупинити', 'chat.continue': 'Продовжити', 'chat.retry': 'Повторити',
    'chat.attach': 'Прикріпити фото (PNG, JPG, WEBP) — або Ctrl+V, або перетягніть', 'chat.remove': 'Прибрати', 'chat.useProject': 'Використовувати контекст проєкту (RAG)',
    'att.max': 'Максимум 6 зображень', 'att.size': 'Зображення більше 12 МБ', 'att.type': 'Підтримуються лише PNG, JPG, JPEG, WEBP',
    'welcome.title': 'REVEX CODE', 'welcome.text': 'Локальний AI-кодер. Відкрийте проєкт у вкладці «Проєкт», оберіть модель справа і питайте. Код із відповіді можна застосувати в редактор з переглядом змін.',
    'msg.you': 'Ви', 'msg.cached': 'з кешу', 'msg.ttft': 'перший токен {n} мс', 'msg.stopped': 'зупинено', 'msg.length': 'обірвано за лімітом — натисніть «Продовжити»', 'msg.files': 'контекст: {n} файл(ів)', 'msg.ocr': 'Розпізнаю текст на зображенні…',
    'cb.copy': 'Копіювати', 'cb.copied': 'Скопійовано', 'cb.apply': 'Застосувати',
    'proj.open': 'Відкрити папку проєкту', 'proj.search': 'Пошук по проєкту (RAG)…', 'proj.none': 'Проєкт не відкрито', 'proj.indexing': 'Індексація: {n} / {t}', 'proj.indexed': 'Проїндексовано: {f} файлів, {c} фрагментів', 'proj.reindex': 'Оновити', 'proj.noHits': 'Нічого не знайдено',
    'editor.toggle': 'Редактор', 'ed.save': 'Зберегти', 'ed.undo': 'Скасувати', 'ed.revert': 'Повернути з диска', 'ed.run': '▶ Запустити', 'ed.runStop': '■ Стоп', 'ed.empty': 'Відкрийте файл у вкладці «Проєкт»',
    'ed.accept': 'Прийняти', 'ed.reject': 'Відхилити', 'ed.newFile': 'Новий файл', 'ed.applied': 'Зміни застосовано (не збережено — Ctrl+S)', 'ed.saved': 'Збережено',
    'ed.confirmClose': 'Файл {f} має незбережені зміни. Закрити?', 'ed.confirmRevert': 'Відкинути незбережені зміни?', 'ed.output': 'Вивід', 'ed.clear': 'Очистити', 'ed.unsupportedRun': 'Запуск цього типу файлу не підтримується (py, js, ts, lua, c, cpp)',
    'ai.explain': 'REVEX: Пояснити', 'ai.fix': 'REVEX: Знайти й виправити помилки', 'ai.refactor': 'REVEX: Рефакторинг', 'ai.tests': 'REVEX: Написати тести',
    'ai.p.explain': 'Поясни цей код із файлу {f}.', 'ai.p.fix': 'Знайди помилки в цьому коді з файлу {f} і виправ їх. Нічого робочого не видаляй.', 'ai.p.refactor': 'Зроби рефакторинг цього коду з файлу {f}, не змінюючи поведінку.', 'ai.p.tests': 'Напиши тести для цього коду з файлу {f}.',
    'models.installed': 'Встановлені', 'models.catalog': 'Каталог (Ollama)', 'models.cloud': 'Хмарні (потрібен API-ключ)', 'models.none': 'Моделей немає — завантажте з каталогу',
    'models.test': 'Тест', 'models.delete': 'Видалити', 'models.confirmDelete': 'Видалити модель {m} з диска?', 'models.installedBadge': 'Встановлено',
    'models.download': 'Завантажити', 'models.pause': 'Пауза', 'models.resume': 'Продовжити', 'models.cancel': 'Скасувати', 'models.paused': 'Пауза',
    'models.needs': 'потрібно ≈{n} GB', 'models.recommended': 'рекомендовано', 'models.done': 'Модель {m} завантажено',
    'models.warnNo': 'Модель {m} не підходить для цього комп\'ютера (мало RAM/VRAM або місця). Все одно завантажити?',
    'models.not.disk': 'мало місця на диску', 'models.not.ram': 'не вистачає RAM/VRAM',
    'lvl.gpu': 'GPU — швидко', 'lvl.hybrid': 'GPU+CPU — повільніше', 'lvl.cpu': 'CPU — повільно', 'lvl.no': 'не підходить',
    'cloud.status': 'не підключено', 'hw.title': 'Ваш комп\'ютер', 'hw.cores': 'ядер', 'hw.gpu': 'GPU', 'hw.none': 'не виявлено', 'hw.disk': 'Вільно на диску', 'hw.na': 'н/д',
    'eng.running': 'Ollama працює {v}', 'eng.stopped': 'Ollama встановлена, але не запущена', 'eng.missing': 'Ollama не встановлена', 'eng.start': 'Запустити рушій', 'eng.install': 'Встановити Ollama', 'eng.starting': 'Запускаю…',
    'eng.failed': 'Не вдалося запустити Ollama', 'eng.unsupported': 'Автовстановлення доступне лише у Windows', 'eng.confirmInstall': 'Завантажити офіційний інсталятор Ollama (ollama.com) і встановити його?', 'eng.downloading': 'Завантаження Ollama: {p}% · {s} MB/s', 'eng.installing': 'Встановлення Ollama…',
    'r.model': 'Модель', 'r.auto': 'Авто (за складністю завдання)', 'r.autoNote': 'Прості питання — швидка модель, складні — найпотужніша з придатних.', 'r.wizard': 'Майстер налаштування',
    'r.speed': 'Швидкість', 'r.ttft': 'Перший токен', 'r.usedModel': 'Остання модель', 'r.context': 'Контекст', 'r.params': 'Параметри генерації', 'r.temp': 'Температура', 'r.ctxLen': 'Довжина контексту', 'r.maxTok': 'Макс. токенів (0 = без ліміту)',
    'r.cache': 'Кешувати відповіді (температура ≤ 0.3)', 'r.clearCache': 'Очистити кеш', 'r.cacheCleared': 'Кеш очищено', 'r.lang': 'Мова інтерфейсу',
    'ctx.max': 'Максимум моделі: {n} токенів', 'ctx.million': 'Модель підтримує {n} токенів', 'ctx.warn': 'Великий контекст потребує багато RAM/VRAM — може бути повільно',
    'err.noModels': 'Немає встановлених моделей. Завантажте модель у вкладці «Моделі».', 'err.modelMissing': 'Модель {m} не встановлена', 'err.engine': 'Ollama не відповідає. Запустіть рушій (права панель).', 'err.noProject': 'Спершу відкрийте папку проєкту', 'err.noTarget': 'У блоці немає імені файлу, а активного файлу в редакторі теж немає',
    'wz.title': 'Перший запуск', 'wz.intro': 'Перевіримо комп\'ютер, рушій і модель. Нічого не завантажується без вашого підтвердження.', 'wz.hw': 'Обладнання', 'wz.engine': 'Локальний рушій (Ollama)', 'wz.engineMissing': 'Не встановлено. Можна завантажити офіційний інсталятор (ollama.com).',
    'wz.model': 'Рекомендована модель', 'wz.download': 'Завантажити', 'wz.test': 'Тестовий запит', 'wz.testHint': 'Перевірка, що модель відповідає', 'wz.runTest': 'Запустити тест', 'wz.done': 'Готово'
  },
  en: {
    'tab.chats': 'Chats', 'tab.project': 'Project', 'tab.models': 'Models',
    'chat.new': '+ New chat', 'chat.untitled': 'New chat', 'chat.delete': 'Delete', 'chat.confirmDelete': 'Delete this chat?',
    'chat.ph': 'Ask about code or attach an error screenshot… (Enter — send, Shift+Enter — new line)',
    'chat.send': 'Send', 'chat.stop': '■ Stop', 'chat.continue': 'Continue', 'chat.retry': 'Retry',
    'chat.attach': 'Attach image (PNG, JPG, WEBP) — or Ctrl+V, or drag & drop', 'chat.remove': 'Remove', 'chat.useProject': 'Use project context (RAG)',
    'att.max': 'Up to 6 images', 'att.size': 'Image is larger than 12 MB', 'att.type': 'Only PNG, JPG, JPEG, WEBP are supported',
    'welcome.title': 'REVEX CODE', 'welcome.text': 'A local AI coder. Open a project in the Project tab, pick a model on the right and ask. Code from replies can be applied to the editor with a diff preview.',
    'msg.you': 'You', 'msg.cached': 'cached', 'msg.ttft': 'first token {n} ms', 'msg.stopped': 'stopped', 'msg.length': 'cut by the limit — press Continue', 'msg.files': 'context: {n} file(s)', 'msg.ocr': 'Recognizing text in the image…',
    'cb.copy': 'Copy', 'cb.copied': 'Copied', 'cb.apply': 'Apply',
    'proj.open': 'Open project folder', 'proj.search': 'Search project (RAG)…', 'proj.none': 'No project opened', 'proj.indexing': 'Indexing: {n} / {t}', 'proj.indexed': 'Indexed: {f} files, {c} chunks', 'proj.reindex': 'Refresh', 'proj.noHits': 'Nothing found',
    'editor.toggle': 'Editor', 'ed.save': 'Save', 'ed.undo': 'Undo', 'ed.revert': 'Revert from disk', 'ed.run': '▶ Run', 'ed.runStop': '■ Stop', 'ed.empty': 'Open a file from the Project tab',
    'ed.accept': 'Accept', 'ed.reject': 'Reject', 'ed.newFile': 'New file', 'ed.applied': 'Changes applied (unsaved — Ctrl+S)', 'ed.saved': 'Saved',
    'ed.confirmClose': 'File {f} has unsaved changes. Close it?', 'ed.confirmRevert': 'Discard unsaved changes?', 'ed.output': 'Output', 'ed.clear': 'Clear', 'ed.unsupportedRun': 'Running this file type is not supported (py, js, ts, lua, c, cpp)',
    'ai.explain': 'REVEX: Explain', 'ai.fix': 'REVEX: Find and fix bugs', 'ai.refactor': 'REVEX: Refactor', 'ai.tests': 'REVEX: Write tests',
    'ai.p.explain': 'Explain this code from {f}.', 'ai.p.fix': 'Find bugs in this code from {f} and fix them. Do not remove working code.', 'ai.p.refactor': 'Refactor this code from {f} without changing behavior.', 'ai.p.tests': 'Write tests for this code from {f}.',
    'models.installed': 'Installed', 'models.catalog': 'Catalog (Ollama)', 'models.cloud': 'Cloud (API key required)', 'models.none': 'No models — download one from the catalog',
    'models.test': 'Test', 'models.delete': 'Delete', 'models.confirmDelete': 'Delete model {m} from disk?', 'models.installedBadge': 'Installed',
    'models.download': 'Download', 'models.pause': 'Pause', 'models.resume': 'Resume', 'models.cancel': 'Cancel', 'models.paused': 'Paused',
    'models.needs': 'needs ≈{n} GB', 'models.recommended': 'recommended', 'models.done': 'Model {m} downloaded',
    'models.warnNo': 'Model {m} does not fit this computer (not enough RAM/VRAM or disk). Download anyway?',
    'models.not.disk': 'not enough disk space', 'models.not.ram': 'not enough RAM/VRAM',
    'lvl.gpu': 'GPU — fast', 'lvl.hybrid': 'GPU+CPU — slower', 'lvl.cpu': 'CPU — slow', 'lvl.no': 'not compatible',
    'cloud.status': 'not connected', 'hw.title': 'Your computer', 'hw.cores': 'cores', 'hw.gpu': 'GPU', 'hw.none': 'not detected', 'hw.disk': 'Free disk', 'hw.na': 'n/a',
    'eng.running': 'Ollama is running {v}', 'eng.stopped': 'Ollama is installed but not running', 'eng.missing': 'Ollama is not installed', 'eng.start': 'Start engine', 'eng.install': 'Install Ollama', 'eng.starting': 'Starting…',
    'eng.failed': 'Could not start Ollama', 'eng.unsupported': 'Auto-install is available on Windows only', 'eng.confirmInstall': 'Download the official Ollama installer (ollama.com) and install it?', 'eng.downloading': 'Downloading Ollama: {p}% · {s} MB/s', 'eng.installing': 'Installing Ollama…',
    'r.model': 'Model', 'r.auto': 'Auto (by task complexity)', 'r.autoNote': 'Simple questions use a fast model, hard ones the strongest suitable one.', 'r.wizard': 'Setup wizard',
    'r.speed': 'Speed', 'r.ttft': 'First token', 'r.usedModel': 'Last model', 'r.context': 'Context', 'r.params': 'Generation parameters', 'r.temp': 'Temperature', 'r.ctxLen': 'Context length', 'r.maxTok': 'Max tokens (0 = unlimited)',
    'r.cache': 'Cache answers (temperature ≤ 0.3)', 'r.clearCache': 'Clear cache', 'r.cacheCleared': 'Cache cleared', 'r.lang': 'Interface language',
    'ctx.max': 'Model maximum: {n} tokens', 'ctx.million': 'Model supports {n} tokens', 'ctx.warn': 'Large context needs a lot of RAM/VRAM — it may be slow',
    'err.noModels': 'No models installed. Download one in the Models tab.', 'err.modelMissing': 'Model {m} is not installed', 'err.engine': 'Ollama is not responding. Start the engine (right panel).', 'err.noProject': 'Open a project folder first', 'err.noTarget': 'The block has no file name and no file is active in the editor',
    'wz.title': 'First run', 'wz.intro': 'We will check your computer, the engine and a model. Nothing is downloaded without your confirmation.', 'wz.hw': 'Hardware', 'wz.engine': 'Local engine (Ollama)', 'wz.engineMissing': 'Not installed. You can download the official installer (ollama.com).',
    'wz.model': 'Recommended model', 'wz.download': 'Download', 'wz.test': 'Test request', 'wz.testHint': 'Checks that the model answers', 'wz.runTest': 'Run test', 'wz.done': 'Done'
  }
};
RX.lang = 'uk';
RX.t = (k, v) => {
  let s = (RX.dict[RX.lang] && RX.dict[RX.lang][k]) || RX.dict.en[k] || k;
  if (v) for (const x in v) s = s.split('{' + x + '}').join(v[x]);
  return s;
};
RX.applyI18n = () => {
  document.querySelectorAll('[data-i18n]').forEach((e) => (e.textContent = RX.t(e.dataset.i18n)));
  document.querySelectorAll('[data-i18n-ph]').forEach((e) => (e.placeholder = RX.t(e.dataset.i18nPh)));
  document.querySelectorAll('[data-i18n-title]').forEach((e) => (e.title = RX.t(e.dataset.i18nTitle)));
  document.documentElement.lang = RX.lang;
};
