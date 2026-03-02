# 备份分支：创建、推送到云端与从云端拉取 — SOP

> **本 SOP 覆盖完整流程：** ① 创建今日备份 → ② 推送到 GitHub → ③ 需要时从云端拉取/恢复。

---

## 一、前置说明

- **备份分支命名：** `backup/YYYYMMDD`（如 `backup/20250302`）。
- **执行环境：** 本机 Windows 项目目录（如 `E:\Project\V2.13`）；若在服务器操作，路径与 `origin` 保持一致即可。
- **远程仓库：** 默认以 `origin` 指向 GitHub（如 `https://github.com/xxx/polo.git`），可用 `git remote -v` 查看。

---

## 二、创建今日备份（本地）

| 步骤 | 操作 | 确认 |
|------|------|------|
| 2.1 | 双击项目根目录下的 **`backup-branch-run.bat`**（推荐）或 `backup-branch.bat` | 窗口出现「Backup branch: backup/YYYYMMDD」及「Done」 |
| 2.2 | 脚本会自动：创建分支 `backup/当天日期` → 提交当前所有改动 → 切回 `main` | 无报错即表示本地备份已建好 |

**说明：** 此时备份仅在本地，要同步到 GitHub 需继续执行「三、推送到云端」。

---

## 三、推送到 GitHub 云端（详细步骤）

在**本机**项目目录下，按顺序执行下表。推送前请确认当前在 `main` 且无未提交敏感改动。

### 3.1 推送 main 分支（含最新代码与备份脚本）

| 步骤 | 命令 | 确认 |
|------|------|------|
| 3.1.1 | `cd E:\Project\V2.13` | 进入项目根目录 |
| 3.1.2 | `git status` | 确认当前分支为 `On branch main`；若有未提交改动，先 `git add -A`、`git commit -m "说明"` 或先执行「二」再推送 |
| 3.1.3 | `git push origin main` | 输出 `main -> main` 或 `Everything up-to-date`，无报错 |

**说明：** 日常开发后只需执行 3.1 即可把 main 推到云端；若刚运行过「二」中的备份脚本，main 未变则可能显示 `Everything up-to-date`。

### 3.2 推送备份分支到云端（与 main 一起做一次即可）

刚创建过今日备份、或希望把本地已有备份分支同步到 GitHub 时执行：

| 步骤 | 命令 | 确认 |
|------|------|------|
| 3.2.1 | `git branch` | 查看本地分支，记下要推送的备份分支名（如 `backup/20250302`） |
| 3.2.2 | `git push origin backup/20250302` | 将 `20250302` 换成实际日期；输出 `* [new branch] backup/20250302 -> backup/20250302` 或 `up to date` |
| 若有多个备份分支 | `git push origin backup/20250302 backup/20260302` | 一次推送多个，分支名用空格分隔 |
| 或推送所有本地分支 | `git push origin --all` | 会把所有本地分支（含 main 与所有 backup/xxx）都推到 origin |

**建议：** 每次用「二」建完当日备份后，顺手执行一次 `git push origin main` 和 `git push origin backup/YYYYMMDD`（当天日期），即可保证云端与本地一致。

### 3.3 推送结果自检（可选）

| 步骤 | 命令 | 确认 |
|------|------|------|
| 3.3.1 | `git fetch origin` | 无报错 |
| 3.3.2 | `git branch -r --list '*backup*'` 或 `git branch -r` | 能看到 `origin/backup/YYYYMMDD` 表示该备份已成功推送到云端；`--list '*backup*'` 只显示含 backup 的远程分支（PowerShell 下推荐，避免管道报错） |

---

## 四、从云端拉取备份（恢复/查看）

适用于：本机代码乱了、或想基于某天备份查看/恢复。

### 步骤 4.1：拉取云端最新分支信息

| 步骤 | 命令 | 确认 |
|------|------|------|
| 4.1.1 | `cd E:\Project\V2.13` | 进入项目根目录 |
| 4.1.2 | `git fetch origin` | 无报错，输出 `From https://github.com/...` 等 |

