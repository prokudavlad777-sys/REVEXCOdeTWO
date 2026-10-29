const fs = require('fs');
const crypto = require('crypto');

class Cache {
  constructor(file, max = 300) {
    this.file = file; this.max = max; this.map = new Map(); this.timer = null;
    try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); for (const [k, v] of j) this.map.set(k, v); } catch (_) {}
  }
  key(obj) { return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex'); }
  get(k) { if (!this.map.has(k)) return null; const v = this.map.get(k); this.map.delete(k); this.map.set(k, v); return v; }
  set(k, v) {
    this.map.delete(k); this.map.set(k, v);
    while (this.map.size > this.max) this.map.delete(this.map.keys().next().value);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 1000);
  }
  flush() { try { fs.writeFileSync(this.file, JSON.stringify([...this.map])); } catch (_) {} }
  clear() { this.map.clear(); this.flush(); }
}
module.exports = Cache;
