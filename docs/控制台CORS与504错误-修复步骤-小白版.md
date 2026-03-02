# 控制台报 CORS + 504 的修复步骤（小白版）

你看到的两个主要错误可以这样理解：

1. **504 Gateway Timeout（网关超时）**  
   网页向「AI 接口」要结果时，等了一段时间（默认 60 秒）还没收到回复，Nginx 就主动断开并返回 504。  
   **通俗说**：就像打电话，对方一直不接，最后自动挂断。

2. **CORS 被拦截**  
   出现 504 时，Nginx 直接返回错误页，**没有带上「允许跨域」的响应头**，浏览器就会再报一条 CORS 错误。  
   **通俗说**：本来只有「超时」一个问题，但因为错误页没带「允许 www.plc-sim.com 访问」的标记，浏览器再报一层 CORS。

所以**根本原因是「等 AI 的时间太短」**：把「允许等待的时间」调长，AI 正常返回后，CORS 会由后端正常带上，一般就不会再报。

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
