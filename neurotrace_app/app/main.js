import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { KeystrokeCaptureService } from './src/main/keystroke-capture.js';
import { detectKeyboard } from './src/main/keyboardDetector.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow = null;
let captureService = null;
let backendProcess = null;
let keyboardInfo = null;

const userDataPath = app.getPath('userData');
const sessionsDir = path.join(userDataPath, 'sessions');

/**
 * Integrated Backend Startup
 */
function startBackend() {
    const backendRoot = path.join(__dirname, '..', 'backend');
    const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
    
    backendProcess = spawn(pythonPath, ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8421'], {
        cwd: backendRoot
    });

    backendProcess.stdout.on('data', (data) => console.log(`[Core] ${data}`));
    backendProcess.on('close', (code) => console.log(`[Core] Backend exited with code ${code}`));
}

function createWindow() {
  const isDev = process.env.NODE_ENV === 'development';
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false, 
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'NeuroTrace | Motor Assessment',
    backgroundColor: '#ffffff'
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.once('ready-to-show', () => mainWindow.show());
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
  handle('keyboard:getInfo', () => keyboardInfo);

  handle('session:save', async (event, session) => {
    try {
      const sessionId = session.session_id || Date.now();
      const jsonFile = path.join(sessionsDir, `session_${sessionId}.json`);
      fs.writeFileSync(jsonFile, JSON.stringify(session, null, 2), 'utf-8');
      return { success: true, jsonPath: jsonFile, session_id: sessionId };
    } catch (err) { return { success: false, error: err.message }; }
  });
}

app.whenReady().then(async () => {
  keyboardInfo = await detectKeyboard();
  startBackend();
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
