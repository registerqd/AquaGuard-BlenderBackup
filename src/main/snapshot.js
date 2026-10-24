'use strict';

const fs = require('fs');
const path = require('path');
const config = require('./config');

const SLOTS = ['A', 'B', 'C'];

function fileInfo(file) {
  try {
    const st = fs.statSync(file);
    return { exists: true, size: st.size, mtime: st.mtimeMs, path: file, name: path.basename(file) };
  } catch (e) {
    return { exists: false, size: 0, mtime: 0, path: file, name: path.basename(file) };
  }
}

/** 读取快照目录下 A/B/C 三个槽位的状态 */
function listSlots() {
  const { snapshotDir } = config.getEffectivePaths();
  const slots = SLOTS.map((s) => {
    const info = fileInfo(path.join(snapshotDir, `${s}.blend`));
    return Object.assign({ slot: s }, info);
  });
  const existing = slots.filter((s) => s.exists);
  const newest = existing.sort((a, b) => b.mtime - a.mtime)[0] || null;
  return { dir: snapshotDir, slots: slots, newest: newest };
}

/** 最新一份快照（A/B/C 里修改时间最新的） */
function newestSnapshot() {
  const { newest } = listSlots();
  return newest ? newest.path : '';
}

/** 恢复目录里的文件列表（61.blend、62.blend …） */
function listRecovered() {
  const { recoverDir } = config.getEffectivePaths();
  let files = [];
  try {
    if (fs.existsSync(recoverDir)) {
      files = fs
        .readdirSync(recoverDir)
        .filter((f) => /\.blend$/i.test(f))
        .map((f) => {
          const full = path.join(recoverDir, f);
          const info = fileInfo(full);
          return {
            name: f,
            path: full,
            size: info.size,
            mtime: info.mtime,
            index: Number((f.match(/^(\d+)/) || [0, 0])[1]) || 0
          };
        })
        .sort((a, b) => b.index - a.index);
    }
  } catch (e) {
    files = [];
  }
  return { dir: recoverDir, files: files };
}

module.exports = { SLOTS, listSlots, newestSnapshot, listRecovered, fileInfo };
