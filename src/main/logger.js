'use strict';

const fs = require('fs');
const path = require('path');

/**
 * 轻量日志器：内存环形缓冲（供界面实时展示）+ 追加写入日志文件。
 */
class Logger {
  constructor(maxLines = 500) {
    this.maxLines = maxLines;
    this.lines = [];
    this.filePath = null;
    this.listeners = [];
  }

  setFile(filePath) {
    this.filePath = filePath;
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
    } catch (e) {
      /* 目录创建失败不影响主流程 */
    }
  }

  onLine(fn) {
    this.listeners.push(fn);
  }

  _stamp() {
    const d = new Date();
    const p = (n, w = 2) => String(n).padStart(w, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  write(level, message) {
    const entry = {
      time: this._stamp(),
      ts: Date.now(),
      level: level,
      message: String(message)
    };
    this.lines.push(entry);
    if (this.lines.length > this.maxLines) {
      this.lines.splice(0, this.lines.length - this.maxLines);
    }
    this.listeners.forEach((fn) => {
      try {
        fn(entry);
      } catch (e) {
        /* 忽略监听器异常 */
      }
    });
    if (this.filePath) {
      const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${entry.message}\n`;
      fs.appendFile(this.filePath, line, () => {});
    }
    return entry;
  }

  info(msg) {
    return this.write('info', msg);
  }

  warn(msg) {
    return this.write('warn', msg);
  }

  error(msg) {
    return this.write('error', msg);
  }

  success(msg) {
    return this.write('success', msg);
  }

  recent(n = 200) {
    return this.lines.slice(-n);
  }

  clear() {
    this.lines = [];
  }
}

module.exports = new Logger();
