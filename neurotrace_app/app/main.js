import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { KeystrokeCaptureService } from './src/main/keystroke-capture.js';
import { detectKeyboard } from './src/main/keyboardDetector.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === 'development';

let mainWindow = null;
let captureService = null;
let backendProcess = null;
let keyboardInfo = null;

const userDataPath = app.getPath('userData');
const sessionsDir = path.join(userDataPath, 'sessions');


function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false, 
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, 'public', 'icon.png'),
    title: 'Tremora | Motor Assessment',
    backgroundColor: '#ffffff'
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (captureService) captureService.stop();
  });

  if (!captureService) {
    captureService = new KeystrokeCaptureService(mainWindow);
  }
}

function registerHandlers() {
  if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

  const handle = (channel, func) => {
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, func);
  };

  handle('buffer:getSnapshot', () => {
      return {
          keystrokes: captureService?.getBuffer() || [],
          keyboard: keyboardInfo
      };
  });
  handle('buffer:clear', () => captureService?.clearBuffer());
  
  handle('capture:start', async () => {
      keyboardInfo = await detectKeyboard();
      captureService?.start();
      return true;
  });
  handle('capture:stop', () => {
      captureService?.stop();
      return true;
  });
  handle('capture:setTappyMode', (event, enabled) => {
      captureService?.setTappyMode(enabled);
      return true;
  });
  handle('keyboard:getInfo', () => keyboardInfo);

  handle('report:savePDF', async (event, htmlContent) => {
    try {
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Save Analysis Report',
        defaultPath: `Tremora_Report_${new Date().toISOString().slice(0,10)}.pdf`,
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
      });
      if (canceled || !filePath) return { success: false, reason: 'cancelled' };

      // Write HTML to a temp file — avoids data: URL length limits for large reports
      const os = await import('os');
      const tmpHtml = path.join(os.default.tmpdir(), `tremora_report_${Date.now()}.html`);
      fs.writeFileSync(tmpHtml, htmlContent, 'utf-8');

      const printWin = new BrowserWindow({
        width: 1000, height: 1300,
        show: false,
        webPreferences: { nodeIntegration: false, contextIsolation: true },
      });

      // Load via file:// protocol for reliable rendering
      await printWin.loadFile(tmpHtml);
      // Wait for styles to fully render
      await new Promise(r => setTimeout(r, 1200));

      const pdfBuffer = await printWin.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
      });

      printWin.destroy();
      // Clean up temp file
      try { fs.unlinkSync(tmpHtml); } catch {}

      fs.writeFileSync(filePath, pdfBuffer);
      return { success: true, filePath };
    } catch (err) {
      console.error('[report:savePDF] Error:', err);
      return { success: false, reason: err.message };
    }
  });

  handle('session:save', async (event, session) => {
    try {
      const sessionId = session.session_id || Date.now();
      const jsonFile = path.join(sessionsDir, `session_${sessionId}.json`);
      fs.writeFileSync(jsonFile, JSON.stringify(session, null, 2), 'utf-8');
      return { success: true, jsonPath: jsonFile, session_id: sessionId };
    } catch (err) { return { success: false, error: err.message }; }
  });

  handle('session:list', async () => {
    try {
      if (!fs.existsSync(sessionsDir)) return [];
      const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.json'));
      const list = files.map(f => {
        try {
          const content = JSON.parse(fs.readFileSync(path.join(sessionsDir, f), 'utf-8'));
          return {
            session_id: content.session_id,
            recorded_at: content.recorded_at || content.keystrokes?.[0]?.datetime || fs.statSync(path.join(sessionsDir, f)).mtime,
            ai_result: content.ai_result,
            wpm: content.summary?.wpm || content.wpm || 'N/A',
            accuracy: content.summary?.accuracy || content.accuracy || '0',
            total_keystrokes: content.summary?.total_keystrokes || content.keystrokes?.length || 0,
          };
        } catch (e) { return null; }
      }).filter(Boolean);
      return list.sort((a,b) => new Date(b.recorded_at) - new Date(a.recorded_at));
    } catch (err) { return []; }
  });

  handle('session:load', async (event, { session_id }) => {
    try {
      const file = path.join(sessionsDir, `session_${session_id}.json`);
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch (err) { return null; }
  });

  handle('session:delete', async (event, { session_id }) => {
    try {
      const file = path.join(sessionsDir, `session_${session_id}.json`);
      if (fs.existsSync(file)) fs.unlinkSync(file);
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  });

  handle('session:openFolder', () => shell.openPath(sessionsDir));
}

app.whenReady().then(async () => {
  keyboardInfo = await detectKeyboard();
  registerHandlers();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
      if (backendProcess) backendProcess.kill();
      app.quit();
  }
});

app.on('before-quit', () => {
  if (captureService) captureService.stop();
  if (backendProcess) backendProcess.kill();
});
