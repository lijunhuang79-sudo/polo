# GitHub 同步部署说明（Polo PLC-Sim）

- **仓库**: [https://github.com/lijunhuang79-sudo/polo](https://github.com/lijunhuang79-sudo/polo)
- **维护**: PoloHuang &lt;lijunlhuang79@gmail.com&gt;
- **服务器前端目录**: `/var/www/plc-sim/polo/frontend`（Nginx 静态根目录）
- **服务器仓库/后端**: `/var/www/plc-sim/polo`（git 克隆根目录，内含 `backend/`）

---

## 一、两种部署方式

| 方式 | 说明 | 适用 |
|------|------|------|
| **GitHub Actions** | push 到 `main` 后自动 SSH 到服务器执行拉取、构建、发布 | 推荐，推送即部署 |
| **服务器本机脚本** | 在服务器上定时或手动执行 `deploy/scripts/deploy-polo.sh` | 无公网 SSH 或不想配密钥时 |

---

## 二、使用 GitHub Actions（推荐）

### 1. 在服务器上准备 SSH 密钥

SSH 登录到 **213.111.157.18** 后执行：

```bash
# 若已有可用的 root 密钥对可跳过生成，只用私钥
sudo -u root ssh-keygen -t ed25519 -C "polo-deploy" -f /root/.ssh/deploy_polo -N ""
cat /root/.ssh/deploy_polo.pub >> /root/.ssh/authorized_keys
# 或若 root 用 authorized_keys：
# sudo cat /root/.ssh/deploy_polo.pub >> /root/.ssh/authorized_keys
```

把 **私钥** 内容复制出来（整段，含 `-----BEGIN ... KEY-----` 和 `-----END ... KEY-----`）：

```bash
sudo cat /root/.ssh/deploy_polo
```

### 2. 在 GitHub 仓库添加 Secret

1. 打开 [https://github.com/lijunhuang79-sudo/polo](https://github.com/lijunhuang79-sudo/polo)
2. **Settings** → **Secrets and variables** → **Actions**
3. **New repository secret**
   - **Name**: `DEPLOY_SSH_KEY`
   - **Value**: 粘贴上面复制的私钥全文

### 3. 确保服务器环境

- Node.js ≥ 18（`node -v`）
- npm（`npm -v`）
- git、rsync
- 若用 pm2 管理后端：`npm install -g pm2`

首次部署前在服务器上：

- 若需前端生产环境变量且仓库里没有 `.env.production`，可在克隆后复制一份并编辑：
  ```bash
  cd /var/www/plc-sim/polo
  cp env.production.example .env.production
  nano .env.production   # 确认 VITE_APP_API_BASE 等
  ```
- 后端 API Key 仍在服务器上配置，不要提交到 Git：
  ```bash
  cp /var/www/plc-sim/polo/backend/.env.example /var/www/plc-sim/polo/backend/.env
  nano /var/www/plc-sim/polo/backend/.env
  ```

### 4. 推送触发部署

对 `main` 分支执行 push 后，到仓库 **Actions** 页查看 “Deploy to PLC-Sim Server” 是否成功。成功后访问 https://www.plc-sim.com 验证。

---

## 三、使用服务器本机脚本

### 1. 首次在服务器上克隆并执行

```bash
sudo mkdir -p /var/www/plc-sim
sudo chown $USER:$USER /var/www/plc-sim
git clone https://github.com/lijunhuang79-sudo/polo.git /var/www/plc-sim/polo
cd /var/www/plc-sim/polo
chmod +x deploy/scripts/deploy-polo.sh
./deploy/scripts/deploy-polo.sh
```

### 2. 配置前端/后端环境（同上）

- 前端：`/var/www/plc-sim/polo/.env.production`（可从 `env.production.example` 复制）
- 后端：`/var/www/plc-sim/polo/backend/.env`（从 `.env.example` 复制并填写 API Key）

### 3. 定时同步（可选）

```bash
crontab -e
# 例如每天 2 点拉取并部署
0 2 * * * /var/www/plc-sim/polo/deploy/scripts/deploy-polo.sh >> /var/log/plc-polo-deploy.log 2>&1
```

或每次需要更新时手动执行：

```bash
/var/www/plc-sim/polo/deploy/scripts/deploy-polo.sh
```

---

## 四、Nginx 配置

当前部署脚本把前端构建产物发布到 **`/var/www/plc-sim/polo/frontend`**。Nginx 的站点 root 需指向该目录，例如：

```nginx
server {
    server_name www.plc-sim.com;
    root /var/www/plc-sim/polo/frontend;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
    # ... 其他配置（auth_basic、/api 代理等）同现有 plc-sim.conf
}
```

若你当前使用的是 `/var/www/plc-sim/frontend`，请改为上述 `root`，或修改脚本中的 `FRONTEND_WWW` 与 Nginx 一致后重载 Nginx：

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 五、验证清单

- [ ] GitHub 仓库 **Actions** 中 “Deploy to PLC-Sim Server” 对 `main` 的 push 成功
- [ ] 服务器上 `ls /var/www/plc-sim/polo/frontend` 有 `index.html` 和 `assets/`
- [ ] https://www.plc-sim.com 可访问且为最新内容
- [ ] https://api.plc-sim.com/health 返回 `{"ok":true,"service":"plc-sim-api"}`（若已配置后端与 Nginx）

---

## 六、信息汇总

| 项目 | 值 |
|------|-----|
| 名字 | PoloHuang |
| 邮箱 | lijunlhuang79@gmail.com |
| 仓库 | https://github.com/lijunhuang79-sudo/polo.git |
| 分支 | main |
| 服务器前端目录 | /var/www/plc-sim/polo/frontend |
| 服务器仓库根目录 | /var/www/plc-sim/polo |
| 后端 pm2 进程名 | plc-sim-api |
