# SSH 认证失败 (unable to authenticate) — 排查步骤

报错：`ssh: handshake failed: ssh: unable to authenticate, attempted methods [none publickey], no supported methods remain`

说明：私钥已能被解析，但**服务器不认可这把钥匙** —— 即服务器上对应用户的 `authorized_keys` 里没有这条私钥对应的公钥，或登录用户不对。

---

## 第一步：确认服务器上 root 的 authorized_keys

SSH 登录服务器后执行（若 GitHub 里 SSH_USERNAME 不是 root，把 root 换成对应用户）：

```bash
sudo cat /root/.ssh/authorized_keys
```

记下里面的公钥（每行一条，形如 `ssh-ed25519 AAAA...` 或 `ssh-rsa AAAAB3...`）。

---

## 第二步：确认本机哪把钥匙能登录服务器

在你 **Mac 本机**终端执行（用你平时登录的账号，例如 root）：

```bash
ssh -v root@plc-sim.com exit 2>&1 | grep "Offering public key"
```

会看到类似：`Offering public key: /Users/你的用户名/.ssh/id_ed25519`。  
说明你平时用的是 **id_ed25519** 这把钥匙登录。

---

## 第三步：核对“服务器上的公钥”和“本机私钥”是否一对

在 **Mac** 上执行：

```bash
cat ~/.ssh/id_ed25519.pub
```

输出应和服务器 `/root/.ssh/authorized_keys` 里**某一行**完全一致（或你登录用的对应用户的 authorized_keys 里）。

- **一致**：说明钥匙对得上，问题多半是 **SSH_USERNAME** 不对（见第四步）。
- **不一致**：说明你平时登录用的不是 id_ed25519，或公钥在服务器别的用户下。要么把本机 `cat ~/.ssh/id_ed25519.pub` 的输出**追加**到服务器 root 的 authorized_keys，要么用服务器上实际有这条公钥的用户名做 SSH_USERNAME。

---

## 第四步：把本机公钥加到服务器 root（若还没有）

**重要**：放进服务器 `authorized_keys` 的必须是**公钥**（`.pub` 文件），不是私钥。私钥只能放在本机或 GitHub Secrets，绝不能放进 authorized_keys。

若服务器上 root 的 authorized_keys 里**没有**你本机公钥，在**本机**执行：

```bash
ssh-copy-id -i ~/.ssh/id_ed25519.pub root@plc-sim.com
```

按提示输入 root 密码。成功后，再在 GitHub Actions 里 **Re-run** 部署。

若 `ssh-copy-id` 不可用，可手动追加：

1. 本机执行：`cat ~/.ssh/id_ed25519.pub`（注意是 **.pub**），复制输出的**那一行**（形如 `ssh-ed25519 AAAA...` 或 `ssh-rsa AAAAB3...`，只有一行）。
2. 登录服务器后执行：`echo "这里粘贴刚才复制的公钥那一行" >> /root/.ssh/authorized_keys`（把引号里换成公钥内容，不要换成私钥）。

---

## 第五步：确认 GitHub Secrets

- **SSH_USERNAME** 必须和服务器上**放公钥的那个用户**一致。若公钥在 root 的 authorized_keys，就填 **root**。
- **DEPLOY_SSH_KEY** 填的是**私钥**（本机 `~/.ssh/id_ed25519` 的完整内容），不是 .pub。

---

## 小结

| 现象 | 处理 |
|------|------|
| 服务器 root 的 authorized_keys 里没有本机公钥 | 本机执行 `ssh-copy-id -i ~/.ssh/id_ed25519.pub root@plc-sim.com`，或手动追加公钥到 `/root/.ssh/authorized_keys` |
| 公钥在别的用户下（如 ubuntu） | 要么把同一公钥追加到 root 的 authorized_keys，要么把 GitHub 的 **SSH_USERNAME** 改为该用户 |
| 本机有多把钥匙，不确定用哪把 | 本机执行 `ssh -v root@plc-sim.com exit 2>&1 | grep "Offering public key"` 看实际用的钥匙，把**那把私钥**填到 DEPLOY_SSH_KEY |

完成上述后，再在 Actions 里 **Re-run all jobs** 试一次。
