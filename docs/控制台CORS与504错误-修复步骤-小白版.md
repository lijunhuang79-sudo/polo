# 控制台报 CORS + 504 的修复步骤（小白版）

你看到的两个主要错误可以这样理解：

1. **504 Gateway Timeout（网关超时）**  
   网页向「AI 接口」要结果时，等了一段时间（默认 60 秒）还没收到回复，Nginx 就主动断开并返回 504。  
   **通俗说**：就像打电话，对方一直不接，最后自动挂断。

2. **CORS 被拦截**  
   出现 504 时，Nginx 直接返回错误页，**没有带上「允许跨域」的响应头**，浏览器就会再报一条 CORS 错误。  
   **通俗说**：本来只有「超时」一个问题，但因为错误页没带「允许 www.plc-sim.com 访问」的标记，浏览器再报一层 CORS。

3. **「preflight request doesn't pass access control check: It does not have HTTP ok status」**  
   浏览器在发 POST 前会先发 **OPTIONS**（预检）。若 api.plc-sim.com 对 OPTIONS 也要求 Basic 登录并返回 401，浏览器就认为预检失败（不是 2xx），从而拦截后续 POST。  
   **处理**：在 Nginx 里对 OPTIONS 请求免认证并直接返回 204 和 CORS 头（见仓库 `deploy/nginx/plc-sim.ssl.conf` 中 api 的 `location /` 内 `if ($request_method = 'OPTIONS')` 块）。更新配置后需重新拉取并覆盖、再 `nginx -s reload`。

4. **401 Unauthorized（未授权）**  
   页面在 **www.plc-sim.com**，AI 请求却发到 **api.plc-sim.com**，属于跨域。浏览器**不会**把你在 www 输入的 Basic 密码带到 api，所以 api 返回 401。  
   **处理**：让前端请求**同源**（也走 www），这样一次登录同时覆盖页面和接口。构建时把 `VITE_APP_API_BASE` 设为 **`https://www.plc-sim.com`**（或留空用相对路径），重新 build 并部署。Nginx 里 www 已有 `location /api/` 反代到后端，无需改 Nginx。

所以**根本原因是「等 AI 的时间太短」或「OPTIONS 预检被 Basic Auth 拦成 401」或「API 跨域导致不带 Basic 密码而 401」**：按上面对应处理即可。

下面按「你要在服务器上做什么」一步一步写，你只要会 SSH 登录服务器、会复制粘贴命令即可。

---

## 第一步：登录到你的服务器

1. 打开你平时用的「终端」或「SSH 工具」（如 PuTTY、Xshell、或 Windows 自带的「终端」）。
2. 用你的账号登录到**放网站的那台服务器**（就是 plc-sim.com 所在的那台机器）。  
   例如：
   ```bash
   ssh 你的用户名@你的服务器IP
   ```
3. 输入密码（如有）后，看到类似 `root@xxx:~#` 或 `ubuntu@xxx:~$` 就表示已经登录成功。

---

## 第二步：确认「AI 后端」在运行

先确认本机 3000 端口的服务是起来的，否则改完 Nginx 也会一直超时。

在终端里**逐行**执行（每行回车一次）：

```bash
pm2 list
```

看列表里有没有一个叫 **plc-sim-api** 的，状态是 **online**。

- 如果有且是 **online**：继续下一步。
- 如果没有，或状态不是 online：
  ```bash
  cd /var/www/plc-sim/polo/backend
  pm2 start server.js --name plc-sim-api
  pm2 save
  ```
  再执行一次 `pm2 list` 确认是 online。

再测一下本机能否访问健康接口：

```bash
curl -s http://127.0.0.1:3000/health
```

若返回一串 JSON 且里面有 `"ok":true`，说明后端正常。  
若报错或没反应，说明 3000 端口服务没起来，需要先解决后端再继续。

---

## 第三步：把 Nginx 的「等待时间」调长（解决 504）

现在 Nginx 只等 60 秒，AI 生成经常超过 60 秒就会 504。我们要把**转发到后端**的等待时间改长。

1. 在服务器上执行（复制整段，一次性粘贴到终端）：

   ```bash
   sudo nano /etc/nginx/sites-available/plc-sim.ssl.conf
   ```

   如果提示「找不到文件」，可能是别的名字，先看有哪些配置：

   ```bash
   ls /etc/nginx/sites-available/
   ```

   找到带 **plc-sim** 或 **ssl** 的 conf 文件，把上面命令里的文件名换成实际名字再执行。

