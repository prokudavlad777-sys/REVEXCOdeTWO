// Розбір відповіді моделі на текст і код-блоки. Працює і в Node (тести), і в браузері.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.RX = root.RX || {}; root.RX.blocks = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  const PATH_RE = /[\/\\]|\.\w{1,8}$/;
  const FILE_COMMENT = /^\s*(?:\/\/|#|--|;|\/\*|<!--)\s*(?:file(?:name)?|path)\s*:\s*([^\s*>]+)/i;

  const cleanTok = (t) => t.replace(/^(file|filename|title|path)=/i, '').replace(/^["'`]+|["'`]+$/g, '');
  const looksLikePath = (t) => PATH_RE.test(t) && !/^https?:/i.test(t);

  function parseInfo(info) {
    info = (info || '').trim();
    let lang = '', path = '';
    const m = info.match(/^([A-Za-z0-9_+#-]+):(.+)$/);
    const toks = m && looksLikePath(cleanTok(m[2])) ? [m[1], m[2]] : info.split(/\s+/).filter(Boolean);
    toks.forEach((raw, i) => {
      const t = cleanTok(raw);
      if (!t) return;
      if (!path && looksLikePath(t) && (i > 0 || /[\/\\]/.test(t) || /^[\w.-]+\.\w{1,8}$/.test(t))) path = t.replace(/\\/g, '/');
      else if (!lang) lang = t.toLowerCase();
    });
    return { lang, path };
  }

  function parse(text) {
    const segs = [];
    const re = /```([^\n`]*)\n([\s\S]*?)(?:\n```|$)/g;
    let last = 0, m, idx = 0;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) segs.push({ type: 'text', text: text.slice(last, m.index) });
      const { lang, path } = parseInfo(m[1]);
      let p = path;
      if (!p) { const fc = (m[2].split('\n', 1)[0] || '').match(FILE_COMMENT); if (fc) p = fc[1].replace(/\\/g, '/'); }
      segs.push({ type: 'code', lang, path: p, code: m[2], closed: /\n```$/.test(m[0]), index: idx++ });
      last = m.index + m[0].length;
      if (m[0].length === 0) re.lastIndex++;
    }
    if (last < text.length) segs.push({ type: 'text', text: text.slice(last) });
    return segs;
  }

  return { parse, parseInfo };
});
