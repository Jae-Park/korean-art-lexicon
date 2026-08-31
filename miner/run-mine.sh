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
# stale 락 회수 — 보유 pid가 죽었으면 버린다(heavy-guard.sh와 같은 방식).
# 없으면 비정상 종료 한 번이 다음 정기 실행을 '조용히' 막는다: skip 한 줄 찍고 exit 0이라
# 워치독엔 성공으로 보인다. 2026-08-31에 실제로 락이 남아 그 상태가 됐다.
if ! mkdir "$LOCK" 2>/dev/null; then
  holder=$(cat "$LOCK/pid" 2>/dev/null)
  if [[ -n "$holder" ]] && kill -0 "$holder" 2>/dev/null; then
    echo "$(TS) [mine] lock 점유 중(pid=$holder) → skip(수동/스케줄 충돌 방지)"
    exit 0
  fi
  echo "$(TS) [mine] stale lock 회수 (보유 pid=${holder:-기록없음}, 살아있지 않음)"
  rm -rf "$LOCK"
  if ! mkdir "$LOCK" 2>/dev/null; then
    echo "$(TS) [mine] lock 재획득 실패 → skip"
    exit 0
  fi
fi
echo $$ > "$LOCK/pid" 2>/dev/null
trap 'rm -rf "$LOCK" 2>/dev/null' EXIT

echo "$(TS) [mine] start — source=all, verify"
node src/index.js mine --source all --verify
echo "$(TS) [mine] done"
