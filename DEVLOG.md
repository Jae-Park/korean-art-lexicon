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

---

## 2026-04-02

### Organizations 카테고리 본격 구축 + Terms 보강

**배경**: organizations 카테고리가 2개(MMCA, 테이크아웃드로잉)에 머물러 있어, 한국 현대미술 인프라의 핵심 기관들을 우선 추가.

**기관 추가 (6건)**

| 엔트리 | 비고 |
|--------|------|
| 광주비엔날레재단 | 재단법인, 1995 설립. Wikidata Q484487 |
| (사)부산비엔날레조직위원회 | 사단법인, 1999 설립. 광주와 달리 사단법인 형태 확인 |
| 아르코미술관 | 1974 미술회관 개관 → 2005 현 명칭. 전 명칭 variants로 기록 |
| 서울시립미술관 | 서울시 운영, 1988. Wikidata Q7451676. 컬렉션 6,310점 |
| 아트선재센터 | 사립, 1998. Wikidata Q4801558 |
| 국제갤러리 | 1982 이현숙 설립(인사동), 1987 소격동 이전 |

**용어 추가 (1건)**
- 민중미술 — 1980년 광주항쟁 계기, Wikidata Q6867771. Tate + Wikipedia 교차 확인

**데이터 현황**
- 기관: 2 → 8 (6건 추가)
- 용어: 3 → 4 (1건 추가)
- 총 엔트리: 77 → 84

**특이사항**
- 부산비엔날레 법인명 조사: `(사)부산비엔날레조직위원회` — GOKAMS 국내DB + bizno.net으로 사단법인 확인. 행사명(`부산비엔날레`)과 법인명을 name.ko / variants로 구분
- 아르코미술관 연혁은 공식 사이트 연혁 페이지가 404. ARKO 공식 게시판 50주년 공지(arko.or.kr/board/view/4057)에서 1974·1979·2002·2005 연혁 확인
- 일별 자동 리서치 리포트 운영 시작 (`reports/daily/YYYY-MM-DD.md`)

**미결 과제**
- `gwangju-biennale`, `busan-biennale` — `type.aat: 300266309`은 전시(biennial) ID. 기관/법인에 적합한 AAT ID로 교체 필요
- `kukje-gallery` — Wikidata ID 미확인
- `minjung-misul` — `period.end` 소스 미확인
- 광주/부산비엔날레 에디션별 exhibitions 미작성
