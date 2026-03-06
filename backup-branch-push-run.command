#!/bin/bash
cd "$(dirname "$0")"
chmod +x "./backup-branch-push.sh" 2>/dev/null || true
exec "./backup-branch-push.sh"
