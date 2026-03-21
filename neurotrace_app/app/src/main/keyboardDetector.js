import { exec } from 'child_process';
import os from 'os';
import util from 'util';

const execAsync = util.promisify(exec);

export async function detectKeyboard() {
  const result = {
    polling_hz: 125,
    polling_interval_ms: 8,
    min_measurable_ht_ms: 8,
    detection_method: 'assumed',
    keyboard_name: 'Unknown',
    is_gaming_keyboard: false,
    quantisation_warning: true,
    confidence: 'Low'
  };

  try {
    const rawResult = await Promise.race([
      performDetection(),
      new Promise(resolve => setTimeout(() => resolve(null), 3000))
    ]);

    if (rawResult) {
      if (rawResult.polling_hz) result.polling_hz = rawResult.polling_hz;
      if (rawResult.detection_method) result.detection_method = rawResult.detection_method;
      if (rawResult.keyboard_name) result.keyboard_name = rawResult.keyboard_name;
      if (rawResult.confidence) result.confidence = rawResult.confidence;
    }
  } catch (err) {
    console.error('[KeyboardDetector] Error:', err.message);
  }

  // Snap to standard rates if detected
  const standardRates = [125, 250, 500, 1000, 2000, 8000];
  result.polling_hz = standardRates.reduce((prev, curr) => Math.abs(curr - result.polling_hz) < Math.abs(prev - result.polling_hz) ? curr : prev);

  if (result.polling_hz >= 500) {
    result.is_gaming_keyboard = true;
    result.quantisation_warning = false;
  } else if (result.polling_hz >= 250) {
    result.is_gaming_keyboard = false;
    result.quantisation_warning = false;
  } else {
    result.is_gaming_keyboard = false;
    result.quantisation_warning = true;
  }
  
  result.polling_interval_ms = parseFloat((1000 / result.polling_hz).toFixed(2));
  result.min_measurable_ht_ms = result.polling_interval_ms;

  return result;
}

async function performDetection() {
  const platform = os.platform();
  const res = { confidence: 'High' };

  try {
    if (platform === 'win32') {
      res.detection_method = 'hid';
      
      // Node-hid enumeration
      let HID;
      try {
        HID = (await import('node-hid')).default;
      } catch (e) {
        HID = require('node-hid');
      }
      
      const devices = HID.devices();
      const kbds = devices.filter(d => d.usagePage === 0x01 && d.usage === 0x06);
      if (kbds.length > 0) {
        res.keyboard_name = kbds[0].product || 'Generic USB Keyboard';
      }

      // WMI fallback
      const { stdout } = await execAsync('powershell -Command "Get-PnpDevice -Class Keyboard | Select-Object FriendlyName -ExpandProperty FriendlyName"');
      const lines = stdout.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length > 0 && !res.keyboard_name) {
        res.keyboard_name = lines[0];
      }
      
      const lName = (res.keyboard_name || '').toLowerCase();
      if (lName.includes('gaming') || lName.includes('rgb') || lName.includes('corsair') || lName.includes('razer') || lName.includes('logitech g')) {
        res.polling_hz = 1000;
        res.confidence = 'Medium';
      } else {
        res.polling_hz = 125;
        res.confidence = 'Low';
        res.detection_method = 'assumed';
      }
      return res;

    } else if (platform === 'darwin') {
      res.detection_method = 'ioreg';
      
      const { stdout } = await execAsync('ioreg -r -c IOHIDDevice -d 4');
      const lines = stdout.split('\n');
      let inKeyboard = false;
      for (const line of lines) {
        if (line.toLowerCase().includes('keyboard')) inKeyboard = true;
        if (inKeyboard && line.includes('"ReportInterval" =')) {
          const match = line.match(/"ReportInterval" = (\d+)/);
          if (match) {
            res.polling_hz = Math.round(1000000 / parseInt(match[1], 10));
            res.keyboard_name = 'Mac Keyboard';
            return res;
          }
        }
      }

      const { stdout: sp } = await execAsync('system_profiler SPUSBDataType -json');
      const data = JSON.parse(sp);
      let found = false;
      const search = (items) => {
        for (const item of items) {
          if ((item._name || '').toLowerCase().includes('keyboard')) {
            res.keyboard_name = item._name;
            if (item.polling_interval) {
              res.polling_hz = parseInt(item.polling_interval.replace('Hz', ''), 10);
              found = true;
            }
          }
          if (item._items && !found) search(item._items);
        }
      };
      if (data.SPUSBDataType) search(data.SPUSBDataType);
      if (found) return res;

    } else if (platform === 'linux') {
      res.detection_method = 'sysfs';
      const { stdout } = await execAsync('cat /proc/bus/input/devices');
      const blocks = stdout.split('\n\n');
      for (const block of blocks) {
        if (block.includes('Handlers=') && block.includes('kbd')) {
          const match = block.match(/Name="(.*?)"/);
          if (match) res.keyboard_name = match[1];
          const lName = (res.keyboard_name || '').toLowerCase();
          if (lName.includes('gaming')) res.polling_hz = 1000;
          else res.polling_hz = 125;
          res.confidence = 'Medium';
          return res;
        }
      }
    }
  } catch (err) {
    console.error('Detection error:', err.message);
  }
  return null;
}
