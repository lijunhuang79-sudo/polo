# Phase 1 实施步骤与流程

> 目标：前端接入后端 AI 代理、移除 Key 暴露、CORS 收紧、协议完善，达到安全合规可对外水平。

**实施状态：** 代码修改已完成，待联调与部署验证。

---

## 一、总览

| 任务 | 说明 | 预估 |
|------|------|------|
| 1. 前端接入后端 AI | 生产环境 AI 请求走自有后端，前端不再传 Key | 1–2 天 |
| 2. 移除/隐藏 Key 输入 | 后端模式下隐藏 API Key 输入框 | 0.5 天 |
| 3. 后端 CORS 收紧 | 将 `*` 改为白名单域名 | 0.5 天 |
| 4. 环境变量与配置 | 前端 API 地址、后端 Key 配置 | 0.5 天 |
| 5. 协议与免责完善 | 用户协议、隐私政策内容补充（待法务审阅） | 0.5 天 |
| 6. 联调与验证 | 本地 + 生产环境全流程测试 | 1 天 |

**合计：约 4–5 个工作日**

---

## 二、任务 1：前端接入后端 AI

### 2.1 新增后端调用服务

**文件：** `src/services/backendAi.ts`（新建）

```typescript
// 调用自有后端 /api/ai/generate，不传 API Key
// 入参：model, prompt, logicHints
// 返回：GeneratedSolution
```

**要点：**
- 使用 `import.meta.env.VITE_APP_API_BASE` 或默认 `https://api.plc-sim.com`
- 请求体：`{ model, prompt, logicHints }`
- 错误时抛出带 message 的 Error

### 2.2 修改 AI 调用逻辑

**文件：** `src/App.tsx`

- 增加 `USE_BACKEND_AI`：生产环境为 `true`，开发环境可通过 `VITE_APP_USE_BACKEND_AI` 控制
- 当 `USE_BACKEND_AI` 为 true 时：
  - 调用 `backendAi.generate(model, prompt, logicHints)`，不传 apiKey
  - 不再检查 `apiKey.trim()`，不再读写 `localStorage` 的 Key
- 当 `USE_BACKEND_AI` 为 false 时：保持现有逻辑（用户输入 Key，直连第三方）

### 2.3 修改 aiModels 配置

**文件：** `src/config/aiModels.ts`

- 后端模式下仅展示后端支持的模型：`deepseek`、`gemini`、`codex`（Qwen 暂不接入后端，可后续补充）
- 或：增加 `backendOnly` 标记，UI 根据 `USE_BACKEND_AI` 过滤

---

## 三、任务 2：移除/隐藏 Key 输入

### 3.1 UI 条件渲染

**文件：** `src/App.tsx`

- 当 `USE_BACKEND_AI` 为 true 时：
  - 隐藏「API Key 输入框」「测试连接」「保存 Key」等控件
  - 显示简短说明：「AI 生成由平台提供，无需配置 Key」
- 当 `USE_BACKEND_AI` 为 false 时：保持现有 Key 输入 UI

### 3.2 清理 localStorage

- 后端模式下不再调用 `localStorage.setItem/getItem` 与 Key 相关逻辑
- 可选：增加「清除已保存 Key」的隐藏入口，便于用户迁移

---

## 四、任务 3：后端 CORS 收紧

### 4.1 修改 server.js

**文件：** `backend/server.js`

- 将 `Access-Control-Allow-Origin: *` 改为可配置白名单
- 默认白名单：`https://www.plc-sim.com`、`https://plc-sim.com`、开发时 `http://localhost:5173`
- 从环境变量 `CORS_ORIGINS` 读取，格式如 `https://www.plc-sim.com,https://plc-sim.com`

### 4.2 实现逻辑

```javascript
const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'https://www.plc-sim.com,https://plc-sim.com').split(',');
function getCorsOrigin(req) {
  const origin = req.headers.origin;
  return origin && CORS_ORIGINS.includes(origin) ? origin : CORS_ORIGINS[0];
}
// 在 send() 和 cors() 中使用 getCorsOrigin(req) 替代 '*'
```

---

## 五、任务 4：环境变量与配置

### 5.1 前端 .env

| 变量 | 说明 | 生产示例 |
|------|------|----------|
| `VITE_APP_USE_BACKEND_AI` | 是否使用后端 AI（生产建议 true） | `true` |
| `VITE_APP_API_BASE` | 后端 API 根地址 | `https://api.plc-sim.com` |

**文件：** `.env.production`（或 `.env.production.example`）

```
VITE_APP_USE_BACKEND_AI=true
VITE_APP_API_BASE=https://api.plc-sim.com
```

### 5.2 后端 .env

**文件：** `backend/.env`（已有则补充）

