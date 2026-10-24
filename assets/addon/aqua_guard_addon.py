# -*- coding: utf-8 -*-
"""
AquaGuard 青羽守护 — Blender 端插件
=====================================

作用：
  1. 主动连接 AquaGuard 看门狗（TCP 127.0.0.1:47831）
  2. 每 10 秒上报一次心跳（HB），让看门狗知道 Blender 还活着
  3. 收到看门狗的 CF 存档指令后，按节奏把当前工程写成三份滚动快照：
        新快照 → C.blend
        原 C   → B.blend
        原 B   → A.blend
     （每收到 N 次 CF 才落盘一次，默认 N=2，即每 2 分钟一份）

安装：
  Blender → 编辑 → 偏好设置 → 插件 → 安装 → 选中本文件 → 勾选启用
"""

bl_info = {
    "name": "AquaGuard 青羽守护",
    "author": "AquaGuard Studio",
    "version": (1, 0, 1),
    "blender": (2, 93, 0),
    "location": "3D 视图 → 侧边栏(N) → AquaGuard",
    "description": "定时滚动快照 + 心跳上报，配合 AquaGuard 看门狗防止 Blender 崩溃丢文件",
    "category": "System",
}

import os
import json
import time
import socket
import shutil
import threading
import traceback

import bpy
from bpy.props import StringProperty, IntProperty, BoolProperty

# ----------------------------------------------------------------------
# 默认值
# ----------------------------------------------------------------------
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 47831
DEFAULT_HEARTBEAT = 10      # 秒（存活检查间隔）
DEFAULT_CF_EVERY = 2        # 每收到 N 次 CF 落盘一次
RECONNECT_DELAY = 5         # 断线重连间隔（秒）

PREF_KEY = "aquaguard"

