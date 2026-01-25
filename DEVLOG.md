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

### 다음 단계
- [ ] 시드 데이터 수집 (크롤링 또는 수동 입력)
- [ ] 기여 폼 구현 (Google Form → GitHub Issue)
- [ ] 검색/브라우징 UI 개발
- [ ] The Translation Desk 연동 설계
