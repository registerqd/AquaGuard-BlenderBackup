'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { app } = require('electron');

/** 默认配置 */
const DEFAULTS = {
  // 通信
  port: 47831,
  bindHost: '127.0.0.1',
  // 节奏（秒）
  cfInterval: 60, // 看门狗下发 CF 指令的间隔
  snapshotEvery: 2, // 插件每收到 N 次 CF 才真正落盘一次（默认 2 → 每 2 分钟）
  heartbeatInterval: 10, // 插件上报心跳间隔（存活检查）
  missLimit: 2, // 连续丢失 N 次心跳即告警
  // 行为
  autoStart: false,
  autoRestartAsk: true, // 心跳丢失后弹窗询问是否重启 Blender
  startMinimized: false,
  keepLog: true,
  // 路径（留空则用默认）
  blenderPath: '',
  snapshotDir: '',
  recoverDir: ''
};

let cache = null;
let configPath = null;

function userDocuments() {
  try {
    return app.getPath('documents');
  } catch (e) {
    return path.join(os.homedir(), 'Documents');
  }
}

function defaultSnapshotDir() {
  return path.join(userDocuments(), 'AquaGuard备份');
}

function defaultRecoverDir() {
  return path.join(userDocuments(), 'AquaGuard备份');
}

function resolvePath() {
  if (!configPath) {
    configPath = path.join(app.getPath('userData'), 'config.json');
  }
  return configPath;
}

function load() {
  if (cache) return cache;
  const file = resolvePath();
  let stored = {};
  try {
    if (fs.existsSync(file)) {
      stored = JSON.parse(fs.readFileSync(file, 'utf8')) || {};
    }
  } catch (e) {
    stored = {};
  }
  cache = Object.assign({}, DEFAULTS, stored);
  return cache;
}

function save(patch) {
  const current = load();
  cache = Object.assign({}, current, patch || {});
  const file = resolvePath();
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(cache, null, 2), 'utf8');
  } catch (e) {
    /* 写入失败时保持内存配置可用 */
  }
  return cache;
}

function getEffectivePaths() {
  const cfg = load();
  return {
    snapshotDir: cfg.snapshotDir && cfg.snapshotDir.trim() ? cfg.snapshotDir : defaultSnapshotDir(),
    recoverDir: cfg.recoverDir && cfg.recoverDir.trim() ? cfg.recoverDir : defaultRecoverDir()
  };
}

module.exports = {
  DEFAULTS,
  load,
  save,
  resolvePath,
  defaultSnapshotDir,
  defaultRecoverDir,
  getEffectivePaths
};
