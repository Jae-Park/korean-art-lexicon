# Korean Art Lexicon — Project Rules

## 데이터 무결성 원칙 (Data Integrity Rules)

### 절대 규칙: 출처 우선 (Source-First)
1. **기억 기반 데이터 작성 금지**: LLM의 기억에서 나온 정보를 YAML 데이터로 직접 작성하지 않는다.
2. **워크플로우 순서**: `출처 URL 확보 → 페이지에서 직접 추출 → YAML 작성`. 이 순서를 절대 뒤집지 않는다.
3. **LLM 기억은 검색어로만 사용**: "박찬경 2019 MMCA" 같은 검색 키워드로만 활용하고, 검색 결과에서 확인된 정보만 기록한다.

### sources 필드 규칙
- 모든 YAML 파일에 `sources` 필드 필수
- 루트 URL 금지 (예: `https://www.mmca.go.kr` ✗)
  - **예외**: 작가/기관 공식 웹사이트는 루트 URL 허용 (note에 "official website", "studio website", "foundation official", "estate" 등 명시)
- 전시 상세 페이지, 작가 프로필 등 구체적 URL만 허용 (예: `https://www.mmca.go.kr/exhibitions/exhibitionsDetail.do?exhId=...` ✓)
- **URL도 날조 금지**: "이 갤러리에 이 작가 페이지가 있을 것 같다"로 URL을 추정해서 작성하지 않는다. 반드시 검색으로 실제 URL을 확인한 후 기록한다.
- URL 없이 데이터를 작성할 경우 `status: unverified` 표시 필수
- **`accessed` 필드**: 출처 접속일을 `YYYY-MM-DD` (ISO 8601) 형식으로 기록. 새로 추가/검증하는 출처부터 기입한다.

### 검증 기준
- 제목(한/영), 날짜, 참여 작가 등 핵심 필드는 반드시 출처 페이지와 1:1 대조
- "그럴듯한" 정보를 추정하여 채우지 않는다 — 확인 불가 시 필드를 비워둔다

### 엔트리 조사 체크리스트
새 엔트리를 작성하거나 기존 엔트리를 보강할 때 아래 항목을 모두 확인한다:
1. **기관 출처** — MMCA, 갤러리 대표 페이지 등 (상세 URL)
2. **언론 출처** — e-flux, ArtReview, Artforum 등 기사/공지
3. **작가/기관 공식 웹사이트** — 루트 URL 허용, note에 "official website" 명시
4. **한국어 출처** — ARKO, 국내 언론 (한글 이름 검증용)
5. **`accessed` 날짜** — 각 출처별 접속일 기록 (`YYYY-MM-DD`)

---

## 엔티티 스키마 (5 types)

| 엔티티 | ID 패턴 | 이름/제목 필드 | 타입/분류 필드 |
|--------|---------|-------------|-------------|
| person | `person.{slug}` | `name.ko`, `name.latn` | `role[].aat` (역할) |
| exhibition | `exhibition.{slug}` | `title.ko`, `title.en` | `type.aat` (전시 유형) |
| organization | `org.{slug}` | `name.ko`, `name.en` | `type.aat` (기관 유형) |
| term | `term.{slug}` | `term.ko`, `term.en` | `category.aat` (용어 분류) |
| publication | `publication.{slug}` | `title.ko`, `title.en` | `type.aat` (출판물 유형) |

### 타입 분류: Getty AAT ID 기반
커스텀 enum 대신 Getty AAT Subject ID를 사용한다. 새 타입 추가 시 반드시 AAT 페이지에서 ID를 직접 검증한다.

**현재 사용 중인 AAT ID:**
- 전시: `300266309` (biennials), `300449166` (group exhibitions), `300449167` (solo exhibitions)
- 기관: `300312281` (museums), `300192556` (alternative spaces)
- 용어: `300055769` (cultural movements and attitudes)
- 출판물: `300026096` (exhibition catalogs), `300060417` (monographs), `300026657` (periodicals)
- 역할: `300025103` (artists), `300025633` (curators), `300025519` (critics)

### name.variants / title.variants
모든 엔티티에 공통 구조:
```yaml
variants:
- form: "이름/제목 변형"
  lang: "ko"           # ISO 639-1
  script: "Hang"       # ISO 15924 (Hang|Hani|Kore|Latn|Jpan|Hans|Hant)
  type: "preferred"    # preferred|alternate|abbreviation|former|transliteration
  source: "출처 기관/출판물"
  accessed: "2026-03-30"
```
person만 추가 필드: `romanization` (revised|mcr|yale|artist|conventional), `display_order` (given-family|family-given)

### external_ids
외부 권위 파일 연결 (선택, 검증된 경우만 추가):
- `ulan`: Getty ULAN Subject ID (person, org)
- `wikidata`: Wikidata Q-item ID (all)
- `viaf`: VIAF cluster ID (person, org)
- `isni`: ISNI (person)
- `aaa`: Asia Art Archive actor/event ID (all)
- `worldcat`: WorldCat OCLC number (publication)
- `aat`: Getty AAT Subject ID (term — 용어 자체가 AAT에 있는 경우)

---

## 데이터 유입 경로