# ----------------------------------------------------------------------
# 主控客户端
# ----------------------------------------------------------------------
class AquaGuardClient:
    """负责 socket 通信与快照轮转。bpy 操作一律回到主线程执行。"""

    def __init__(self):
        self.sock = None
        self.connected = False
        self.running = False
        self.paused = False

        self.host = DEFAULT_HOST
        self.port = DEFAULT_PORT
        self.heartbeat_interval = DEFAULT_HEARTBEAT
        self.cf_every = DEFAULT_CF_EVERY

        self.cf_count = 0          # 累计收到的 CF 次数
        self.snapshot_count = 0    # 累计落盘次数
        self.last_error = ""
        self.last_saved = ""
        self.last_saved_time = 0.0
        self.last_heartbeat = 0.0

        self._send_lock = threading.Lock()
        self._thread = None
        self._hb_thread = None
        self._hb_stop = threading.Event()
        self._scene_lock = threading.Lock()
        self._scene_cache = {"file": "", "scene": "", "unsaved": False}
        self._pending_save = 0     # 待主线程处理的落盘请求数
        self._force_save = False

    # ---------------- 路径 ----------------
    def snapshot_dir(self):
        prefs = bpy.context.preferences.addons.get(__name__)
        custom = ""
        if prefs and prefs.preferences:
            custom = getattr(prefs.preferences, "snapshot_dir", "")
        if custom and custom.strip():
            base = bpy.path.abspath(custom.strip())
        else:
            # 默认放在用户文档目录下
            home = os.path.expanduser("~")
            docs = os.path.join(home, "Documents")
            if not os.path.isdir(docs):
                docs = home
            base = os.path.join(docs, "AquaGuard备份")
        try:
            os.makedirs(base, exist_ok=True)
        except Exception as e:
            self.last_error = "创建快照目录失败: %s" % e
        return base

    # ---------------- 连接 ----------------
    def start(self):
        if self.running:
            return
        self.running = True
        self._thread = threading.Thread(target=self._loop, name="AquaGuardClient", daemon=True)
        self._thread.start()

    def stop(self):
        self.running = False
        self._stop_heartbeat()
        self._close()
        self._thread = None

    def _close(self):
        self.connected = False
        if self.sock:
            try:
                self.sock.close()
            except Exception:
                pass
            self.sock = None

    def _loop(self):
        while self.running:
            if self.sock is None:
                self._connect()
            if self.sock is None:
                time.sleep(RECONNECT_DELAY)
                continue
            try:
                self._recv_loop()
            except Exception as e:
                self.last_error = "接收异常: %s" % e
            self._close()
            if self.running:
                time.sleep(RECONNECT_DELAY)

    def _connect(self):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(6.0)
            s.connect((self.host, self.port))
            s.settimeout(None)
            s.setblocking(True)
            self.sock = s
            self.connected = True
            self.last_error = ""
            self._send_json({
                "type": "hello",
                "blender": bpy.app.version_string,
                "file": bpy.data.filepath or "(未保存)",
                "platform": os.name,
                "plugin": "1.0.0",
            })
            self._start_heartbeat()
        except Exception as e:
            self.last_error = "连接看门狗失败: %s" % e
            self.connected = False
            self.sock = None

    # ---------------- 发送 ----------------
    def _send_raw(self, text):
        if not self.sock:
            return False
        try:
            with self._send_lock:
                self.sock.sendall(text.encode("utf-8"))
            return True
        except Exception as e:
            self.last_error = "发送失败: %s" % e
            self._close()
            return False

    def _send_json(self, obj):
        return self._send_raw(json.dumps(obj, ensure_ascii=False) + "\n")

    def send_heartbeat(self):
        """心跳：只读主线程缓存下来的字符串，不在子线程里碰任何 bpy 接口"""
        if not self.connected:
            return
        with self._scene_lock:
            info = dict(self._scene_cache)
        self._send_json({
            "type": "hb",
            "file": info.get("file") or "(未保存)",
            "scene": info.get("scene") or "",
            "unsaved": bool(info.get("unsaved")),
            "time": time.time(),
            "plugin": "1.0.1",
        })
        self.last_heartbeat = time.time()

    def update_scene_cache(self):
        """主线程调用：把 bpy 状态缓存成纯字符串，供心跳线程安全读取"""
        try:
            info = {
                "file": bpy.data.filepath or "",
                "scene": bpy.context.scene.name if bpy.context.scene else "",
                "unsaved": bool(bpy.data.is_dirty),
            }
            with self._scene_lock:
                self._scene_cache = info
        except Exception:
            pass

    def _start_heartbeat(self):
        """独立线程发心跳：不依赖 Blender 主线程，渲染/保存大文件时也不会断"""
        if self._hb_thread and self._hb_thread.is_alive():
            return
        self._hb_stop.clear()
        self._hb_thread = threading.Thread(target=self._hb_loop, name="AquaGuardHB", daemon=True)
        self._hb_thread.start()

    def _hb_loop(self):
        while not self._hb_stop.is_set():
            if self.connected:
                try:
                    self.send_heartbeat()
                except Exception:
                    pass
            self._hb_stop.wait(max(2.0, float(self.heartbeat_interval)))

    def _stop_heartbeat(self):
        self._hb_stop.set()
        self._hb_thread = None

    # ---------------- 接收 ----------------
    def _recv_loop(self):
        buf = ""
        while self.running and self.sock:
            try:
                chunk = self.sock.recv(4096)
            except Exception as e:
                self.last_error = "连接中断: %s" % e
                return
            if not chunk:
                return
            try:
                buf += chunk.decode("utf-8", "ignore")
            except Exception:
                continue
            while "\n" in buf:
                line, buf = buf.split("\n", 1)
                line = line.strip()
                if line:
                    self._handle_command(line)

    def _handle_command(self, line):
        if line == "CF":
            self.cf_count += 1
            if not self.paused and self.cf_count % max(1, self.cf_every) == 0:
                self._pending_save += 1
        elif line == "CF!FORCE":
            self.cf_count += 1
            if not self.paused:
                self._force_save = True
        elif line == "PING":
            self._send_raw("PONG\n")
        elif line == "WELCOME":
            pass

    # ---------------- 主线程定时器：执行落盘 ----------------
    def tick(self):
        """由 bpy.app.timers 每 1 秒调用，所有 bpy 操作都在这里做。"""
        try:
            self.update_scene_cache()
            do_save = False
            if self._force_save:
                self._force_save = False
                do_save = True
            elif self._pending_save > 0:
                self._pending_save -= 1
                do_save = True

            if do_save and not self.paused:
                self.rotate_save()

            # 把状态同步到面板
            try:
                wm = bpy.context.window_manager
                if wm and hasattr(wm, "aquaguard_connected"):
                    wm.aquaguard_connected = self.connected
                    wm.aquaguard_status = self.status_text()
            except Exception:
                pass
        except Exception:
            self.last_error = traceback.format_exc(limit=1)

        if not self.running:
            return None
        return 1.0

    # ---------------- 快照轮转 ----------------
    def rotate_save(self):
        """C→B、B→A，新快照写入 C。最多保留 3 份。"""
        folder = self.snapshot_dir()
        if not folder:
            return False
        path_a = os.path.join(folder, "A.blend")
        path_b = os.path.join(folder, "B.blend")
        path_c = os.path.join(folder, "C.blend")

        try:
            # 1. C → B（先删旧 B）
            if os.path.exists(path_c):
                if os.path.exists(path_b):
                    os.remove(path_b)
                shutil.move(path_c, path_b)
            # 2. B → A（先删旧 A）
            if os.path.exists(path_b):
                if os.path.exists(path_a):
                    os.remove(path_a)
                shutil.move(path_b, path_a)
            # 3. 写入新的 C
            bpy.ops.wm.save_as_mainfile(filepath=path_c, copy=True, check_existing=False)
            self.snapshot_count += 1
            self.last_saved = path_c
            self.last_saved_time = time.time()
            size = os.path.getsize(path_c) if os.path.exists(path_c) else 0
            self._send_json({
                "type": "saved",
                "slot": "C",
                "path": path_c,
                "size": size,
                "project": bpy.data.filepath or "",
                "count": self.snapshot_count,
            })
            return True
        except Exception as e:
            self.last_error = "快照保存失败: %s" % e
            return False

    # ---------------- 状态文案 ----------------
    def status_text(self):
        if not self.running:
            return "未启动"
        if not self.connected:
            return "等待连接…"
        if self.paused:
            return "已暂停"
        return "守护中"


