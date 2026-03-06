# GitHub Actions 部署失败 — 排查步骤

当 Actions 里 **Deploy via SSH (plc-sim.com)** 显示 Failure 时，按下面步骤查原因并处理。

---

## 第一步：看到具体报错

1. 打开该次运行的 **Summary** 页（你当前看到的失败页）。
2. 在左侧 **All jobs** 下点击 **deploy**（或中间「deploy」卡片），进入该 job 的日志。
3. 展开失败的那一步（一般是 **SSH 到服务器并执行部署**），看红色报错内容。

下面按**常见报错**对照处理。

---

## 第二步：按报错内容处理

### 1. `Secret DEPLOY_SSH_KEY is not set`（或 SSH_HOST、SSH_USERNAME）

**原因**：仓库里没配置对应 Secret。

**处理**：

- 打开 **Settings → Secrets and variables → Actions**。
- 确认存在且名称完全一致（区分大小写）：
  - **DEPLOY_SSH_KEY** — 服务器 SSH 私钥全文
  - **SSH_HOST** — 如 `plc-sim.com` 或 `213.111.157.18`
  - **SSH_USERNAME** — 如 `root`
- 缺哪个就 **New repository secret** 补哪个，改完后可 **Re-run jobs** 再跑一次。

---

### 2. `Permission denied (publickey)` 或 `Authentication failed`

**原因**：SSH 认证失败，常见是私钥不对或服务器上没有对应公钥。

**处理**：

1. 在**服务器**上确认部署用公钥已在对应用户的 `authorized_keys` 里：
   ```bash
   # 以你用的用户名登录服务器后
   cat ~/.ssh/authorized_keys
   # 应能看到 deploy_polo 对应的公钥（或你用来填 DEPLOY_SSH_KEY 的那把私钥对应的公钥）
   ```
2. 若用 root，且密钥是 `/root/.ssh/deploy_polo`，则应有：
   ```bash
   sudo cat /root/.ssh/deploy_polo.pub >> /root/.ssh/authorized_keys
   ```
3. 确认 **DEPLOY_SSH_KEY** 填的是**私钥**完整内容（含 `-----BEGIN ... KEY-----` 和 `-----END ... KEY-----`），且 **SSH_USERNAME** 与 `authorized_keys` 所在用户一致（例如都是 root）。

---

### 3. `Connection refused`、`Connection timed out`、`Could not resolve host`

**原因**：连不上服务器或端口不对。

**处理**：

- **SSH_HOST**：填能访问到的地址。若 `plc-sim.com` 解析不到或不通，可改为服务器 IP（如 `213.111.157.18`）。
- **SSH_PORT**：若 SSH 不用 22，在 Secrets 里加 **SSH_PORT**，值为端口号（如 `22`）。
- 在**本机**测试能否 SSH 登录：
  ```bash
  ssh -p 22 root@plc-sim.com
  # 或
  ssh -p 22 root@213.111.157.18
  ```
- 若服务器有防火墙，需放行 22（或你用的端口）；云主机安全组也要放行该端口。

---

### 4. 已连上 SSH，但脚本里报错（如 `npm: command not found`、`git not found`）

**原因**：服务器上没装 Node/npm 或 git，或 PATH 不对。

**处理**：

- SSH 登录服务器，执行：
  ```bash
  node -v
  npm -v
  git --version
  ```
- 若没有，安装 Node 18+ 和 git（如 Ubuntu/Debian）：
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs git
  ```

---

### 5. `fatal: not a git repository`、`Permission denied` 写目录

**原因**：`/var/www/plc-sim/polo` 不存在或当前用户没权限。

**处理**：

- 在服务器上：
  ```bash
  sudo mkdir -p /var/www/plc-sim
  sudo chown -R root:root /var/www/plc-sim   # 若 SSH_USERNAME 是 root
  ```
- 若首次部署，可先手动克隆一次（用对应用户）：
  ```bash
  git clone https://github.com/lijunhuang79-sudo/polo.git /var/www/plc-sim/polo
  ```
  再 **Re-run jobs**。

---

### 6. `npm ci` 或 `npm run build` 失败

**原因**：依赖或构建错误（网络、Node 版本、脚本错误等）。

**处理**：

- 在日志里看 **具体哪一行**报错（例如某个包 404、ESLint 报错等）。
- SSH 上服务器，进目录本地跑一遍：
  ```bash
  cd /var/www/plc-sim/polo
  npm ci
  npm run build
  ```
  根据报错修项目或服务器环境后，再 **Re-run jobs**。

---

## 第三步：改完后重跑

- 在失败这次运行的 **Summary** 页右上角点 **Re-run jobs** → **Re-run all jobs**，看是否通过。
- 若仍失败，再次点进 **deploy** → 失败步骤，把**新的**报错内容对照上面几条排查。

---

## 小结

| 报错大致内容           | 优先检查 |
|------------------------|----------|
| Secret ... is not set  | GitHub Settings → Actions Secrets 补全 DEPLOY_SSH_KEY、SSH_HOST、SSH_USERNAME |
| Permission denied      | 服务器 `~/.ssh/authorized_keys`、私钥与 SSH_USERNAME 是否一致 |
| Connection refused/超时 | SSH_HOST、SSH_PORT、防火墙/安全组、本机能否 ssh 登录 |
| command not found      | 服务器安装 node、npm、git |
| 非 SSH 的脚本报错       | 进服务器同目录执行相同命令，按报错修 |

把失败步骤里的**完整红色报错**复制下来，按关键字对上表或上面小节即可快速定位。
