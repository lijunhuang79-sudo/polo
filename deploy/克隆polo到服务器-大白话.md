# 克隆 Polo 仓库到服务器 — 大白话步骤

你已经做了：① 在 GitHub 加了私钥  ② 改好了 Nginx 的 root 路径。  
下面只做一件事：**在服务器上克隆仓库到 /var/www/plc-sim/polo，并跑一次部署**。

---

## 第一步：连上你的服务器

在你**自己电脑**上打开 PowerShell 或 CMD，输入（把 `你的密码` 换成 root 的登录密码）：

```bash
ssh root@213.111.157.18
```

输入密码后回车，出现类似 `root@xxx:~#` 就说明已经进到服务器了。后面所有命令都是在这个黑窗口里敲。

---

## 第二步：建好要放网站的目录

在服务器里**一条一条**执行（直接复制粘贴整段也行）：

```bash
mkdir -p /var/www/plc-sim
chown root:root /var/www/plc-sim
```

没有报错就说明目录建好了。

---

## 第三步：克隆 Polo 仓库

还是在服务器里执行：

```bash
cd /var/www/plc-sim
git clone https://github.com/lijunhuang79-sudo/polo.git polo
```

会从 GitHub 把 polo 仓库下载到 `/var/www/plc-sim/polo`。  
如果提示要输 GitHub 用户名/密码，说明仓库是私有的，需要改用带 token 的地址或先配置好 SSH；如果是公开仓库，一般直接就能克隆成功。

克隆成功后可以看一眼：

```bash
ls -la /var/www/plc-sim/polo
```

应该能看到 `src`、`backend`、`package.json`、`deploy` 等文件夹和文件。

---

## 第四步：给部署脚本加上执行权限

```bash
chmod +x /var/www/plc-sim/polo/deploy/scripts/deploy-polo.sh
```

没有输出就是成功了。

---

## 第五步：确认服务器上有 Node.js

执行：

```bash
node -v
```

如果显示 `v18.x` 或 `v20.x` 之类的，说明 Node 已装好，直接做第六步。  
如果提示找不到命令，先装 Node（Ubuntu/Debian 示例）：

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v
```

---

## 第六步：跑第一次部署（构建前端并放到 frontend 目录）

在服务器里执行：

```bash
cd /var/www/plc-sim/polo
./deploy/scripts/deploy-polo.sh
```

脚本会自动：拉最新代码、安装依赖、执行 `npm run build`、把生成的 `dist/` 里的文件复制到 `/var/www/plc-sim/polo/frontend`，并视情况重启后端（pm2）。

如果中间报错，把**完整报错内容**复制下来，方便排查。常见情况：

- **没有 .env.production**：脚本会从 `env.production.example` 复制一份，一般不用你管。
- **后端 .env 没有**：第一次部署后，若要后端连 AI，需要自己建一份：
  ```bash
  cp /var/www/plc-sim/polo/backend/.env.example /var/www/plc-sim/polo/backend/.env
  nano /var/www/plc-sim/polo/backend/.env
  ```
  把里面的 API Key 改成你自己的，保存退出。

---

## 第七步：确认 Nginx 用的是新配置

如果你改过 Nginx 的 root 路径，需要让 Nginx 重新加载配置：

```bash
nginx -t
```

显示 `syntax is ok` 和 `test is successful` 后，再执行：

```bash
systemctl reload nginx
```

（如果用的是 `sudo nginx`，就改成 `sudo nginx -t` 和 `sudo systemctl reload nginx`。）

---

## 第八步：自己验证一下

1. 在你自己电脑浏览器打开：**https://www.plc-sim.com**（或 http，看你怎么配的）。
2. 输入 Basic Auth 的账号密码（你之前配的）。
3. 能正常打开 PLC 仿真器页面、没有白屏，就说明前端部署好了。

还可以在服务器上再看一眼前端文件有没有：

```bash
ls -la /var/www/plc-sim/polo/frontend
```

应该能看到 `index.html` 和 `assets` 文件夹。

---

## 以后更新怎么弄？

- **自动**：在你电脑上改完代码，推送到 GitHub 的 **main** 分支，GitHub Actions 会自动在服务器上拉代码、构建、更新 `/var/www/plc-sim/polo/frontend`，不用再手动克隆。
- **手动**：想自己在服务器上再跑一遍部署，就执行：
  ```bash
  /var/www/plc-sim/polo/deploy/scripts/deploy-polo.sh
  ```

---

## 小结：你要敲的命令（按顺序）

| 顺序 | 命令 |
|------|------|
| 1 | `ssh root@213.111.157.18` |
| 2 | `mkdir -p /var/www/plc-sim` |
| 3 | `cd /var/www/plc-sim` |
| 4 | `git clone https://github.com/lijunhuang79-sudo/polo.git polo` |
| 5 | `chmod +x /var/www/plc-sim/polo/deploy/scripts/deploy-polo.sh` |
| 6 | `node -v`（没有就先装 Node） |
| 7 | `cd /var/www/plc-sim/polo` |
| 8 | `./deploy/scripts/deploy-polo.sh` |
| 9 | `nginx -t && systemctl reload nginx`（若你改了 Nginx 配置） |
| 10 | 浏览器打开 https://www.plc-sim.com 验证 |

按上面做完，就完成了「克隆 polo 仓库到 /var/www/plc-sim/polo」以及第一次前端部署；之后交给 push + Actions 即可。
