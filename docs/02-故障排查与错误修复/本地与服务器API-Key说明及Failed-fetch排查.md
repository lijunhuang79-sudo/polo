# 本地 vs 服务器 API Key 行为说明与「Failed to fetch」排查

**构建详细步骤**请参考：`docs/PLC-SIM 全栈项目部署总结汇报.txt`（含 Nginx、前端构建、后端 pm2、Basic Auth、证书等完整部署流程；前端 API 地址对应 `env.production.example` 中的 `VITE_APP_API_BASE`）。

---

## 一、为什么本地还要手动填 API Key，而网页登录服务器后直接用服务器端的 Key？

这是**按环境区分的刻意设计**：

| 环境 | `USE_BACKEND_AI` 行为 | 表现 |
|------|------------------------|------|
| **开发**（`npm run dev`） | 只有显式设置 `VITE_APP_USE_BACKEND_AI=true` 才为 true | 默认 **false** → 走「前端直连 AI」，需要自己填 API Key |
| **生产**（构建后的页面） | 只要不是显式设为 `false` 就为 true | 默认 **true** → 走「后端代理」，用服务器上的 Key，不显示 Key 输入框 |

所以：

- **本地开发**：默认用你自己的 Key（方便调试、不依赖服务器），所以界面会要求手动填 Key。
- **部署到服务器后打开的网页**：用的是生产构建，默认走后端 AI，所以直接调用服务器端配置的 Key，无需也不应在前端填 Key。

若希望**本地开发时也走服务器端 Key**（不填 Key），在项目根目录增加或修改 `.env.development`：

```env
VITE_APP_USE_BACKEND_AI=true
VITE_APP_API_BASE=http://localhost:3000
```

并确保本机已启动后端（如 `cd backend && node server.js`），且后端已配置好 `.env` 中的 Key。重启 `npm run dev` 后，本地页面也会使用后端 Key、不显示 Key 输入框。

---

## 二、「AI 请求失败：Failed to fetch」可能原因与排查

`Failed to fetch` 是浏览器在 **fetch 阶段就失败** 时的报错，通常是：**请求没发到正确地址**、**被 CORS 拦截**、**后端不可达**。按下面顺序排查。

### 1. 前端请求的地址不对（最常见）

- 前端使用的 API 根地址来自**构建时**的环境变量 `VITE_APP_API_BASE`，未设置时默认为 `https://api.plc-sim.com`。
- 若你把**前端**部署在自己服务器（如 `http://你的服务器`），而**后端**也在同一台机（如 `http://你的服务器:3000`），但构建时**没有**设置 `VITE_APP_API_BASE`，那浏览器会去请求 `https://api.plc-sim.com`，而不是你的后端 → 容易出现 Failed to fetch（或连不上、超时）。

**处理：**

- 构建前端时，让 `VITE_APP_API_BASE` 指向你**实际的后端地址**，例如：
  - 后端在同一台机：`http://你的服务器IP或域名:3000`
  - 或通过 Nginx 反代：`https://你的域名`（后端在 `/api` 时，根地址就填 `https://你的域名`）
- 示例（构建前复制或修改 `.env.production`）：

```env
VITE_APP_USE_BACKEND_AI=true
VITE_APP_API_BASE=http://你的服务器:3000
```

然后重新执行 `npm run build` 并部署生成的 `dist`。

### 2. 后端 CORS 未放行前端页面所在域名/地址

- 后端只对「白名单」里的 Origin 返回允许跨域；白名单来自环境变量 `CORS_ORIGINS`（逗号分隔）。
- 若你从 `http://192.168.1.100` 或 `https://你的公司域名.com` 打开页面，而该地址**不在** `CORS_ORIGINS` 里，浏览器会因 CORS 拒绝而报 Failed to fetch。

**处理：**

- 在**运行后端的机器**上，设置 `CORS_ORIGINS`，把**前端页面的访问地址**（协议+域名+端口，不要末尾斜杠）加进去，例如：

```env
# backend/.env
CORS_ORIGINS=https://www.plc-sim.com,https://plc-sim.com,http://localhost:5173,http://你的服务器IP:端口,https://你的域名.com
```

- 修改后重启后端服务。

### 3. 后端未启动、端口未开放或网络不通

- 前端请求的 `VITE_APP_API_BASE` 必须能真正连上：后端进程已启动、端口（如 3000）已监听、服务器防火墙/安全组放行该端口。
- 若前端在公网、后端在内网，需做内网穿透或把后端暴露到前端能访问的地址。

**快速自检：**

- 浏览器直接访问：`http://你的后端地址:3000/health` 或 `http://你的后端地址:3000/api/health`，应返回 `{"ok":true,"service":"plc-sim-api"}`。
- 若打不开，说明后端不可达，先解决网络/防火墙/进程再测前端。

### 4. 混合内容（HTTPS 页面请求 HTTP）

- 若页面是 **https** 打开的，而 `VITE_APP_API_BASE` 配成了 **http**，部分浏览器会拦截（Mixed Content）→ 也会出现类似 Failed to fetch。
- 处理：同一域名下用 Nginx 做反向代理，让前端和 API 都用 https；或开发阶段用 http 页面 + http 后端。

---

## 三、自建部署检查清单（避免 Failed to fetch）