CLIENT = AquaGuardClient()


# ----------------------------------------------------------------------
# 属性：窗口管理器（供面板显示）
# ----------------------------------------------------------------------
def _get_connected(self):
    return CLIENT.connected


def _get_status(self):
    return CLIENT.status_text()


# ----------------------------------------------------------------------
# 偏好设置
# ----------------------------------------------------------------------
class AquaGuardPreferences(bpy.types.AddonPreferences):
    bl_idname = __name__

    host: StringProperty(name="看门狗地址", default=DEFAULT_HOST)
    port: IntProperty(name="端口", default=DEFAULT_PORT, min=1, max=65535)
    heartbeat: IntProperty(name="心跳间隔（秒）", default=DEFAULT_HEARTBEAT, min=5, max=600)
    cf_every: IntProperty(name="每 N 次 CF 落盘一次", default=DEFAULT_CF_EVERY, min=1, max=20)
    snapshot_dir: StringProperty(name="快照目录", subtype="DIR_PATH", default="")

    def draw(self, context):
        layout = self.layout
        col = layout.column(align=True)
        col.prop(self, "host")
        col.prop(self, "port")
        col.separator()
        col.prop(self, "heartbeat")
        col.prop(self, "cf_every")
        col.separator()
        col.prop(self, "snapshot_dir")
        col.label(text="快照目录留空 = 文档/AquaGuard备份")


# ----------------------------------------------------------------------
# 面板
# ----------------------------------------------------------------------
class AQUAGUARD_PT_panel(bpy.types.Panel):
    bl_label = "AquaGuard 青羽守护"
    bl_idname = "AQUAGUARD_PT_panel"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "AquaGuard"

    def draw(self, context):
        layout = self.layout
        wm = context.window_manager

        box = layout.box()
        row = box.row()
        row.label(text="状态：" + (wm.aquaguard_status if hasattr(wm, "aquaguard_status") else "—"),
                  icon="LINKED" if CLIENT.connected else "UNLINKED")
        row = box.row(align=True)
        row.label(text="快照次数：%d" % CLIENT.snapshot_count)
        row.label(text="CF：%d" % CLIENT.cf_count)

        if CLIENT.last_saved:
            box.label(text="最近：" + os.path.basename(CLIENT.last_saved), icon="FILE_TICK")
            box.label(text=time.strftime("%H:%M:%S", time.localtime(CLIENT.last_saved_time)))

        if CLIENT.last_error:
            warn = layout.box()
            warn.alert = True
            warn.label(text=CLIENT.last_error[:80], icon="ERROR")

        layout.separator()
        row = layout.row(align=True)
        row.operator("aquaguard.save_now", icon="FILE_TICK")
        row.operator("aquaguard.toggle_pause",
                     text="继续" if CLIENT.paused else "暂停",
                     icon="PLAY" if CLIENT.paused else "PAUSE")
        layout.operator("aquaguard.reconnect", icon="FILE_REFRESH")
        layout.operator("aquaguard.open_folder", icon="FILE_FOLDER")

        prefs = context.preferences.addons.get(__name__)
        if prefs:
            layout.operator("preferences.addon_show", text="插件设置").module = __name__


