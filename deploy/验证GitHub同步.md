# GitHub 同步前端/后端 — 验证清单

用于确认「GitHub 同步脚本」已正确部署并生效。

---

## 一、先确认同步方式

常见两种方式，请对号入座：

| 方式 | 说明 | 验证重点 |
|------|------|----------|
| **A. GitHub Actions** | 仓库 `.github/workflows/*.yml`，push 后自动构建并部署到服务器 | 看 Actions 是否绿、日志里是否部署成功 |
| **B. 服务器拉取** | 服务器上 cron / webhook 定时或触发 `git pull` + 构建 + 重启 | 看服务器上脚本日志、文件时间、进程 |

---

## 二、验证步骤（通用）

### 1. 前端是否已更新

- 浏览器访问：**https://www.plc-sim.com**（或 http，需 Basic Auth）。
- 看页面是否正常、无白屏。
- （可选）在页脚或控制台看是否有版本/构建时间（若你有写）：确认是否为最近一次发布。

### 2. 后端是否存活

在浏览器或本机执行：

```bash
curl -u admin:你的密码 https://api.plc-sim.com/health
```

或在浏览器打开（会提示输入 Basic Auth）：

- **https://api.plc-sim.com/health**

期望返回类似：

```json
{"ok":true,"service":"plc-sim-api"}
```

### 3. 服务器上文件是否最新（SSH 登录 213.111.157.18）

```bash
# 前端静态文件修改时间（应为最近同步时间）
ls -la /var/www/plc-sim/frontend/

# 后端目录（若同步的是 backend 或整仓）
ls -la /var/www/plc-sim/backend/
```

若同步脚本会做 `git pull`，可再看仓库时间：

```bash
# 若代码在 /var/www/plc-sim/repo 或类似路径
cd /var/www/plc-sim   # 或你的仓库根目录
git log -1 --oneline
git status
```

### 4. 后端进程是否在跑

```bash
pm2 list
# 或
pm2 show plc-sim-api
```

确认 `plc-sim-api` 状态为 **online**，重启次数与最近部署时间合理。

### 5. 做一次「改代码 → 推送 → 看线上是否更新」

1. 在仓库改一小处（例如页脚文字或 `package.json` 里一个注释）。
2. 推送到 GitHub（你配置同步的分支）。
3. 等 1～5 分钟（视脚本间隔而定）。
4. 刷新 https://www.plc-sim.com，或再次查 `/health`、服务器上 `ls -la` / `git log -1`。

若前端/后端或服务器上的代码/文件都变成刚才的修改，说明同步链路是通的。

---

## 三、若使用 GitHub Actions

1. 打开仓库 **Actions** 页，看最近一次 workflow 是否 **成功**（绿色勾）。
2. 点进该次 run，看日志里是否包含：
   - 构建前端（如 `npm run build`）
   - 部署到 213.111.157.18（如 scp/rsync 到 `/var/www/plc-sim/frontend`）
   - 部署/重启后端（如 ssh 执行 `pm2 restart plc-sim-api`）
3. 若失败，看报错步骤（例如 SSH 权限、密钥、路径、命令不存在等）。

---

## 四、若使用服务器本机脚本（cron / webhook）

1. **Cron**：`crontab -l` 看是否有拉代码、构建、重启的命令。
2. **Webhook**：在 GitHub 仓库 Settings → Webhooks 看是否有指向你服务器的 URL；可对仓库 push 一次，在 Webhook 的「Recent Deliveries」里看是否 200、脚本是否被触发。
3. 到脚本里写的日志目录（如 `/var/log/plc-sim-sync.log`）看最近是否有成功记录、有无报错。

---

## 五、快速一条龙检查（本机执行）

需要本机已装 `curl`，且能访问 api.plc-sim.com（若启用了 Basic Auth，下面会提示输入账号密码）：

```bash
# 健康检查（把 admin:密码 换成你的 Basic Auth）
curl -s -u admin:你的密码 https://api.plc-sim.com/health

# 若未开 Auth，直接：
# curl -s https://api.plc-sim.com/health
```

返回 `{"ok":true,...}` 即说明后端在线；再在浏览器打开 www.plc-sim.com 看前端即可。

---

## 六、常见问题

| 现象 | 可能原因 | 建议 |
|------|----------|------|
| /health 404 或连不上 | Nginx 未转发、后端未起、防火墙 | 检查 Nginx 配置、pm2、ufw |
| 前端白屏 | 构建失败或未部署最新 dist | 看构建日志、服务器上 dist 是否更新 |
| 推送后线上没变 | 同步未触发或失败、分支不对 | 看 Actions 或服务器脚本日志、确认分支 |
| Basic Auth 弹窗失败 | 用户名/密码或路径错误 | 核对 Nginx `auth_basic_user_file`、htpasswd 文件 |

---

验证通过标准建议：

- [ ] https://www.plc-sim.com 可访问且页面正常  
- [ ] https://api.plc-sim.com/health 返回 `{"ok":true,"service":"plc-sim-api"}`  
- [ ] 服务器上前端/后端文件时间为最近同步时间  
- [ ] 做一次小改并 push 后，线上在预期时间内更新  

若你愿意提供同步脚本所在位置（例如「在服务器某路径」或「在另一个 repo 的 Actions」），可以再根据实际脚本写一份更贴合的验证步骤。
