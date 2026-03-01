# PLC-Sim 服务器部署说明

- **服务器 IP**: 213.111.157.18  
- **域名**: plc-sim.com、www.plc-sim.com、api.plc-sim.com  
- **系统**: Linux（Nginx）

---

## 一、DNS 解析

在域名服务商处将以下记录指向 `213.111.157.18`：

| 类型 | 主机记录 | 记录值 |
|------|----------|--------|
| A | @ | 213.111.157.18 |
| A | www | 213.111.157.18 |
| A | api | 213.111.157.18 |

解析生效后可用 `ping plc-sim.com`、`ping www.plc-sim.com`、`ping api.plc-sim.com` 检查。

---

## 二、在服务器上操作（SSH 登录后为 Linux bash）

### 1. 安装 Nginx（若未安装）

```bash
# Debian/Ubuntu
sudo apt update
sudo apt install -y nginx

# 或 CentOS/RHEL
sudo yum install -y nginx
```

### 2. 创建站点目录

```bash
sudo mkdir -p /var/www/plc-sim/frontend
sudo chown -R $USER:$USER /var/www/plc-sim
```

### 3. 上传 Nginx 配置

将本仓库 `deploy/nginx/plc-sim.conf` 上传到服务器，并启用：

若使用配置中的 Basic Auth（调试访问密码），需在服务器上创建密码文件（与《部署总结汇报》一致）：
`sudo htpasswd -c /etc/nginx/.plc-sim-auth admin`，详见 `deploy/nginx/plc-sim.conf` 顶部注释。

```bash
# 上传后执行（或直接在服务器上创建该文件）
sudo cp /path/to/plc-sim.conf /etc/nginx/sites-available/plc-sim.conf
sudo ln -sf /etc/nginx/sites-available/plc-sim.conf /etc/nginx/sites-enabled/

# 若系统使用 conf.d 目录：
# sudo cp /path/to/plc-sim.conf /etc/nginx/conf.d/plc-sim.conf
```

### 4. 检查并重载 Nginx

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 5. 部署前端静态文件

在本地项目根目录构建：

```bash
cd e:\Project\V2.13
npm run build
```

将 `dist/` 目录下所有文件上传到服务器 `/var/www/plc-sim/frontend/`，例如：

```bash
# 在服务器上（若从本机 scp）
scp -r dist/* user@213.111.157.18:/var/www/plc-sim/frontend/
```

### 6. 部署并启动 API 后端

后端代码在项目 `backend/` 目录，在服务器上运行（端口 3000）：

```bash
cd /var/www/plc-sim/backend   # 或你上传 backend 后的路径
npm ci --production
# 配置环境变量后（见下）
node server.js
```

建议用 pm2 常驻：

```bash
npm install -g pm2
pm2 start server.js --name plc-sim-api
pm2 save && pm2 startup
```

### 7. 配置 API 环境变量（后端）

在服务器上创建 `backend/.env`（不要提交到 git）：

```env
PORT=3000
NODE_ENV=production
# 以下为各模型 API Key，由服务端持有，前端不接触
DEEPSEEK_API_KEY=sk-xxx
GEMINI_API_KEY=AIzaSyxxx
# OPENAI_API_KEY=sk-xxx  # 若使用 codex
```

---

## 三、HTTPS（Let's Encrypt）

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d plc-sim.com -d www.plc-sim.com -d api.plc-sim.com
```

证书签发后，用 `deploy/nginx/plc-sim.ssl.conf` 替换或合并到现有配置，或由 certbot 自动修改。然后：

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 四、前端生产环境变量

构建前端时指定 API 地址（请求发往 api.plc-sim.com）：

在项目根目录创建 `.env.production`：

```env
VITE_APP_API_BASE=https://api.plc-sim.com
VITE_APP_SKIP_LOGIN=false
```

执行 `npm run build` 后，前端会使用该 API 根地址。

---

## 五、PowerShell 下操作说明

### 5.1 你已在服务器 PowerShell 中

若当前是 **Windows Server** 且已安装 Nginx for Windows：

- 将 `deploy/nginx/plc-sim.conf` 复制到 Nginx 的 `conf` 目录（如 `C:\nginx\conf\sites\` 或通过 `include` 引入）。
- 修改配置中的 `root` 路径为 Windows 路径，例如：`root C:/var/www/plc-sim/frontend;`
- 后端需在 Windows 上运行 Node（如 `node backend\server.js` 或使用 pm2-windows），监听 3000 端口。
- 重载 Nginx：`nginx -s reload`（在 Nginx 安装目录下执行）。

### 5.2 本机 PowerShell 上传到 Linux 服务器

若服务器是 **Linux**（如 213.111.157.18），你在本机 PowerShell 可执行：

```powershell
# 上传 nginx 配置
scp E:\Project\V2.13\deploy\nginx\plc-sim.conf user@213.111.157.18:~/

# 上传前端构建结果（先在本机执行 npm run build）
scp -r E:\Project\V2.13\dist\* user@213.111.157.18:/var/www/plc-sim/frontend/

# 上传后端（整个 backend 目录）
scp -r E:\Project\V2.13\backend user@213.111.157.18:/var/www/plc-sim/
```

然后在 **SSH 会话（Linux bash）** 里执行：

```bash
# 移动配置并启用
sudo mv ~/plc-sim.conf /etc/nginx/sites-available/
sudo ln -sf /etc/nginx/sites-available/plc-sim.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 安装 Node 18+ 后启动后端（无依赖，仅用 Node 内置模块）
cd /var/www/plc-sim/backend
cp .env.example .env
# 编辑 .env 填入 DEEPSEEK_API_KEY 等
node server.js
# 或使用 pm2: pm2 start server.js --name plc-sim-api && pm2 save
```

---

## 六、简要检查清单

- [ ] DNS 三个域名均解析到 213.111.157.18  
- [ ] Nginx 配置已放入并 `nginx -t` 通过、reload 成功  
- [ ] 前端文件在 `/var/www/plc-sim/frontend/`，可访问 www.plc-sim.com  
- [ ] 后端监听 3000，pm2 或 systemd 常驻，api.plc-sim.com/health 返回 200  
- [ ] 后端 .env 已配置 API Key，不提交到 git  
- [ ] 已配置 HTTPS 并强制跳转（可选但推荐）
