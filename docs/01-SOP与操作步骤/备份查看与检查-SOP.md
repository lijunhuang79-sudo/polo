# 备份查看与检查 — SOP

> **说明：** 本项目的备份通过 Git 分支实现，每次执行备份会生成分支 `backup/YYYYMMDD`（如 `backup/20260303`）。本 SOP 用于查看、检查已有备份。

---

## 一、备份方式与文件位置

| 环境   | 操作方式                         | 备份逻辑脚本        |
|--------|----------------------------------|---------------------|
| Windows | 双击 `backup-branch-run.bat`     | backup-branch.bat    |
| Mac    | 双击 `backup-branch-run.command` | backup-branch.sh     |

备份结果：在**当前仓库**中多出一个本地分支 `backup/当天日期`，并产生一次提交（有改动则正常提交，无改动则 `--allow-empty`）。  
若已配置远程并执行过 `git push`，远程也会存在对应分支（如 `origin/backup/20260303`）。

---

## 二、查看已有备份分支（列表）

在项目根目录打开终端执行。

### 2.1 只看本地备份分支

```bash
git branch | grep backup
```

示例输出：
```
  backup/20250302
  backup/20260302
  backup/20260303
```

### 2.2 看所有本地分支（含 main）

```bash
git branch
```

### 2.3 看本地 + 远程的备份分支

```bash
git branch -a | grep backup
```

示例输出：
```
  backup/20250302
  backup/20260302
  backup/20260303
  remotes/origin/backup/20250302
  remotes/origin/backup/20260302
  remotes/origin/backup/20260303
```

---

## 三、查看某个备份的“当时文件”（进入该备份）

要像打开历史快照一样查看某天备份的完整文件状态，可切换到该备份分支。

### 3.1 进入备份分支

```bash
# 将 20260303 换成你要查看的日期
git checkout backup/20260303
```

执行后，工作区中的文件会变为**该备份当天的状态**，可在访达/资源管理器中直接打开项目查看。

### 3.2 查看完毕切回主分支

```bash
git checkout main
```

**注意：** 查看完备份后务必执行本步，否则会一直停留在备份分支上。

---

## 四、不切换分支，仅检查备份内容差异

不想切换分支时，可直接对比某备份与 `main` 的差异。

### 4.1 看该备份相对 main 改了哪些文件（文件名列表）

```bash
# 将 backup/20260303 换成目标备份分支名
git diff main..backup/20260303 --stat
```

### 4.2 看具体内容差异（全文 diff）

```bash
git diff main..backup/20260303
```

### 4.3 只看某备份的提交记录

```bash
git log backup/20260303 -5
```

可确认该备份的提交信息（通常为 `backup: YYYYMMDD` 或 `backup: YYYYMMDD empty`）。

---

## 五、快速检查清单（每次查看备份时）

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | `git branch \| grep backup` | 能看到至少一条 `backup/YYYYMMDD` |
| 2 | 选定日期，执行 `git checkout backup/YYYYMMDD` | 终端显示 `Switched to branch 'backup/YYYYMMDD'` |
| 3 | 在项目目录中浏览/打开文件 | 文件内容为该备份日期的状态 |
| 4 | 执行 `git checkout main` | 终端显示 `Switched to branch 'main'`，回到当前开发分支 |

---

## 六、常见问题

**Q：执行 `git branch \| grep backup` 没有输出？**  
- 表示本地还没有任何 `backup/` 分支，需先在本机执行一次备份（双击 `backup-branch-run.bat` 或 `backup-branch-run.command`）。

**Q：远程有没有备份分支？**  
- 执行 `git push origin backup/YYYYMMDD` 后，远程才会有该备份分支；仅本地备份时远程不会自动出现。

**Q：想恢复某备份到当前 main 可以吗？**  
- 可以，但不建议直接强制覆盖。推荐做法：`git checkout backup/YYYYMMDD` 查看确认后，把需要的文件复制出来，再在 `main` 上手动合并或粘贴；或使用 `git merge backup/YYYYMMDD`（可能产生合并提交，需根据需求决定）。

---

## 七、命令速查

| 目的           | 命令 |
|----------------|------|
| 列出本地备份分支 | `git branch \| grep backup` |
| 列出本地+远程备份 | `git branch -a \| grep backup` |
| 进入某备份查看   | `git checkout backup/YYYYMMDD` |
| 回到主分支      | `git checkout main` |
| 看备份与 main 的文件差异 | `git diff main..backup/YYYYMMDD --stat` |
| 看备份的提交记录 | `git log backup/YYYYMMDD -5` |

---

*文档版本：1.0 | 适用于 Windows / Mac 备份脚本*
