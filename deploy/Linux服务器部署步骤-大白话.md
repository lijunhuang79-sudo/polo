# Linux 服务器部署步骤（大白话版）

服务器：**213.111.157.18**  
域名：**plc-sim.com**、**www.plc-sim.com**、**api.plc-sim.com**

---

## 第一步：先把域名指到你的服务器

去你买域名的地方（阿里云、腾讯云、Cloudflare、GoDaddy 等都行），给这三个域名都加一条 **A 记录**，指向 IP：`213.111.157.18`。

- `plc-sim.com` → 213.111.157.18  
- `www.plc-sim.com` → 213.111.157.18  
- `api.plc-sim.com` → 213.111.157.18  

保存后等几分钟，在你自己电脑上打开 PowerShell 或 CMD 输入：

```bash
ping www.plc-sim.com
```

能看到 213.111.157.18 就说明解析好了。

---

## 第二步：连上你的 Linux 服务器

在你**自己电脑**上打开 PowerShell（或 CMD），输入（把 `你的用户名` 换成你 SSH 登录用的名字，比如 root 或 ubuntu）：

```bash
ssh 你的用户名@213.111.157.18
```

输入密码后，就进到服务器里了。后面说的“在服务器上”就是指在这个黑窗口里敲命令。

---

## 第三步：在服务器上装 Nginx（如果还没装）

在服务器里输入：

```bash
# 如果是 Ubuntu / Debian
sudo apt update
sudo apt install -y nginx

# 如果是 CentOS / 红帽系
sudo yum install -y nginx
```

装好后可以开个浏览器访问 `http://213.111.157.18`，能看到 Nginx 默认页就说明装好了。

---

## 第四步：建好放网站的文件夹

在服务器里输入：

```bash
sudo mkdir -p /var/www/plc-sim/frontend
sudo mkdir -p /var/www/plc-sim/backend
sudo chown -R $USER:$USER /var/www/plc-sim
```

这样你就有一个专门放 PLC 网站的目录了，而且当前用户有权限往里面放文件。

---

## 第五步：把 Nginx 配置拷到服务器

**不要**在服务器里手敲配置，容易出错。在你**自己电脑**上再开一个 PowerShell 窗口（不要关 SSH 那个），在项目目录下执行（把 `你的用户名` 改成你 SSH 用的）：

```powershell
cd E:\Project\V2.13
scp deploy/nginx/plc-sim.conf 你的用户名@213.111.157.18:~/
```

会提示输入密码，传完后配置文件就在服务器你的家目录 `~/` 里了。

回到 **SSH 那个窗口**，在服务器里执行：

```bash
sudo mv ~/plc-sim.conf /etc/nginx/sites-available/
sudo ln -sf /etc/nginx/sites-available/plc-sim.conf /etc/nginx/sites-enabled/
sudo nginx -t
```

最后一行如果显示 `syntax is ok` 和 `test is successful`，再执行：

```bash
sudo systemctl reload nginx
```

到这步，Nginx 已经按三个域名分好了：访问 www 走前端，访问 api 走后端（后端还没起，所以 api 会报错先不用管）。

### 第五步（续）：设置调试访问密码（暂不对外开放时必做）

与《PLC-SIM 全栈项目部署总结汇报》一致，密码文件为 `/etc/nginx/.plc-sim-auth`，建议用户名 `admin`。在服务器里执行：

```bash
# 安装生成密码的工具（没有的话）
sudo apt install -y apache2-utils

# 创建密码文件，用户名用 admin，按提示输入你要的密码
sudo htpasswd -c /etc/nginx/.plc-sim-auth admin
```

以后要**改密码**或**多加一个用户**时，去掉 `-c`，否则会覆盖原文件：

```bash
sudo htpasswd /etc/nginx/.plc-sim-auth admin
```

改完密码后重载 Nginx：

```bash
sudo nginx -t && sudo systemctl reload nginx
```

