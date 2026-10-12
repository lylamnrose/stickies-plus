const { contextBridge, ipcRenderer } = require('electron');

// The only things a note's web page is allowed to ask the app to do.
contextBridge.exposeInMainWorld('sticky', {
  get: () => ipcRenderer.invoke('note:get'),
  save: (html) => ipcRenderer.send('note:save', html),
  newNote: () => ipcRenderer.send('note:new'),
  close: () => ipcRenderer.send('note:close'),
  remove: () => ipcRenderer.invoke('note:delete'),
  setColor: (color) => ipcRenderer.send('note:color', color),
  togglePin: () => ipcRenderer.invoke('note:pin'),
  sendBehind: () => ipcRenderer.send('note:send-behind'),
  toggleCollapse: () => ipcRenderer.send('note:toggle-collapse'),
  setOpacity: (value) => ipcRenderer.send('note:opacity', value),
  // The note window grows while an image is open large, and shrinks back afterwards.
  zoomStart: () => ipcRenderer.send('note:zoom-start'),
  zoomEnd: () => ipcRenderer.send('note:zoom-end'),
  // Main tells the note when it was collapsed/expanded (button or ⌘M).
  onCollapsed: (callback) => {
    ipcRenderer.on('note:collapsed', (_event, collapsed) => callback(!!collapsed));
  },
});