**说明：** `git fetch` 只更新远程分支信息，不改变当前工作区文件。

### 步骤 4.2：查看云端有哪些备份分支

| 步骤 | 命令 | 说明 |
|------|------|------|
| 4.2.1 | `git branch -r` | 列出所有远程分支，找 `origin/backup/YYYYMMDD` |
| 或   | `git branch -r --list '*backup*'` | 只列出含 `backup` 的远程分支（推荐，PowerShell 下无管道报错） |

记下要恢复的备份分支名，例如：`origin/backup/20250302`。

### 步骤 4.3：拉取并「使用」该备份（二选一）

#### 方式 A：只在该备份上查看/工作（不覆盖 main）

| 步骤 | 命令 | 确认 |
|------|------|------|
| 4.3A.1 | `git checkout -b backup/20250302 origin/backup/20250302` | 将 `20250302` 换成你要的日期；无报错即创建并切换到该备份分支 |
| 或   | 若本地已有同名分支：`git checkout backup/20250302` 再 `git pull origin backup/20250302` | 与云端该备份分支一致 |

之后当前分支即为该日期的备份，可查看、运行或在此基础上改。要回到最新开发线执行：`git checkout main`。

#### 方式 B：把该备份「覆盖」到当前 main（慎用）

**⚠️ 会丢弃 main 上未推送或未备份的改动，操作前请确认。**

| 步骤 | 命令 | 确认 |
|------|------|------|
| 4.3B.1 | `git fetch origin` | 已执行过可跳过 |
| 4.3B.2 | `git checkout main` | 确保在 main |
| 4.3B.3 | `git reset --hard origin/backup/20250302` | 将 `20250302` 换成目标备份日期；main 的当前内容会被该备份完全覆盖 |
| 4.3B.4 | `git status` | 应为 `nothing to commit, working tree clean` |

之后本机 `main` 已等于该日期的备份；若要同步到远程：`git push origin main --force`（会改写远程 main，需谨慎）。

---

## 五、常用命令速查

### 推送相关

| 目的 | 命令 |
|------|------|
| 推送 main 到云端 | `git push origin main` |
| 推送单个备份分支 | `git push origin backup/YYYYMMDD` |
| 推送多个备份分支 | `git push origin backup/20250302 backup/20260302` |
| 推送所有本地分支 | `git push origin --all` |

### 拉取/恢复相关

| 目的 | 命令 |
|------|------|
| 只更新远程分支信息 | `git fetch origin` |
| 列出远程备份分支 | `git branch -r --list '*backup*'` |
| 切到某备份分支（本地已有） | `git checkout backup/YYYYMMDD` |
| 从云端拉出某备份并切换 | `git checkout -b backup/YYYYMMDD origin/backup/YYYYMMDD` |
| 切回 main | `git checkout main` |
| 用某备份完全覆盖当前 main | `git checkout main` 后 `git reset --hard origin/backup/YYYYMMDD` |

---

## 六、注意事项

1. **未提交的改动**：`checkout` 或 `reset --hard` 可能报错或丢弃改动；可先 `git stash` 暂存，或先提交/建备份再操作。
2. **先 fetch 再拉取**：从云端恢复某备份前，必须先执行 `git fetch origin`，再按 4.3 操作。
3. **备份分支与 main**：日常开发在 `main`；备份分支仅用于快照与恢复，一般不直接在其上长期开发。
4. **推送顺序**：建议先推送 main，再按需推送备份分支；或使用 `git push origin --all` 一次推送全部。
5. **与一键备份脚本的关系**：「二」中的 `backup-branch-run.bat` 只负责在本地建分支并提交，推送到 GitHub 需按「三」手动执行或养成习惯在创建备份后立即 push。

---

## 七、相关文档与脚本

| 内容 | 位置 |
|------|------|
| 一键创建今日备份并提交到分支 | 项目根目录 `backup-branch-run.bat` / `backup-branch.bat` |
| 前端/后端同步到服务器 | `docs/前端后端同步到服务器-完整步骤.md` |
