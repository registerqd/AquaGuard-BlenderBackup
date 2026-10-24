'use strict';

const net = require('net');
const EventEmitter = require('events');
const logger = require('./logger');

/**
 * 看门狗 TCP 服务端
 *
 * 协议：一行一条消息
 *   看门狗 → 插件：CF            定时存档指令（默认每 60 秒一次）
 *                  CF!FORCE      立刻存档一次
 *                  PING          连通性探测
 *   插件 → 看门狗：{"type":"hello"|"hb"|"saved"|"bye", ...}  JSON 行
 *
 * 心跳：插件每 heartbeatInterval 秒发一次 hb；
 *       连续 missLimit 次未收到 → 触发 alarm 事件（询问是否重启 Blender）
 */
class WatchdogServer extends EventEmitter {
  constructor() {
    super();
    this.server = null;
    this.clients = new Set();
    this.port = 47831;
    this.host = '127.0.0.1';
    this.cfInterval = 60;
    this.heartbeatInterval = 10;
    this.missLimit = 2;

    this.connected = false;
    this.clientInfo = null;
    this.lastHeartbeat = 0;
    this.connectedAt = 0;
    this.missed = 0;
    this.alarm = false;
    this.lastSaved = null; // {slot, path, size, time}
    this.cfCount = 0;
    this.lastCfAt = 0;
    this.receivedCount = 0;
    this.normalExit = false; // 插件是否报告过「正常关闭」

    this._cfTimer = null;
    this._checkTimer = null;
  }

  configure(opts) {
    if (!opts) return;
    if (opts.port) this.port = opts.port;
    if (opts.cfInterval) this.cfInterval = opts.cfInterval;
    if (opts.heartbeatInterval) this.heartbeatInterval = opts.heartbeatInterval;
    if (opts.missLimit) this.missLimit = opts.missLimit;
  }