# ----------------------------------------------------------------------
# 操作符
# ----------------------------------------------------------------------
class AQUAGUARD_OT_save_now(bpy.types.Operator):
    bl_idname = "aquaguard.save_now"
    bl_label = "立即存档"
    bl_description = "马上生成一份快照（不等待下一次 CF 指令）"

    def execute(self, context):
        ok = CLIENT.rotate_save()
        self.report({"INFO"} if ok else {"ERROR"}, "快照已保存" if ok else "保存失败：" + CLIENT.last_error)
        return {"FINISHED"}


class AQUAGUARD_OT_toggle_pause(bpy.types.Operator):
    bl_idname = "aquaguard.toggle_pause"
    bl_label = "暂停/继续守护"
    bl_description = "暂停后不再自动落盘，但心跳照常上报"

    def execute(self, context):
        CLIENT.paused = not CLIENT.paused
        self.report({"INFO"}, "已暂停守护" if CLIENT.paused else "已继续守护")
        return {"FINISHED"}


class AQUAGUARD_OT_reconnect(bpy.types.Operator):
    bl_idname = "aquaguard.reconnect"
    bl_label = "重新连接"
    bl_description = "断开并重新连接看门狗"

    def execute(self, context):
        CLIENT._close()
        CLIENT.last_error = ""
        self.report({"INFO"}, "正在重新连接…")
        return {"FINISHED"}


class AQUAGUARD_OT_open_folder(bpy.types.Operator):
    bl_idname = "aquaguard.open_folder"
    bl_label = "打开快照文件夹"
    bl_description = "在文件管理器里打开快照目录"

    def execute(self, context):
        folder = CLIENT.snapshot_dir()
        try:
            bpy.ops.wm.path_open(filepath=folder)
        except Exception:
            self.report({"WARNING"}, "无法打开：" + folder)
        return {"FINISHED"}


# ----------------------------------------------------------------------
# 注册
# ----------------------------------------------------------------------
CLASSES = (
    AquaGuardPreferences,
    AQUAGUARD_PT_panel,
    AQUAGUARD_OT_save_now,
    AQUAGUARD_OT_toggle_pause,
    AQUAGUARD_OT_reconnect,
    AQUAGUARD_OT_open_folder,
)

_tick_registered = False


def _main_tick():
    """全局 1 秒定时器：驱动落盘与面板刷新"""
    CLIENT.tick()
    return 1.0


def _notify_normal_exit():
    """Blender 正常关闭时告诉看门狗「我是自己关的」，避免误判成崩溃。"""
    try:
        CLIENT._send_json({"type": "bye"})
    except Exception:
        pass


def register():
    global _tick_registered
    for cls in CLASSES:
        bpy.utils.register_class(cls)

    bpy.types.WindowManager.aquaguard_connected = BoolProperty(default=False)
    bpy.types.WindowManager.aquaguard_status = StringProperty(default="未启动")

    # 正常退出钩子：用户自己关 Blender 时发 bye，看门狗就不会弹窗
    try:
        if _notify_normal_exit not in bpy.app.handlers.quit_pre:
            bpy.app.handlers.quit_pre.append(_notify_normal_exit)
    except Exception:
        pass
    import atexit
    atexit.register(_notify_normal_exit)

    # 读取用户偏好
    prefs = bpy.context.preferences.addons.get(__name__)
    if prefs and prefs.preferences:
        CLIENT.host = prefs.preferences.host or DEFAULT_HOST
        CLIENT.port = int(prefs.preferences.port or DEFAULT_PORT)
        CLIENT.heartbeat_interval = int(prefs.preferences.heartbeat or DEFAULT_HEARTBEAT)
        CLIENT.cf_every = int(prefs.preferences.cf_every or DEFAULT_CF_EVERY)

    CLIENT.start()

    if not bpy.app.timers.is_registered(_main_tick):
        bpy.app.timers.register(_main_tick, first_interval=1.0, persistent=True)
        _tick_registered = True

    print("[AquaGuard] 插件已启用，目标 %s:%d" % (CLIENT.host, CLIENT.port))


def unregister():
    global _tick_registered
    CLIENT.stop()
    if bpy.app.timers.is_registered(_main_tick):
        bpy.app.timers.unregister(_main_tick)
        _tick_registered = False

    try:
        del bpy.types.WindowManager.aquaguard_connected
        del bpy.types.WindowManager.aquaguard_status
    except Exception:
        pass

    for cls in reversed(CLASSES):
        try:
            bpy.utils.unregister_class(cls)
        except Exception:
            pass

    print("[AquaGuard] 插件已停用")


if __name__ == "__main__":
    register()