```
DEEPSEEK_API_KEY=sk-xxx
GEMINI_API_KEY=AIzaSyxxx
OPENAI_API_KEY=sk-xxx
CORS_ORIGINS=https://www.plc-sim.com,https://plc-sim.com
```

**注意：** 生产环境需在服务器上配置上述 Key，且不提交到 Git。

---

## 六、任务 5：协议与免责完善

### 6.1 用户协议

**文件：** `src/App.tsx` 中 `showAgreement` 弹窗内容

- 补充：服务范围、禁止用途、账号与数据规则、争议解决
- 标注：「完整协议由运营方另行公示，正式发布前需法务审阅」

### 6.2 隐私政策

**文件：** `src/App.tsx` 中 `showPrivacy` 弹窗内容

- 补充：收集的数据类型、用途、存储地、保留期、第三方共享、用户权利
- 标注：「正式发布前需法务审阅；若面向欧盟用户需考虑 GDPR」

### 6.3 登录前勾选（可选 Phase 1.5）

- 在登录页增加「我已阅读并同意《用户服务协议》和《隐私政策》」勾选框
- 未勾选不可登录（若启用登录）

---

## 七、任务 6：联调与验证

### 7.1 本地联调

1. 启动后端：`cd backend && node server.js`（确保 .env 有 Key）
2. 前端 .env.development：`VITE_APP_USE_BACKEND_AI=true`，`VITE_APP_API_BASE=http://localhost:3000`
3. 启动前端：`npm run dev`
4. 验证：选择 AI 生成 → 不输入 Key → 点击「一键生成PLC程序」→ 应成功返回结果

### 7.2 生产验证

1. 部署后端：确保 `backend/.env` 有 DEEPSEEK/GEMINI/OPENAI Key
2. 部署前端：`.env.production` 中 `VITE_APP_USE_BACKEND_AI=true`，`VITE_APP_API_BASE=https://api.plc-sim.com`
3. 访问 https://www.plc-sim.com
4. 验证：AI 生成无需 Key，可正常生成；本地生成正常；导出正常
5. 验证 CORS：从其他域名访问应被拒绝（或按配置行为）

### 7.3 检查清单

- [ ] 生产环境 AI 生成不展示 Key 输入框
- [ ] 生产环境 AI 生成可成功返回结果
- [ ] 本地生成、导出、仿真功能正常
- [ ] 浏览器 Network 中无直接请求 DeepSeek/Gemini/OpenAI，仅请求 api.plc-sim.com
- [ ] 后端 CORS 仅允许白名单域名
- [ ] 用户协议、隐私政策内容已补充（待法务审阅）

---

## 八、实施顺序建议

```
Day 1: 任务 4（环境变量）+ 任务 1（backendAi 服务 + App 调用逻辑）
Day 2: 任务 2（隐藏 Key UI）+ 任务 3（CORS）
Day 3: 任务 5（协议完善）
Day 4: 任务 6（联调与验证）
Day 5: 缓冲 / 问题修复
```

---

## 九、回滚方案

若 Phase 1 上线后出现问题：

1. 将 `VITE_APP_USE_BACKEND_AI` 设为 `false`，重新构建前端并部署
2. 前端恢复「用户输入 Key、直连第三方」模式
3. 排查后端问题后再次切换为 `true`

---

## 十、Phase 1 完成标准

- [ ] 生产环境 AI 请求全部经自有后端，前端不接触 API Key
- [ ] 后端 CORS 已收紧为白名单
- [ ] 用户协议、隐私政策内容已补充（法务审阅可并行）
- [ ] 本地与生产环境全流程验证通过
- [ ] 部署文档已更新（含 .env 配置说明）

完成上述项后，可视为 Phase 1 达标，具备对外安全合规基础。

---

## 十一、已完成的代码修改（可直接使用）

| 文件 | 修改内容 |
|------|----------|
| `src/services/backendAi.ts` | 新建，调用 `/api/ai/generate` 与 `/api/ai/test` |
| `src/App.tsx` | 增加 `USE_BACKEND_AI`、`BACKEND_MODELS`；后端模式下隐藏 Key UI、调用 `backendGenerate` |
| `backend/server.js` | CORS 改为白名单（`CORS_ORIGINS` 环境变量） |
| `env.production.example` | 增加 `VITE_APP_USE_BACKEND_AI=true` |
| `backend/.env.example` | 增加 `CORS_ORIGINS` 说明 |

**默认行为：** 生产环境未设置 `VITE_APP_USE_BACKEND_AI` 时，默认使用后端 AI（即 `true`）。开发环境默认不使用，需显式设置 `VITE_APP_USE_BACKEND_AI=true` 测试后端模式。
