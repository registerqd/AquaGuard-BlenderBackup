'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('aqua', {
  // 状态
  getState: () => ipcRenderer.invoke('state:get'),
  onState: (fn) => ipcRenderer.on('state:update', (_e, s) => fn(s)),
  onLog: (fn) => ipcRenderer.on('log:line', (_e, l) => fn(l)),
  onAlarm: (fn) => ipcRenderer.on('alarm:heartbeat', (_e, d) => fn(d)),
  onStartupRecover: (fn) => ipcRenderer.on('startup:recover', (_e, d) => fn(d)),
  startupRecover: (yes) => ipcRenderer.invoke('action:startup-recover', yes),
  getLog: () => ipcRenderer.invoke('log:get'),

  // 配置
  getConfig: () => ipcRenderer.invoke('cfg:get'),
  setConfig: (patch) => ipcRenderer.invoke('cfg:set', patch),

  // 动作
  startServer: () => ipcRenderer.invoke('server:start'),
  stopServer: () => ipcRenderer.invoke('server:stop'),
  forceSnapshot: () => ipcRenderer.invoke('action:snapshot'),
  restartBlender: (opts) => ipcRenderer.invoke('action:restart-blender', opts),
  dismissAlarm: () => ipcRenderer.invoke('action:dismiss-alarm'),
  openPath: (p) => ipcRenderer.invoke('action:open-path', p),
  exportAddon: () => ipcRenderer.invoke('action:export-addon'),
  installAddon: () => ipcRenderer.invoke('action:install-addon'),
  detectBlender: () => ipcRenderer.invoke('action:detect-blender'),
  setAutoStart: (flag) => ipcRenderer.invoke('action:autostart', flag),
  openExternal: (url) => ipcRenderer.invoke('action:open-external', url),
  copyText: (text) => ipcRenderer.invoke('action:copy', text),

  // 窗口
  minimize: () => ipcRenderer.send('win:minimize'),
  hideToTray: () => ipcRenderer.send('win:hide'),
  close: () => ipcRenderer.send('win:close'),
  isMaximized: () => ipcRenderer.invoke('win:is-maximized'),
  toggleMaximize: () => ipcRenderer.send('win:toggle-maximize')
});
