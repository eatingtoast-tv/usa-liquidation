#!/bin/zsh
# Pull the latest from Notion (Website page) and publish to the live site if anything changed.
#   ./publish.sh            → sync + push if changed
# Runs automatically every 15 min via ~/Library/LaunchAgents/com.usaliquidation.sync.plist
# Log: ~/usa-liquidation-store/sync.log
set -u
export PATH="$HOME/.local/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
cd "$(dirname "$0")" || exit 1

echo "=== $(date '+%Y-%m-%d %H:%M:%S') ==="
python3 sync_notion.py || echo "(sync had errors — only the parts that worked were updated)"

# only data files + downloaded photos are published automatically
git add data/ images/notion/ 2>/dev/null
if git diff --cached --quiet; then
  echo "no changes"
  exit 0
fi
git commit -qm "Sync from Notion $(date '+%Y-%m-%d %H:%M')" && git push -q && echo "published ✓"
