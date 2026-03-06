#!/bin/bash
cd "$(dirname "$0")"
chmod +x "./backup-branch.sh" 2>/dev/null || true
exec "./backup-branch.sh"
