# PLC-SIM 全栈应用 — 配置文件备份与恢复 SOP

**文档版本**：1.0  
**适用环境**：Ubuntu 云服务器，Nginx + Node.js(pm2)，域名 plc-sim.com / www.plc-sim.com / api.plc-sim.com  
**最后更新**：按实际修订日期填写  

---

## 1. 目的与范围

### 1.1 目的

- 对当前服务器上 PLC-SIM 应用相关的**所有配置文件与关键目录**进行定期、可校验的完整备份。
- 在配置误改、证书过期、迁移或故障时，能按标准流程**安全恢复**并可选**回滚**。

### 1.2 范围

| 类别 | 路径 | 说明 |
|------|------|------|
| Nginx 配置 | `/etc/nginx/nginx.conf` | 主配置 |
| | `/etc/nginx/sites-available/plc-sim.conf` | 站点配置（含 HTTP/HTTPS、SPA、API 反向代理、Basic Auth） |
| | `/etc/nginx/sites-enabled/plc-sim.conf` | 软链接 |
| | `/etc/nginx/.plc-sim-auth` | Basic Auth 密码文件 |
| SSL 证书与配置 | `/etc/letsencrypt/live/plc-sim.com/` | 证书文件 |
| | `/etc/letsencrypt/options-ssl-nginx.conf` | SSL 选项 |
| | `/etc/letsencrypt/ssl-dhparams.pem` | DH 参数 |
| 前端部署 | `/var/www/plc-sim/polo/frontend` | Nginx 静态根目录（构建产物，与 deploy.yml 一致） |
| 后端代码与配置 | `/var/www/plc-sim/polo/backend` | 后端代码目录 |
| | `/var/www/plc-sim/polo/backend/.env` | 后端环境变量（PORT、CORS、API Key 等） |

**不包含**：数据库数据、pm2 进程列表（需另用 `pm2 save` 与数据备份流程）。

---

## 2. 前置条件

- 具备 `sudo` 权限的 SSH 登录账号。
- 备份目标目录可写：建议使用 `/backup/app-configs`，并保证磁盘空间充足。
- 已确认上述路径在服务器上存在（首次执行前可逐条 `ls` 核对）。

---

## 3. 路径与环境速查

| 变量/用途 | 值 |
|-----------|-----|
| 仓库根目录 | `/var/www/plc-sim/polo` |
| 后端目录 | `/var/www/plc-sim/polo/backend` |
| 后端 .env | `/var/www/plc-sim/polo/backend/.env` |
| 前端部署目录 | `/var/www/plc-sim/polo/frontend` |
| 备份根目录 | `/backup/app-configs` |
| 备份子目录 | `/backup/app-configs/plc-sim` |
| 备份脚本 | `/usr/local/sbin/backup_plc_sim_configs.sh` |

---

## 4. 备份脚本内容

以下脚本为**唯一标准版本**，路径已按当前部署固定，请勿随意修改路径变量。

**脚本路径**：`/usr/local/sbin/backup_plc_sim_configs.sh`

```bash
#!/usr/bin/env bash
# PLC-SIM 全栈应用 — 配置文件与关键目录备份脚本（SOP 标准版）
set -euo pipefail

APP_NAME="plc-sim"
BACKUP_ROOT="/backup/app-configs"

REPO_ROOT="/var/www/plc-sim/polo"
BACKEND_DIR="${REPO_ROOT}/backend"
BACKEND_ENV_FILE="${BACKEND_DIR}/.env"
FRONTEND_DEPLOY_DIR="${REPO_ROOT}/frontend"

TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_DIR="${BACKUP_ROOT}/${APP_NAME}"
BACKUP_FILE="${BACKUP_DIR}/${TIMESTAMP}_full.tar.gz"

mkdir -p "${BACKUP_DIR}"

CONFIG_PATHS=(
  "/etc/nginx/nginx.conf"
  "/etc/nginx/sites-available/plc-sim.conf"
  "/etc/nginx/sites-enabled/plc-sim.conf"
  "/etc/nginx/.plc-sim-auth"
  "/etc/letsencrypt/live/plc-sim.com"
  "/etc/letsencrypt/options-ssl-nginx.conf"
  "/etc/letsencrypt/ssl-dhparams.pem"
  "${FRONTEND_DEPLOY_DIR}"
  "${BACKEND_DIR}"
  "${BACKEND_ENV_FILE}"
)

INCLUDE_ARGS=()
for p in "${CONFIG_PATHS[@]}"; do
  if [ -e "$p" ]; then
    INCLUDE_ARGS+=("$p")
  else
    echo "WARN: path not found, skip: $p" >&2
  fi
done

if [ "${#INCLUDE_ARGS[@]}" -eq 0 ]; then
  echo "ERROR: no valid paths to backup" >&2
  exit 1
fi

tar -czpf "${BACKUP_FILE}" "${INCLUDE_ARGS[@]}"

(
  cd "${BACKUP_DIR}"
  sha256sum "$(basename "${BACKUP_FILE}")" > "$(basename "${BACKUP_FILE}").sha256"
)

echo "Backup created: ${BACKUP_FILE}"
```

