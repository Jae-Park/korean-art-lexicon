# Korean Art Lexicon — 로드맵

## 현재 상태 (2026-03-27)

### 완료
- [x] 데이터 스키마 설계 (exhibition, person, organization, term)
- [x] 디렉토리 구조 확정 (data/, staging/, specs/, scripts/)
- [x] 검증 파이프라인 설계 (자동 검증 → staging → 인간 리뷰 → data)
- [x] validate_auto.py 작성 (스키마 + 출처 + 중복 검증)
- [x] MMCA 현대차 시리즈 2014-2023 전시 데이터 재구축 (출처 검증 완료, 10건)
- [x] specs/sources.yaml + field-mapping/mmca.yaml 작성
- [x] 랜딩 페이지 + lexicon 프로토타입 페이지

### 다음 단계
- [ ] staging/ 내 미검증 데이터 (persons, organizations, terms) 출처 확보 후 data/로 이동
- [ ] MMCA 추가 전시 데이터 수집 (현대차 시리즈 외)
- [ ] lexicon 프론트엔드를 data/에서 직접 읽도록 연결
- [ ] 추가 기관 크롤링 대상 선정 및 specs 추가

### 장기 목표
- [ ] 크롤러 자동화 (scripts/scrape/)
- [ ] 사용자 입력 인터페이스
- [ ] 커뮤니티 검증 레이어 (validate_submission.py)
- [ ] 1차 출처(본인) 신원 확인 시스템