### 1. 기관 크롤링 (자동/반자동)
- 대상: MMCA 등 신뢰 기관 웹사이트
- 설정: `specs/sources.yaml` + `specs/field-mapping/` 기반
- 흐름: `크롤링 → 자동 검증 → staging/ → 인간 리뷰 → data/`

### 2. 사용자 입력 (수동)
- 대상: 작가, 큐레이터, 연구자 등 외부 기여자
- 흐름: `입력 → 자동 검증 → staging/ → 인간 리뷰 → data/`

---

## 출처 유형 (Source Types)

| 유형 | 예시 | 검증 방법 |
|------|------|-----------|
| **기관 출처 (institutional)** | MMCA 전시 상세 페이지 | URL 접근 가능 + 내용 대조 |
| **문헌 출처 (bibliographic)** | 도록, 논문, 기사 | 서지 정보 확인 |
| **1차 출처 (firsthand)** | 작가·큐레이터 본인 | 신원 확인 (기관 이메일, person 레코드 연결, 에디터 승인) |

---

## 검증 파이프라인

```
모든 입력 ──→ [자동 검증] ──→ staging/ ──→ [인간 리뷰] ──→ data/
               (기계)          (대기)        (에디터)        (확정)
```

### 1단계: 자동 검증 — 입구 차단 (validate_auto.py)
- 스키마: 필수 필드, 형식, 타입 체크
- 중복: 기존 data/와 충돌 여부
- 출처 형식: 루트 URL 금지, 상세 URL 필수
- **URL 생존 확인: 404 = 💀 DEAD_URL → 즉시 FAIL (허구 출처 차단)**
- 봇 차단(403)은 PASS (URL 자체는 존재)
- **통과 못 하면 staging/에도 못 들어감**
- 옵션: `--no-url-check`로 오프라인 실행 가능

### 2단계: 출처 내용 대조 (validate_source_content.py)
- URL 페이지를 실제로 fetch하여 YAML 핵심 필드와 텍스트 대조
- 404(허구 URL) vs 403(봇 차단) vs 200+불일치 3단계 구분
- Playwright fallback: urllib 봇 차단 시 헤드리스 브라우저로 재시도
- 옵션: `--no-playwright`, `--verbose`

### 3단계: 인간 리뷰 (에디터)
- 내용의 정확성, 맥락 판단
- 기존 데이터와의 일관성
- 승인 / 수정 요청 / 거부
- **기계가 대체할 수 없는 영역**

---

## Status 체계

```
rejected ←── [인간 리뷰] ──→ stable
                  ↑
submitted → [자동 검증] → pending_review (staging/)
                |
              failed (입력자에게 피드백)
```

| Status | 의미 | 위치 |
|--------|------|------|
| `submitted` | 입력됨, 미검증 | 입력 큐 |
| `failed` | 자동 검증 실패 | 반려 |
| `pending_review` | 자동 검증 통과, 인간 리뷰 대기 | staging/ |
| `reviewed` | 인간 리뷰 통과, 공개 가능 | data/ |
| `firsthand` | 1차 출처 (본인) 확인됨 | staging/ → data/ |
| `stable` | 최종 검증 완료 | data/ |
| `rejected` | 인간 리뷰에서 거부 | 반려 |

> **공개 기준**: `pending_review` 엔트리는 웹 프론트엔드에서 필터링되어 비공개. `reviewed` 이상만 공개.

---

## 데이터 변경 후 필수 프로세스

**데이터(YAML) 변경 시 반드시 아래 전체를 실행한다. 중간에 멈추지 않는다.**

```bash
./scripts/pipeline.sh          # 원스텝: validate → build → verify
```

또는 수동 실행:
```
1. python3 scripts/validate_auto.py data/        ← 스키마+URL 검증
2. python3 scripts/build.py                       ← dist/lexicon.json 재빌드
3. 브라우저에서 변경 항목 확인                       ← 눈으로 검증
```

**절대 하지 않을 것:**
- validate만 돌리고 build를 안 하는 것
- build만 하고 브라우저 확인을 안 하는 것
- 사용자가 "검증했어?" "확인했어?"라고 물어봐야 진행하는 것

---

## 프로젝트 디렉토리 구조

```
korean-art-lexicon/
├── CLAUDE.md                     # 이 파일 — 프로젝트 규칙
├── plan.md                       # 로드맵
├── specs/                        # 크롤링 설정 (영구 인프라)
│   ├── sources.yaml              #   기관별 URL 패턴, 수집 주기
│   └── field-mapping/            #   기관별 HTML → YAML 필드 매핑
├── scripts/
│   ├── validate_auto.py          # 1단계: 스키마+중복+출처형식+URL생존 (중첩 required 재귀 체크)
│   ├── validate_source_content.py # 2단계: 출처 내용 대조 (진위 검증)
│   ├── build.py                  # YAML → dist/lexicon.json 빌드
│   ├── pipeline.sh               # 원스텝: validate → build → verify
│   └── scrape/                   # 기관별 크롤러
├── staging/                      # 자동 검증 통과, 인간 리뷰 대기
├── data/                         # 확정 데이터만
│   ├── exhibitions/
│   ├── persons/
│   ├── organizations/
│   ├── terms/
│   └── publications/
└── site/                         # 프론트엔드 (lexicon 웹)
```
