# AquaGuard
Blender 外部崩溃守护工具
# AquaGuard
Blender 外部崩溃守护工具

> 基于 Electron 开发，独立于 Blender 运行，通过 TCP 心跳监控 Blender 状态，实现安全快照备份，防止工程文件损坏、丢失。

## ✨ 功能特点
- 🔁 **A/B/C 三轮快照轮换备份**，不会覆盖唯一备份
- ❤️ TCP 心跳机制，实时检测 Blender 是否存活
- ⛔ 异常熔断：Blender 卡死/崩溃时，立刻停止写入，避免文件损坏
- 📌 独立外部守护，不依赖 Blender 内置自动保存
- 🌏 内置简体中文 / 繁体中文 / 英文多语言支持
- 🖥️ Windows 桌面端，带可视化监控面板，状态一目了然

## 📦 安装
前往右侧 Releases 下载 `AquaGuard_Setup_xxx.exe` 安装包，双击安装。

## 📝 使用流程
1. 在 Blender 中安装配套插件，开启心跳服务
2. 启动 AquaGuard，填写匹配端口，建立连接
3. 设置备份目录、快照间隔
4. 正常建模，程序后台持续监护；一旦 Blender 崩溃，自动锁定当前备份，防止坏档

## 📜 开源协议
MIT License
