'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFile } = require('child_process');
const config = require('./config');
const logger = require('./logger');

/** 在常见安装位置里找 Blender 可执行文件 */
function findBlender() {
  const cfg = config.load();
  if (cfg.blenderPath && fs.existsSync(cfg.blenderPath)) return cfg.blenderPath;

  const candidates = [];
  if (process.platform === 'win32') {
    const roots = [
      'C:\\Program Files\\Blender Foundation',
      'C:\\Program Files (x86)\\Blender Foundation',
      'D:\\Program Files\\Blender Foundation'
    ];
    roots.forEach((root) => {
      try {
        if (!fs.existsSync(root)) return;
        fs.readdirSync(root)
          .filter((d) => d.toLowerCase().startsWith('blender'))
          .sort()
          .reverse()
          .forEach((d) => candidates.push(path.join(root, d, 'blender.exe')));
      } catch (e) {
        /* 忽略无权限目录 */
      }
    });
    // Steam 版
    candidates.push('C:\\Program Files (x86)\\Steam\\steamapps\\common\\Blender\\blender.exe');
  } else if (process.platform === 'darwin') {
    candidates.push('/Applications/Blender.app/Contents/MacOS/Blender');
  } else {
    candidates.push('/usr/bin/blender', '/usr/local/bin/blender', '/snap/bin/blender', '/opt/blender/blender');
  }

  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return '';
}

/** 列出正在运行的 Blender 进程 PID */
function listBlenderPids() {
  return new Promise((resolve) => {
    const cmd = process.platform === 'win32' ? 'tasklist' : 'ps';
    const args =
      process.platform === 'win32' ? ['/FI', 'IMAGENAME eq blender.exe', '/FO', 'CSV', '/NH'] : ['-A', '-o', 'pid=,comm='];
    execFile(cmd, args, { timeout: 8000 }, (err, stdout) => {
      if (err || !stdout) return resolve([]);
      const pids = [];
      stdout.split(/\r?\n/).forEach((line) => {
        const t = line.trim();
        if (!t) return;
        if (process.platform === 'win32') {
          if (/blender\.exe/i.test(t)) {
            const m = t.match(/"([^"]+)","(\d+)"/);
            if (m) pids.push(Number(m[2]));
          }
        } else if (/blender/i.test(t) && !/grep/i.test(t)) {
          const m = t.match(/^(\d+)/);
          if (m) pids.push(Number(m[1]));
        }
      });
      resolve(pids);
    });
  });
}

/** 结束所有 Blender 进程（仅在用户确认重启后调用） */
async function killBlender() {
  const pids = await listBlenderPids();
  if (!pids.length) {
    logger.warn('没有检测到正在运行的 Blender 进程');
    return { ok: true, killed: 0 };
  }
  if (process.platform === 'win32') {
    await new Promise((resolve) => {
      execFile('taskkill', ['/IM', 'blender.exe', '/F'], { timeout: 10000 }, () => resolve());
    });
  } else {
    pids.forEach((pid) => {
      try {
        process.kill(pid, 'SIGTERM');
      } catch (e) {
        /* 进程可能已退出 */
      }
    });
  }
  logger.warn(`已结束 ${pids.length} 个 Blender 进程`);
  return { ok: true, killed: pids.length };
}

/** 用 Blender 打开指定文件 */
function openInBlender(filePath) {
  const exe = findBlender();
  if (!exe) {
    logger.error('未找到 Blender 可执行文件，请在「设置」里手动指定路径');
    return { ok: false, error: '未找到 Blender，请在设置里指定路径' };
  }
  try {
    const child = spawn(exe, [filePath], { detached: true, stdio: 'ignore' });
    child.unref();
    logger.success(`已用 Blender 打开：${path.basename(filePath)}`);
    return { ok: true, exe: exe };
  } catch (e) {
    logger.error('启动 Blender 失败：' + e.message);
    return { ok: false, error: e.message };
  }
}

/** 在恢复目录里取下一个编号（从 61 开始：61.blend、62.blend …） */
function nextRecoverFile(recoverDir) {
  fs.mkdirSync(recoverDir, { recursive: true });
  let n = 61;
  const used = new Set(
    fs
      .readdirSync(recoverDir)
      .map((f) => {
        const m = f.match(/^(\d+)\.blend$/i);
        return m ? Number(m[1]) : null;
      })
      .filter((v) => v !== null)
  );
  while (used.has(n)) n += 1;
  return path.join(recoverDir, `${n}.blend`);
}

/**
 * 把最新快照落到「文档/AquaGuard备份」里，编号递增（61、62 …）
 * 返回落盘后的文件路径
 */
function stageRecovery(snapshotFile) {
  if (!snapshotFile || !fs.existsSync(snapshotFile)) {
    return { ok: false, error: '没有可用的快照文件' };
  }
  const { recoverDir } = config.getEffectivePaths();
  const target = nextRecoverFile(recoverDir);
  fs.copyFileSync(snapshotFile, target);
  logger.success(`快照已保存为恢复文件：${path.basename(target)}`);
  return { ok: true, path: target, dir: recoverDir };
}

module.exports = {
  findBlender,
  listBlenderPids,
  killBlender,
  openInBlender,
  stageRecovery,
  nextRecoverFile
};
