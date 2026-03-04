# 为什么改成 VITE_APP_USE_BACKEND_AI=false 后仍不显示 API Key 输入框？

## 原因说明

前端是否显示「API Key 输入框」由 **构建时** 写进代码的 `VITE_APP_USE_BACKEND_AI` 决定，**不是**运行时读配置文件。

- **Vite 行为**：执行 `npm run build` 时，只会读取**项目根目录下的 `.env.production`**，把里面的 `VITE_APP_*` 替换进打包后的 JS。之后你改任何文件，只要**没有重新 build 并部署新的 dist**，网页里跑的仍是旧代码。
- **你改的是哪个文件？**
  - 若只改了 **`env.production.example`**：该文件只是示例，**不会**被 Vite 读取。构建时用的必须是 **`.env.production`**（注意前面有个点）。
  - 若改了 **`.env.production`** 但**没有重新执行 `npm run build`**：打包结果里仍是旧的环境变量，所以界面不会变。
  - 若在本机 build 但**部署的是服务器上的旧 dist**（或没重新 rsync/上传）：服务器上的前端仍是旧构建，也不会显示 Key 输入框。

因此：**改配置 → 必须重新构建 → 必须部署新 dist → 浏览器强刷**，缺一不可。

---

## 正确操作步骤（改完后要显示 API Key 输入框）

### 情况 A：在服务器上构建并部署（与《前端后端同步到服务器-完整步骤》一致）

1. **SSH 登录服务器**，进入项目根目录：
   ```bash
   cd /var/www/plc-sim/polo
   ```
2. **确保构建时读到的是 .env.production**（若没有就从示例复制一份再改）：
   ```bash
   cp -n env.production.example .env.production
   nano .env.production
   ```
   将其中一行改为：
   ```env
   VITE_APP_USE_BACKEND_AI=false
   ```
   保存退出。
3. **重新构建并发布前端**（会用到新的 .env.production）：
   ```bash
   npm run build
   sudo rsync -a --delete dist/ /var/www/plc-sim/polo/frontend/
   sudo chown -R www-data:www-data /var/www/plc-sim/polo/frontend
   ```
4. **浏览器强刷**：打开站点后按 **Ctrl+Shift+R**（或无痕模式重新打开），避免读到缓存的旧 JS。

### 情况 B：在本机构建，再上传/同步到服务器

1. **在本机**项目根目录（如 `E:\Project\V2.13`）：
   - 若没有 `.env.production`，先复制：  
     `copy env.production.example .env.production`（PowerShell）  
     或把 `env.production.example` 另存为 `.env.production`。
   - 编辑 `.env.production`，保证有：
     ```env
     VITE_APP_USE_BACKEND_AI=false
     ```
2. **在本机**执行：
   ```powershell
   npm run build
   ```
3. 把生成的 **`dist` 目录**按你现有方式上传/同步到服务器的前端目录（如 `/var/www/plc-sim/polo/frontend`），覆盖旧文件。
4. 浏览器 **Ctrl+Shift+R** 强刷或使用无痕窗口再打开。

---

## 如何确认当前页面用的是 true 还是 false？

已在页面中注入调试变量，构建并部署后：

1. 打开站点，按 **F12** 打开开发者工具，切到 **Console**。
2. 输入并回车：
   ```text
   __PLC_USE_BACKEND_AI
   ```
3. 若显示 **`true`**：说明当前这份构建仍是「使用后端 AI、不显示 Key 输入框」，需要按上面步骤在**构建机**上改 `.env.production` 为 `VITE_APP_USE_BACKEND_AI=false` 后**重新 build 并部署**，再强刷。
4. 若显示 **`false`**：说明构建已生效，此时应能看到 API Key 输入框；若仍看不到，多半是浏览器缓存，用 **Ctrl+Shift+R** 或无痕模式再试。

---

## 小结

| 你做的操作 | 是否会让界面变成「显示 API Key」 |
|------------|----------------------------------|
| 只改 `env.production.example`，不复制为 `.env.production` | ❌ 不会（构建读不到） |
| 只改 `.env.production`，但不重新 `npm run build` | ❌ 不会（打包结果未更新） |
| 重新 build 了，但没把新 dist 部署到服务器/没覆盖旧文件 | ❌ 不会（线上仍是旧包） |
| 改 `.env.production` → 重新 build → 部署新 dist → 浏览器强刷 | ✅ 会 |

因此：**把配置文件里的 `VITE_APP_USE_BACKEND_AI` 改为 `false` 后，必须用「构建时真正读取」的 `.env.production`，再重新构建、部署、强刷，网页才会出现 API Key 输入框。**
