/**
 * Preload — ponte segura renderer <-> main (modulo 9).
 *
 * Com contextIsolation + sandbox, o renderer nao toca em `fs`/`ipcRenderer`
 * direto. Expomos so uma API minima em `window.kiosk`; o jogo faz feature-detect
 * dela (ver src/shell/bridge.ts) e cai nos caminhos web quando ausente.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kiosk', {
  isKiosk: true,
  getConfig: () => ipcRenderer.invoke('kiosk:getConfig'),
  loadTheme: () => ipcRenderer.invoke('kiosk:loadTheme'),
  saveTheme: (theme) => ipcRenderer.invoke('kiosk:saveTheme', theme),
  saveLead: (lead) => ipcRenderer.invoke('kiosk:saveLead', lead),
  revealLeads: () => ipcRenderer.invoke('kiosk:revealLeads'),
});
