import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.DIST = path.join(__dirname$1, "../dist");
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(__dirname$1, "../public");
let win;
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
function createWindow() {
  win = new BrowserWindow({
    width: 1366,
    height: 768,
    // Icon logic: In dev, it's in public/. In prod, public assets are moved to dist/.
    icon: path.join(process.env.VITE_PUBLIC, "icon.ico"),
    autoHideMenuBar: true,
    // Hide default menu
    webPreferences: {
      nodeIntegration: true,
      // Required for internal communication
      contextIsolation: false,
      // Required for internal communication
      // CRITICAL: Disable webSecurity to allow CORS and connection to local Node-RED (ws://)
      // This is necessary when the app is loaded from file:// but connects to localhost
      webSecurity: false
    }
  });
  win.webContents.session.clearCache().then(() => {
    console.log("Session cache cleared successfully to maintain disk health.");
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(process.env.DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(createWindow);
