# AquaGuard — Blender Crash Recovery Watchdog

> **English (primary) / 中文（对照）** — Never lose a Blender project to a crash, freeze, or power cut again.

A glassmorphism desktop watchdog that guards Blender in the background: it keeps rolling snapshots of your project and monitors a live heartbeat. The moment Blender stops responding, it asks whether to restart — and automatically saves the latest snapshot as `61.blend`, `62.blend` … and reopens it.

一个青碧色玻璃拟态的桌面程序：在后台守着你的 Blender，定时写滚动快照、盯着心跳；一旦 Blender 不再响应，弹窗询问是否重启，并自动把最新快照另存为 `61.blend`、`62.blend`… 再打开。

---

## 1. How It Works / 工作原理

```
┌────────────────────────┐     TCP 127.0.0.1:47831      ┌──────────────────────┐
│   AquaGuard Watchdog   │ ─── CF save cmd (every 60s) ─► │  Blender Add-on      │
│   (Electron desktop)   │ ◄──── HB heartbeat (10s) ───── │  (.py add-on)        │
└────────────────────────┘                                └──────────────────────┘
          │                                                             │
          │  Silence ≥ limit → PING probe → still no reply              │ Every 2 CF cmds
          │  → alarm dialog asking to restart                           ▼
          ▼                                                        Write C.blend
   Copy latest snapshot → 61.blend, 62.blend…                      old C → B.blend
   → kill frozen Blender → reopen                                  old B → A.blend
```

**EN**: The watchdog sends a save command (`CF`) every 60 seconds. The add-on replies with a heartbeat every 10 seconds from a dedicated network thread — so heartbeats keep flowing even while Blender is busy rendering or saving. If heartbeats go missing, the watchdog sends a `PING` probe first and only raises an alarm when the probe also gets no reply. This means a busy (but alive) Blender never triggers a false alarm.

**中文**：看门狗每 60 秒下发一次存档指令（`CF`）；插件由独立网络线程每 10 秒上报一次心跳——即使 Blender 正在渲染或保存大快照，心跳也不会中断。心跳超限后看门狗会先发 `PING` 主动探测，探测也无回应才告警，因此「忙碌但活着」的 Blender 不会触发误报。

### Key Timings / 三个关键节奏

| Item 项目 | Default 默认值 | Description 说明 |
| --- | --- | --- |
| CF save command 存档指令 | every 60s 每 60 秒 | Watchdog tells the add-on to save 看门狗通知插件「该存档了」 |
| Actual snapshot 实际落盘 | every 2 min 每 2 分钟 | Add-on writes a snapshot every 2 CF commands 插件每收到 2 次 CF 才写一次快照 |
| Heartbeat 心跳 | every 10s 每 10 秒 | Add-on reports liveness (network thread, busy-safe) 插件上报存活（网络线程发送，忙时不断） |
| Silence limit 断连判定 | 5 misses (≈50s) + 6s PING probe 丢 5 次（约 50 秒）+ 6 秒探测 | Alarm fires only if PING also unanswered PING 也无回应才判定无响应并弹窗 |

### Snapshot Rotation (max 3 files) / 快照轮转（最多 3 份）

```
new snapshot → C.blend        old C → B.blend        old B → A.blend        old A deleted
```

**EN**: At most 3 snapshots exist on disk at any time (A/B/C), keeping disk usage predictable. Recovery always picks the newest one.

**中文**：磁盘上任何时刻最多 3 份快照（A/B/C），占用可控；恢复时自动挑选最新的一份。

### Recovery File Numbering / 恢复文件编号

**EN**: When recovery runs, the latest snapshot is copied to `Documents/AquaGuard备份` as numbered files starting from `61.blend` (61, 62, 63 …), then opened in Blender so you can continue from where you left off.

**中文**：恢复时，最新快照会复制到「文档 / AquaGuard备份」，从 `61.blend` 开始递增编号（61、62、63 …），再用 Blender 打开，从断点继续。

---

## 2. Installation & Usage / 安装与使用

### 2.1 Install the Main Program / 安装主程序

**EN**:
- **Option A (Installer)**: double-click `AquaGuard_Setup_1.0.2.exe` and follow the wizard. Enabling "launch at startup" is recommended.
- **Option B (Portable)**: run `AquaGuard.exe` directly.

