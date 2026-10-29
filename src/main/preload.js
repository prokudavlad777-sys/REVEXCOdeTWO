const { contextBridge, ipcRenderer } = require('electron');

const EVENTS = new Set(['chat:event', 'models:progress', 'project:index', 'run:event', 'ollama:install']);
const invoke = async (ch, ...a) => {
  const r = await ipcRenderer.invoke(ch, ...a);
  if (r && r.__err) throw new Error(r.__err);
  return r;
};

contextBridge.exposeInMainWorld('revex', {
  init: () => invoke('app:init'),
  saveSettings: (p) => invoke('settings:save', p),
  hwRefresh: () => invoke('hw:refresh'),
  hwLive: () => invoke('hw:live'),
  engineStatus: () => invoke('engine:status'),
  engineStart: () => invoke('engine:start'),
  engineInstall: () => invoke('engine:install'),
  modelsList: () => invoke('models:list'),
  modelInfo: (n) => invoke('models:info', n),
  modelPull: (n) => invoke('models:pull', n),
  modelPullCancel: (n) => invoke('models:pull-cancel', n),
  modelDelete: (n) => invoke('models:delete', n),
  modelTest: (n) => invoke('models:test', n),
  chatsList: () => invoke('chats:list'),
  chatGet: (id) => invoke('chats:get', id),
  chatSave: (c) => invoke('chats:save', c),
  chatDelete: (id) => invoke('chats:delete', id),
  chatSend: (req) => invoke('chat:send', req),
  chatStop: (id) => invoke('chat:stop', id),
  cacheClear: () => invoke('cache:clear'),
  projectOpen: () => invoke('project:open'),
  projectOpenLast: () => invoke('project:open-last'),
  projectReindex: () => invoke('project:reindex'),
  projectList: (dir) => invoke('project:list', dir),
  projectRead: (rel) => invoke('project:read', rel),
  projectWrite: (rel, text) => invoke('project:write', rel, text),
  projectCreate: (rel, text) => invoke('project:create', rel, text),
  projectSearch: (q) => invoke('project:search', q),
  runFile: (rel) => invoke('run:file', rel),
  runStop: () => invoke('run:stop'),
  openExternal: (u) => invoke('shell:open', u),
  on: (ch, cb) => {
    if (!EVENTS.has(ch)) return () => {};
    const h = (_e, p) => cb(p);
    ipcRenderer.on(ch, h);
    return () => ipcRenderer.removeListener(ch, h);
  }
});
