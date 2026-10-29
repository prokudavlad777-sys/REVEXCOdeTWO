(function () {
  const RX = window.RX;
  RX.$ = (id) => document.getElementById(id);
  RX.esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  RX.fmtBytes = (n) => (n >= 1073741824 ? (n / 1073741824).toFixed(1) + ' GB' : (n / 1048576).toFixed(0) + ' MB');
  RX.fmtK = (n) => (n >= 1e6 ? +(n / 1e6).toFixed(2) + 'M' : n >= 1000 ? +(n / 1000).toFixed(1) + 'K' : String(n));

  RX.toast = (msg, ms = 2600) => {
    const el = RX.$('toast'); el.textContent = msg; el.classList.remove('hidden');
    clearTimeout(RX._tt); RX._tt = setTimeout(() => el.classList.add('hidden'), ms);
  };

  RX.modal = (html) => { RX.$('modalBox').innerHTML = html; RX.$('modal').classList.remove('hidden'); return RX.$('modalBox'); };
  RX.closeModal = () => RX.$('modal').classList.add('hidden');

  const inline = (s) => RX.esc(s).replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
  RX.renderText = (text) => {
    const out = []; let list = [], para = [];
    const flushP = () => { if (para.length) { out.push('<p>' + para.join('<br>') + '</p>'); para = []; } };
    const flushL = () => { if (list.length) { out.push('<ul>' + list.map((x) => '<li>' + x + '</li>').join('') + '</ul>'); list = []; } };
    for (const line of text.split('\n')) {
      let m;
      if ((m = line.match(/^#{1,4}\s+(.*)$/))) { flushP(); flushL(); out.push('<h4>' + inline(m[1]) + '</h4>'); }
      else if ((m = line.match(/^\s*[-*]\s+(.*)$/)) || (m = line.match(/^\s*\d+[.)]\s+(.*)$/))) { flushP(); list.push(inline(m[1])); }
      else if (!line.trim()) { flushP(); flushL(); }
      else { flushL(); para.push(inline(line)); }
    }
    flushP(); flushL();
    return out.join('');
  };

  // Повертає HTML повідомлення; код-блоки отримують data-n для дій «Копіювати/Застосувати».
  RX.renderMessage = (text) => RX.blocks.parse(text).map((s) => {
    if (s.type === 'text') return RX.renderText(s.text);
    return `<div class="cb" data-n="${s.index}"><div class="cbh"><span class="lang">${RX.esc(s.lang || 'text')}</span>` +
      (s.path ? `<span class="fname">${RX.esc(s.path)}</span>` : '') + '<span class="sp"></span>' +
      `<button class="btn sm" data-act="copy">${RX.t('cb.copy')}</button>` +
      (s.closed ? `<button class="btn sm primary" data-act="apply">${RX.t('cb.apply')}</button>` : '') +
      `</div><pre><code>${RX.esc(s.code)}</code></pre></div>`;
  }).join('');

  RX.colorize = async (root) => {
    if (!window.monaco) return;
    for (const cb of root.querySelectorAll('.cb')) {
      if (cb.dataset.done) continue;
      const lang = cb.querySelector('.lang').textContent;
      const code = cb.querySelector('code');
      try { code.innerHTML = await window.monaco.editor.colorize(code.textContent, RX.ed.normLang(lang), { tabSize: 2 }); cb.dataset.done = '1'; } catch (_) {}
    }
  };

  RX.readImage = (file) => new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return reject(new Error('type'));
    if (file.size > 12 * 1024 * 1024) return reject(new Error('size'));
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('read'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('read'));
      img.onload = () => {
        const MAX = 2000, k = Math.min(1, MAX / Math.max(img.width, img.height));
        if (k === 1) return resolve({ name: file.name || 'image', dataUrl: fr.result });
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve({ name: file.name || 'image', dataUrl: c.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.92) });
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
})();
