# Failed to fetch 六步排查 — 执行报告

> 本文档为按《本地与服务器API-Key说明及Failed-fetch排查》四、排查详细步骤逐项执行后的记录与结论。  
> **构建详细步骤**见：`docs/PLC-SIM 全栈项目部署总结汇报.txt`。

---

## 步骤 1：确认前端构建时使用的 API 地址 ✅ 已在本机核查

### 本机检查结果

| 检查项 | 结果 |
|--------|------|
| 项目根目录是否存在 `.env.production` | **否**（仅存在 `env.production.example`，未发现已提交的 `.env.production`） |
| 构建时实际使用的 API 根地址 | 若**未**在构建前将示例复制为 `.env.production` 并配置，则前端代码默认使用 **`https://api.plc-sim.com`**（见 `src/services/backendAi.ts` 第 10 行） |
| `env.production.example` 内容 | `VITE_APP_USE_BACKEND_AI=true`，`VITE_APP_API_BASE=https://api.plc-sim.com` |

### 结论与建议

- **若你部署的是 plc-sim.com / api.plc-sim.com**：当前默认即指向 `https://api.plc-sim.com`，无需改。需确认服务器上**构建时**是否有 `.env.production`（或环境变量 `VITE_APP_API_BASE`），若在服务器上构建，请在服务器项目根目录检查：  
  `cat /var/www/plc-sim/polo/.env.production 2>/dev/null || echo "文件不存在"`
- **若你部署的是自建域名/自建服务器**：必须在**执行 build 的机器上**（本机或服务器）存在 `.env.production`，且其中 `VITE_APP_API_BASE` 为你实际的后端地址（如 `https://api.你的域名.com` 或 `http://服务器IP:3000`），然后重新执行 `npm run build` 并重新部署前端（参见《前端后端同步到服务器-完整步骤》）。

### 你需要做的（二选一）

1. **在服务器上构建时**：SSH 到服务器后执行  
   ```bash
   cat /var/www/plc-sim/polo/.env.production 2>/dev/null || echo "无 .env.production"
   ```  
   若无此文件，则当前构建使用的是默认 `https://api.plc-sim.com`。若你的后端就是 api.plc-sim.com，则本步通过；否则在服务器项目根目录创建 `.env.production`（参考 `env.production.example`），把 `VITE_APP_API_BASE` 改为实际后端地址，再重新执行部署流程中的 `npm run build` 与 rsync。
2. **在本机构建再上传时**：在本机项目根目录创建或修改 `.env.production`，确保 `VITE_APP_API_BASE` 为实际后端地址，再执行 `npm run build` 并上传 `dist` 内容。

---

## 步骤 2：在浏览器中确认实际请求的 URL 与状态 ⚠️ 需你在浏览器中执行

以下请你在**出现 Failed to fetch 的电脑**上操作，并把结果填到「你的记录」中。

### 操作清单

1. 用 Chrome 或 Edge 打开部署后的前端页面（如 `https://www.plc-sim.com` 或你的自建地址）。
2. 按 **F12** 打开开发者工具，切换到 **Network** 面板。
3. 勾选 **Preserve log**，点击清空按钮清空现有记录。
4. 在页面上触发一次 **AI 生成**（或「测试连接」）。
5. 在请求列表中找到发往后端的请求（URL 通常包含 `/api/ai/generate` 或 `/api/ai/test`），点击该请求。

### 请记录以下三项

| 项目 | 你的记录 |
|------|----------|
| **Request URL**（完整地址） | 例如：`https://api.plc-sim.com/api/ai/generate` 或其它？ |
| **Status** | 例如：`(failed)` / `200` / `503` / `CORS error` / `net::ERR_xxx`？ |
| **Response Headers** 中的 `Access-Control-Allow-Origin` | 有 / 无？若有多条，值是什么？当前页面地址栏的 Origin 是否与该值一致？ |

### 如何判断

- 若 **Request URL** 不是你的后端地址（例如你自建后端却显示 `https://api.plc-sim.com`）→ 回到步骤 1，修正 `VITE_APP_API_BASE` 并重新构建部署。
- 若 URL 正确但 **Status** 为 CORS 相关或控制台有 CORS 报错 → 进入步骤 3，检查后端 CORS。
- 若 **Status** 为网络错误（如 `net::ERR_CONNECTION_REFUSED`）→ 进入步骤 4，检查后端进程与端口。

---

## 步骤 3：检查后端 CORS 白名单 ✅ 已核查代码与示例

### 代码与配置核查结果

| 项目 | 结果 |
|------|------|
| 后端 CORS 逻辑 | `backend/server.js`：从环境变量 `CORS_ORIGINS` 读取白名单（逗号分隔），请求的 `Origin` 必须在列表中才会返回对应 `Access-Control-Allow-Origin` |
| 默认白名单（未设置 `CORS_ORIGINS` 时） | `https://www.plc-sim.com`, `https://plc-sim.com`, `http://localhost:5173`, `http://127.0.0.1:5173` |
| `backend/.env.example` 说明 | 已注明：前端从哪个地址打开页面，就把该来源（含协议与端口）写进 `CORS_ORIGINS`，否则易出现 Failed to fetch |

### 你需要做的（在服务器上）

1. SSH 登录到运行后端的服务器。
2. 进入后端目录并查看当前 CORS 配置，例如：  
   ```bash
   cd /var/www/plc-sim/polo/backend
   grep CORS .env 2>/dev/null || echo "未在 .env 中设置 CORS_ORIGINS"
   ```  
   若使用 pm2 注入环境，可再执行：  
   ```bash
   pm2 env plc-sim-api 2>/dev/null | grep CORS
   ```
