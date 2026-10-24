'use strict';

const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell, dialog, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');

const config = require('./config');
const logger = require('./logger');
const WatchdogServer = require('./tcp-server');
const snapshot = require('./snapshot');
const blender = require('./blender');
const autostart = require('./autostart');

const APP_NAME = 'AquaGuard 青羽守护';
const isHiddenStart = process.argv.includes('--hidden');

let win = null;
let tray = null;
let server = null;
let stateTimer = null;
let blenderTimer = null;
let isQuitting = false;

app.setAppUserModelId('com.aquaguard.watchdog');

/* ------------------------------------------------------------------ */
/* 意外关闭标记 IfDownload.AquaGuard                                   */
/*   true  = 上次 Blender 没正常收尾（关机 / 断电 / 强杀），开机后要问一次
/*   false = 已处理过或一切正常，不再弹窗
/* ------------------------------------------------------------------ */
const FLAG_NAME = 'IfDownload.AquaGuard';
let blenderRunning = false;
let lastBlenderRunning = false;
let crashAlarmSent = false;

function flagCandidates() {
  const list = [];
  if (app.isPackaged) list.push(path.join(path.dirname(process.execPath), FLAG_NAME));
  list.push(path.join(app.getAppPath(), FLAG_NAME));
  list.push(path.join(app.getPath('userData'), FLAG_NAME));
  return list;
}

function flagPath() {
  // 优先程序根目录；写不进去时用配置目录
  const list = flagCandidates();
  for (const p of list) {
    try {
      if (fs.existsSync(p)) return p;
    } catch (e) {
      /* 忽略 */
    }
  }
  return list[0];
}

function readFlag() {
  try {
    const p = flagPath();
    if (!fs.existsSync(p)) return false;
    const v = fs.readFileSync(p, 'utf8').trim().toLowerCase();
    return v === 'true';
  } catch (e) {
    return false;
  }
}

function writeFlag(value) {
  const text = value ? 'true' : 'false';
  for (const p of flagCandidates()) {
    try {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, text, 'utf8');
      logger.info(`恢复标记已写入 ${value ? 'true' : 'false'}（${p}）`);
      return p;
    } catch (e) {
      /* 换下一个位置 */
    }
  }
  logger.warn('恢复标记写入失败');
  return '';
}

/* 上次会话记录：判断这次启动是不是「意外关闭后重来」 */
function sessionFile() {
  return path.join(app.getPath('userData'), 'session.json');
}

function readSession() {
  try {
    const f = sessionFile();
    if (!fs.existsSync(f)) return null;
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch (e) {
    return null;
  }
}

function writeSession(obj) {
  try {
    fs.writeFileSync(sessionFile(), JSON.stringify(obj), 'utf8');
  } catch (e) {
    /* 忽略 */
  }
}

/* ------------------------------------------------------------------ */
/* 单实例                                                              */
/* ------------------------------------------------------------------ */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showWindow();
  });
}

/* ------------------------------------------------------------------ */
/* 窗口                                                                */
/* ------------------------------------------------------------------ */
function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 1000,
    minHeight: 660,
    frame: false,
    show: false,
    backgroundColor: '#071a20',
    title: APP_NAME,
    icon: path.join(__dirname, '../../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.loadFile(path.join(__dirname, '../renderer/index.html'));

  win.once('ready-to-show', () => {
    if (!isHiddenStart) win.show();
  });

  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });

  win.on('closed', () => {
    win = null;
  });
}

