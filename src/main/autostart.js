'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { app } = require('electron');
const logger = require('./logger');

/**
 * 开机自启（跨平台）
 * - Windows / macOS：走 Electron 原生 setLoginItemSettings
 * - Linux：写入 ~/.config/autostart/*.desktop
 */

function linuxAutostartFile() {
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(base, 'autostart', 'aquaguard.desktop');
}

function isEnabled() {
  try {
    if (process.platform === 'linux') {
      return fs.existsSync(linuxAutostartFile());
    }
    const s = app.getLoginItemSettings({
      path: process.execPath,
      args: ['--hidden']
    });
    return !!s.openAtLogin;
  } catch (e) {
    return false;
  }
}

function enable() {
  try {
    if (process.platform === 'linux') {
      const file = linuxAutostartFile();
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const exec = app.isPackaged ? process.execPath : `"${process.execPath}" "${app.getAppPath()}"`;
      const content = [
        '[Desktop Entry]',
        'Type=Application',
        'Name=AquaGuard 青羽守护',
        'Comment=Blender 自动存档看门狗',
        `Exec=${exec} --hidden`,
        'X-GNOME-Autostart-enabled=true',
        'Terminal=false',
        ''
      ].join('\n');
      fs.writeFileSync(file, content, 'utf8');
    } else {
      app.setLoginItemSettings({
        openAtLogin: true,
        openAsHidden: true,
        path: process.execPath,
        args: ['--hidden']
      });
    }
    logger.success('已开启开机自启');
    return true;
  } catch (e) {
    logger.error('开启开机自启失败：' + e.message);
    return false;
  }
}

function disable() {
  try {
    if (process.platform === 'linux') {
      const file = linuxAutostartFile();
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } else {
      app.setLoginItemSettings({
        openAtLogin: false,
        path: process.execPath,
        args: ['--hidden']
      });
    }
    logger.info('已关闭开机自启');
    return true;
  } catch (e) {
    logger.error('关闭开机自启失败：' + e.message);
    return false;
  }
}

function set(flag) {
  return flag ? enable() : disable();
}

module.exports = { isEnabled, enable, disable, set };