2. 在 nano 里找到 **api.plc-sim.com** 对应的那个 `server { ... }` 块（里面有 `server_name api.plc-sim.com;`）。

3. 在这个 server 里找到 `location / { ... }`，里面会有三行类似：

   ```nginx
   proxy_connect_timeout 60s;
   proxy_send_timeout 60s;
   proxy_read_timeout 60s;
   ```

4. 把这三行**改成**（数字改大，单位仍是秒）：

   ```nginx
   proxy_connect_timeout 60s;
   proxy_send_timeout 300s;
   proxy_read_timeout 300s;
   ```

   表示：允许连接 60 秒、发送/读取各等 **300 秒（5 分钟）**，AI 慢一点也能等完。

5. 保存并退出 nano：  
   - 按 **Ctrl+O** 回车保存  
   - 再按 **Ctrl+X** 退出

**如果你不想手改**：可以用下面第四步里「用仓库里的配置覆盖」的方式，仓库里的配置已经改成 300 秒了。

---

## 第四步（推荐）：直接使用仓库里改好的 Nginx 配置

项目里已经有一份改好超时和 CORS 的配置，你可以直接在服务器上覆盖过去再用。

1. 在服务器上进入仓库目录：

   ```bash
   cd /var/www/plc-sim/polo
   ```

2. 拉取最新代码（如果你刚在本机改过并 push 了）：

   ```bash
   git fetch origin
   git reset --hard origin/main
   ```

3. 看一下仓库里的 Nginx 配置是否存在：

   ```bash
   ls deploy/nginx/plc-sim.ssl.conf
   ```

4. 用仓库里的配置覆盖系统里的配置（**注意**：会覆盖你之前在服务器上对这份配置的手动修改）。  
   系统里 Nginx 的配置可能在 `/etc/nginx/sites-available/` 下，文件名可能是 `plc-sim.ssl.conf` 或 `plc-sim.conf`，先看一下：

   ```bash
   ls /etc/nginx/sites-available/ | grep plc
   ```

   假设看到的是 `plc-sim.conf`，就执行（把**目标文件名**改成你实际看到的）：

   ```bash
   sudo cp /var/www/plc-sim/polo/deploy/nginx/plc-sim.ssl.conf /etc/nginx/sites-available/plc-sim.conf
   ```

   若你服务器上用的就是 `plc-sim.ssl.conf`，则：

   ```bash
   sudo cp /var/www/plc-sim/polo/deploy/nginx/plc-sim.ssl.conf /etc/nginx/sites-available/plc-sim.ssl.conf
   ```

5. 检查 Nginx 配置有没有语法错误：

   ```bash
   sudo nginx -t
   ```

   应看到 `syntax is ok` 和 `test is successful`。

6. 让 Nginx 重新加载配置（不中断现有连接）：

   ```bash
   sudo nginx -s reload
   ```

---

## 第五步：确认后端允许「来自 www.plc-sim.com 的跨域」

504 解决后，正常响应会由**后端**返回，后端本身会带 CORS 头。但要确保后端允许 `https://www.plc-sim.com`。

1. 在服务器上打开后端的 .env 文件：

   ```bash
   nano /var/www/plc-sim/polo/backend/.env
   ```

2. 看有没有一行 **CORS_ORIGINS**。  
   - 如果没有，可以加一行（一行写完整，不要换行）：  
     ```env
     CORS_ORIGINS=https://www.plc-sim.com,https://plc-sim.com,http://localhost:5173
     ```  
   - 如果有，确保里面包含 **https://www.plc-sim.com**（多个地址用英文逗号隔开，不要空格）。

3. 保存退出（Ctrl+O 回车，Ctrl+X）。

4. 重启后端，让配置生效：

   ```bash
   pm2 restart plc-sim-api
   ```

---

## 第六步：在浏览器里再试一次

1. 打开 https://www.plc-sim.com ，登录（若有 Basic 认证）。
2. 使用一次「AI 生成」功能。
3. 再打开开发者工具（F12）→ 控制台，看是否还有 504 和 CORS 报错。

- 若**还有 504**：可能是 AI 接口本身很慢或出错，可以再适当加大 `proxy_read_timeout`（例如 600），或到服务器上看后端日志：  
  ```bash
  pm2 logs plc-sim-api
  ```
- 若**只剩 CORS**、没有 504：再确认第五步里 CORS_ORIGINS 包含 `https://www.plc-sim.com`，且执行过 `pm2 restart plc-sim-api`。

---

## 修改后仍报错：请按下面逐项验证（在服务器上执行）

