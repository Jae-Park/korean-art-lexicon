# Korean Art Lexicon — Development Log

## 2025-01-25

### 프로젝트 초기 세팅 완료

**구조**
- 4개 엔티티 타입 정의: persons, exhibitions, organizations, terms
- JSON Schema 기반 데이터 검증 시스템 구축
- GitHub Actions CI로 PR 시 자동 검증

**데이터 스키마**
- `person.schema.json` — 인물 (성/이름 분리, 로마자 표기 변형 추적)
- `exhibition.schema.json` — 전시
- `organization.schema.json` — 기관
- `term.schema.json` — 용어 (번역 유형: transliteration, semantic, literal, loan)

**샘플 데이터**
- 인물: 김수자, 이우환, 박찬경
- 전시: 베니스비엔날레 한국관 2024, MMCA 현대차 시리즈 2023
- 기관: 국립현대미술관, 테이크아웃드로잉
- 용어: 단색화, 신생공간

**랜딩 페이지**
- 2-column 한영 병렬 레이아웃
- IBM Plex Sans / IBM Plex Sans KR 폰트
- 베이퍼웨이브 무빙 그라데이션 배경
- 고정 헤더 + backdrop blur
- 반응형 모바일 대응

**배포**
- GitHub Pages 활성화: https://jae-park.github.io/korean-art-lexicon/
- 레포 public 전환

**자동화**
- `update-date.yml` — push 시 Last Updated 날짜 자동 업데이트

**문서**
- `docs/gokams-analysis.md` — GOKAMS 사이트 분석 및 개선점 정리

---

## 2026-03-27

### 시드 데이터 수집 Phase 1: MMCA 현대차 시리즈

**전략**: 단일 기관(MMCA)을 앵커로 깊게 파고, 전시 → 작가 연쇄 등록하는 프로토타입 워크플로 확립.

**전시 추가 (10건)**
- MMCA 현대차 시리즈 전시 2014–2024 전체 등록
- 이불, 안규철, 김수자, 임흥순, 최정화, 박찬경, 양혜규, 문경원&전준호, 최우람, 정연두, 이슬기

**인물 추가 (12명)**
- 현대차 시리즈 참여 작가: 이불, 안규철, 임흥순, 최정화, 양혜규, 문경원, 전준호, 최우람, 정연두, 이슬기
- 단색화 주요 작가 (dangling ref 해소): 박서보, 하종현

**용어 추가 (1건)**
- 대안공간 (alternative space) — sinseang-gonggan에서 참조하던 dangling ref 해소

**데이터 현황**
- 인물: 3 → 15 (12명 추가)
- 전시: 2 → 12 (10건 추가)
- 기관: 2 (변동 없음)
- 용어: 2 → 3 (1건 추가)
- 총 엔트리: 9 → 32

**특이사항**
- 로마자 표기 주의점: 양혜규(Haegue Yang), 정연두(Yeondoo Jung), 이슬기(Seulgi Lee)는 given-family 순서를 공식 표기로 사용
- 최정화는 Choi Jeong Hwa / Choi Jeong-hwa / Choi Jung Hwa 등 표기 변형 다수
- 최우람은 Choe U-Ram / Choi Woo-Ram / U-Ram Choe 등 표기 변형 다수

---

### 다음 단계
- [ ] MMCA 주요 기획전 추가 (현대차 시리즈 외)
- [ ] 다른 기관 확장 (아트선재센터, 리움미술관, 국제갤러리 등)
- [ ] 기여 폼 구현 (Google Form → GitHub Issue)
- [ ] 검색/브라우징 UI 개발
- [ ] The Translation Desk 연동 설계