---

## 5. 标准操作流程

### 5.1 首次安装备份脚本

| 步骤 | 操作 | 说明 |
|------|------|------|
| 1 | `sudo mkdir -p /backup/app-configs` | 创建备份根目录 |
| 2 | `sudo chown "$USER":"$USER" /backup/app-configs` | 可选：便于非 root 查看备份列表 |
| 3 | 将 **第 4 节** 脚本内容保存为 `/usr/local/sbin/backup_plc_sim_configs.sh` | 可用 `sudo nano` 或从本机 `scp` 上传 |
| 4 | `sudo chmod +x /usr/local/sbin/backup_plc_sim_configs.sh` | 赋予执行权限 |
| 5 | `sudo /usr/local/sbin/backup_plc_sim_configs.sh` | 执行一次，确认无报错且生成 `.tar.gz` 与 `.sha256` |

**验收**：`ls /backup/app-configs/plc-sim/` 中应出现 `YYYY-MM-DD_HH-MM-SS_full.tar.gz` 及同名的 `.sha256` 文件。

---

### 5.2 日常/定期手动备份

| 步骤 | 操作 |
|------|------|
| 1 | SSH 登录服务器 |
| 2 | 执行：`sudo /usr/local/sbin/backup_plc_sim_configs.sh` |
| 3 | 确认终端输出为 `Backup created: /backup/app-configs/plc-sim/YYYY-MM-DD_HH-MM-SS_full.tar.gz` |

建议在以下时机额外执行一次：修改 Nginx 配置、更换证书、修改 `.env`、大版本发布前。

---

### 5.3 配置定时自动备份（可选）

| 步骤 | 操作 |
|------|------|
| 1 | `sudo crontab -e` |
| 2 | 添加一行（每天 03:00 执行）：<br>`0 3 * * * /usr/local/sbin/backup_plc_sim_configs.sh >> /var/log/backup_plc_sim_configs.log 2>&1` |
| 3 | 保存退出 |

**验收**：次日检查 `/backup/app-configs/plc-sim/` 是否有新时间戳的备份，并查看 `/var/log/backup_plc_sim_configs.log` 无报错。

---

### 5.4 备份完整性校验

每次取用备份前，或定期抽检时，按以下步骤校验。

| 步骤 | 操作 |
|------|------|
| 1 | `cd /backup/app-configs/plc-sim` |
| 2 | 确定要校验的备份包文件名，例如：`2026-03-10_12-00-00_full.tar.gz` |
| 3 | 执行：`sha256sum -c ./2026-03-10_12-00-00_full.tar.gz.sha256`（替换为实际文件名） |
| 4 | 确认输出为该文件名 + `OK` |

若校验失败，不得用该包做恢复，应换用其他时间点备份或重新备份。

---

## 6. 恢复流程

### 6.1 恢复演练（不覆盖现网，仅验证备份内容）

用于确认某份备份包内容完整、结构正确，**不会修改当前运行中的配置**。

| 步骤 | 操作 |
|------|------|
| 1 | `BACKUP_DIR="/backup/app-configs/plc-sim"` |
| 2 | `RESTORE_FILE="YYYY-MM-DD_HH-MM-SS_full.tar.gz"`（替换为实际要演练的备份文件名） |
| 3 | `RESTORE_TEST_DIR="$HOME/plc-sim-restore-test"` |
| 4 | `mkdir -p "${RESTORE_TEST_DIR}"` |
| 5 | `sudo tar -xzpf "${BACKUP_DIR}/${RESTORE_FILE}" -C "${RESTORE_TEST_DIR}"` |
| 6 | `ls -R "${RESTORE_TEST_DIR}"`，检查是否有 `etc/nginx`、`etc/letsencrypt`、`var/www/plc-sim` 等目录及文件 |
| 7 | 演练结束后可删除：`rm -rf "${RESTORE_TEST_DIR}"` |

---

### 6.2 正式恢复（覆盖现网配置）

仅在需要将系统配置回退或迁移到某份备份时执行。**执行前必须完成 6.2.1 回滚点备份**。

#### 6.2.1 回滚点备份（必须）

在解压目标备份覆盖系统前，先对**当前**配置做一次快照，便于恢复失败时回滚。

```bash
ROLLBACK_DIR="/backup/app-configs-rollback/plc-sim_before_restore_$(date +"%Y-%m-%d_%H-%M-%S")"
sudo mkdir -p "${ROLLBACK_DIR}"
sudo cp -a /etc/nginx "${ROLLBACK_DIR}/"
sudo cp -a /etc/letsencrypt "${ROLLBACK_DIR}/"
sudo cp -a /var/www/plc-sim "${ROLLBACK_DIR}/"
```

记录本步骤生成的 `ROLLBACK_DIR` 路径，回滚时要用。

#### 6.2.2 执行恢复

