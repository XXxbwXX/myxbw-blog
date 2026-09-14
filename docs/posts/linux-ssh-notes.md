---
title: Linux 远程登录与 SSH：几条省时间的命令
date: '2026-09-12'
description: 从第一次远程登录到配置别名、传文件和排查连接问题，整理一份常用的 SSH 命令清单。
tags: [Linux, SSH, 工具]
readingTime: 6
---

# Linux 远程登录与 SSH：几条省时间的命令

SSH 是学 Linux 时最早遇到、也最容易“只记个大概”的工具。这篇文章不展开协议细节，只整理高频命令和排错顺序。

## 1. 第一次登录

最基础的形式：

```bash
ssh 用户名@服务器地址
```

如果服务器 SSH 端口不是 22：

```bash
ssh -p 2222 用户名@服务器地址
```

首次连接会提示确认指纹，核对服务器提供的信息后再输入 `yes`。

## 2. 用密钥代替密码

本地生成密钥：

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

一路回车即可。默认生成：

- 私钥：`~/.ssh/id_ed25519`
- 公钥：`~/.ssh/id_ed25519.pub`

把公钥传到服务器：

```bash
ssh-copy-id -i ~/.ssh/id_ed25519.pub 用户名@服务器地址
```

如果没有 `ssh-copy-id`，也可以手动追加：

```bash
cat ~/.ssh/id_ed25519.pub | ssh 用户名@服务器地址 'mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys'
```

## 3. 配置别名，少打一长串

编辑 `~/.ssh/config`：

```txt
Host myserver
    HostName 192.0.2.10
    User root
    Port 2222
    IdentityFile ~/.ssh/id_ed25519
```

之后只需要：

```bash
ssh myserver
```

别名同样适用于 `scp`、`rsync` 和 VS Code Remote SSH。

## 4. 传文件

上传单个文件：

```bash
scp ./app.tar.gz myserver:/opt/app/
```

下载整个目录：

```bash
scp -r myserver:/var/log/nginx ./nginx-logs
```

更推荐大文件或增量同步用 `rsync`：

```bash
rsync -avz --progress ./dist/ myserver:/var/www/site/
```

注意 `rsync` 结尾的斜杠：`./dist/` 表示同步目录内容，`./dist` 表示把 `dist` 整个目录放进去。

## 5. 连接失败时的排查顺序

按这个顺序查，通常能定位到原因：

1. **网络是否通**：`ping 服务器地址`；
2. **端口是否开**：`nc -vz 服务器地址 22`；
3. **SSH 是否在监听**：服务器上 `systemctl status sshd`；
4. **防火墙是否放行**：`ufw status` 或云厂商安全组；
5. **权限是否正确**：`~/.ssh` 应为 `700`，`authorized_keys` 应为 `600`；
6. **看客户端详细日志**：`ssh -vvv 用户名@服务器地址`。

权限问题最常见：

```bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

## 6. 保持长连接

网络不稳定时，可以在本地 `~/.ssh/config` 里加：

```txt
ServerAliveInterval 30
ServerAliveCountMax 6
```

这样 SSH 会定期发送心跳，减少一段时间不操作就被断开的情况。

## 小结

SSH 的命令不多，关键是提前把密钥、别名和排错顺序准备好。配置一次，后面每次远程操作都会少花几分钟。
