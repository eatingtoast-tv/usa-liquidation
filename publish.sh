#!/bin/zsh
# Pull the latest from Notion (Website page) and publish to the live site if anything changed.
# BACKUP syncer (every 5 min via ~/Library/LaunchAgents/com.usaliquidation.sync.plist) — the main one is
# GitHub Actions (.github/workflows/notion-sync.yml). Safe to run alongside it. Log: sync.log
set -u
export PATH="$HOME/.local/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
cd "$(dirname "$0")" || exit 1
echo "=== $(date '+%Y-%m-%d %H:%M:%S') ==="

# start from exactly what's live (drop any half-finished local data), then pull
git checkout -q -- data/ images/notion/ 2>/dev/null
git clean -fdq images/notion/ 2>/dev/null
git pull -q --rebase --autostash || { git rebase --abort 2>/dev/null; echo "pull failed, skipping"; exit 1; }

python3 sync_notion.py || echo "(sync had errors — only the parts that worked were updated)"

git add -A data/
[ -d images/notion ] && git add -A images/notion/
git add -u images/notion/ 2>/dev/null
if git diff --cached --quiet; then echo "no changes"; exit 0; fi
git commit -qm "Sync from Notion (Mac) $(date '+%Y-%m-%d %H:%M')"
# if GitHub's job pushed first, rebase on top and try once more
git push -q || { git pull -q --rebase && git push -q; } && echo "published ✓"