控制台**仍然**出现 CORS 和 504，多半是「服务器上实际生效的 Nginx 配置」还没改成 300 秒和 CORS。请 SSH 登录服务器后，**按顺序**做下面检查。

### 验证 1：当前 Nginx 是否已经用上 300 秒和 CORS？

**先确认 Nginx 能正常输出配置**（之前命令没任何反应，多半是 `nginx -T` 失败且错误被吃掉了）。在服务器上**分两步**执行：

**第 1 步：测试配置是否有效**

```bash
sudo nginx -t
```

- 若显示 `syntax is ok` 和 `test is successful`：继续第 2 步。
- 若报错（如 `syntax error` 或 `failed`）：说明配置文件有误，需要先修好再重载；把完整报错贴出来可帮你排查。

**第 2 步：看当前生效的配置里有没有 300 秒和 CORS**

```bash
sudo nginx -T 2>&1 | grep -E "proxy_read_timeout|Access-Control-Allow-Origin"
```

（这里用 `2>&1` 而不是 `2>/dev/null`，这样 Nginx 的报错也会显示出来。）

- **若能看到 `proxy_read_timeout 300s` 和 `Access-Control-Allow-Origin`**：说明新配置已生效，问题可能在「后端没起来」或「AI 接口卡住」，继续做**验证 3**。
- **若看到的还是 `proxy_read_timeout 60s`，或根本没有 `Access-Control-Allow-Origin`**：说明**服务器上的 Nginx 还在用旧配置**，需要按下面**验证 2** 把配置真正更新并重载。
- **若第 2 步整段命令仍然没有任何输出**：可能是这台机器上的 Nginx 配置里根本没有 `proxy_pass`（例如 API 不在本机、或用了别的反向代理）。请执行下面两条，把终端里的**完整输出**贴出来，便于判断：
  ```bash
  which nginx
  ls -la /etc/nginx/sites-enabled/
  ```

---

## 若出现「conflicting server name api.plc-sim.com」且 grep 无输出（你当前情况）

说明 **api.plc-sim.com** 被两个启用配置同时定义了（例如 `sites-enabled` 里既有 **api.plc-sim.com** 又有 **plc-sim.conf**），Nginx 只认其中一个，且当前生效的那份**没有** 300 秒和 CORS，所以会 504 + CORS 报错。按下面做即可修复。

### 操作步骤（在服务器上依次执行）

**1. 先拉取仓库最新代码**（确保服务器上的 `deploy/nginx/plc-sim.ssl.conf` 是带 300s 和 CORS 的版本）

```bash
cd /var/www/plc-sim/polo
git fetch origin
git reset --hard origin/main
```

**2. 去掉重复的 api 配置，只保留一份**

让 **api.plc-sim.com** 只由 **plc-sim.conf** 提供（我们的完整配置在一个文件里），删除对独立文件 `api.plc-sim.com` 的启用：

```bash
sudo rm /etc/nginx/sites-enabled/api.plc-sim.com
```

**3. 用仓库里的完整配置覆盖 plc-sim.conf**

```bash
sudo cp /var/www/plc-sim/polo/deploy/nginx/plc-sim.ssl.conf /etc/nginx/sites-available/plc-sim.conf
```

**4. 测试并重载 Nginx**

```bash
sudo nginx -t
sudo nginx -s reload
```

**5. 再验证一次（应有输出）**

```bash
sudo nginx -T 2>&1 | grep -E "proxy_read_timeout|Access-Control-Allow-Origin"
```

应能看到 `proxy_read_timeout 300s` 和 `Access-Control-Allow-Origin`。然后浏览器强刷（Ctrl+Shift+R）再试 AI 生成。

**若验证时仍然显示 60s**：多半是第 1 步 `git reset --hard origin/main` 因「dubious ownership」失败，服务器上的 `deploy/nginx/plc-sim.ssl.conf` 还是旧版（60s），所以 cp 过去仍是 60s。按下面任选一种方式修：

- **方式 A（推荐）：修好 Git 再拉取、再覆盖**
  1. 在服务器上执行（解除 Git 对目录归属的报错）：
     ```bash
     git config --global --add safe.directory /var/www/plc-sim/polo
     ```
  2. 再拉取并覆盖配置：
     ```bash
     cd /var/www/plc-sim/polo
     git fetch origin
     git reset --hard origin/main
     grep "proxy_read_timeout" deploy/nginx/plc-sim.ssl.conf
     ```
     若能看到 `proxy_read_timeout 300s`，说明仓库里已是新配置，再执行：
     ```bash
     sudo cp /var/www/plc-sim/polo/deploy/nginx/plc-sim.ssl.conf /etc/nginx/sites-available/plc-sim.conf
     sudo nginx -t
     sudo nginx -s reload
     ```
  3. 再跑一次：`sudo nginx -T 2>&1 | grep -E "proxy_read_timeout|Access-Control-Allow-Origin"`，应能看到 300s 和 CORS。

