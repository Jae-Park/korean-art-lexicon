#!/bin/zsh
# Korean Art Lexicon — 주간 mine (월 07:30 launchd). 토큰 없으면 no-op.
# source=all: GOLD(MMCA) + SILVER(번역DB) → 3티어 검증 → 가중치 → Notion push.
set -u
export PATH="/usr/local/bin:/opt/homebrew/bin:$HOME/.local/bin:/usr/bin:/bin"
cd "${0:A:h}" || exit 1
[ -f .env ] && set -a && source .env && set +a
TS() { date "+%Y-%m-%d %H:%M:%S"; }

if [ -z "${NOTION_TOKEN:-}" ]; then
  echo "$(TS) [mine] NOTION_TOKEN 미설정 → skip (토큰 설정 후 자동 활성)"
  exit 0
fi

LOCK=/tmp/lexicon-miner.lock
if ! mkdir "$LOCK" 2>/dev/null; then
  echo "$(TS) [mine] lock 점유 중 → skip(수동/스케줄 충돌 방지)"
  exit 0
fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

echo "$(TS) [mine] start — source=all, verify"
node src/index.js mine --source all --verify
echo "$(TS) [mine] done"