Both status pills in the top-right corner — **Watchdog running** / **Blender connected** — should light up.

**中文**：
- **方式 A（安装包）**：双击 `AquaGuard_Setup_1.0.2.exe`，一路下一步。建议勾选「开机自动启动」。
- **方式 B（绿色版）**：直接运行 `AquaGuard.exe`。

启动后窗口右上角两个状态灯——**看门狗运行中 / Blender 已连接**——亮起即正常。

### 2.2 Install the Blender Add-on / 安装 Blender 插件

**EN**:
1. In the app, open the **Blender Add-on** page → **Export Add-on**. You get `Blender插件.zip` (the zip is bundled with the app, so it always matches the app version).
2. In Blender: `Edit` → `Preferences` → `Add-ons` → `Install from Disk…` and pick the zip.
3. Find **AquaGuard 青羽守护** in the add-on list and enable it.
4. Back in the app, the "Blender connected" pill lights up.

You can also click **One-click Install to Blender** — the app copies the add-on into Blender's add-on folder (you still need to enable it in Blender).

> **Note**: The add-on file is also shipped in the install folder as `Blender插件.zip`. If you installed an older version of the add-on, reinstall it from the new zip so both sides stay in sync — version mismatch is the #1 cause of false alarms.

**中文**：
1. 在程序里打开「Blender 插件」页 → **导出插件文件**，得到 `Blender插件.zip`（zip 内置于软件，始终与软件版本同步）。
2. Blender → `编辑` → `偏好设置` → `插件` → 右上角 `从磁盘安装`，选中该 zip。
3. 在插件列表里找到 **AquaGuard 青羽守护**，勾选启用。
4. 回到主程序，「Blender 已连接」亮起即成功。

也可以点「一键安装到 Blender」，程序会自动把插件复制到 Blender 插件目录（仍需在 Blender 里勾选启用）。

> **注意**：安装目录内也附有一份 `Blender插件.zip`。如果之前装过旧版插件，请用新 zip 重新安装一次，保证插件和软件版本一致——版本不同步是误报的头号原因。

### 2.3 The Add-on Panel / 插件面板

**EN**: In Blender's 3D view press `N` → sidebar → **AquaGuard** tab:

- Connection status & snapshot counter
- **Save Now**: write a snapshot immediately, without waiting for the next CF
- **Pause / Resume**: pause auto-snapshots (heartbeats continue)
- **Reconnect**, **Open Snapshot Folder**

**中文**：Blender 3D 视图按 `N` → 侧边栏 **AquaGuard** 标签页：

- 连接状态、快照次数
- **立即存档**：不等下一轮 CF，马上写一份
- **暂停 / 继续**：暂停自动落盘（心跳照常上报）
- **重新连接**、**打开快照文件夹**

---

## 3. Building the Installer Yourself / 自己打包安装包

**EN**: Double-click `一键打包.bat` and wait — no manual setup needed:

1. Detects Node.js; downloads a portable copy if missing (~30 MB)
2. Installs dependencies (downloads Electron, 3–5 min)
3. Builds the app and generates the installer
4. Opens the output folder with `AquaGuard_Setup_1.0.2.exe` inside

The installer runs on any Windows PC (desktop shortcut, Start-menu entry, uninstaller). Internet required; first run downloads ~250 MB.

**Alternative — Inno Setup**: run `一键打包.bat` once to produce `dist\win-unpacked`, then open `build\installer.iss` with Inno Setup 6 and click Build.

Dev mode: `npm start`

**中文**：双击 `一键打包.bat`，等它跑完即可，全程无需手动配置：

1. 自动检测 Node.js，没有就下载免安装版（约 30MB）
2. 自动安装依赖（下载 Electron，3–5 分钟）
3. 自动打包并生成安装包
4. 完成后弹出文件夹，里面就是 `AquaGuard_Setup_1.0.2.exe`

安装包可装到任何 Windows 电脑（含桌面快捷方式、开始菜单、卸载项）。需要联网，首次约下载 250MB。

**Inno Setup 方式（可选）**：先跑一次 `一键打包.bat` 生成 `dist\win-unpacked`，再用 Inno Setup 6 打开 `build\installer.iss` 点 Build。

开发调试：`npm start`

---

## 4. Project Structure / 目录结构

