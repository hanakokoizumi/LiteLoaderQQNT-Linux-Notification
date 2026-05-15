# LiteLoaderQQNT-Linux-Notification

在 Linux 上通过 `org.freedesktop.Notifications`（DBus）强制显示 QQ NT 新消息桌面通知；点击通知会将 QQ 窗口前置并尝试获取焦点。

如果需要原生通知，可以参考：https://forum.archlinuxcn.org/t/topic/13074/17

## 安装

### 自 GitHub Releases

1. 在仓库 Releases 中下载对应版本的 `LiteLoaderQQNT-Linux-Notification-<tag>.zip`。
2. 在 LiteLoaderQQNT 控制面板选择从压缩包安装。
3. 重启 QQ。

### 从源码目录安装

1. 将整个 `LiteLoaderQQNT-Linux-Notification` 目录复制到 LiteLoader 的插件目录。
2. 在本目录执行 `pnpm install`（或 `npm install`）。
3. 重启 QQ。

## 依赖

- 系统需有实现 **Freedesktop 通知规范** 的服务，例如 `dunst`、`mako`、`swaync`、`gnome-shell` 自带通知等。

## 许可证

MIT License，见 [LICENSE](LICENSE)。Copyright (c) 2026 Hanako。
