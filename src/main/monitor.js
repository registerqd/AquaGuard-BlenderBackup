'use strict';

/**
 * 运行时监控 + 崩溃现场记录
 * ------------------------------------------------------------
 * 两件事：
 *  1. 资源占用：常驻后台的软件，用户第一个问的就是「吃多少内存」。
 *     这里每秒采样 RSS / 堆 / CPU，供界面直接显示数字。
 *  2. 崩溃现场：环形缓冲记录最近 30 秒发生了什么（心跳、CF 指令、
 *     内存峰值、Blender 状态）。崩溃后能回答「它当时在干什么」。
 */

const fs = require('fs');
const path = require('path');

const RING_SIZE = 120; // 约 30 秒 × 4 条/秒 的事件量

class Monitor {
  constructor() {
    this.ring = [];
    this.lastCpu = process.cpuUsage();
    this.lastCpuAt = Date.now();
    this.cpuPercent = 0;
    this.mem = { rss: 0, heapUsed: 0, heapTotal: 0 };
    this.peakRss = 0;
    this.startedAt = Date.now();
    this.timer = null;
  }

  start(onTick) {
    if (this.timer) return;
    this.timer = setInterval(() => {
      const now = Date.now();
      const usage = process.cpuUsage(this.lastCpu);
      const elapsedUs = (now - this.lastCpuAt) * 1000;
      // CPU 占用按单核归一
      this.cpuPercent = elapsedUs > 0 ? +(((usage.user + usage.system) / elapsedUs) * 100).toFixed(1) : 0;
      this.lastCpu = process.cpuUsage();
      this.lastCpuAt = now;

      const m = process.memoryUsage();
      this.mem = {
        rss: m.rss,
        heapUsed: m.heapUsed,
        heapTotal: m.heapTotal
      };
      if (m.rss > this.peakRss) this.peakRss = m.rss;

      if (typeof onTick === 'function') onTick(this.snapshot());
    }, 1000);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  snapshot() {
    return {
      cpuPercent: this.cpuPercent,
      rssMB: +(this.mem.rss / 1048576).toFixed(1),
      heapMB: +(this.mem.heapUsed / 1048576).toFixed(1),
      peakRssMB: +(this.peakRss / 1048576).toFixed(1),
      uptimeSec: Math.floor((Date.now() - this.startedAt) / 1000)
    };
  }

  /** 记一条事件到环形缓冲 */
  event(type, detail) {
    this.ring.push({
      t: Date.now(),
      type: type,
      detail: detail === undefined ? '' : String(detail),
      rssMB: +(this.mem.rss / 1048576).toFixed(1),
      cpu: this.cpuPercent
    });
    if (this.ring.length > RING_SIZE) this.ring.shift();
  }

  recent(limit) {
    return this.ring.slice(-(limit || 40));
  }

  /** 崩溃时把现场快照写到磁盘 */
  dumpCrash(dir, extra) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const file = path.join(dir, `crash-${stamp}.json`);
      const payload = {
        at: new Date().toISOString(),
        platform: process.platform,
        arch: process.arch,
        versions: process.versions,
        resource: this.snapshot(),
        recentEvents: this.recent(RING_SIZE),
        extra: extra || {}
      };
      fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
      return file;
    } catch (e) {
      return '';
    }
  }

  /** 列出历史崩溃现场 */
  listCrashes(dir) {
    let files = [];
    try {
      if (fs.existsSync(dir)) files = fs.readdirSync(dir).filter((f) => /^crash-.*\.json$/.test(f));
    } catch (e) {
      files = [];
    }
    return files
      .map((f) => {
        const full = path.join(dir, f);
        let data = null;
        try {
          data = JSON.parse(fs.readFileSync(full, 'utf8'));
        } catch (e) {
          data = null;
        }
        return { name: f, path: full, at: data ? data.at : '', resource: data ? data.resource : null, events: data ? (data.recentEvents || []).length : 0 };
      })
      .sort((a, b) => (a.name < b.name ? 1 : -1));
  }
}

module.exports = { Monitor, RING_SIZE };