- **方式 B：不依赖 Git，直接在服务器上把 60s 改成 300s**
  在服务器上执行（把当前已生效的 `plc-sim.conf` 里的 60s 改成 300s）：
  ```bash
  sudo sed -i 's/proxy_send_timeout 60s/proxy_send_timeout 300s/g' /etc/nginx/sites-available/plc-sim.conf
  sudo sed -i 's/proxy_read_timeout 60s/proxy_read_timeout 300s/g' /etc/nginx/sites-available/plc-sim.conf
  sudo nginx -t
  sudo nginx -s reload
  ```
  然后再验证：`sudo nginx -T 2>&1 | grep proxy_read_timeout`，应出现 300s。CORS 头若仍缺失，可再用 nano 在 **api.plc-sim.com** 的 server 块里（`auth_basic_user_file` 下一行）加上：
  ```nginx
  add_header Access-Control-Allow-Origin "https://www.plc-sim.com" always;
  add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
  add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;
  ```
  保存后 `sudo nginx -t` 与 `sudo nginx -s reload`。

**注意**：若你希望继续用独立的 `api.plc-sim.com` 文件而不是合并到 plc-sim.conf，也可以保留 `sites-enabled/api.plc-sim.com`，改为删除 plc-sim.conf 里对 api.plc-sim.com 的 server 块，并只修改 `sites-available/api.plc-sim.com`，在其中加上 300s 和 CORS。上面步骤是「只保留一份、用仓库一文件搞定」的写法，冲突会消失且配置统一。

### 验证 2：把仓库里的配置真正更新到服务器并重载

1. 本机若改过配置，先推送到 Git：`git add -A` → `git commit -m "nginx 300s CORS"` → `git push origin main`。
2. 在服务器上执行：
   ```bash
   cd /var/www/plc-sim/polo
   git fetch origin
   git reset --hard origin/main
   ls /etc/nginx/sites-enabled/
   ```
   看 `sites-enabled` 里实际启用的是哪个 conf（如 `plc-sim.ssl.conf` 或 `plc-sim.conf`），然后：
   ```bash
   sudo cp /var/www/plc-sim/polo/deploy/nginx/plc-sim.ssl.conf /etc/nginx/sites-available/你看到的那个文件名
   sudo nginx -t
   sudo nginx -s reload
   ```
3. 再执行一次**验证 1**，确认已出现 `proxy_read_timeout 300s` 和 `Access-Control-Allow-Origin`。

### 验证 3：后端是否在跑、本机能否访问？

```bash
pm2 list
curl -s http://127.0.0.1:3000/health
```

`plc-sim-api` 应为 **online**，curl 应返回 `{"ok":true,...}`。若失败，先 `pm2 start` 或看 `pm2 logs plc-sim-api`。

### 验证 4：浏览器强刷

修改并重载 Nginx 后，在浏览器按 **Ctrl+Shift+R** 强刷，或关掉标签页重新打开 https://www.plc-sim.com 再试 AI 生成。

**总结**：仍报错就先跑验证 1；若不是 300s 和 CORS，按验证 2 覆盖配置并 reload，再验证 3 确认后端，最后验证 4 强刷。

---

## 小结（你要做的几件事）

| 顺序 | 做什么 | 目的 |
|------|--------|------|
| 1 | SSH 登录服务器 | 能在服务器上执行命令 |
| 2 | `pm2 list`、`curl -s http://127.0.0.1:3000/health` | 确认 AI 后端在跑 |
| 3 | 把 Nginx 里 api 的 `proxy_read_timeout` 改为 300s（或用仓库里的配置覆盖） | 解决 504 超时 |
| 4 | `sudo nginx -t` 然后 `sudo nginx -s reload` | 让 Nginx 用新配置 |
| 5 | 在 backend/.env 里设好 CORS_ORIGINS 包含 https://www.plc-sim.com，再 `pm2 restart plc-sim-api` | 保证 CORS 正常 |
| 6 | 浏览器强刷后再试 AI 生成，看控制台 | 验证是否还报错 |

按这个流程做下来，控制台里的 **CORS** 和 **504** 一般就会消失或只剩其一；若还有问题，把控制台完整报错贴出来，再对着「哪一步没做 / 做错了」排查即可。
