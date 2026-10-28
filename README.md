# AquaGuard 青羽守护 — Blender Crash Recovery Watchdog

<p align="center">
  <img src="界面预览.png" alt="AquaGuard 界面预览" width="820" style="max-width: 100%; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);" />
</p>

<p align="center">
  <a href="#english"><img src="https://img.shields.io/badge/Language-English-16a3a8.svg" alt="English"></a>
  <a href="#中文说明"><img src="https://img.shields.io/badge/语言-简体中文-0f6d75.svg" alt="中文"></a>
  <img src="https://img.shields.io/badge/Version-v1.1.0-blue.svg" alt="Version 1.1.0">
  <img src="https://img.shields.io/badge/Blender-2.93%20--%204.x-orange.svg" alt="Blender Support">
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License MIT">
</p>

> **Never lose a Blender project to a crash, freeze, or sudden power outage again.**  
> 跑在 Blender **外部**的轻量看门狗程序：A/B/C 三槽轮转快照 + 独立线程 TCP 心跳 + PING 探针防误杀。

---

<a name="english"></a>
## English

### What is AquaGuard?

AquaGuard is a lightweight desktop watchdog that runs **completely outside of Blender**. It maintains rolling project snapshots and monitors a live heartbeat over a local TCP connection. When Blender freezes, crashes, or the machine suddenly loses power, your work is already safely written to disk.

### Built for My Dad

My dad sculpts figurines in Blender — complex models with tens of thousands of faces. Out-of-memory crashes and freezes used to happen regularly, meaning hours of sculpting were wiped out in an instant. So I built this watchdog for him.

Now, whenever Blender locks up, he simply terminates the hung process and restarts. The watchdog immediately detects the state, stages the latest snapshot, and reopens it. The fear of "when was my last save?" is completely gone.

### Proven by a Real 5-Hour Power Cut

During a 5-hour continuous modeling session, my computer suddenly lost power. Upon rebooting, AquaGuard launched with the system, detected the ungraceful shutdown flag, and prompted: *"Would you like to recover your project?"*

The entire scene was restored from the latest snapshot without a single byte lost. It asks exactly once, updates the state flag, and stays silent on future boots.

### How Reliable Is It?

> **Worst case: you lose the last 2 minutes — not the last 5 hours.**

The watchdog dispatches a snapshot command (`CF`) every 60 seconds. The add-on persists a snapshot every 2 commands (default: 2 minutes). Three snapshots (`A.blend`, `B.blend`, `C.blend`) rotate on disk, ensuring disk space remains bounded (~3× project size) while keeping 3 historical recovery points.

### Why Not Just Use Blender's Built-in Autosave or Add-ons?

When Blender crashes, **everything running inside the Blender process dies with it**.

| Feature | Blender AutoSave | Regular Add-on | AquaGuard Watchdog |
|---|---|---|---|
| **Process Isolation** | ❌ Dies with Blender | ❌ Dies with Blender | ✅ **External watchdog process** |
| **Sudden Power Outage** | ⚠️ Often corrupt or outdated | ❌ In-memory state lost | ✅ **Flagged on startup & 1-click recovery** |
| **Silent Freeze / Hang** | ❌ Cannot detect itself | ❌ Thread blocked | ✅ **Heartbeat timeout + PING probe** |
| **Recovery Workflow** | ⚠️ Hunt through `File -> Recover` | ⚠️ Manual file copying | ✅ **Native modal -> Auto-open `61.blend...`** |
| **History Retention** | Overwritten or temp wiped | Variable | ✅ **Guaranteed A/B/C rotation** |

### How It Works

```text
┌────────────────────────┐     TCP 127.0.0.1:47831      ┌────────────────────────┐
│   AquaGuard Watchdog   │ ─── Save Command (60s) ────► │     Blender Add-on     │
│  (Desktop Background)  │ ◄─── Heartbeat (10s) ─────── │  (Dedicated NetThread) │
└────────────────────────┘                              └────────────────────────┘
            │                                                        │
            │  Missed ≥ 2 Heartbeats                                 │ Every 2 Commands:
            │  -> Dispatches PING Probe                              ▼
            │  -> Still silent?                                 Persist C.blend
            ▼                                                   Rotate C -> B -> A
     Native Alert Dialog                                        (Max 3 snapshots)
            │
            ├─► Click [Recover Now]:
            │     Terminate hung Blender -> Copy latest snapshot to 61.blend -> Auto Open
            └─► Click [Ignore]:
                  Suppresses alarm and resets timer
```

### Installation

#### 1. Watchdog App (Windows)
- Download `AquaGuard_Setup_1.1.0.exe` (or unpack `AquaGuard_Setup_1.1.0.zip`).
- Follow the wizard. Enabling **Launch at startup** is recommended.

#### 2. Blender Add-on
1. Open AquaGuard, navigate to the **Blender Add-on** tab, and click **Export Add-on**.
2. In Blender: `Edit -> Preferences -> Add-ons -> Install...`, select `aqua_guard_addon.py` (or zip), and check the box to enable **AquaGuard**.
3. Press `N` in the 3D Viewport to find the **AquaGuard** sidebar panel.

---

<a name="中文说明"></a>
## 中文说明

### 核心亮点

- **独立进程守护**：Blender 就算崩成白屏、无响应或直接闪退，外部看门狗依然存活。
- **A / B / C 三槽轮转快照**：磁盘空间始终恒定（仅占 3 份工程体积），最老的一份自动淘汰，永远保留最新三档进度。
- **PING 探针防误杀**：Blender 在高负荷烘焙、重度渲染或存大文件时主线程易卡顿，看门狗在告警前主动发送 PING 探测，插件响应即解除，绝不误杀正在渲染的工程。
- **开机断电自愈**：断电关机前标记会话；下次开机自启弹窗询问是否打开断电前工程，确认后自动按 `61.blend`、`62.blend`… 递增另存，原工程零污染。
- **无缝打开**：无需配置 Blender 安装路径，直接调用系统关联默认程序启动恢复文件。

### 怎么使用

1. **运行主程序**：双击运行安装包安装并启动 AquaGuard，托盘常驻。
2. **安装插件**：在主程序「Blender 插件」页点击导出，在 Blender「偏好设置 → 插件」里安装并启用。
3. **日常工作**：像平时一样在 Blender 中建模、雕刻、渲染。3D 视图按 `N` 键可在侧边栏查看心跳与快照状态，也可随时手动点击「立即快照」。
4. **遇险恢复**：一旦遭遇崩溃或卡死，系统级原生弹窗自动置顶弹出，点击「立即恢复」即可一键拉起最新快照继续工作。

### 存储路径

| 文件类型 | 默认存放位置 |
|---|---|
| **轮转快照（A/B/C）** | `我的文档\AquaGuard备份\` |
| **灾后恢复文件（61/62...）** | `我的文档\AquaGuard备份\` |
| **程序配置文件** | `%APPDATA%\AquaGuard\config.json` |
| **运行日志** | `%APPDATA%\AquaGuard\logs\aquaguard.log` |

---

## 开发者自建（Build from Source）

本项目基于 Electron + Node.js 与 Python Blender API 开发，Windows 下支持一键全自动打包：

```bat
# 方式 A：一键无依赖打包（自动下载免安装 Node.js 与依赖）
双击运行 "一键打包.bat"

# 方式 B：常规开发运行
npm install
npm start

# 方式 C：构建安装包
npm run dist:win
```

## 开源协议

本项目采用 [MIT License](LICENSE) 开源。欢迎提交 PR 与 Issue！
