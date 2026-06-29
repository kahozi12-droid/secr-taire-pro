const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("digicab", {
  isDesktop: true,
  platform: process.platform,
  printers: {
    list: () => ipcRenderer.invoke("printers:get"),
    print: (opts) => ipcRenderer.invoke("printers:print", opts),
  },
  onPrintersList: (cb) => ipcRenderer.on("printers:list", (_e, p) => cb(p)),
});
