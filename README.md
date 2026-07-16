# 考云考试系统

一个可在 macOS 和 Windows 上运行的考试 MVP。管理员启动服务后，考生可使用微信扫描二维码进入手机答题页。部署到公网或配置内网穿透地址后，考生无需和管理员连接同一个 Wi-Fi。提交后自动判分，并实时更新管理员工作台和成绩汇总。

## 先看这个

想让考生不和管理员连同一个 Wi-Fi 也能扫码，最稳的做法是准备一个公网地址，然后启动时把它写进 `PUBLIC_ORIGIN`。

```bash
PUBLIC_ORIGIN=https://你的公网地址 npm start
```

这个地址可以是：

1. 你的正式域名
2. 内网穿透工具给你的临时 HTTPS 地址

配完以后，管理员端生成的二维码就会直接指向这个外网地址。

如果你是通过 Cloudflare Tunnel、反向代理或其他外网入口访问管理后台，系统通常也会自动识别当前请求的公网域名；这时可以不手动设置 `PUBLIC_ORIGIN`。如果识别不出来，再按上面的方式显式设置即可。

## 已实现

- 管理员登录、工作台、考试列表、成绩汇总、考生列表
- 创建、发布、结束、删除考试
- 手动建立题库，或上传 TXT / JSON 试卷生成题目
- 为进行中的考试生成真实二维码，支持公网地址
- 单选题、多选题、题间导航、手机响应式布局
- 自动判分、通过判定、实时汇总
- 考生添加、删除、备注编辑
- CSV 成绩导出
- 本地 JSON 持久化，不依赖云服务
- PWA 安装模式，可在 Chrome / Edge 中安装为桌面应用

## 启动

首次运行：

```bash
npm install
npm run build
npm start
```

管理员打开终端显示的本机地址，例如：

```text
http://localhost:8787
```

默认管理员账号：

```text
账号：admin
密码：123456
```

可以用环境变量修改账号密码：

```bash
ADMIN_USER=yourname ADMIN_PASS=yourpass npm start
```

## 公网扫码

这件事可以理解成一句话：二维码里写的是一个网址，只要这个网址在外网能打开，考生就不需要和管理员连同一个 Wi-Fi。

最简单的做法有两种：

1. 把系统部署到公网服务器，直接使用你的正式域名。
2. 先在本机运行，再用内网穿透工具生成一个公网 HTTPS 地址。

拿到公网地址后，把它填给 `PUBLIC_ORIGIN`，例如：

```bash
PUBLIC_ORIGIN=https://exam.example.com npm start
```

这时管理员端生成的二维码就会指向 `https://exam.example.com/?join=...`。

如果你暂时没有域名，也可以先用内网穿透工具给自己一个临时地址，比如：

```bash
PUBLIC_ORIGIN=https://xxxxx.ngrok-free.app npm start
```

配置后的检查方法很简单：

1. 在管理员端打开“答题二维码”。
2. 复制二维码下方的链接。
3. 用手机流量或另一台不连 Wi-Fi 的设备打开这个链接。
4. 如果能进入答题页，说明配置成功。

如果打不开，通常是下面两个原因：

1. `PUBLIC_ORIGIN` 写错了，或者少了 `http://` / `https://`。
2. 你填的是本机地址、局域网地址，外网访问不到。

开发模式：

```bash
npm run dev
```

## 公网部署

如果你要正式上线，推荐直接用 Docker 跑在一台公网服务器上，然后把域名指向这台机器。

```bash
docker build -t kaoyun .
docker run -d --name kaoyun \
  -p 8787:8787 \
  -e PUBLIC_ORIGIN=https://exam.example.com \
  -e ADMIN_USER=admin \
  -e ADMIN_PASS=123456 \
  kaoyun
```

部署完成后，后台二维码会自动使用 `PUBLIC_ORIGIN` 对应的外网地址；如果前面有反向代理，也会优先识别代理传来的公网域名。

如果你想把 HTTPS 和反向代理一起交给 Caddy 处理，可以直接用 `docker-compose.yml`：

```bash
PUBLIC_ORIGIN=https://exam.example.com docker compose up -d --build
```

上线前把 [`Caddyfile`](./Caddyfile) 里的域名和邮箱改成你自己的。`Caddy` 会自动申请证书，外网访问就会是正式地址。

## 数据

运行数据保存在 `data/db.json`。删除该文件后重新启动，会恢复内置演示考试和样例成绩。

## 上传试卷格式

支持 `.json` 或 `.txt`。TXT 示例：

```text
1. 发现设备异常时，首先应该怎么做？
A. 继续运行并观察
B. 立即停机并按流程上报
C. 自行拆卸检修
D. 等待交接班处理
答案：B

2. 进入生产区域前，应完成哪些准备？
A. 规范佩戴防护用品
B. 了解疏散通道
C. 关闭手机
D. 确认现场风险提示
答案：A,B,D
```

## 当前边界

这是适合演示或小型考试的 MVP。当前管理员登录为轻量本地账号，数据仍保存在本地 JSON 文件。若用于正式组织考试，下一阶段应接入 HTTPS、公网域名、数据库、正式账号体系、防重复提交和断线恢复。
