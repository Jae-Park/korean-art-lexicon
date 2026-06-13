# 기관 스크랩 진행 상태

_정본: specs/institutions.yaml · published는 dist에서 라이브 계산 · 5개 기관_

| 단계 | 기관 | 도메인 | crawled | candidates | pushed | published(live) | 범위 | 갱신 |
|---|---|---|---|---|---|---|---|---|
| 🟢 live | 국립현대미술관 (MMCA) | mmca.go.kr | · | · | · | 51 | 전시(정기 월/목 크롤) | 2026-06-11 |
| 📤 pushed | 대안공간 풀 (Art Space Pool) | altpool.org | 244 | 459 | 459 | 0 | 전시 1999-2020 전체(b_type=8) | 2026-06-13 |
| ⬜ planned | 아트선재센터 (Art Sonje Center) | artsonje.org | · | · | · | 1 | 전시·작가 | 2026-06-13 |
| ⬜ planned | 국제갤러리 (Kukje Gallery) | kukjegallery.com | · | · | · | 11 |  | 2026-06-13 |
| ⬜ planned | 광주비엔날레 (Gwangju Biennale) | gwangjubiennale.org | · | · | · | 1 |  | 2026-06-13 |

## 크롤 체크포인트

_재크롤 시 high_water 초과분만 증분 수집. local_archive = 영구 저장본._

| 기관 | 최근 크롤 | 레코드 | 범위(extent) | high_water | 로컬 저장본 |
|---|---|---|---|---|---|
| 대안공간 풀 | 2026-06-13 | 244 | b_type=8 전체, board_id 303–2206, 전시 244건, 1999–2020 | max_board_id=2206, b_types=[8] | `crawl-archive/altpool/altpool_20260613.json` |