| 步骤 | 操作 |
|------|------|
| 1 | 确认已完成 **6.2.1**，并已记录回滚点目录路径 |
| 2 | `BACKUP_DIR="/backup/app-configs/plc-sim"` |
| 3 | `RESTORE_FILE="YYYY-MM-DD_HH-MM-SS_full.tar.gz"`（替换为要恢复的备份文件名） |
| 4 | `cd "${BACKUP_DIR}"` |
| 5 | `sha256sum -c ./${RESTORE_FILE}.sha256`，确认 OK |
| 6 | `sudo tar -xzpf "${RESTORE_FILE}" -C /` |
| 7 | `sudo nginx -t`，确认 Nginx 配置语法正确 |
| 8 | `sudo systemctl reload nginx` |
| 9 | `pm2 restart plc-sim-api`（或当前使用的 pm2 进程名） |
| 10 | 浏览器访问 https://www.plc-sim.com 与 https://api.plc-sim.com，验证访问与 Basic Auth、API 是否正常 |

---

### 6.3 回滚（恢复失败时）

当 6.2 执行后出现异常，需要撤回到“恢复前状态”时使用。

| 步骤 | 操作 |
|------|------|
| 1 | 使用 **6.2.1** 中记录的回滚点目录，例如：<br>`ROLLBACK_DIR="/backup/app-configs-rollback/plc-sim_before_restore_2026-03-10_14-00-00"` |
| 2 | `sudo cp -a "${ROLLBACK_DIR}/nginx/"* /etc/nginx/`（或按实际结构恢复 nginx 子目录） |
| 3 | `sudo cp -a "${ROLLBACK_DIR}/letsencrypt/"* /etc/letsencrypt/`（同上，按实际结构） |
| 4 | `sudo cp -a "${ROLLBACK_DIR}/plc-sim/"* /var/www/plc-sim/` |
| 5 | `sudo nginx -t && sudo systemctl reload nginx` |
| 6 | `pm2 restart plc-sim-api` |
| 7 | 再次验证站点与 API |

若回滚点目录结构与 `/etc`、`/var/www` 不一致，可用 `sudo tar -czf rollback.tar.gz -C "${ROLLBACK_DIR}" .` 再 `sudo tar -xzf rollback.tar.gz -C /` 等方式按需调整。

---

## 7. 安全与保管要求

- 备份包内含 `/var/www/plc-sim/polo/backend/.env`，其中有 **DEEPSEEK_API_KEY、GEMINI_API_KEY** 等敏感信息，须按敏感数据管理：
  - 备份目录权限建议仅 root 或指定运维账号可读：`sudo chmod 700 /backup/app-configs/plc-sim`。
  - 不得将未加密的备份包上传至公网或不可信存储。
- 若需将备份拷贝至其他机器，应通过 **scp/rsync over SSH** 或加密后传输；长期归档建议对 tar 包做加密（如 GPG）。
- 定时任务日志 `/var/log/backup_plc_sim_configs.log` 可能包含路径信息，权限建议设为 `600` 且仅 root 可读。

---

## 8. 变更与路径调整

若服务器上路径变更（如仓库改为 `/opt/plc-sim/polo`、前端部署目录变更），须同步修改：

1. **本 SOP 第 1.2、第 3 节** 的路径表。
2. **第 4 节** 脚本中的 `REPO_ROOT`、`BACKEND_DIR`、`BACKEND_ENV_FILE`、`FRONTEND_DEPLOY_DIR` 以及 `CONFIG_PATHS` 中的对应项。
3. **第 6.2.1、6.3 节** 中的回滚/恢复路径（若有引用具体路径）。

修改后应重新部署脚本并做一次完整备份与恢复演练，并更新本文档版本号与“最后更新”日期。

---

## 9. 附录：快速命令一览

```bash
# 执行备份
sudo /usr/local/sbin/backup_plc_sim_configs.sh

# 校验指定备份（替换日期时间）
cd /backup/app-configs/plc-sim && sha256sum -c ./YYYY-MM-DD_HH-MM-SS_full.tar.gz.sha256

# 恢复演练（不覆盖现网）
sudo tar -xzpf /backup/app-configs/plc-sim/YYYY-MM-DD_HH-MM-SS_full.tar.gz -C "$HOME/plc-sim-restore-test"

# 正式恢复前回滚点备份
ROLLBACK_DIR="/backup/app-configs-rollback/plc-sim_before_restore_$(date +"%Y-%m-%d_%H-%M-%S")"
sudo mkdir -p "${ROLLBACK_DIR}" && sudo cp -a /etc/nginx /etc/letsencrypt /var/www/plc-sim "${ROLLBACK_DIR}/"

# 正式恢复（替换备份文件名后执行）
cd /backup/app-configs/plc-sim && sudo tar -xzpf YYYY-MM-DD_HH-MM-SS_full.tar.gz -C /
sudo nginx -t && sudo systemctl reload nginx && pm2 restart plc-sim-api
```

---

**文档结束**