1. **后端**
   - `backend/.env` 已配置 `DEEPSEEK_API_KEY` / `GEMINI_API_KEY` / `OPENAI_API_KEY`（按使用的模型）。
   - `CORS_ORIGINS` 包含**用户打开前端页面的完整来源**（如 `http://服务器:80`, `https://你的域名.com`）。
   - 后端已启动，`/health` 或 `/api/health` 能访问。

2. **前端构建**
   - `.env.production` 中 `VITE_APP_API_BASE` 为**实际后端地址**（与上面 CORS、网络可达一致）。
   - `VITE_APP_USE_BACKEND_AI=true`（生产走后端 Key）。
   - 执行 `npm run build` 后部署的是新构建的 `dist`。

3. **浏览器**
   - 打开开发者工具 → Network，看 AI 请求的 URL 是否指向你的后端；若指向 `api.plc-sim.com` 说明构建时未带上正确的 `VITE_APP_API_BASE`。
   - 若请求地址正确仍 Failed to fetch，看该请求的 Response Headers 是否缺少 `Access-Control-Allow-Origin` 或与你当前页面 Origin 不一致 → 按上面第 2 步调整 CORS。

按上述顺序排查后，一般即可定位并解决「本地要填 Key」与「网页调服务器端 Key 时 Failed to fetch」的问题。

---

## 四、排查详细步骤（按顺序执行）

当网页出现「AI 请求失败：Failed to fetch」时，按下列步骤逐项执行并记录结果。

### 步骤 1：确认前端构建时使用的 API 地址

- **目的**：确认浏览器实际会请求哪个后端地址。
- **操作**：在本机打开构建时用的 `.env.production`（若无则参考 `env.production.example`），查看 `VITE_APP_USE_BACKEND_AI=true` 和 `VITE_APP_API_BASE=...`。未设置时默认为 `https://api.plc-sim.com`；若你的后端不在该域名，必须改为正确地址后**重新 `npm run build`** 并重新部署（构建详细步骤见《PLC-SIM 全栈项目部署总结汇报》）。
- **结论**：记下当前构建对应的 `VITE_APP_API_BASE` 值。

### 步骤 2：在浏览器中确认实际请求的 URL 与状态

- **目的**：确认请求是否发到正确地址、是否被 CORS 或网络拦截。
- **操作**：用 Chrome/Edge 打开部署后的前端页面，F12 → Network，勾选 Preserve log，清空后触发一次 AI 生成。找到发往 `/api/ai/` 的请求，记录：Request URL 是否与步骤 1 一致；Status 是否 (failed)/CORS error/net::ERR_*；Response Headers 中 `Access-Control-Allow-Origin` 是否与当前页面 Origin 一致。
- **结论**：URL 错误 → 回步骤 1 重构建；URL 正确且 CORS 报错 → 步骤 3；网络错误 → 步骤 4。

### 步骤 3：检查后端 CORS 白名单

- **目的**：确保前端页面所在来源已被后端允许。
- **操作**：SSH 到后端服务器，进入 backend 目录，执行 `cat .env | grep CORS` 或 `pm2 env plc-sim-api`。`CORS_ORIGINS` 为逗号分隔的完整来源（协议+域名+端口），自建时需包含用户打开前端的地址（如 `https://你的域名.com`）。对比步骤 2 中请求的 Origin，若不在列表中则加入后**重启后端**（如 `pm2 restart plc-sim-api`）。
- **结论**：当前页面 Origin 必须在 `CORS_ORIGINS` 中且已重启。

### 步骤 4：确认后端进程与端口可达

- **目的**：排除后端未启动、端口未监听、防火墙拦截。
- **操作**：在后端服务器上：`pm2 list` 确认 plc-sim-api 为 online；`ss -tlnp | grep 3000` 确认 3000 在监听；`curl -s http://127.0.0.1:3000/health` 应返回 `{"ok":true,"service":"plc-sim-api"}`。若 API 通过 Nginx 暴露，再测 `curl -s -o /dev/null -w "%{http_code}" https://api.plc-sim.com/health` 应为 200。前端在其它电脑时，在同一网络下访问 `http://后端IP:3000/health`，不通则检查防火墙/安全组。
- **结论**：只有 /health 在本机及前端可达时，AI 请求才可能成功。

### 步骤 5：确认后端已配置 API Key

- **操作**：在后端服务器查看 `backend/.env` 中是否配置了 `DEEPSEEK_API_KEY`、`GEMINI_API_KEY`、`OPENAI_API_KEY`（按使用的模型）。若返回 503 且提示 API Key not configured，补全后重启后端。
- **结论**：使用的模型在服务端必须有有效 Key。

### 步骤 6：HTTPS 页面不要请求 HTTP 后端（混合内容）

- **操作**：若前端是 https 打开，`VITE_APP_API_BASE` 必须为 https。若为 http，应改为通过 Nginx 反代的 https 地址后重新构建部署。
- **结论**：HTTPS 页面只请求 HTTPS 后端。

**汇总**：构建按《PLC-SIM 全栈项目部署总结汇报》执行；出现 Failed to fetch 时按 1→2→3→4→5→6 依次确认「前端 API 地址 → 浏览器请求与 CORS → 后端 CORS → 后端进程与网络 → 后端 Key → 混合内容」，即可定位并修复。
