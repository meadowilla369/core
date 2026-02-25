#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f IMPLEMENTATION_CHECKLIST.md ]]; then
  echo "IMPLEMENTATION_CHECKLIST.md not found"
  exit 1
fi

done_count=$(rg -n "^- \[x\]" IMPLEMENTATION_CHECKLIST.md | wc -l | tr -d ' ')
pending_count=$(rg -n "^- \[ \]" IMPLEMENTATION_CHECKLIST.md | wc -l | tr -d ' ')

echo "Checklist status"
echo "- completed: ${done_count}"
echo "- pending:   ${pending_count}"