  start() {
    if (this.server) return { ok: true, already: true };
    this.server = net.createServer((socket) => this._onConnection(socket));

    this.server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`端口 ${this.port} 已被占用，请到设置里换一个端口`);
      } else {
        logger.error('TCP 服务异常：' + err.message);
      }
      this.emit('state');
    });

    this.server.listen(this.port, this.host, () => {
      logger.success(`看门狗已启动，监听 ${this.host}:${this.port}`);
      this._startTimers();
      this.emit('state');
    });

    return { ok: true };
  }

  stop() {
    this._stopTimers();
    this.clients.forEach((s) => {
      try {
        s.destroy();
      } catch (e) {
        /* 忽略 */
      }
    });
    this.clients.clear();
    if (this.server) {
      try {
        this.server.close();
      } catch (e) {
        /* 忽略 */
      }
      this.server = null;
    }
    this.connected = false;
    this.clientInfo = null;
    this.alarm = false;
    this.missed = 0;
    logger.info('看门狗已停止');
    this.emit('state');
    return { ok: true };
  }

  _startTimers() {
    this._stopTimers();
    this._cfTimer = setInterval(() => this.sendCf(), this.cfInterval * 1000);
    this._checkTimer = setInterval(() => this._checkHeartbeat(), 2000);
  }

  _stopTimers() {
    if (this._cfTimer) clearInterval(this._cfTimer);
    if (this._checkTimer) clearInterval(this._checkTimer);
    this._cfTimer = null;
    this._checkTimer = null;
  }

  /** 下发 CF 存档指令 */
  sendCf(force) {
    if (!this.clients.size) return false;
    const payload = force ? 'CF!FORCE\n' : 'CF\n';
    this.clients.forEach((s) => {
      try {
        s.write(payload);
      } catch (e) {
        /* 单个连接写失败忽略 */
      }
    });
    this.cfCount += 1;
    this.lastCfAt = Date.now();
    logger.info(force ? '已下发立即存档指令 CF!FORCE' : `已下发存档指令 CF（第 ${this.cfCount} 次）`);
    this.emit('state');
    return true;
  }

  _checkHeartbeat() {
    if (!this.connected) return;
    const base = this.lastHeartbeat || this.connectedAt;
    if (!base) return;
    const elapsed = Date.now() - base;
    const missed = Math.floor(elapsed / (this.heartbeatInterval * 1000));
    const changed = missed !== this.missed;
    this.missed = Math.max(0, missed);

    if (this.missed >= this.missLimit && !this.alarm) {
      this.alarm = true;
      logger.error(`连续 ${this.missed} 次未收到 Blender 心跳，疑似卡死或已崩溃`);
      this.emit('alarm', {
        missed: this.missed,
        silentSeconds: Math.round(elapsed / 1000),
        lastHeartbeat: this.lastHeartbeat,
        clientInfo: this.clientInfo
      });
    }
    if (changed) this.emit('state');
  }

  _onConnection(socket) {
    socket.setNoDelay(true);
    socket.setEncoding('utf8');
    this.clients.add(socket);
    this.connected = true;
    this.connectedAt = Date.now();
    this.lastHeartbeat = Date.now();
    this.missed = 0;
    this.alarm = false;
    this.normalExit = false;
    this.clientInfo = { address: socket.remoteAddress, since: Date.now() };
    logger.success('Blender 插件已连接');
    this.emit('state');

    let buffer = '';
    socket.on('data', (chunk) => {
      buffer += chunk;
      let idx = buffer.indexOf('\n');
      while (idx >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (line) this._onLine(line, socket);
        idx = buffer.indexOf('\n');
      }
      if (buffer.length > 64 * 1024) buffer = '';
    });

    socket.on('close', () => {
      this.clients.delete(socket);
      if (this.clients.size === 0) {
        this.connected = false;
        this.clientInfo = null;
        this.alarm = false;
        this.missed = 0;
        logger.warn('Blender 插件已断开');
        this.emit('state');
      }
    });

    socket.on('error', () => {
      /* 连接错误由 close 统一处理 */
    });
  }

  _onLine(line, socket) {
    if (line === 'PONG') {
      this.lastHeartbeat = Date.now();
      return;
    }
    let msg = null;
    try {
      msg = JSON.parse(line);
    } catch (e) {
      return;
    }
    if (!msg || typeof msg !== 'object') return;
    this.receivedCount += 1;

    if (msg.type === 'hello') {
      this.clientInfo = Object.assign({}, this.clientInfo, msg, { since: Date.now() });
      this.lastHeartbeat = Date.now();
      this.missed = 0;
      this.alarm = false;
      logger.info(`插件握手：Blender ${msg.blender || '未知版本'}${msg.file ? '，当前文件 ' + msg.file : ''}`);
      // 回执，让插件知道握手成功
      try {
        socket.write('WELCOME\n');
      } catch (e) {
        /* 忽略 */
      }
    } else if (msg.type === 'hb') {
      this.lastHeartbeat = Date.now();
      this.missed = 0;
      if (this.alarm) {
        this.alarm = false;
        logger.success('心跳已恢复，告警解除');
      }
      if (this.clientInfo) {
        this.clientInfo.file = msg.file || this.clientInfo.file;
        this.clientInfo.scene = msg.scene || this.clientInfo.scene;
        this.clientInfo.unsaved = !!msg.unsaved;
      }
    } else if (msg.type === 'saved') {
      this.lastSaved = {
        slot: msg.slot || 'C',
        path: msg.path || '',
        size: msg.size || 0,
        time: Date.now(),
        project: msg.project || ''
      };
      logger.success(`快照已保存到 ${this.lastSaved.slot}.blend（${(this.lastSaved.size / 1024 / 1024).toFixed(2)} MB）`);
    } else if (msg.type === 'bye') {
      this.normalExit = true;
      logger.info('插件报告 Blender 正常关闭（不触发告警）');
      this.emit('normal-exit');
    }
    this.emit('state');
  }

  getState() {
    const base = this.lastHeartbeat || this.connectedAt;
    return {
      running: !!this.server,
      port: this.port,
      connected: this.connected,
      clientInfo: this.clientInfo,
      lastHeartbeat: this.lastHeartbeat,
      silentSeconds: base ? Math.round((Date.now() - base) / 1000) : 0,
      missed: this.missed,
      missLimit: this.missLimit,
      alarm: this.alarm,
      normalExit: this.normalExit,
      cfCount: this.cfCount,
      lastCfAt: this.lastCfAt,
      cfInterval: this.cfInterval,
      heartbeatInterval: this.heartbeatInterval,
      lastSaved: this.lastSaved
    };
  }
}

module.exports = WatchdogServer;