之后访问 www.plc-sim.com 或 api.plc-sim.com 时，浏览器会先弹出“输入用户名和密码”，输入你设置的 **admin** 和密码才能进。不输或输错就看不到页面、也调不了接口，相当于暂时不对外开放。

---

## 第六步：在本机打包前端，并上传到服务器

在你**自己电脑**上，在项目根目录执行：

```powershell
cd E:\Project\V2.13
npm run build
```

会生成一个 `dist` 文件夹。把里面**所有东西**上传到服务器的 `/var/www/plc-sim/frontend/`（把 `你的用户名` 换成你的）：

```powershell
scp -r dist/* 你的用户名@213.111.157.18:/var/www/plc-sim/frontend/
```

传完后，在浏览器访问 **http://www.plc-sim.com**（或 http://plc-sim.com，会跳转到 www），应该就能看到你的 PLC 仿真器页面了。

---

## 第七步：把后端代码上传并跑起来

在你**自己电脑**上执行（把 `你的用户名` 换成你的）：

```powershell
cd E:\Project\V2.13
scp -r backend 你的用户名@213.111.157.18:/var/www/plc-sim/
```

然后在 **SSH 里**，在服务器上执行：

```bash
cd /var/www/plc-sim/backend
cp .env.example .env
nano .env
```

用 nano 打开 `.env` 后，把里面的 `sk-xxx`、`AIzaSyxxx` 改成你**真实的** DeepSeek、Gemini 等 API Key，保存退出（Ctrl+O 回车，再 Ctrl+X）。

确认服务器上装了 Node.js 且版本 ≥ 18：

```bash
node -v
```

如果没有或版本太低，先装一个（Ubuntu 示例）：

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

然后启动后端（当前会占用这个终端）：

```bash
cd /var/www/plc-sim/backend
node server.js
```

看到类似 `plc-sim-api listening on http://0.0.0.0:3000` 就说明后端起来了。

这时在浏览器访问 **http://api.plc-sim.com/health**，应该能看到一行 JSON：`{"ok":true,"service":"plc-sim-api"}`。

想关掉后端就按 Ctrl+C。想让它一直在后台跑，可以用 pm2（可选）：

```bash
sudo npm install -g pm2
cd /var/www/plc-sim/backend
pm2 start server.js --name plc-sim-api
pm2 save
pm2 startup
```

按它提示执行完，以后重启服务器后端也会自动起来。

---

## 第八步（可选）：给网站加 HTTPS

这样别人访问时是带小锁的 https，更安全。在服务器上执行：

```bash
# Ubuntu/Debian
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d plc-sim.com -d www.plc-sim.com -d api.plc-sim.com
```

按提示输入邮箱、同意条款，选“重定向 HTTP 到 HTTPS”。证书装好后，Nginx 会自动改配置，你不需要再动。

之后访问 **https://www.plc-sim.com** 和 **https://api.plc-sim.com** 就可以了。

---

## 总结：你一共要做的事

1. **域名**：把 plc-sim.com、www、api 三个都 A 记录到 213.111.157.18。  
2. **SSH**：用 `ssh 用户名@213.111.157.18` 连上服务器。  
3. **Nginx**：装 Nginx，建目录，把 `plc-sim.conf` 拷上去并启用，重载 Nginx。  
4. **前端**：本机 `npm run build`，用 scp 把 `dist/*` 拷到 `/var/www/plc-sim/frontend/`。  
5. **后端**：用 scp 把 `backend` 拷到 `/var/www/plc-sim/`，在服务器上 `cp .env.example .env`，编辑 `.env` 填好 API Key，`node server.js`（或 pm2 常驻）。  
6. **可选**：用 certbot 给三个域名上 HTTPS。

做完这些，**www.plc-sim.com** 就是你的前端页面，**api.plc-sim.com** 就是你的后端接口，API Key 只存在服务器上，不会暴露给用户。