```
AquaGuard/
├── package.json                 deps & electron-builder config
├── build_win.bat                one-click Windows build
├── build/
│   ├── installer.iss            Inno Setup script
│   ├── icon.ico / icon.png      app icons
│   └── tray.png                 tray icon
├── src/
│   ├── main/                    Electron main process
│   │   ├── main.js              window, tray, IPC, restart & recovery flow
│   │   ├── tcp-server.js        TCP watchdog (CF dispatch / heartbeat check / alarm)
│   │   ├── snapshot.js          A/B/C snapshots & recovery files
│   │   ├── blender.js           detect Blender, kill process, reopen files
│   │   ├── autostart.js         launch at startup (Win/mac/Linux)
│   │   ├── config.js            config read/write
│   │   ├── logger.js            runtime log
│   │   └── preload.js           secure bridge
│   └── renderer/                UI (sidebar + topbar, teal glassmorphism)
│       ├── index.html
│       ├── style.css
│       └── app.js
└── assets/addon/
    └── aqua_guard_addon.py      Blender add-on source
```

**中文**：目录结构与上表一致——`src/main` 为 Electron 主进程（窗口、托盘、IPC、看门狗、快照、Blender 控制、自启、配置、日志），`src/renderer` 为青碧玻璃拟态界面，`assets/addon` 为 Blender 插件源码。

---

## 5. Data & Paths / 数据与路径

| Content 内容 | Location 位置 |
| --- | --- |
| Rolling snapshots A/B/C 滚动快照 | `Documents/AquaGuard备份/` |
| Recovery files 61, 62… 恢复文件 | `Documents/AquaGuard备份/` |
| App config 程序配置 | `%APPDATA%/AquaGuard/config.json` |
| Runtime log 运行日志 | `%APPDATA%/AquaGuard/logs/aquaguard.log` |

**EN**: The add-on's snapshot folder can be changed in the add-on preferences inside Blender (leave empty to use the defaults above).

**中文**：插件端的快照目录可在 Blender 插件偏好设置里修改（留空即用默认值）。

---

## 6. FAQ / 常见问题

**Q: Add-on installed but the app shows "not connected"?**
**A**: Check that both sides use the same port (default `47831`) and that the watchdog is running. If you changed the port, disable and re-enable the add-on in Blender.
**问：插件装了但主程序显示未连接？** 检查端口是否一致（默认 47831），确认「看门狗运行中」。改过端口后要在 Blender 里禁用再启用插件。

**Q: "Port already in use" error?**
**A**: Change the port in Settings (e.g. `47832`), then set the same port in the add-on preferences and restart the add-on.
**问：提示端口被占用？** 到「设置」换一个端口（如 47832），插件偏好设置里改成同一个，重启插件。

**Q: Recovery didn't reopen Blender automatically?**
**A**: Set the path manually in Settings → Blender executable, e.g. `C:\Program Files\Blender Foundation\Blender 4.2\blender.exe`.
**问：恢复后没有自动打开 Blender？** 到「设置 → Blender 可执行文件」手动填路径。

**Q: Will it kill my running render?**
**A**: Never automatically. Blender is only terminated after you click "Recover Now" in the alarm dialog; "Later" does nothing.
**问：会不会误杀正在跑的渲染？** 不会。只有你在弹窗里点「立即恢复」才会结束 Blender；点「暂不处理」什么都不做。

**Q: Do snapshots eat my disk?**
**A**: At most 3 copies (A/B/C) — roughly 3× the size of one project file. Oldest is overwritten automatically.
**问：快照会不会很占磁盘？** 最多 3 份（A/B/C），约等于 3 倍工程文件大小，旧的自动覆盖。

**Q: Why did it false-alarm before? / 为什么之前老是误报？**
**A**: Fixed in v1.0.1+. Causes were: an outdated add-on in the old zip (60s heartbeat vs 10s expected), heartbeats sent from Blender's busy main thread, and no probe before alarming. Now the add-on heartbeats from a network thread, and the watchdog PINGs before raising an alarm.
**答**：v1.0.1 起已修复。旧版原因是 zip 里插件过旧（60 秒心跳对不上 10 秒要求）、心跳走 Blender 忙碌的主线程、告警前没有探测。现在心跳走网络线程，告警前先 PING 探测。
