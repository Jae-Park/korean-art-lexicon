# Miner harvest runbook — 2026-07-14

범위: Notion `Lexicon Candidates`의 처리=`new` 약 9,929개 중, Source-First 강한 인물만 `staging/`의 `pending_review`로 만든다. 이 문서는 mine/harvest/materialize를 실행하지 않은 상태에서 코드와 2026-06-23 보류 커밋을 읽어 작성했다.

## 먼저 알아둘 점

- 새 miner는 `mine`의 Notion create 직전에 DB 전체의 `dedup_key`를 엔티티별로 전수 조회한다. 같은 키가 `new`, `rework`, `approved`, `rejected`, `materialized` 중 어느 상태로든 있으면 새 행을 만들지 않는다. 재시도 시 `run_date`도 갱신하지 않고 skip한다. 코드: `miner/src/index.js`, `miner/src/notion.js`, `miner/src/dedup.js`.
- `miner/scripts/materialize_longtail.mjs`는 이번 Notion 큐용이 아니다. 과거 `wikidata-romanization.json`을 읽고 MMCA API를 직접 호출하며, `--apply`는 `data/persons/`에 바로 쓴다. 실행하지 않는다.
- 현재 Notion 후보의 로컬 덤프는 필요 없다. `gate`가 Notion에서 필요한 `new/rework` 행을 읽어 `reports/miner/publish-gate.json`이라는 검토용 스냅샷을 쓴다. 실제 materialize 입력은 사람이 Notion에서 `approved`로 바꾼 행을 `harvest`가 다시 조회한다.

## 강한 출처 티어: 선택 규칙과 사람 게이트

자동 1차 필터는 아래 세 조건 중 코드로 증명되는 부분만 사용한다.

1. `node miner/src/index.js gate --min-inst 3`의 `ready`만 후보로 한다. `ready`는 (SeMA와 MMCA 동시 언급 **또는** 정규화 기관 3개 이상)이며, 로마자 표기가 2개 이상 있고 공백·하이픈·마침표 제거 후 모두 일치한 인물이다.
2. 각 `ready`의 Notion 원행과 `sources`를 열어, MMCA 영문 전시/소장품 상세의 로마자 표기 또는 `crawl-archive/mmca/artist_romanization.json`의 동일 인물 매핑이 있는지 사람 확인한다. 매핑 자체는 과거 `materialize_longtail.mjs`가 만들었으며, gate가 자동 결합하지는 않는다.
3. 동음가드: `conflict`(로마자 정규형 불일치), `needRoman`(0~1 표기), 이름/직업이 다른 동명이인, 듀오·콜렉티브 및 기관은 승인하지 않는다. `gate`의 동음가드는 `miner/src/index.js`의 `romanizations` 비교이고, Wikidata 보조 가드는 `miner/scripts/wikidata_romanize.mjs`에 있으나 Wikidata만으로 materialize하지 않는다. 블랙리스트는 `miner/src/blacklist.js`에서 mine과 gate 모두 제외한다.

따라서 MMCA 로마자맵 + 다기관 + 동음가드를 한 번에 자동 승인하는 현행 명령은 없다. 위 2번은 사람이 페이지/매핑과 Notion 원행을 대조하는 Source-First 게이트다. `ready`라도 이 대조를 통과한 행만 `approved`로 바꾼다.

## 다음 실행 순서

아래는 네트워크와 `miner/.env`의 `NOTION_TOKEN`, `NOTION_CANDIDATES_DB_ID`가 필요한 단계다. `gate`와 `harvest`만 Notion REST를 호출한다. `harvest`는 `--push` 없이 실행해야 staging에서 멈춘다.

```sh
cd ~/Developer/korean-art-lexicon
set -a; source miner/.env; set +a
node miner/src/index.js gate --min-inst 3
# reports/miner/publish-gate.json의 ready와 Notion 원행을 사람이 대조한 뒤, 통과 행만 Notion에서 처리=approved
node miner/src/index.js harvest
```

