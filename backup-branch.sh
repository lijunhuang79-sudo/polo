#!/bin/bash
# Mac 上运行：在终端执行 ./backup-branch.sh 或 bash backup-branch.sh
# 作用：创建/追加当天备份分支 backup/YYYYMMDD，并在结束后切回原分支

set -e
cd "$(dirname "$0")"

TODAY=$(date +%Y%m%d)
BRANCH="backup/$TODAY"
ORIGINAL_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")

echo ""
echo "[1/6] 当前目录: $(pwd)"
echo "[2/6] 当前分支: $ORIGINAL_BRANCH"
echo "[3/6] 备份分支: $BRANCH"
echo ""

if ! command -v git >/dev/null 2>&1; then
    echo "[ERROR] 未找到 Git。请先安装 Xcode Command Line Tools 或 Git。"
    read -r -p "按回车键关闭..."
    exit 1
fi

if [ ! -d .git ]; then
    echo "[ERROR] 当前目录不是 Git 仓库（缺少 .git 文件夹）。"
    read -r -p "按回车键关闭..."
    exit 1
fi

echo "[4/6] 创建或切换到备份分支..."
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
    echo "分支已存在，切换到该分支并追加备份..."
    git checkout "$BRANCH"
else
    git checkout -b "$BRANCH"
fi

echo "[5/6] 添加并提交..."
git add -A
if ! git diff --cached --quiet 2>/dev/null; then
    git commit -m "backup: $TODAY"
    echo "已提交到分支: $BRANCH"
else
    git commit -m "backup: $TODAY empty" --allow-empty
    echo "空备份已记录: $BRANCH"
fi

echo "[6/6] 切回原分支..."
if git checkout "$ORIGINAL_BRANCH" 2>/dev/null; then
    echo ""
    echo "=== 备份完成 ==="
    echo "备份分支: $BRANCH"
    echo "已切回: $ORIGINAL_BRANCH"
    echo ""
else
    echo "[WARN] 切回 $ORIGINAL_BRANCH 失败，当前仍在 $BRANCH"
fi

read -r -p "按回车键关闭..."
