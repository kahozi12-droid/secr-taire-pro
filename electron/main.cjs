// DigiCab - SAE/LBA — Electron desktop shell (Windows)
// Loads the published Lovable app and exposes native printer access
// via Electron's webContents.print() / printToPDF() APIs.

const { app, BrowserWindow, ipcMain, Menu, shell } = require("electron");
const path = require("path");

const APP_URL =
  process.env.DIGICAB_URL ||
  "https://id-preview--59db28e4-70a3-49b8-a87c-b1f37b6976a8.lovable.app";

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: "#0b1220",
    title: "DigiCab - SAE/LBA",
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadURL(APP_URL);

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_URL)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  // Build a minimal menu with print shortcut
  const menu = Menu.buildFromTemplate([
    {
      label: "Fichier",
      submenu: [
        {
          label: "Imprimer…",
          accelerator: "CmdOrCtrl+P",
          click: () => mainWindow.webContents.print({ silent: false, printBackground: true }),
        },
        { type: "separator" },
        { role: "quit", label: "Quitter" },
      ],
    },
    {
      label: "Affichage",
      submenu: [
        { role: "reload", label: "Recharger" },
        { role: "forceReload", label: "Recharger (forcé)" },
        { role: "toggleDevTools", label: "Outils de développement" },
        { type: "separator" },
        { role: "resetZoom", label: "Zoom 100%" },
        { role: "zoomIn", label: "Zoom +" },
        { role: "zoomOut", label: "Zoom -" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Plein écran" },
      ],
    },
    {
      label: "Imprimante",
      submenu: [
        {
          label: "Lister les imprimantes",
          click: async () => {
            const printers = await mainWindow.webContents.getPrintersAsync();
            mainWindow.webContents.send("printers:list", printers);
          },
        },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

// IPC: list printers
ipcMain.handle("printers:get", async () => {
  if (!mainWindow) return [];
  return await mainWindow.webContents.getPrintersAsync();
});

// IPC: print current page silently to a specific printer
ipcMain.handle("printers:print", async (_evt, opts = {}) => {
  if (!mainWindow) return { ok: false };
  return await new Promise((resolve) => {
    mainWindow.webContents.print(
      {
        silent: !!opts.silent,
        printBackground: true,
        deviceName: opts.deviceName || undefined,
        copies: opts.copies || 1,
      },
      (success, reason) => resolve({ ok: success, reason }),
    );
  });
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
