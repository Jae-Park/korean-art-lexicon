# Korean Art Lexicon — 로드맵

## 현재 상태 (2026-03-31)

### 인프라
- 5개 엔티티 스키마: person, exhibition, organization, term, publication
- 타입/분류: Getty AAT ID 기반 (커스텀 enum 제거)
- name/title.variants: 구조화된 이름 변형 (lang, script, type, source, accessed)
- external_ids: ULAN, Wikidata, VIAF, ISNI, AAA, WorldCat 연결 준비
- 검증 파이프라인: validate_auto.py → build.py → lexicon.json
- GitHub Actions 자동 빌드 (data/ 변경 시)
- VIAF lookup 스크립트 (읽기 전용, 후보 조회)

### 데이터
- persons: 47명 (한국 현대미술 작가 중심)
- exhibitions: 25건 (베니스 한국관 1995-2024, MMCA 현대차 2014-2023)
- organizations: 2곳 (MMCA, 테이크아웃드로잉)
- terms: 3개 (단색화, 대안공간, 신생공간)
- publications: 0건 (스키마 완성, 데이터 추가 예정)

---

## 단기 (항목 100개까지)

- [ ] CLI 리뷰 스크립트 — pending_review 항목 승인/거부 (터미널)
- [ ] pending_review 7건 처리
- [ ] VIAF ID 등록 — lookup_viaf.py 결과 확인 후 수동 등록
- [ ] 베니스 한국관 데이터 보강 — type (AAT), 누락 정보 추가
- [ ] GOKAMS 용어 확장 (30-50개)
- [ ] 광주비엔날레 데이터 추가
- [ ] publication 엔트리 시작 — 주요 전시 도록부터
- [ ] validate_source_content.py 고도화 (출처 내용 자동 대조)

## 중기 (항목 100-500개)

- [ ] 추가 기관 크롤링 — 아르코, 서울시립미술관, 부산현대미술관
- [ ] 외국 작가 한국어명 수집 시작
- [ ] 외국 전시 한국어 제목 수집 시작
- [ ] Wikidata 연동 — external_ids.wikidata 체계적 등록
- [ ] Getty ULAN 기여 검토 — 한국 작가 이름 변형 제출 가능성 조사
- [ ] 크롤러 자동화 (scripts/scrape/)
- [ ] 데이터 임포트/익스포트 도구

## 장기 (항목 500-1,000개)

- [ ] 백엔드 도입 검토 (Supabase + Next.js)
  - YAML → PostgreSQL 전환
  - Row Level Security 기반 권한 관리
  - YAML ↔ DB 양방향 싱크 (전환기)
- [ ] 사용자 등록 + 권한 계층
  - viewer → contributor → reviewer → editor → admin
- [ ] 웹 리뷰 인터페이스
- [ ] 공개 API 엔드포인트
- [ ] AAA (Asia Art Archive) 연동
- [ ] 커뮤니티 기여 워크플로우

## 원칙

- **1,000개 미만은 1인 관리** — 오버엔지니어링 금지
- **출처 우선** — LLM 기억 기반 데이터 작성 절대 금지
- **국제 표준 준수** — Getty AAT, ISO 639-1, ISO 15924, ISO 3166-1
- **점진적 전환** — YAML → DB 전환 시 기존 워크플로우 유지하며 이행
- **우리가 권위적인 것만 저장** — 한국미술 이름 변형. 전기 데이터는 external_ids로 연결
