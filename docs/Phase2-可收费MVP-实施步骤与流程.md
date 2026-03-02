# Phase 2：可收费 MVP — 实施步骤与流程

> 目标：正式用户体系（注册/登录/Token）、预充值 + 按次扣费、为支付接入预留接口，形成可收费 MVP。

---

## 一、Phase 2 总览

| 子阶段 | 内容 | 产出 |
|--------|------|------|
| **Phase 2a** | 用户注册/登录、JWT 鉴权、余额与流水、AI 调用按次扣费 | 未登录不可用 AI；登录后扣点数；可「管理员赠送」或「新用户赠送」测试 |
| **Phase 2b** | 接入一种支付渠道（支付宝/微信/Stripe）、充值下单与回调 | 用户可真实充值，余额增加 |

当前文档与代码先完成 **Phase 2a**，Phase 2b 预留接口与实施说明。

---

## 二、Phase 2a 设计要点

### 2.1 数据模型（SQLite）

| 表 | 字段 | 说明 |
|----|------|------|
| **users** | id, email, password_hash, created_at | 邮箱注册，密码 bcrypt 存储 |
| **accounts** | user_id, balance_points, updated_at | 用户余额（点数），1 次 AI = 1 点 |
| **transactions** | id, user_id, type, amount, ref_id, created_at | type: 'grant'\|'recharge'\|'consume' |

- 新用户注册时自动创建 account，并可选赠送新用户点数（如 10 点）。
- 每次成功调用 `/api/ai/generate` 扣 1 点（可配置），扣费与写流水在同一事务。

### 2.2 接口设计

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| POST | /api/auth/register | 否 | body: { email, password }，返回 { token, user, balance } |
| POST | /api/auth/login | 否 | body: { email, password }，返回 { token, user, balance } |
| GET | /api/me | JWT | 返回 { user, balance } |
| POST | /api/ai/generate | JWT | 同 Phase 1，请求头带 Authorization: Bearer &lt;token&gt;；扣 1 点后调用 AI |
| POST | /api/pay/create-order | JWT | Phase 2b：创建充值订单，返回支付 URL 或参数 |
| POST | /api/pay/callback | 否（签名校验） | Phase 2b：支付回调，加余额、写流水 |

### 2.3 定价（示例）

- **1 次 AI 生成 = 1 点**
- 新用户注册赠送 **10 点**
- 充值：Phase 2b 接入后，例如 10 元 = 100 点（由支付与定价配置决定）

---

## 三、Phase 2a 实施步骤

### 3.1 后端

1. **依赖**：`better-sqlite3`、`bcryptjs`、`jsonwebtoken`
2. **db.js**：初始化 SQLite，建表 users、accounts、transactions，封装增删改查
3. **auth.js**：密码哈希与校验、JWT 签发与校验（从 Authorization 头取 token）
4. **server.js**：
   - 挂载 POST /api/auth/register、POST /api/auth/login、GET /api/me
   - /api/ai/generate：先校验 JWT，取 userId → 查余额 ≥ 1 → 扣 1 点 + 写 consume 流水 → 再调 AI；余额不足返回 402
5. **配置**：环境变量 JWT_SECRET、AI_PRICE_POINTS（默认 1）、NEW_USER_BONUS_POINTS（默认 10）

### 3.2 前端

1. **登录/注册**：替换或扩展当前「密码登录」为邮箱+密码；增加注册页或弹窗
2. **Token**：登录/注册成功后保存 token（localStorage 或 sessionStorage），请求时带 `Authorization: Bearer <token>`
3. **余额**：调用 GET /api/me 获取余额，在 header 或侧栏展示「点数：N」
4. **AI 调用**：请求 /api/ai/generate 时带 Authorization；若 402 提示「余额不足，请充值」
5. **充值入口**：按钮「充值」跳转至 Phase 2b 支付页或先占位「即将上线」

### 3.3 部署与配置

- 服务器安装 Node 依赖后，首次启动自动创建 SQLite 文件（如 `backend/data/plc.db`）
- 环境变量：JWT_SECRET（必填）、NEW_USER_BONUS_POINTS、AI_PRICE_POINTS
- 数据目录需可写，建议备份 `data/plc.db`

---

## 四、Phase 2b 实施步骤（支付接入）

### 4.1 可选方案

| 地区 | 方案 | 说明 |
|------|------|------|
| 中国大陆 | 支付宝 / 微信支付 | 需企业主体与商户号；可接官方 API 或 Ping++、BeeCloud 等聚合 |
| 海外 | Stripe | 文档完善，支持一次性支付与订阅 |

### 4.2 后端

- POST /api/pay/create-order：入参 amount（元或点数），生成订单号，调用支付渠道下单，返回支付 URL 或二维码参数；写 orders 表（order_id, user_id, amount, status, created_at）
- POST /api/pay/callback：支付渠道异步回调，校验签名 → 根据 order_id 幂等更新订单状态并给对应用户加余额、写 recharge 流水

### 4.3 前端

- 「充值」页：选择金额 → 调 create-order → 跳转支付或展示二维码
- 支付完成后跳回站点，前端轮询或调 GET /api/me 刷新余额

### 4.4 合规

- 涉及支付需企业主体与相关资质；支付回调需 HTTPS；敏感配置（商户密钥等）仅存服务端环境变量

---

## 五、验证清单（Phase 2a）

- [ ] 用户可注册（邮箱+密码）、登录后返回 token
- [ ] 请求 /api/me 带 token 可获取用户信息与余额
- [ ] 未带 token 调用 /api/ai/generate 返回 401
- [ ] 带 token 且余额 ≥ 1 时调用 /api/ai/generate 成功并扣 1 点
- [ ] 余额不足时返回 402，前端提示「余额不足，请充值」
- [ ] 新用户注册后余额为赠送点数（如 10）
- [ ] 前端登录后展示余额，AI 生成后余额更新

---

## 六、已完成的代码修改（Phase 2a）

见仓库内：

- `backend/db.js` — SQLite 与 users/accounts/transactions
- `backend/auth.js` — 密码与 JWT
- `backend/server.js` — 注册/登录/me、/api/ai/generate 鉴权与扣费
- 前端：登录/注册 UI、Token 存储、Authorization 头、余额展示与不足提示

Phase 2b 支付接口预留为 POST /api/pay/create-order、POST /api/pay/callback，实现时按上节接入具体支付渠道。

---

## 七、Phase 2a 已完成代码清单

| 位置 | 说明 |
|------|------|
| `backend/package.json` | 依赖 bcryptjs、better-sqlite3、jsonwebtoken |
| `backend/db.js` | SQLite 建表 users/accounts/transactions，扣费与退还 |
| `backend/auth.js` | 密码哈希、JWT 签发与校验 |
| `backend/server.js` | 注册/登录/me，/api/ai/generate 鉴权+扣费+失败退还 |
| `backend/.env.example` | JWT_SECRET、NEW_USER_BONUS_POINTS、AI_PRICE_POINTS |
| `src/services/backendAi.ts` | token 参数，401/402 错误码 |
| `src/services/backendAuth.ts` | login、register、getMe |
| `src/App.tsx` | 后端登录/注册、余额展示、退出、生成带 Token |

**部署：** 服务器 `cd backend && npm install`；设置 `JWT_SECRET`；`backend/data/` 可写，首次启动创建 `plc.db`。
