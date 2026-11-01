'use strict';

/**
 * 多工程守护
 * ------------------------------------------------------------
 * 老版本一次只能盯一个 .blend：插件连上来就覆盖全局状态，
 * 同时开三个工程的人第二个就失效了。
 *
 * 现在每个工程按「文件绝对路径」生成稳定 ID，各自持有独立的
 * 快照链（时间轴）与增量块仓库，互不干扰。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');

function projectId(blendPath) {
  const norm = path.resolve(blendPath).toLowerCase();
  return crypto.createHash('sha1').update(norm).digest('hex').slice(0, 12);
}

function baseDir() {
  const { snapshotDir } = config.getEffectivePaths();
  return path.join(snapshotDir, 'projects');
}

function projectDir(blendPath) {
  return path.join(baseDir(), projectId(blendPath));
}

function manifestDir(blendPath) {
  return path.join(projectDir(blendPath), 'manifests');
}

function chunkDir(blendPath) {
  return path.join(projectDir(blendPath), 'chunks');
}

/** 读取某个工程的全部快照清单，按时间倒序 */
function listManifests(blendPath) {
  const dir = manifestDir(blendPath);
  let files = [];
  try {
    if (fs.existsSync(dir)) files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch (e) {
    files = [];
  }
  return files
    .map((f) => {
      try {
        const m = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        m._manifestFile = f;
        return m;
      } catch (e) {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/** 写入一份新清单 */
function saveManifest(blendPath, manifest) {
  const dir = manifestDir(blendPath);
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date(manifest.createdAt || Date.now()).toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2), 'utf8');
  return file;
}

/** 只保留最近 N 份清单（默认 20 份时间轴），旧的连同块一起回收 */
function pruneManifests(blendPath, keep) {
  const limit = keep || 20;
  const all = listManifests(blendPath);
  const drop = all.slice(limit);
  drop.forEach((m) => {
    try {
      fs.unlinkSync(path.join(manifestDir(blendPath), m._manifestFile));
    } catch (e) {
      /* ignore */
    }
  });
  return { kept: Math.min(all.length, limit), dropped: drop.length };
}

/** 列出所有被守护过的工程 */
function listProjects() {
  const root = baseDir();
  let dirs = [];
  try {
    if (fs.existsSync(root)) dirs = fs.readdirSync(root).filter((d) => fs.statSync(path.join(root, d)).isDirectory());
  } catch (e) {
    dirs = [];
  }
  return dirs
    .map((d) => {
      const infoFile = path.join(root, d, 'project.json');
      let info = {};
      try {
        info = JSON.parse(fs.readFileSync(infoFile, 'utf8'));
      } catch (e) {
        info = {};
      }
      const ms = listManifests(info.blendPath || '');
      return {
        id: d,
        name: info.name || d,
        blendPath: info.blendPath || '',
        lastSeen: info.lastSeen || 0,
        snapshots: ms.length,
        latestAt: ms[0] ? ms[0].createdAt : 0
      };
    })
    .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
}

/** 登记 / 更新工程元信息 */
function touchProject(blendPath) {
  const dir = projectDir(blendPath);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'project.json');
  let info = {};
  try {
    if (fs.existsSync(file)) info = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    info = {};
  }
  info = Object.assign(info, {
    id: projectId(blendPath),
    name: path.basename(blendPath),
    blendPath: path.resolve(blendPath),
    lastSeen: Date.now()
  });
  fs.writeFileSync(file, JSON.stringify(info, null, 2), 'utf8');
  return info;
}

module.exports = {
  projectId,
  projectDir,
  manifestDir,
  chunkDir,
  listManifests,
  saveManifest,
  pruneManifests,
  listProjects,
  touchProject,
  baseDir
};
