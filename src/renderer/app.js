'use strict';

/* ============================================================
   AquaGuard 渲染进程逻辑
   - 有 Electron 环境：通过 preload 暴露的 window.aqua 通信
   - 无 Electron 环境（直接双击 html）：自动进入界面预览模式
   ============================================================ */

const api = window.aqua || null;
const DEMO = !api;

const PAGE_TITLES = {
  overview: ['概览', 'Blender 自动存档看门狗'],
  snapshots: ['快照', '三份滚动快照与崩溃恢复文件'],
  addon: ['Blender 插件', '安装插件即可开始守护'],
  settings: ['设置', '通信、节奏与开机行为'],
  logs: ['运行日志', '实时事件记录'],
  about: ['关于', 'AquaGuard 青羽守护']
};

let state = null;
let logs = [];
let cfg = {};
let alarmShown = false;

/* ---------------- 工具 ---------------- */
const $ = (id) => document.getElementById(id);

function fmtBytes(n) {
  if (!n) return '—';
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}

function fmtTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function fmtAgo(ts) {
  if (!ts) return '—';
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s} 秒前`;
  if (s < 3600) return `${Math.floor(s / 60)} 分钟前`;
  return `${Math.floor(s / 3600)} 小时前`;
}

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2400);
}

/* ---------------- 页面切换 ---------------- */
document.querySelectorAll('.nav-item').forEach((item) => {
  item.addEventListener('click', () => {
    const page = item.dataset.page;
    document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));
    document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
    item.classList.add('active');
    const target = $('page-' + page);
    if (target) target.classList.add('active');
    const t = PAGE_TITLES[page] || ['', ''];
    $('topTitle').textContent = t[0];
    $('topHint').textContent = t[1];
    $('main') || document.querySelector('.main').scrollTo(0, 0);
  });
});

/* ---------------- 渲染 ---------------- */
function renderState(s) {
  if (!s) return;
  state = s;
  cfg = s.config || {};
  const srv = s.server || {};
  const app = s.app || {};

  // 顶栏状态
  const pillServer = $('pillServer');
  pillServer.classList.toggle('on', !!srv.running);
  pillServer.querySelector('span').textContent = srv.running ? `看门狗运行中 · ${srv.port}` : '看门狗未启动';

  const pillBlender = $('pillBlender');
  pillBlender.classList.toggle('on', !!srv.connected && !srv.alarm);
  pillBlender.classList.toggle('warn', !!srv.alarm);
  pillBlender.querySelector('span').textContent = srv.alarm
    ? 'Blender 无响应'
    : srv.connected
    ? 'Blender 已连接'
    : 'Blender 未连接';

  // 概览指标
  $('mServer').textContent = srv.running ? '运行中' : '已停止';
  $('mPort').textContent = `监听 ${cfg.bindHost || '127.0.0.1'}:${srv.port || cfg.port}`;

  $('mConn').textContent = srv.connected ? '已连接' : '未连接';
  $('mConnFoot').textContent = srv.connected
    ? `插件在线 · ${(srv.clientInfo && srv.clientInfo.blender) || 'Blender'}`
    : '等待 Blender 插件连接';

  const every = (cfg.snapshotEvery || 2) * (cfg.cfInterval || 60);
  $('mRhythm').textContent = every >= 60 ? `${Math.round(every / 60)} 分钟` : `${every} 秒`;
  $('mRhythmFoot').textContent = `每 ${cfg.cfInterval || 60} 秒下发 CF 指令`;

  const last = srv.lastSaved;
  $('mLastSnap').textContent = last ? `${last.slot}.blend` : '暂无快照';
  $('mLastSnapFoot').textContent = last ? `${fmtAgo(last.time)} · ${fmtBytes(last.size)}` : '等待首次存档';

  // 心跳环
  const silent = srv.silentSeconds || 0;
  const hb = cfg.heartbeatInterval || 60;
  const ratio = srv.connected ? Math.min(1, silent / (hb * (srv.missLimit || 2))) : 0;
  const C = 2 * Math.PI * 62;
  const bar = $('ringBar');
  bar.style.strokeDasharray = C;
  bar.style.strokeDashoffset = C * ratio;
  bar.style.stroke = srv.alarm ? '#ff6b81' : srv.connected ? 'url(#gradRing)' : 'rgba(93,133,141,0.5)';
  $('ringNum').textContent = srv.connected ? silent : '—';
  $('kvMiss').textContent = `${srv.missed || 0} / ${srv.missLimit || 2} 次`;
  $('kvCf').textContent = `已下发 ${srv.cfCount || 0} 次`;
  $('kvFile').textContent =
    srv.connected && srv.clientInfo && srv.clientInfo.file ? String(srv.clientInfo.file).split(/[\\/]/).pop() : '—';

  $('footState').textContent = srv.alarm ? '告警中' : srv.connected ? '守护中' : srv.running ? '待连接' : '已停止';
  $('btnToggleServer').textContent = srv.running ? '停止看门狗' : '启动看门狗';
  $('addonAddr').textContent = `127.0.0.1:${srv.port || cfg.port}`;
  $('aboutPlatform').textContent =
    app.platform === 'win32' ? 'Windows' : app.platform === 'darwin' ? 'macOS' : 'Linux';
  if (s.paths) $('aboutData').textContent = s.paths.snapshotDir;

  // 快照槽位
  renderSlots(s.snapshots);
  renderRecovered(s.recovered);

  // 设置项
  const swA = $('swAutostart');
  swA.classList.toggle('on', !!app.autoStart);
  $('inpPort').value = cfg.port || 47831;
  $('inpCf').value = cfg.cfInterval || 60;
  $('inpEvery').value = cfg.snapshotEvery || 2;
  $('inpHb').value = cfg.heartbeatInterval || 60;
  const inpBlender = $('inpBlender');
  if (inpBlender && document.activeElement !== inpBlender) {
    inpBlender.value = app.blenderPath || '';
  }
  $('swAskRestart').classList.toggle('on', cfg.autoRestartAsk !== false);

  // 告警弹窗
  if (srv.alarm && !alarmShown) showAlarm(srv);
}

function renderSlots(snap) {
  const list = (snap && snap.slots) || [];
  const newestPath = snap && snap.newest ? snap.newest.path : '';
  const html = list
    .map((s) => {
      const isNew = s.exists && s.path === newestPath;
      return `
      <div class="slot ${isNew ? 'is-newest' : ''}">
        <div class="slot-key">${s.slot}</div>
        <div class="slot-body">
          <div class="slot-name">${s.slot}.blend
            ${isNew ? '<span class="tag">最新</span>' : s.exists ? '<span class="tag">历史</span>' : '<span class="tag empty">空槽</span>'}
          </div>
          <div class="slot-meta">${s.exists ? `${fmtBytes(s.size)} · ${fmtTime(s.mtime)}` : '还没有写入'}</div>
        </div>
      </div>`;
    })
    .join('');
  $('overviewSlots').innerHTML = html;
  $('fullSlots').innerHTML = html;
  const count = list.filter((s) => s.exists).length;
  $('navSnapBadge').textContent = `${count}/3`;
}

function renderRecovered(rec) {
  const box = $('recList');
  const files = (rec && rec.files) || [];
  if (!files.length) {
    box.innerHTML = '<div class="empty-hint">还没有恢复文件<br/>当 Blender 卡死、你选择「重启并恢复」后，<br/>最新快照会以 61.blend 起编号保存在这里</div>';
    return;
  }
  box.innerHTML = files
    .map(
      (f) => `
      <div class="rec-item">
        <span class="rec-index">${f.index || '—'}</span>
        <span>${f.name}</span>
        <span class="rec-meta">${fmtBytes(f.size)} · ${fmtTime(f.mtime)}</span>
      </div>`
    )
    .join('');
}

/* ---------------- 日志 ---------------- */
function pushLog(entry) {
  logs.push(entry);
  if (logs.length > 400) logs.shift();
  const box = $('logBox');
  const div = document.createElement('div');
  div.className = 'log-line' + (entry.level === 'error' ? ' err' : '');
  div.innerHTML = `<span class="log-time">${entry.time}</span>
    <span class="log-level ${entry.level}">${entry.level}</span>
    <span class="log-msg"></span>`;
  div.querySelector('.log-msg').textContent = entry.message;
  box.appendChild(div);
  while (box.childElementCount > 400) box.removeChild(box.firstChild);
  box.scrollTop = box.scrollHeight;
}

/* ---------------- 告警 ---------------- */
function showAlarm(srv) {
  alarmShown = true;
  const isCrash = srv && srv.type === 'crash';
  const modal = $('alarmOverlay').querySelector('.modal');
  modal.querySelector('h3').textContent = isCrash ? 'Blender 已经退出（崩溃或强制结束）' : 'Blender 好像卡住了';
  modal.querySelector('p').innerHTML = isCrash
    ? 'Blender 进程已经不在了，而且它没有正常关闭 —— 可能是崩溃、被强制结束或者断电。'
    : `已经连续 <span class="hl">${(srv && srv.missed) || 2}</span> 次没有收到心跳，最后一次响应在
       <span class="hl">${(srv && srv.silentSeconds) || 0} 秒</span>前。这通常意味着 Blender 正在卡死。`;
  $('btnAlarmRestart').textContent = isCrash ? '恢复并打开' : '重启并恢复';
  $('alarmOverlay').dataset.mode = isCrash ? 'crash' : 'hang';
  $('alarmOverlay').classList.add('show');
}

$('btnAlarmIgnore').addEventListener('click', async () => {
  $('alarmOverlay').classList.remove('show');
  alarmShown = false;
  if (api) await api.dismissAlarm();
});

/* 开机恢复弹窗 */
$('btnStartupYes').addEventListener('click', async () => {
  $('startupOverlay').classList.remove('show');
  if (DEMO) return toast('预览模式：实际会打开最新快照');
  const r = await api.startupRecover(true);
  if (r && r.ok) toast('已打开恢复文件 ' + (r.recovered || '').split(/[\\/]/).pop());
  else toast('打开失败：' + ((r && r.error) || '未找到快照'));
});

$('btnStartupNo').addEventListener('click', async () => {
  $('startupOverlay').classList.remove('show');
  if (DEMO) return;
  await api.startupRecover(false);
  toast('已跳过，下次不再询问');
});

function showStartupRecover(data) {
  $('startupSnap').textContent = (data && data.name) || '暂无快照';
  $('startupOverlay').classList.add('show');
}

$('btnAlarmRestart').addEventListener('click', async () => {
  const mode = $('alarmOverlay').dataset.mode || 'hang';
  $('alarmOverlay').classList.remove('show');
  alarmShown = false;
  if (DEMO) {
    toast('预览模式：实际运行时会恢复快照并打开 Blender');
    return;
  }
  // 卡死：先结束卡住的进程；崩溃：进程已不在，直接恢复
  const r = await api.restartBlender({ kill: mode === 'hang' });
  if (r && r.ok) toast('已打开恢复文件 ' + (r.recovered || '').split(/[\\/]/).pop());
  else toast('恢复失败：' + ((r && r.error) || '未知原因'));
});

/* ---------------- 动作 ---------------- */
async function act(fn, okMsg) {
  if (DEMO) {
    toast('预览模式：实际运行时此处会执行对应操作');
    return null;
  }
  const r = await fn();
  if (okMsg && (!r || r.ok !== false)) toast(okMsg);
  if (r && r.ok === false && r.error) toast(r.error);
  return r;
}

$('btnForceSnap').addEventListener('click', () => act(() => api.forceSnapshot(), '已下发立即存档指令'));
$('btnForceSnap2').addEventListener('click', () => act(() => api.forceSnapshot(), '已下发立即存档指令'));
$('btnRefreshSnap').addEventListener('click', () => act(() => api.getState().then(renderState), '已刷新'));

$('btnToggleServer').addEventListener('click', async () => {
  if (DEMO) return toast('预览模式：实际运行时会启动/停止看门狗');
  const running = state && state.server && state.server.running;
  if (running) await api.stopServer();
  else await api.startServer();
  renderState(await api.getState());
});

const btnBackup = $('btnOpenBackupDir');
if (btnBackup) btnBackup.addEventListener('click', () => {
  if (DEMO) return toast('预览模式');
  api.openPath(state && state.paths ? state.paths.snapshotDir : '');
});

$('btnOpenSnapDir').addEventListener('click', () => {
  if (DEMO) return toast('预览模式');
  api.openPath(state && state.paths ? state.paths.snapshotDir : '');
});
$('btnOpenRecDir').addEventListener('click', () => {
  if (DEMO) return toast('预览模式');
  api.openPath(state && state.paths ? state.paths.recoverDir : '');
});
$('btnOpenLogFile').addEventListener('click', () => {
  if (DEMO) return toast('预览模式');
  api.openPath(state && state.app ? state.app.configPath : '');
});

$('btnExportAddon').addEventListener('click', () => act(() => api.exportAddon(), '插件已导出'));
$('btnInstallAddon').addEventListener('click', () => act(() => api.installAddon(), '插件已安装，请到 Blender 偏好设置里勾选启用'));
const btnDetectEl = $('btnDetect');
if (btnDetectEl) btnDetectEl.addEventListener('click', async () => {
  if (DEMO) return toast('预览模式');
  const r = await api.detectBlender();
  if (r && r.ok) toast('已找到 Blender');
  else toast('没找到，请手动填写路径');
  renderState(await api.getState());
});

$('swAutostart').addEventListener('click', async () => {
  if (DEMO) return toast('预览模式');
  const on = !$('swAutostart').classList.contains('on');
  $('swAutostart').classList.toggle('on', on);
  await api.setAutoStart(on);
  toast(on ? '已开启开机自启' : '已关闭开机自启');
  renderState(await api.getState());
});

$('swAskRestart').addEventListener('click', () => {
  $('swAskRestart').classList.toggle('on');
});

$('btnSaveCfg').addEventListener('click', async () => {
  if (DEMO) return toast('预览模式：设置不会真的保存');
  const patch = {
    port: Number($('inpPort').value) || 47831,
    cfInterval: Number($('inpCf').value) || 60,
    snapshotEvery: Number($('inpEvery').value) || 2,
    heartbeatInterval: Number($('inpHb').value) || 60,
    blenderPath: ($('inpBlender') ? $('inpBlender').value.trim() : (state && state.app ? state.app.blenderPath : '')),
    autoRestartAsk: $('swAskRestart').classList.contains('on')
  };
  await api.setConfig(patch);
  toast('设置已保存');
  renderState(await api.getState());
});

$('btnClearLog').addEventListener('click', () => {
  logs = [];
  $('logBox').innerHTML = '';
  if (api) api.getLog();
});

// 窗口按钮
$('btnMin').addEventListener('click', () => (api ? api.minimize() : toast('预览模式')));
$('btnMax').addEventListener('click', () => (api ? api.toggleMaximize() : toast('预览模式')));
$('btnClose').addEventListener('click', () => (api ? api.hideToTray() : toast('预览模式')));

/* ---------------- 启动 ---------------- */
async function boot() {
  if (DEMO) {
    $('demoFlag').classList.add('show');
    startDemo();
    return;
  }
  renderState(await api.getState());
  const history = await api.getLog();
  (history || []).forEach(pushLog);
  api.onState((s) => renderState(s));
  api.onLog((l) => pushLog(l));
  api.onAlarm((d) => showAlarm({ missed: d.missed, silentSeconds: d.silentSeconds }));
}

/* ---------------- 预览模式（无主程序时） ---------------- */
function startDemo() {
  const now = Date.now();
  const demoState = {
    app: { platform: 'win32', autoStart: true, blenderPath: 'C:\\Program Files\\Blender Foundation\\Blender 4.2\\blender.exe' },
    server: {
      running: true,
      port: 47831,
      connected: true,
      clientInfo: { blender: '4.2.0 LTS', file: 'D:\\项目\\角色动画_第3版.blend', scene: 'Scene' },
      lastHeartbeat: now - 12000,
      silentSeconds: 12,
      missed: 0,
      missLimit: 2,
      alarm: false,
      cfCount: 37,
      lastCfAt: now - 34000,
      lastSaved: { slot: 'C', size: 25800000, time: now - 68000 }
    },
    config: { port: 47831, bindHost: '127.0.0.1', cfInterval: 60, snapshotEvery: 2, heartbeatInterval: 60, missLimit: 2 },
    snapshots: {
      slots: [
        { slot: 'A', exists: true, size: 24600000, mtime: now - 248000 },
        { slot: 'B', exists: true, size: 25200000, mtime: now - 188000 },
        { slot: 'C', exists: true, size: 25800000, mtime: now - 68000 }
      ],
      newest: { path: 'C.blend' }
    },
    recovered: {
      files: [
        { name: '62.blend', index: 62, size: 24100000, mtime: now - 86400000 },
        { name: '61.blend', index: 61, size: 23700000, mtime: now - 172800000 }
      ]
    },
    paths: { snapshotDir: 'C:\\Users\\老师\\Documents\\AquaGuard快照', recoverDir: 'C:\\Users\\老师\\Documents\\AquaGuard恢复' }
  };
  renderState(demoState);

  [
    ['info', 'AquaGuard 青羽守护 v1.0.0 启动'],
    ['success', '看门狗已启动，监听 127.0.0.1:47831'],
    ['success', 'Blender 插件已连接'],
    ['info', '插件握手：Blender 4.2.0 LTS，当前文件 角色动画_第3版.blend'],
    ['info', '已下发存档指令 CF（第 37 次）'],
    ['success', '快照已保存到 C.blend（24.61 MB）']
  ].forEach((l, i) => {
    setTimeout(() => pushLog({ time: fmtTime(Date.now() - (6 - i) * 9000).slice(6), level: l[0], message: l[1] }), i * 260);
  });

  // 心跳环随时间走动
  let sec = 12;
  setInterval(() => {
    sec = (sec + 1) % 60;
    const C = 2 * Math.PI * 62;
    $('ringNum').textContent = sec;
    $('ringBar').style.strokeDashoffset = C * Math.min(1, sec / 120);
    demoState.server.silentSeconds = sec;
  }, 1000);
}

boot();
