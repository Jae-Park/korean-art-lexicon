#!/bin/zsh
# Korean Art Lexicon — 주간 harvest (목 07:30 launchd). 노션 approved → materialize → staging → validate.
# 기본 dry-run: 저장소 쓰기(PR)는 사람 게이트. 로그 확인 후 'node src/index.js harvest --push' 로 PR 생성.
set -u
export PATH="/usr/local/bin:/opt/homebrew/bin:$HOME/.local/bin:/usr/bin:/bin"
export LEXICON_VENV="$HOME/.venvs/lexicon/bin/python"
cd "${0:A:h}" || exit 1
[ -f .env ] && set -a && source .env && set +a
TS() { date "+%Y-%m-%d %H:%M:%S"; }

if [ -z "${NOTION_TOKEN:-}" ]; then
  echo "$(TS) [harvest] NOTION_TOKEN 미설정 → skip"
  exit 0
fi

LOCK=/tmp/lexicon-harvest.lock
if ! mkdir "$LOCK" 2>/dev/null; then
  echo "$(TS) [harvest] lock 점유 중 → skip"
  exit 0
fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

echo "$(TS) [harvest] start — dry-run(materialize+validate). PR은 수동 --push."
node src/index.js harvest
echo "$(TS) [harvest] done — approved 승격하려면: node src/index.js harvest --push"
