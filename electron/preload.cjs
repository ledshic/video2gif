const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('video2gif', {
  getDefaults: () => ipcRenderer.invoke('get-defaults'),
  probeDuration: (input) => ipcRenderer.invoke('probe-duration', input),
  selectVideo: () => ipcRenderer.invoke('select-video'),
  selectOutput: (defaultName) => ipcRenderer.invoke('select-output', defaultName),
  showItemInFolder: (filePath) => ipcRenderer.invoke('show-item-in-folder', filePath),
  openPath: (filePath) => ipcRenderer.invoke('open-path', filePath),
  defaultOutputPath: (input) => ipcRenderer.invoke('default-output-path', input),
  convert: (opts) => ipcRenderer.invoke('convert', opts),
  cancelConvert: () => ipcRenderer.invoke('cancel-convert'),
  onProgress: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('convert-progress', handler);
    return () => ipcRenderer.removeListener('convert-progress', handler);
  },
});
