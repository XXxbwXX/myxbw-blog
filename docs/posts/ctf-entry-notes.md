---
title: CTF 入门：先把信息收集和 Linux 命令练熟
date: '2026-09-10'
description: 不急着背工具，先建立“拿到题目先收集信息”的固定动作，再按方向补基础。
tags: [CTF, 安全, 学习]
readingTime: 6
---

# CTF 入门：先把信息收集和 Linux 命令练熟

CTF 的方向很多，新人最容易卡在“工具装了一堆，拿到题还是不知道从哪下手”。我的建议是：先把信息收集和 Linux 基础命令练成条件反射，再按方向补知识。

## 1. 拿到题目先做信息收集

不要一上来就猜漏洞。先回答这几个问题：

- 题目给了什么文件？压缩包、图片、流量包还是二进制？
- 有没有提示？标题、描述、附件名、目录名都可能是线索。
- 是什么类型？Misc、Web、Crypto、Pwn、Reverse？
- 有没有在线服务？域名、端口、协议分别是什么？

对应的命令：

```bash
file challenge.bin
strings challenge.bin | head -50
binwalk challenge.bin
exiftool image.png
```

Web 题先看响应头和页面源码：

```bash
curl -I http://target/
curl -s http://target/ | head -100
```

## 2. Linux 命令是最通用的基础

无论哪个方向，这些命令都值得练熟：

```bash
ls -la
find . -type f
grep -rin "flag" .
xxd file.bin | head
tar -xvf archive.tar.gz
unzip challenge.zip
base64 -d data.txt
```

重点不是背参数，而是知道“遇到某类文件应该用哪个工具看”。

## 3. 按方向补基础

### Misc

- 图片隐写：`exiftool`、`zsteg`、`steghide`；
- 流量分析：Wireshark、`tshark`；
- 编码转换：CyberChef、Python 脚本；
- 压缩包：`binwalk`、`foremost`、`fcrackzip`。

### Web

- 先理解 HTTP 请求和响应；
- 再学常见漏洞：注入、XSS、文件上传、SSRF、反序列化；
- 靶场推荐 DVWA、Pikachu、PortSwigger Web Security Academy。

### Reverse / Pwn

- Reverse：从 `strings`、`file`、IDA/Ghidra 开始；
- Pwn：先补汇编、栈、调用约定，再碰 `pwntools`；
- 不要一开始就挑战高难度 Pwn，容易劝退。

## 4. 把每次复盘写成 SOP

我习惯每道题记录四件事：

1. 题目信息：类型、附件、目标；
2. 信息收集结果：哪些线索有用；
3. 利用过程：每一步命令和判断依据；
4. 结论：这题考了什么，下次怎么更快识别。

这样做比单纯刷题数量更有用，因为下一次遇到同类题，可以按记录直接复现。

## 5. 推荐练习节奏

- 每周 2～3 道 Misc / Web 入门题；
- 每周补一个知识点，例如 HTTP 状态码、SQL 注入类型；
- 每月把错题重做一遍；
- 遇到卡题先记录，不要连续耗超过一小时。

## 小结

CTF 的入门门槛不在工具，而在“先观察、再假设、最后验证”的流程。把信息收集和 Linux 命令练熟，后面的方向学习会顺很多。
