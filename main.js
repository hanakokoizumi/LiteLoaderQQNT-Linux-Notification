"use strict";

const path = require("path");
const { createRequire } = require("module");
const { ipcMain, BrowserWindow } = require("electron");

const CHANNEL_NOTIFY = "LiteLoader.linux_notification.notify";
const DEDUP_MS = 2000;

/** @type {Map<string, number>} */
const recentMsgIds = new Map();

/** @type {any | null} */
let notificationsIface = null;
let actionListenerAttached = false;
let ipcRegistered = false;

/**
 * 从插件根目录解析依赖（QQ 进程 cwd 可能不是插件目录，plain require 会找不到 dbus-next）。
 */
function createPluginRequire() {
  let root = __dirname;
  try {
    if (
      typeof LiteLoader !== "undefined" &&
      LiteLoader.plugins?.linux_notification?.path?.plugin
    ) {
      root = LiteLoader.plugins.linux_notification.path.plugin;
    }
  } catch {
    // ignore
  }
  return createRequire(path.join(root, "package.json"));
}

/** @type {ReturnType<typeof createRequire> | null} */
let pluginRequire = null;
function requireFromPlugin(specifier) {
  if (!pluginRequire) {
    pluginRequire = createPluginRequire();
  }
  return pluginRequire(specifier);
}

function pruneDedup() {
  const now = Date.now();
  for (const [id, t] of recentMsgIds) {
    if (now - t > DEDUP_MS) {
      recentMsgIds.delete(id);
    }
  }
}

function shouldNotify(msgId) {
  pruneDedup();
  if (msgId == null || msgId === "") {
    return true;
  }
  const key = String(msgId);
  const now = Date.now();
  const last = recentMsgIds.get(key);
  if (last != null && now - last < DEDUP_MS) {
    return false;
  }
  recentMsgIds.set(key, now);
  return true;
}

function focusQQWindows() {
  const wins = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed());
  const scored = wins.map((w) => {
    let score = 0;
    try {
      const u = w.webContents.getURL();
      if (u.includes("#/main/message")) {
        score = 2;
      } else if (u.includes("#/chat")) {
        score = 1;
      }
    } catch {
      // ignore
    }
    return { w, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const target =
    scored.find((x) => x.score > 0)?.w ?? scored[0]?.w ?? null;
  if (!target) {
    return;
  }
  try {
    if (target.isMinimized()) {
      target.restore();
    }
    target.show();
    target.focus();
  } catch (e) {
    console.error("[linux_notification] focus window failed:", e);
  }
}

function attachActionListener(iface) {
  if (actionListenerAttached) {
    return;
  }
  iface.on("ActionInvoked", (id, actionKey) => {
    if (actionKey === "default") {
      focusQQWindows();
    }
  });
  actionListenerAttached = true;
}

/** @type {string} */
let lastEnsureDBusError = "";

async function ensureDBus() {
  if (process.platform !== "linux") {
    return null;
  }
  if (notificationsIface) {
    return notificationsIface;
  }
  lastEnsureDBusError = "";
  try {
    const dbus = requireFromPlugin("dbus-next");
    const bus = dbus.sessionBus();
    const obj = await bus.getProxyObject(
      "org.freedesktop.Notifications",
      "/org/freedesktop/Notifications"
    );
    const iface = obj.getInterface("org.freedesktop.Notifications");
    notificationsIface = iface;
    attachActionListener(iface);
    return iface;
  } catch (e) {
    notificationsIface = null;
    lastEnsureDBusError = formatErr(e);
    console.error("[linux_notification] DBus init failed:", e);
    return null;
  }
}

function formatErr(e) {
  if (e == null) {
    return "unknown";
  }
  const msg = e.message || String(e);
  if (e.code === "MODULE_NOT_FOUND" || /Cannot find module/i.test(msg)) {
    return `${msg}\n（请在插件目录执行 npm install / pnpm install，并确认 LiteLoader 加载的是该目录。）`;
  }
  return msg;
}

/**
 * @param {string} summary
 * @param {string} body
 * @returns {Promise<{ ok: boolean; usedActions?: boolean; error?: string; ensureError?: string }>}
 */
async function notifyDesktop(summary, body) {
  const iface = await ensureDBus();
  if (!iface) {
    return {
      ok: false,
      ensureError: lastEnsureDBusError || "无法连接 org.freedesktop.Notifications",
    };
  }

  const appName = "QQ";
  const replacesId = 0;
  const appIcon = "";
  const hints = {};
  const expireTimeout = -1;
  const s = String(summary || "QQ");
  const b = String(body || "您有一条新消息");

  const withActions = ["default", "打开"];
  try {
    await iface.Notify(
      appName,
      replacesId,
      appIcon,
      s,
      b,
      withActions,
      hints,
      expireTimeout
    );
    return { ok: true, usedActions: true };
  } catch (e1) {
    console.warn(
      "[linux_notification] Notify with actions failed, retry without actions:",
      e1
    );
    try {
      await iface.Notify(
        appName,
        replacesId,
        appIcon,
        s,
        b,
        [],
        hints,
        expireTimeout
      );
      return { ok: true, usedActions: false };
    } catch (e2) {
      return {
        ok: false,
        error: formatErr(e2),
        actionsError: formatErr(e1),
      };
    }
  }
}

function registerIpc() {
  if (process.platform !== "linux" || ipcRegistered) {
    return;
  }
  ipcRegistered = true;
  ipcMain.on(CHANNEL_NOTIFY, (event, payload) => {
    if (!payload || typeof payload !== "object") {
      return;
    }
    const { msgId, summary, body } = payload;
    if (!shouldNotify(msgId)) {
      return;
    }
    notifyDesktop(summary, body).catch((e) => {
      console.error("[linux_notification] notifyDesktop:", e);
    });
  });
}

registerIpc();

function onBrowserWindowCreated() {
  // 占位：逻辑在 preload + ipcMain，无需 hook BrowserWindow
}

module.exports = {
  onBrowserWindowCreated,
};
