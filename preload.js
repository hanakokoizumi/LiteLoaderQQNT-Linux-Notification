"use strict";

const { ipcRenderer } = require("electron");

const CHANNEL_NOTIFY = "LiteLoader.linux_notification.notify";

const CMD_RECV = "nodeIKernelMsgListener/onRecvMsg";
const CMD_RECV_ACTIVE = "nodeIKernelMsgListener/onRecvActiveMsg";

let webContentsId = ipcRenderer.sendSync("___!boot");
if (!webContentsId) {
  webContentsId = 2;
}

/**
 * @param {string} cmdName
 * @param {(payload: any) => void} handler
 */
function subscribeEvent(cmdName, handler) {
  const listener = (event, ...args) => {
    if (args?.[1]?.[0]?.cmdName === cmdName) {
      handler(args[1][0].payload);
    }
  };
  ipcRenderer.on(`IPC_DOWN_${webContentsId}`, listener);
  return listener;
}

/**
 * @param {any} el
 * @returns {string}
 */
function elementToSnippet(el) {
  if (!el || typeof el !== "object") {
    return "";
  }
  if (el.textElement?.content) {
    return String(el.textElement.content);
  }
  if (el.atElement?.atNtUid || el.atElement?.atUid) {
    const t = el.atElement.atNtUid || el.atElement.atUid;
    return `@${t}`;
  }
  if (el.atAllElement) {
    return "@全体成员";
  }
  if (el.picElement) {
    return "[图片]";
  }
  if (el.faceElement) {
    return "[表情]";
  }
  if (el.pttElement) {
    return "[语音]";
  }
  if (el.fileElement) {
    return "[文件]";
  }
  if (el.videoElement) {
    return "[视频]";
  }
  if (el.marketFaceElement) {
    return "[表情]";
  }
  if (el.replyElement) {
    return "";
  }
  if (el.grayTipElement) {
    return "";
  }
  if (el.walletElement) {
    return "[红包]";
  }
  if (el.inlineKeyboardElement) {
    return "";
  }
  return "";
}

/**
 * @param {any[] | undefined} elements
 * @returns {string}
 */
function summarizeBody(elements) {
  if (!Array.isArray(elements)) {
    return "您有一条新消息";
  }
  const parts = [];
  for (const el of elements) {
    const s = elementToSnippet(el);
    if (s) {
      parts.push(s);
    }
  }
  const joined = parts.join(" ").trim();
  return joined || "您有一条新消息";
}

/**
 * @param {any} msg
 * @returns {string}
 */
function summarizeTitle(msg) {
  if (!msg || typeof msg !== "object") {
    return "QQ";
  }
  const candidates = [
    msg.peerName,
    msg.groupName,
    msg.remarkName,
    msg.sendNickName,
    msg.sendMemberName,
    msg.sendRemarkName,
    msg.peerUid,
  ];
  for (const c of candidates) {
    if (c != null && String(c).trim() !== "") {
      return String(c);
    }
  }
  return "QQ";
}

/**
 * @param {any} payload
 */
function onIncomingMessages(payload) {
  const list = payload?.msgList;
  if (!Array.isArray(list)) {
    return;
  }
  for (const msg of list) {
    if (!msg || typeof msg !== "object") {
      continue;
    }
    const summary = summarizeTitle(msg);
    const body = summarizeBody(msg.elements);
    ipcRenderer.send(CHANNEL_NOTIFY, {
      msgId: msg.msgId,
      summary,
      body,
    });
  }
}

subscribeEvent(CMD_RECV, onIncomingMessages);
subscribeEvent(CMD_RECV_ACTIVE, onIncomingMessages);