function showWindow() {
  if (!win) {
    createWindow();
    return;
  }
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

/* ------------------------------------------------------------------ */
/* 托盘                                                                */
/* ------------------------------------------------------------------ */
function createTray() {
  let img;
  const iconPath = path.join(__dirname, '../../assets/tray.png');
  try {
    img = nativeImage.createFromPath(iconPath);
    if (img.isEmpty()) img = nativeImage.createEmpty();
  } catch (e) {
    img = nativeImage.createEmpty();
  }
  tray = new Tray(img);
  tray.setToolTip(APP_NAME);
  updateTrayMenu();
  tray.on('click', () => showWindow());
}

function updateTrayMenu() {
  if (!tray) return;
  const st = server ? server.getState() : { running: false, connected: false };
  const menu = Menu.buildFromTemplate([
    { label: `${APP_NAME}`, enabled: false },
    { type: 'separator' },
    { label: st.running ? `监听中 · 端口 ${st.port}` : '看门狗未启动', enabled: false },
    { label: st.connected ? 'Blender 已连接' : 'Blender 未连接', enabled: false },
    { type: 'separator' },
    { label: '打开主界面', click: () => showWindow() },
    {
      label: '立即存档一次',
      enabled: st.connected,
      click: () => server && server.sendCf(true)
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(menu);
}

/* ------------------------------------------------------------------ */
/* 看门狗                                                              */
/* ------------------------------------------------------------------ */
function buildState() {
  const cfg = config.load();
  const slots = snapshot.listSlots();
  const recovered = snapshot.listRecovered();
  const blenderExe = blender.findBlender();
  const serverState = server ? server.getState() : { running: false, port: cfg.port, connected: false };

  return {
    app: {
      name: APP_NAME,
      version: app.getVersion(),
      platform: process.platform,
      autoStart: autostart.isEnabled(),
      configPath: config.resolvePath(),
      blenderPath: blenderExe,
      addonInstalled: false
    },
    server: serverState,
    config: cfg,
    snapshots: slots,
    recovered: recovered,
    paths: config.getEffectivePaths()
  };
}

function pushState() {
  if (win && !win.isDestroyed()) {
    win.webContents.send('state:update', buildState());
  }
  updateTrayMenu();
}

function startWatchdog() {
  const cfg = config.load();
  if (!server) {
    server = new WatchdogServer();
    server.on('state', () => pushState());
    server.on('alarm', (data) => handleAlarm(data));
  }
  server.configure({
    port: cfg.port,
    cfInterval: cfg.cfInterval,
    heartbeatInterval: cfg.heartbeatInterval,
    missLimit: cfg.missLimit
  });
  return server.start();
}

/* ------------------------------------------------------------------ */
/* Windows 原生弹窗（置顶到最前）                                       */
/* ------------------------------------------------------------------ */
async function nativeAlert(opts) {
  const wasTop = win && !win.isDestroyed() ? win.isAlwaysOnTop() : false;
  if (win && !win.isDestroyed()) {
    win.show();
    win.setAlwaysOnTop(true, 'screen-saver'); // 最高层级
    win.focus();
    win.flashFrame(true);
  }
  try {
    return await dialog.showMessageBox(win, Object.assign({ noLink: true, modal: true }, opts));
  } finally {
    if (win && !win.isDestroyed() && !wasTop) {
      win.setAlwaysOnTop(false);
      win.flashFrame(false);
    }
  }
}

async function handleAlarm(data) {
  // 只在 Blender 进程确实存在时才判定「卡死」；进程没了走崩溃判定
  if (!blenderRunning) return;
  logger.error('心跳告警：Blender 无响应');

  const res = await nativeAlert({
    type: 'error',
    title: 'AquaGuard 青羽守护 — 严重警告',
    message: 'Blender 已无响应，可能已卡死',
    detail:
      `已连续 ${data && data.missed ? data.missed : 2} 次未收到 Blender 心跳，` +
      `最后一次响应在 ${data && data.silentSeconds ? data.silentSeconds : 0} 秒前。\n\n` +
      '继续等待可能丢失未保存的工程。\n' +
      '点击「立即恢复」将：结束无响应的 Blender 进程 → 把最新快照复制为恢复文件 → 用系统默认程序重新打开。',
    buttons: ['立即恢复', '暂不处理'],
    defaultId: 0,
    cancelId: 1,
    icon: undefined
  });

  if (res.response === 0) {
    await restartAndRecover({ kill: true });
  } else {
    if (server) {
      server.alarm = false;
      server.missed = 0;
      server.lastHeartbeat = Date.now();
    }
    logger.warn('用户选择暂不处理');
  }
}

/* ------------------------------------------------------------------ */
/* Blender 进程监控：只有进程在跑才记录，进程消失要区分正常/异常         */
/* ------------------------------------------------------------------ */
async function pollBlender() {
  let running = false;
  try {
    const pids = await blender.listBlenderPids();
    running = pids.length > 0;
  } catch (e) {
    running = false;
  }

  const wasRunning = lastBlenderRunning;
  blenderRunning = running;
  lastBlenderRunning = running;

  // 运行期间持续记录「此刻 Blender 在跑」，供下次启动判断是否意外关闭
  writeSession({ clean: false, blenderRunning: running, at: Date.now() });

  if (wasRunning && !running) {
    const normal = server && server.normalExit;
    if (normal) {
      logger.info('Blender 已正常关闭，不触发告警');
      crashAlarmSent = false;
    } else if (server && (server.connected || server.receivedCount > 0)) {
      if (!crashAlarmSent) {
        crashAlarmSent = true;
        logger.error('Blender 进程异常消失（卡退 / 崩溃），准备恢复');
        const silent = Math.round((Date.now() - (server.lastHeartbeat || Date.now())) / 1000);
        nativeAlert({
          type: 'error',
          title: 'AquaGuard 青羽守护 — 严重警告',
          message: 'Blender 已异常退出（崩溃或被强制结束）',
          detail:
            `Blender 进程已消失，且没有正常关闭信号，最后一次心跳在 ${silent} 秒前。\n\n` +
            '这通常意味着崩溃、闪退或被任务管理器结束。\n' +
            '点击「立即恢复」将：把最新快照复制为恢复文件 → 用系统默认程序重新打开。',
          buttons: ['立即恢复', '暂不处理'],
          defaultId: 0,
          cancelId: 1
        }).then((res) => {
          if (res.response === 0) {
            restartAndRecover({ kill: false });
          } else {
            logger.warn('用户选择暂不处理');
          }
        });
      }
    }
  }

  if (running && !wasRunning) {
    crashAlarmSent = false;
    logger.success('检测到 Blender 已启动，开始守护');
  }

  pushState();
}

/* ------------------------------------------------------------------ */
/* 重启 Blender 并恢复快照                                             */
/* ------------------------------------------------------------------ */
async function restartAndRecover(options) {
  const opts = options || {};
  const newest = snapshot.newestSnapshot();
  if (!newest) {
    logger.error('没有找到任何快照，无法恢复。请确认插件已在 Blender 里正常保存过快照。');
    return { ok: false, error: '没有可用的快照文件' };
  }
  logger.info('开始重启 Blender 并恢复最新快照…');

  // 1. 先把快照落到恢复目录（61.blend、62.blend …）
  const staged = blender.stageRecovery(newest);
  if (!staged.ok) return staged;

  // 2. 结束卡死的 Blender
  if (opts.kill !== false) {
    await blender.killBlender();
    await new Promise((r) => setTimeout(r, 1200));
  }

  // 3. 用系统默认程序打开恢复文件（不需要 Blender 路径）
  let openErr = '';
  try {
    openErr = await shell.openPath(staged.path);
    if (!openErr) logger.success(`已用默认程序打开：${path.basename(staged.path)}`);
  } catch (e) {
    openErr = e.message;
  }
  const opened = { ok: !openErr, error: openErr || null };
  if (!opened.ok) logger.error('打开恢复文件失败：' + openErr);
  if (server) {
    server.alarm = false;
    server.missed = 0;
  }
  pushState();

  return {
    ok: opened.ok,
    recovered: staged.path,
    recoverDir: staged.dir,
    error: opened.error || null
  };
}

/* ------------------------------------------------------------------ */
/* IPC                                                                 */
/* ------------------------------------------------------------------ */
function registerIpc() {
  ipcMain.handle('state:get', () => buildState());

  ipcMain.handle('cfg:get', () => config.load());

  ipcMain.handle('cfg:set', (_e, patch) => {
    const next = config.save(patch || {});
    logger.info('设置已更新');
    if (server) {
      server.configure({
        port: next.port,
        cfInterval: next.cfInterval,
        heartbeatInterval: next.heartbeatInterval,
        missLimit: next.missLimit
      });
      // 端口变化时重启监听
      if (server.running && server.port !== next.port) {
        server.stop();
        server.port = next.port;
        server.start();
      }
    }
    pushState();
    return next;
  });

  ipcMain.handle('server:start', () => {
    const r = startWatchdog();
    pushState();
    return r;
  });

  ipcMain.handle('server:stop', () => {
    const r = server ? server.stop() : { ok: true };
    pushState();
    return r;
  });

  ipcMain.handle('action:snapshot', () => {
    if (!server || !server.connected) {
      return { ok: false, error: 'Blender 插件尚未连接' };
    }
    server.sendCf(true);
    return { ok: true };
  });

  ipcMain.handle('action:restart-blender', (_e, opts) => restartAndRecover(opts));

  /* 启动时询问「上次意外关闭，要不要打开恢复文件」 */
  ipcMain.handle('action:startup-recover', async (_e, yes) => {
    writeFlag(false); // 无论选是还是否，都置为 false，以后不再弹
    if (!yes) {
      logger.info('用户选择不打开上次的恢复文件');
      return { ok: true, skipped: true };
    }
    const r = await restartAndRecover({ kill: false });
    return r;
  });

  ipcMain.handle('action:dismiss-alarm', () => {
    if (server) {
      server.alarm = false;
      server.missed = 0;
      server.lastHeartbeat = Date.now();
    }
    pushState();
    return { ok: true };
  });

  ipcMain.handle('action:open-path', (_e, p) => {
    if (!p) return { ok: false };
    try {
      const target = fs.existsSync(p) && fs.statSync(p).isDirectory() ? p : path.dirname(p);
      shell.openPath(target);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('action:export-addon', async () => {
    const src = addonSourcePath();
    if (!src) return { ok: false, error: '插件源文件缺失' };
    const res = await dialog.showSaveDialog(win, {
      title: '导出 Blender 插件',
      defaultPath: path.join(app.getPath('downloads'), 'aqua_guard_addon.py'),
      filters: [{ name: 'Python', extensions: ['py'] }]
    });
    if (res.canceled || !res.filePath) return { ok: false, canceled: true };
    fs.copyFileSync(src, res.filePath);
    logger.success('插件已导出到：' + res.filePath);
    return { ok: true, path: res.filePath };
  });

  ipcMain.handle('action:install-addon', async () => {
    const src = addonSourcePath();
    if (!src) return { ok: false, error: '插件源文件缺失' };
    const dir = guessBlenderAddonDir();
    if (!dir) {
      return { ok: false, error: '没有自动找到 Blender 插件目录，请用「导出插件」后在 Blender 里手动安装' };
    }
    try {
      const target = path.join(dir, 'aqua_guard_addon.py');
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(src, target);
      logger.success('插件已复制到 Blender 插件目录：' + target);
      return { ok: true, path: target };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('action:detect-blender', () => {
    const p = blender.findBlender();
    if (p) logger.success('已找到 Blender：' + p);
    else logger.warn('没有找到 Blender，请手动指定路径');
    pushState();
    return { ok: !!p, path: p };
  });

  ipcMain.handle('action:autostart', (_e, flag) => {
    const ok = autostart.set(!!flag);
    config.save({ autoStart: !!flag });
    pushState();
    return { ok: ok };
  });

  ipcMain.handle('action:open-external', (_e, url) => {
    shell.openExternal(url);
    return { ok: true };
  });

  ipcMain.handle('action:copy', (_e, text) => {
    clipboard.writeText(String(text || ''));
    return { ok: true };
  });

  ipcMain.handle('log:get', () => logger.recent(300));

  ipcMain.handle('win:is-maximized', () => (win ? win.isMaximized() : false));
  ipcMain.on('win:minimize', () => win && win.minimize());
  ipcMain.on('win:hide', () => win && win.hide());
  ipcMain.on('win:close', () => win && win.hide());
  ipcMain.on('win:toggle-maximize', () => {
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
}

function addonSourcePath() {
  const candidates = [
    path.join(process.resourcesPath || '', 'addon', 'aqua_guard_addon.py'),
    path.join(__dirname, '../../assets/addon/aqua_guard_addon.py')
  ];
  for (const c of candidates) {
    try {
      if (c && fs.existsSync(c)) return c;
    } catch (e) {
      /* 忽略 */
    }
  }
  return '';
}

function guessBlenderAddonDir() {
  const exe = blender.findBlender();
  if (!exe) return '';
  // Windows: <Blender>/<version>/scripts/addons ；用版本号推断
  if (process.platform === 'win32') {
    const m = path.basename(path.dirname(exe)).match(/(\d+)\.(\d+)/);
    const ver = m ? `${m[1]}.${m[2]}` : '4.2';
    return path.join(path.dirname(exe), ver, 'scripts', 'addons');
  }
  if (process.platform === 'darwin') {
    return path.join(app.getPath('home'), 'Library/Application Support/Blender/scripts/addons');
  }
  return path.join(app.getPath('home'), '.config/blender/scripts/addons');
}

/* ------------------------------------------------------------------ */
/* 启动                                                                */
/* ------------------------------------------------------------------ */
app.whenReady().then(() => {
  logger.setFile(path.join(app.getPath('userData'), 'logs', 'aquaguard.log'));
  logger.info(`${APP_NAME} v${app.getVersion()} 启动`);

  registerIpc();
  createWindow();
  createTray();

  // 首次启动默认开启看门狗
  startWatchdog();

  stateTimer = setInterval(pushState, 1000);

  // 每 5 秒看一眼 Blender 进程：只有它在跑才守护，退出时区分正常 / 异常
  setTimeout(() => pollBlender(), 1200);
  blenderTimer = setInterval(() => pollBlender(), 5000);

  // 判断上次是不是意外关闭（关机 / 断电 / 强杀）
  const last = readSession();
  if (last && last.clean === false && last.blenderRunning === true) {
    logger.warn('检测到上次是意外关闭（Blender 当时仍在运行），已写入恢复标记');
    writeFlag(true);
  }

  // 标记为 true → 开窗后弹一次 Windows 原生对话框
  if (readFlag()) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        const snap = snapshot.newestSnapshot();
        const res = await nativeAlert({
          type: 'warning',
          title: 'AquaGuard 青羽守护 — 检测到上次异常退出',
          message: '上次关机或强制结束时，Blender 仍在运行',
          detail:
            '可能存在未保存的工程进度。\n' +
            (snap ? `已找到最新快照：${path.basename(snap)}\n\n` : '暂未找到可用快照。\n\n') +
            '点击「打开恢复文件」将把最新快照复制到备份目录，并用系统默认程序打开。\n' +
            '选择任一按钮后，本次提示不会再次出现。',
          buttons: ['打开恢复文件', '忽略'],
          defaultId: 0,
          cancelId: 1
        });
        writeFlag(false); // 无论选是还是否，都置为 false，以后不再弹
        if (res.response === 0) {
          if (snap) await restartAndRecover({ kill: false });
          else logger.warn('没有可用快照，无法恢复');
        } else {
          logger.info('用户选择忽略上次的恢复文件');
        }
      }, 900);
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else showWindow();
  });
});

app.on('window-all-closed', (e) => {
  // 常驻托盘，不退出
});

app.on('before-quit', () => {
  isQuitting = true;
  if (stateTimer) clearInterval(stateTimer);
  if (blenderTimer) clearInterval(blenderTimer);
  // 正常退出：记下「我是正常关的」，下次启动就不会误判成意外关闭
  writeSession({ clean: true, blenderRunning: blenderRunning, at: Date.now() });
  if (server) server.stop();
});

process.on('uncaughtException', (err) => {
  logger.error('主进程异常：' + (err && err.message ? err.message : String(err)));
});
