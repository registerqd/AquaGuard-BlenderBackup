# AquaGuard 青羽守护

> Blender 自动存档看门狗 —— 卡死、崩溃、断电都不再丢工程

一个青碧色玻璃拟态的桌面程序：在后台守着你的 Blender，定时让它写滚动快照、盯着心跳；
一旦 Blender 不再响应，弹窗问你要不要重启，并自动把最新快照另存为 `61.blend`、`62.blend`… 再打开。

---

## 一、它怎么工作

```
┌────────────────────────┐        TCP 127.0.0.1:47831        ┌──────────────────────┐
│   AquaGuard 看门狗      │ ─────── CF 存档指令（每 60 秒）──► │  Blender 插件         │
│   （Electron 桌面程序） │ ◄────── HB 心跳（每 60 秒）────── │  （.py 插件）         │
└────────────────────────┘                                   └──────────────────────┘
          │                                                             │
          │ 连续 2 次收不到心跳 → 弹窗询问重启                          │ 每收到 2 次 CF
          ▼                                                             ▼
   把最新快照另存为 61.blend、62.blend… → 结束卡死的 Blender → 用新进程打开    写入 C.blend
                                                                      原 C → B.blend
                                                                      原 B → A.blend
```

### 三个关键节奏

| 项目 | 默认值 | 说明 |
| --- | --- | --- |
| CF 存档指令 | 每 60 秒 | 看门狗告诉插件「该存档了」 |
| 实际落盘 | 每 2 分钟 | 插件每收到 2 次 CF 才真正写一次快照 |
| 心跳上报 | 每 10 秒 | 插件告诉看门狗「我还活着」（存活检查） |
| 断连判定 | 连续 2 次 | 约 20 秒没心跳 → 判定卡死并弹窗 |

### 快照轮转规则（最多 3 份）

```
新快照 → C.blend        原 C → B.blend        原 B → A.blend        原 A 被删除
```

任何时刻磁盘上最多 3 份快照，占用可控；恢复时自动挑**最新**的那一份。

### 恢复文件编号

重启恢复时，最新快照会被复制到「文档 / AquaGuard备份」，从 `61.blend` 开始递增
（61、62、63 …），然后用 Blender 打开，让你从断点继续。

---

## 二、安装与使用

### 1. 安装主程序

- **方式 A（安装包）**：双击 `AquaGuard-Setup-1.0.0.exe`，一路下一步。
  安装向导里建议勾选「开机自动启动」。
- **方式 B（绿色版）**：直接运行 `dist\win-unpacked\AquaGuard.exe`。

启动后窗口右上角会显示两个状态：**看门狗运行中** / **Blender 已连接**。

### 2. 安装 Blender 插件

1. 在程序里点「Blender 插件」页 → **导出插件文件**，得到 `aqua_guard_addon.py`。
2. Blender → `编辑` → `偏好设置` → `插件` → 右上角 `安装`，选中该文件。
3. 在插件列表里找到 **AquaGuard 青羽守护**，勾选启用。
4. 回到主程序，右上角「Blender 已连接」亮起即成功。

也可以直接点「一键安装到 Blender」，程序会自动把插件复制到 Blender 插件目录
（仍需在 Blender 里勾选启用）。

### 3. 插件面板

Blender 3D 视图里按 `N` → 侧边栏找到 **AquaGuard** 标签页：

- 查看连接状态、快照次数
- **立即存档**：不等下一轮 CF，马上写一份
- **暂停 / 继续**：暂停自动落盘（心跳照常上报）
- **重新连接**、**打开快照文件夹**

---

## 三、自己打包成 exe 安装包（最简单）

**双击 `一键打包.bat`，等它跑完就行。** 全程不用装任何东西：

1. 自动检测 Node.js，没有就自动下载免安装版（约 30MB）
2. 自动安装依赖（会下载 Electron，3-5 分钟）
3. 自动打包并生成安装包
4. 完成后自动弹出文件夹，里面就是 `AquaGuard-Setup-1.0.0.exe`

双击那个 exe 就能装到任何一台 Windows 电脑上（有桌面快捷方式、开始菜单、卸载项）。

> 需要联网。首次运行较慢（要下载约 250MB），之后再次打包会快很多。

### 想用 Inno Setup 打包（可选）

若你更习惯 Inno Setup：先跑一次 `一键打包.bat` 生成 `dist\win-unpacked`，
再用 Inno Setup 6 打开 `build\installer.iss` 点 Build 即可，产物同样是安装包 exe。

开发调试：

```bat
npm start
```

---

## 四、目录结构

```
AquaGuard/
├── package.json                 依赖与 electron-builder 配置
├── build_win.bat                Windows 一键打包
├── build/
│   ├── installer.iss            Inno Setup 打包脚本
│   ├── icon.ico / icon.png      应用图标
│   └── tray.png                 托盘图标
├── src/
│   ├── main/                    Electron 主进程
│   │   ├── main.js              窗口、托盘、IPC、重启恢复流程
│   │   ├── tcp-server.js        TCP 看门狗（CF 下发 / 心跳检测 / 告警）
│   │   ├── snapshot.js          A/B/C 快照与恢复文件读取
│   │   ├── blender.js           Blender 探测、结束进程、启动并打开文件
│   │   ├── autostart.js         开机自启（Win/mac/Linux）
│   │   ├── config.js            配置读写
│   │   ├── logger.js            运行日志
│   │   └── preload.js           安全桥接
│   └── renderer/                界面（左栏 + 顶栏，青碧玻璃拟态）
│       ├── index.html
│       ├── style.css
│       └── app.js
└── assets/addon/
    └── aqua_guard_addon.py      Blender 插件源码
```

---

## 五、数据与路径

| 内容 | 位置 |
| --- | --- |
| 滚动快照 A/B/C | `文档/AquaGuard备份/` |
| 恢复文件 61、62… | `文档/AquaGuard备份/` |
| 程序配置 | `%APPDATA%/AquaGuard/config.json` |
| 运行日志 | `%APPDATA%/AquaGuard/logs/aquaguard.log` |

插件端的快照目录可以在 Blender 插件偏好设置里改（留空即用上面的默认值）。

---

## 六、常见问题

**Q：插件装了但主程序显示未连接？**
检查端口是否一致（默认 47831），并确认主程序的「看门狗运行中」。改过端口后要在 Blender 里禁用再启用插件。

**Q：提示端口被占用？**
到「设置」换一个端口（如 47832），保存后在 Blender 插件偏好设置里改成同一个端口，重启插件。

**Q：恢复后没有自动打开 Blender？**
到「设置 → Blender 可执行文件」手动填写路径，例如
`C:\Program Files\Blender Foundation\Blender 4.2\blender.exe`。

**Q：会不会误杀我正在跑的渲染？**
只有你在弹窗里点「重启并恢复」，程序才会结束 Blender 进程；点「先不管」则什么都不做。

**Q：快照会不会很占磁盘？**
最多 3 份（A/B/C），总量约等于 3 倍工程文件大小，旧的自动覆盖。
