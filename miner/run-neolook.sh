#!/bin/zsh
# Korean Art Lexicon — neolook 보드 데일리 스킴 (매일 새벽 launchd). 로컬 전용·노션 미접촉.
# 네오룩은 LiveView로 self-serve 전수수확 불가 → forward 보드(현재+예정)만 매일 누적.
# Playwright(pwenv) 로컬 실행 = $0, claude 호출 없음(6/15 크레딧 미터링 무관). push는 분리(수동·human-gate).
set -u
export PATH="/usr/local/bin:/opt/homebrew/bin:$HOME/.local/bin:/usr/bin:/bin"
cd "${0:A:h}" || exit 1
TS() { date "+%Y-%m-%d %H:%M:%S"; }
PY="$HOME/.venvs/pwenv/bin/python"

[ -x "$PY" ] || { echo "$(TS) [neolook] pwenv python 없음: $PY → skip"; exit 0; }

LOCK=/tmp/lexicon-neolook.lock
if ! mkdir "$LOCK" 2>/dev/null; then
  echo "$(TS) [neolook] lock 점유 중 → skip(중복 방지)"
  exit 0
fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

echo "$(TS) [neolook] start — board skim (local mirror only, no Notion)"
"$PY" crawl/neolook_harvest.py
echo "$(TS) [neolook] done"
