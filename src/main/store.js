const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  lang: 'uk', model: 'auto', useProject: true, cacheEnabled: true, firstRunDone: false,
  ollamaUrl: 'http://127.0.0.1:11434', lastProject: null, autoStartEngine: true,
  gen: { temperature: 0.2, top_p: 0.9, num_ctx: 8192, num_predict: 0 }
};

function writeJson(file, obj) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, file);
}

class Store {
  constructor(dir) {
    this.dir = dir; this.chatsDir = path.join(dir, 'chats'); this.file = path.join(dir, 'settings.json');
    fs.mkdirSync(this.chatsDir, { recursive: true });
  }
  getSettings() {
    let s = {};
    try { s = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch (_) {}
    return Object.assign({}, DEFAULTS, s, { gen: Object.assign({}, DEFAULTS.gen, s.gen || {}) });
  }
  saveSettings(patch) {
    const cur = this.getSettings();
    const next = Object.assign({}, cur, patch, { gen: Object.assign({}, cur.gen, (patch && patch.gen) || {}) });
    writeJson(this.file, next);
    return next;
  }
  _chatFile(id) {
    if (!/^[\w-]+$/.test(String(id))) throw new Error('BAD_CHAT_ID');
    return path.join(this.chatsDir, id + '.json');
  }
  listChats() {
    const out = [];
    for (const f of fs.readdirSync(this.chatsDir)) {
      if (!f.endsWith('.json')) continue;
      try {
        const c = JSON.parse(fs.readFileSync(path.join(this.chatsDir, f), 'utf8'));
        out.push({ id: c.id, title: c.title || '—', updated: c.updated || 0 });
      } catch (_) {}
    }
    return out.sort((a, b) => b.updated - a.updated);
  }
  getChat(id) { return JSON.parse(fs.readFileSync(this._chatFile(id), 'utf8')); }
  saveChat(chat) { chat.updated = Date.now(); writeJson(this._chatFile(chat.id), chat); return chat.updated; }
  deleteChat(id) { try { fs.unlinkSync(this._chatFile(id)); } catch (_) {} }
}
module.exports = Store;