3. 对比步骤 2 中你记录的**浏览器请求的 Origin**（在 Request Headers 里）：若该 Origin **不在** `CORS_ORIGINS` 列表中，则在 `backend/.env` 中添加或修改，例如：  
   ```bash
   CORS_ORIGINS=https://www.plc-sim.com,https://plc-sim.com,http://localhost:5173,http://127.0.0.1:5173,https://你的前端域名
   ```  
   保存后重启后端：  
   ```bash
   pm2 restart plc-sim-api
   ```

**结论**：只有当前页面所在 Origin 在 `CORS_ORIGINS` 中且已重启后端，CORS 才会通过。

---

## 步骤 4：确认后端进程与端口可达 ⚠️ 需在服务器上执行

以下命令请在**运行后端的服务器**上执行，并记录结果。

### 命令与预期结果

| 序号 | 命令 | 预期 / 说明 |
|------|------|--------------|
| 4.1 | `pm2 list` 或 `pm2 status` | 存在名为 `plc-sim-api` 的进程，状态为 `online` |
| 4.2 | `ss -tlnp \| grep 3000` 或 `netstat -tlnp \| grep 3000` | 3000 端口在监听 |
| 4.3 | `curl -s http://127.0.0.1:3000/health` | 返回 `{"ok":true,"service":"plc-sim-api"}` |
| 4.4 | `curl -s http://127.0.0.1:3000/api/health` | 同上 |
| 4.5 | `curl -s -o /dev/null -w "%{http_code}" https://api.plc-sim.com/health` | 若 API 通过 Nginx 暴露为该域名，应返回 `200` |

若 4.3/4.4 失败：说明本机都连不上后端，需检查 pm2 是否已启动、端口是否被占用、防火墙是否拦截本机 3000。  
若 4.3 成功但 4.5 失败：说明 Nginx 反代或 DNS 有问题，需检查 Nginx 配置与域名解析。

**一键执行（复制整段到服务器 Bash）：**

```bash
echo "=== pm2 ===" && pm2 list
echo "=== port 3000 ===" && (ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null) | grep 3000
echo "=== local health ===" && curl -s http://127.0.0.1:3000/health
echo "=== api.plc-sim.com health ===" && curl -s -o /dev/null -w "HTTP %{http_code}\n" https://api.plc-sim.com/health
```

---

## 步骤 5：确认后端已配置 API Key ✅ 已核查代码

### 代码核查结果

| 项目 | 结果 |
|------|------|
| 后端读取 Key 的方式 | `backend/server.js` 中 `getApiKey(model)` 从环境变量读取，不读请求体 |
| 模型与环境变量对应关系 | `deepseek` → `DEEPSEEK_API_KEY`；`gemini` → `GEMINI_API_KEY`；`codex` → `OPENAI_API_KEY` |
| 未配置时的表现 | 返回 503，body 中为 `API Key not configured for model: xxx` |

### 你需要做的（在服务器上）

在后端目录查看是否配置了对应模型的 Key（**不要**把 Key 贴到任何文档或聊天中）：

```bash
cd /var/www/plc-sim/polo/backend
for v in DEEPSEEK_API_KEY GEMINI_API_KEY OPENAI_API_KEY; do
  if grep -q "^${v}=" .env 2>/dev/null; then echo "$v 已设置"; else echo "$v 未设置"; fi
done
```

若你使用的模型对应项显示「未设置」，请在 `.env` 中补全并重启：`pm2 restart plc-sim-api`。

---

## 步骤 6：HTTPS 页面不要请求 HTTP 后端 ✅ 已核查逻辑

### 核查结果

- 前端 `backendAi.ts` 中 `API_BASE` 来自构建时环境变量 `VITE_APP_API_BASE`，或默认 `https://api.plc-sim.com`。
- 若前端页面是 **https** 打开，而 `VITE_APP_API_BASE` 配成 **http**（如 `http://某IP:3000`），浏览器可能因混合内容策略拦截请求，出现类似 Failed to fetch。
- **结论**：HTTPS 页面必须请求 HTTPS 的后端。若使用自建域名，应通过 Nginx 为 API 配置 HTTPS（与《PLC-SIM 全栈项目部署总结汇报》一致），并在 `.env.production` 中使用 `https://api.你的域名.com` 再构建。

---

## 汇总与下一步

| 步骤 | 本报告内状态 | 你需要做的 |
|------|----------------|------------|
| 1 | 已核查：无 .env.production 则默认 api.plc-sim.com | 在构建机确认或创建 `.env.production`，确保 `VITE_APP_API_BASE` 正确后重新 build 并部署 |
| 2 | 需你在浏览器操作 | 按「步骤 2」清单在浏览器中记录 Request URL、Status、CORS 头，并据此决定走步骤 3 或 4 |
| 3 | 已核查 CORS 逻辑与示例 | 在服务器上检查并补全 `CORS_ORIGINS`，重启 pm2 |
| 4 | 已给出命令 | 在服务器上执行步骤 4 的命令块，确认进程、端口、/health 均正常 |
| 5 | 已核查 getApiKey 与 503 行为 | 在服务器上用 for 循环检查三个 Key 是否已设置，缺则补全并重启 |
| 6 | 已说明混合内容 | 确保 HTTPS 页面对应 https 的 API_BASE，必要时改 .env.production 并重新构建 |

执行完步骤 2～4 后，若把「你的记录」和步骤 4 的命令输出贴出来，可以进一步精确定位问题。也可在服务器上运行 `deploy/scripts/check-backend-health.sh`（见下）做步骤 3～5 的快速自检。
