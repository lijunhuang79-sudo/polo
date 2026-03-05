# GitHub Actions 自动部署 — 配置步骤

推送代码到 `main` 分支后，由 **GitHub** 自动在**服务器**上拉代码、构建、发布。配置只需做一次：**在 GitHub 添加一个密钥** + **在服务器做一次环境准备**。

---

## 一、整体说明

- **自动部署不是在“服务器上布置”**，而是：
  - **GitHub Actions**（在 GitHub 云端）在每次 push 到 `main` 时触发；
  - 用 SSH 连到**你的服务器**，在服务器上执行：拉代码 → `npm ci` → `npm run build` → 把 `dist/` 同步到网站目录，并可选重启后端。
- 因此需要两处配合：
  1. **GitHub 仓库**：配置一个 Secret（服务器的 SSH 私钥），让 Actions 能 SSH 到你的服务器。
  2. **服务器**：装好 Node、准备好目录（首次可先克隆仓库或等 Actions 自动克隆）、Nginx 指向前端目录、需要的话装 pm2。

---

## 二、在 GitHub 上（只需做一次）

### 1. 打开仓库的 Actions 密钥页

- 打开：**https://github.com/lijunhuang79-sudo/polo/settings/secrets/actions**
- 若仓库名或用户名不同，请换成你的：`https://github.com/你的用户名/你的仓库名/settings/secrets/actions`

### 2. 添加以下 Secrets（名称必须一致）

| Name | 说明 | 示例 |
|------|------|------|
| **DEPLOY_SSH_KEY** | 服务器 SSH 私钥完整内容（必填） | 见下方「在服务器上生成密钥」 |
| **SSH_HOST** | 部署目标主机（必填） | `plc-sim.com` 或 `213.111.157.18` |
| **SSH_USERNAME** | SSH 登录用户名（必填） | `root` |
| **SSH_PORT** | SSH 端口（可选，不填则 22） | `22` |

- 点击 **New repository secret**，逐个添加上述 Name 和 Value。

---

## 三、在服务器上（只需做一次）

### 1. 登录服务器

```bash
ssh root@213.111.157.18
```

（若你的服务器 IP 不是 213.111.157.18，请替换；部署脚本里的 IP 也要改成你的，见文末。）

### 2. 生成一对专用于部署的 SSH 密钥（若还没有）

在服务器上执行：

```bash
sudo -u root ssh-keygen -t ed25519 -C "polo-deploy" -f /root/.ssh/deploy_polo -N ""
```

- `-N ""` 表示无密码，方便 GitHub Actions 使用。
- 然后把**公钥**放进 root 的授权列表，这样用这把私钥就能以 root 登录本机：

```bash
cat /root/.ssh/deploy_polo.pub >> /root/.ssh/authorized_keys
```

### 3. 复制私钥内容到 GitHub

在服务器上执行：

```bash
sudo cat /root/.ssh/deploy_polo
```

- 会输出一整段（含 `-----BEGIN OPENSSH PRIVATE KEY-----` 和 `-----END OPENSSH PRIVATE KEY-----`）。
- **整段复制**，粘贴到 GitHub Secret **DEPLOY_SSH_KEY** 的 Value 里，保存。并确保已添加 **SSH_HOST**（如 `plc-sim.com`）、**SSH_USERNAME**（如 `root`），可选 **SSH_PORT**（如 `22`）。

### 4. 安装 Node.js 18+（若未安装）

例如 Ubuntu/Debian：

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # 应 >= 18
```

### 5. 准备目录（二选一）

**方式 A：让 GitHub Actions 首次自动克隆**

- 只需保证目录存在且 root 可写。若 `/var/www/plc-sim/polo` 不存在，可先建父目录：

```bash
sudo mkdir -p /var/www/plc-sim
sudo chown root:root /var/www/plc-sim
```

- 第一次 push 触发 Actions 时，脚本里会执行 `git clone` 到 `/var/www/plc-sim/polo`。

**方式 B：你先在服务器上克隆一次**

```bash
sudo mkdir -p /var/www/plc-sim
sudo chown $USER:$USER /var/www/plc-sim
git clone https://github.com/lijunhuang79-sudo/polo.git /var/www/plc-sim/polo
```

- 之后 Actions 只会 `git fetch` + `git reset --hard`，不再克隆。

### 6. Nginx 指向前端目录

让 **www.plc-sim.com** 的 root 指向 `/var/www/plc-sim/polo/frontend`（构建产物会同步到这里）。例如用仓库里的配置：

```bash
sudo cp /var/www/plc-sim/polo/deploy/nginx/plc-sim-polo.conf /etc/nginx/sites-available/plc-sim.conf
sudo ln -sf /etc/nginx/sites-available/plc-sim.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 7. （可选）后端用 pm2

若需要自动重启后端，在服务器安装 pm2：

```bash
sudo npm install -g pm2
```

- 部署脚本会在 `backend` 目录执行 `pm2 restart plc-sim-api` 或首次 `pm2 start`。

---

## 四、验证自动部署

1. **方式 A：推送触发**
   - 在本机改一点代码，提交并推送到 `main`：
     ```bash
     git add .
     git commit -m "触发自动部署"
     git push origin main
     ```
2. **方式 B：手动运行一次（推荐先做）**
   - 打开 **https://github.com/lijunhuang79-sudo/polo/actions**
   - 左侧选择 **Deploy via SSH (plc-sim.com)**
   - 点击 **Run workflow**，选分支 `main`，再点 **Run workflow**
   - 看「SSH 到服务器并执行部署」步骤：
     - **成功**：说明 Secret 与服务器已配置正确，Actions 能 SSH 到目标并执行部署。
     - **失败**：`Secret ... is not set` → 检查是否已添加 DEPLOY_SSH_KEY、SSH_HOST、SSH_USERNAME；`Permission denied (publickey)` → 检查服务器 `~/.ssh/authorized_keys` 与 SSH_USERNAME 是否一致。
3. 访问 **https://www.plc-sim.com**，确认已是新版本（可硬刷新或无痕查看）。

---

## 五、若服务器 IP 或用户不是默认的

当前脚本里写的是：

- 主机：`213.111.157.18`
- 用户：`root`

若你的服务器不同，请改仓库里的 `.github/workflows/deploy.yml`：

```yaml
env:
  DEPLOY_HOST: 你的服务器IP
  DEPLOY_USER: 你的SSH用户名
```

- 同时，上面「在服务器上」的 SSH 密钥要用**该用户**生成并放入该用户的 `~/.ssh/authorized_keys`，然后把**该用户对应的私钥**填到 GitHub 的 `DEPLOY_SSH_KEY`。

---

## 六、小结

| 位置     | 做什么 |
|----------|--------|
| **GitHub** | 在 Settings → Secrets and variables → Actions 里添加：**DEPLOY_SSH_KEY**（服务器 SSH 私钥）、**SSH_HOST**（如 plc-sim.com）、**SSH_USERNAME**（如 root），可选 **SSH_PORT**（如 22）。 |
| **服务器** | 生成部署用 SSH 密钥、装 Node、准备 `/var/www/plc-sim/polo`（或让 Actions 首次克隆）、Nginx 指向 `.../frontend`、可选 pm2。 |
| **之后**   | 每次 `git push origin main` 都会自动部署；也可在 Actions 页选择 **Deploy via SSH (plc-sim.com)** → **Run workflow** 手动跑一次。 |

配置完成后，**自动部署不需要在服务器上“布置”别的东西**，只要 GitHub 上有 `DEPLOY_SSH_KEY`，服务器环境按上面准备好即可。
