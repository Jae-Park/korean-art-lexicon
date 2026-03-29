#!/usr/bin/env bash
#
# Korean Art Lexicon — 원스텝 파이프라인
# 데이터 변경 후 이 스크립트 하나로: 검증 → 빌드 → 확인
#
# Usage:
#   ./scripts/pipeline.sh              # data/ 전체 (URL 체크 포함)
#   ./scripts/pipeline.sh --no-url-check  # URL 체크 생략 (오프라인)
#   ./scripts/pipeline.sh staging/     # staging/ 대상
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

# 인자 파싱
TARGET="${1:-data/}"
URL_FLAG=""
if [[ "${1:-}" == "--no-url-check" ]]; then
    URL_FLAG="--no-url-check"
    TARGET="${2:-data/}"
elif [[ "${2:-}" == "--no-url-check" ]]; then
    URL_FLAG="--no-url-check"
fi

echo "=================================================="
echo "  Korean Art Lexicon — Pipeline"
echo "=================================================="
echo ""

# Step 1: validate_auto.py
echo "▶ Step 1: 자동 검증 (validate_auto.py)"
echo "--------------------------------------------------"
if ! python3 scripts/validate_auto.py "$TARGET" $URL_FLAG; then
    echo ""
    echo "❌ 검증 실패 — 빌드 중단"
    exit 1
fi
echo ""

# Step 2: build
echo "▶ Step 2: 빌드 (build.py → dist/lexicon.json)"
echo "--------------------------------------------------"
python3 scripts/build.py
echo ""

# Step 3: 빌드 결과 요약
echo "▶ Step 3: 빌드 결과 확인"
echo "--------------------------------------------------"
if [ -f dist/lexicon.json ]; then
    python3 -c "
import json
with open('dist/lexicon.json') as f:
    d = json.load(f)
total = sum(len(v) for v in d.values())
print(f'  총 {total}개 엔트리')
for k, v in d.items():
    print(f'    {k}: {len(v)}개')
"
    echo ""
    echo "✅ 파이프라인 완료"
    echo "   로컬 확인: http://localhost:8080/lexicon.html"
else
    echo "❌ dist/lexicon.json 생성 실패"
    exit 1
fi