`harvest`는 `/tmp/lexicon_approved.json`을 일회성으로 만들고 `scripts/materialize.py`를 호출해 `staging/`에 `pending_review` YAML을 쓴다. 이어 `validate_auto.py staging/ --no-url-check`까지만 수행한다. staging을 사람이 열어 이름·영문표기·상세 URL·동명이인을 다시 확인한 뒤에만, 별도 작업에서 URL 내용 대조와 promote를 진행한다. 이 런에서는 `harvest --push`, `promote.py`, push/PR을 실행하지 않는다.

## organization 라벨 통일

정본 라벨은 스키마 표의 `organization`이다. 신규 후보는 `miner/src/feeders/neolook.js`에서 기존 `org` 대신 `organization`을 쓰도록 고쳤고, `createCandidate`는 그 값을 그대로 Notion `엔티티`에 쓴다. `miner/src/normalize.js`의 `org|…`와 `proposed_id`의 `org.`는 **식별자 접두사**이므로 바꾸지 않는다.

기존 Notion `org` 행은 `miner/src/notion.js`가 읽기 호환용으로 계속 포함한다. 실제 materialize는 `scripts/materialize.py`가 `organization`만 지원하므로, harvest 전에 Notion에서 `엔티티=org` 필터를 열고 해당 행을 `organization`으로 일괄 변경한다. 이후 `org` 옵션은 DB에서 모두 사라진 것이 확인된 다음 별도 정리 변경에서 `ENTITY_TYPES`의 legacy 값을 제거한다. 이것은 Notion DB 상태 변경이므로 코드 커밋과 분리해 사람이 수행한다.

## 6월 23일 생몰연도 보류분 적용

확인한 커밋은 다음과 같다.

- `6c4f0cc`: 미발견 91명(콜렉티브 13 제외) 목록 `round2-individuals.json`, 입력 청크 `r2c/in-*.json`만 생성.
- `b5bb31e`: 연구 결과 청크 1(`r2o/out-1.json`) 보존. 일부 low/null 및 medium 출처 포함.
- `53a2326`: 연구 결과 청크 4(`r2o/out-4.json`) 보존. 청크 2·3·5는 미완료이며 동음 플래그(박경미, 박고은, 박용석, 서고운)가 명시됨.

따라서 세 커밋만으로는 적용 가능한 완결 입력이 아니다. `miner/scripts/apply_years.mjs`는 `reports/miner/birthyear-final.json`을 읽고, `birth_year`가 없는 기존 파일만 갱신하며 동일 URL 출처를 append한다. 현 `birthyear-final.json`은 이미 `90eac27`에서 633 birth/132 death에 적용된 파일이므로 그대로 재실행해도 대개 skip되며, round-2 보류 결과를 자동으로 읽지 않는다.

적용 전에는 사람이 `r2o/out-1.json`과 `out-4.json`의 `confidence=high`만 우선 재검증하고, 동음 플래그·medium·low·null은 제외한다. 청크 2·3·5 연구를 완료해 같은 구조로 받고, 승인분만 별도 입력 JSON으로 컴파일한다. 그 컴파일본은 현재 untracked `reports/miner/birthyear-compiled.json`처럼 보일 수 있으나 정본이 아니므로 반드시 행별 URL·인물 동일성·출처 등급을 재확인한다.

승인된 입력을 `reports/miner/birthyear-final.json`로 **교체하지 말고** 백업/별도 파일로 둔 뒤, `apply_years.mjs`에 입력 경로 인자가 없으므로 아래처럼 명시적으로 백업-교체-실행-복원을 사람 승인 하에 한다. 이는 데이터 쓰기 작업이다.

```sh
cp reports/miner/birthyear-final.json /tmp/birthyear-final.pre-round2.json
cp reports/miner/birthyear-round2-approved.json reports/miner/birthyear-final.json
node miner/scripts/apply_years.mjs
./scripts/pipeline.sh
```

그 다음 변경 YAML의 각 `birth_year`/`death_year`와 새 `sources[]`를 원문 페이지에서 다시 대조하고, `reports/miner/birthyear-final.json`을 의도한 정본(통합본)으로 복구·정리한 뒤에만 커밋한다. 위험은 (a) `apply_years.mjs`가 `confidence`를 읽지 않아 승인되지 않은 행도 적용할 수 있음, (b) slug 오매칭, (c) 약한 애그리게이터/스니펫 출처, (d) 생년이 이미 있으면 조용히 skip해 부분 적용을 놓칠 수 있음이다.
