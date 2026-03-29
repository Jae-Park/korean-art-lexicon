#!/usr/bin/env python3
"""
Korean Art Lexicon — 자동 검증 스크립트
staging/ 또는 data/ 내 YAML 파일을 검증한다.

검증 단계:
  1. 스키마 검증: 필수 필드, 형식, 타입
  2. 출처 검증: sources URL이 루트 URL이 아닌 상세 URL인지
  3. 중복 검증: data/에 동일 id가 이미 존재하는지
"""

import sys
import os
import re
import json
import yaml
from pathlib import Path
from urllib.parse import urlparse

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SCHEMA_DIR = PROJECT_ROOT / "schema"
DATA_DIR = PROJECT_ROOT / "data"
STAGING_DIR = PROJECT_ROOT / "staging"

# 루트 URL로 간주할 패턴 (경로가 / 또는 비어있는 경우)
ROOT_URL_PATTERN = re.compile(r"^https?://[^/]+/?$")

# 엔티티 타입 → 스키마 파일 매핑
ENTITY_SCHEMA_MAP = {
    "exhibitions": "exhibition.schema.json",
    "persons": "person.schema.json",
    "organizations": "organization.schema.json",
    "terms": "term.schema.json",
}


def load_schema(entity_type: str) -> dict:
    schema_file = SCHEMA_DIR / ENTITY_SCHEMA_MAP[entity_type]
    with open(schema_file) as f:
        return json.load(f)


def load_yaml(filepath: Path) -> dict:
    with open(filepath) as f:
        return yaml.safe_load(f)


def get_existing_ids(data_dir: Path) -> set:
    """data/ 내 모든 YAML에서 id 수집"""
    ids = set()
    for subdir in data_dir.iterdir():
        if subdir.is_dir():
            for f in subdir.glob("*.yaml"):
                try:
                    doc = load_yaml(f)
                    if doc and "id" in doc:
                        ids.add(doc["id"])
                except Exception:
                    pass
    return ids


def validate_schema(doc: dict, schema: dict, path: str = "") -> list[str]:
    """필수 필드 및 기본 타입 검증 — 중첩 required도 재귀 체크"""
    errors = []

    # required 필드 체크
    for field in schema.get("required", []):
        if field not in doc:
            full_path = f"{path}.{field}" if path else field
            errors.append(f"필수 필드 누락: '{full_path}'")

    # 중첩 object 필드의 required 재귀 검증
    properties = schema.get("properties", {})
    for field, field_schema in properties.items():
        if field not in doc:
            continue
        if field_schema.get("type") == "object" and isinstance(doc[field], dict):
            full_path = f"{path}.{field}" if path else field
            errors.extend(validate_schema(doc[field], field_schema, full_path))

    # id 패턴 체크
    if "id" in doc and "id" in properties:
        pattern = properties["id"].get("pattern")
        if pattern and not re.match(pattern, doc["id"]):
            errors.append(f"id 형식 오류: '{doc['id']}' (패턴: {pattern})")

    # status 체크
    if "status" in doc and "status" in properties:
        allowed = properties["status"].get("enum", [])
        if doc["status"] not in allowed:
            errors.append(f"잘못된 status: '{doc['status']}' (허용: {allowed})")

    # sources 존재 및 비어있지 않은지
    if "sources" in doc:
        if not isinstance(doc["sources"], list) or len(doc["sources"]) == 0:
            errors.append("sources가 비어있음")
    elif "sources" in schema.get("required", []):
        errors.append("필수 필드 누락: 'sources'")

    return errors


def check_url_alive(url: str, timeout: int = 10) -> tuple:
    """
    URL 생존 확인. HEAD 요청으로 빠르게 체크.
    반환: (alive: bool, status_code: int, detail: str)
    """
    import urllib.request
    import urllib.error

    try:
        req = urllib.request.Request(url, method="HEAD", headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        })
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return (True, resp.status, "ok")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return (False, 404, "DEAD_URL — 존재하지 않는 페이지")
        elif e.code in (403, 429, 503):
            # 봇 차단은 URL 자체는 존재할 수 있으므로 통과
            return (True, e.code, f"봇 차단 가능성 ({e.code})")
        elif e.code == 405:
            # HEAD 미지원 → GET으로 재시도
            try:
                req2 = urllib.request.Request(url, headers={
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                })
                with urllib.request.urlopen(req2, timeout=timeout) as resp2:
                    return (True, resp2.status, "ok")
            except urllib.error.HTTPError as e2:
                if e2.code == 404:
                    return (False, 404, "DEAD_URL — 존재하지 않는 페이지")
                return (True, e2.code, f"HTTP {e2.code}")
            except Exception:
                return (True, 405, "HEAD 미지원, GET도 실패")
        else:
            return (True, e.code, f"HTTP {e.code}")
    except Exception as e:
        # 네트워크 오류는 URL 문제가 아닐 수 있으므로 경고만
        return (True, 0, f"접속 오류: {type(e).__name__}")


def validate_sources(doc: dict, check_alive: bool = True) -> list[str]:
    """출처 URL 검증: 루트 URL 금지, 상세 URL 필수, 404 탐지"""
    errors = []
    sources = doc.get("sources", [])

    for i, src in enumerate(sources):
        url = src if isinstance(src, str) else src.get("url", "")

        if not url:
            errors.append(f"sources[{i}]: URL이 비어있음")
            continue

        if ROOT_URL_PATTERN.match(url):
            errors.append(f"sources[{i}]: 루트 URL 사용 금지 — '{url}'")
            continue

        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            errors.append(f"sources[{i}]: 유효하지 않은 URL — '{url}'")
            continue

        # URL 생존 확인 (404 = 허구 출처)
        if check_alive:
            alive, code, detail = check_url_alive(url)
            if not alive:
                errors.append(f"sources[{i}]: 💀 {detail} — '{url}'")

    return errors


def validate_duplicates(doc: dict, existing_ids: set) -> list[str]:
    """data/에 동일 id가 이미 존재하는지"""
    errors = []
    doc_id = doc.get("id", "")
    if doc_id in existing_ids:
        errors.append(f"중복 id: '{doc_id}' — data/에 이미 존재")
    return errors


def validate_file(filepath: Path, existing_ids: set, check_alive: bool = True) -> dict:
    """단일 파일 검증, 결과 반환."""
    result = {
        "file": str(filepath.relative_to(PROJECT_ROOT)),
        "errors": [],
        "warnings": [],
        "passed": False,
    }

    # 엔티티 타입 결정
    entity_type = filepath.parent.name
    if entity_type not in ENTITY_SCHEMA_MAP:
        result["errors"].append(f"알 수 없는 엔티티 타입: '{entity_type}'")
        return result

    try:
        doc = load_yaml(filepath)
    except Exception as e:
        result["errors"].append(f"YAML 파싱 오류: {e}")
        return result

    if not doc:
        result["errors"].append("빈 파일")
        return result

    schema = load_schema(entity_type)

    # 1. 스키마 검증
    result["errors"].extend(validate_schema(doc, schema))

    # 2. 출처 검증 (형식 + URL 생존)
    result["errors"].extend(validate_sources(doc, check_alive=check_alive))

    # 3. 중복 검증
    result["errors"].extend(validate_duplicates(doc, existing_ids))

    result["passed"] = len(result["errors"]) == 0
    return result


def main():
    no_url_check = "--no-url-check" in sys.argv
    args = [a for a in sys.argv[1:] if not a.startswith("--")]

    target_dir = STAGING_DIR
    if args:
        target_dir = PROJECT_ROOT / args[0]

    if not target_dir.exists():
        print(f"디렉토리 없음: {target_dir}")
        sys.exit(1)

    # data/에서 기존 id 수집 (data/ 자체 검증 시에는 비워둠)
    is_data_dir = target_dir.resolve() == DATA_DIR.resolve()
    existing_ids = set() if is_data_dir else get_existing_ids(DATA_DIR)

    # 대상 디렉토리 내 모든 YAML 검증
    yaml_files = sorted(target_dir.rglob("*.yaml"))

    # data/ 자체 검증 시 내부 중복 체크
    if is_data_dir:
        all_ids = []
        for f in yaml_files:
            try:
                doc = load_yaml(f)
                if doc and "id" in doc:
                    all_ids.append((doc["id"], f))
            except Exception:
                pass
        seen = {}
        for doc_id, fpath in all_ids:
            if doc_id in seen:
                existing_ids.add(doc_id)  # 두 번째부터 중복으로 잡힘
            seen[doc_id] = fpath

    if not yaml_files:
        print(f"검증 대상 없음: {target_dir}")
        sys.exit(0)

    total = 0
    passed = 0
    failed = 0

    for f in yaml_files:
        total += 1
        result = validate_file(f, existing_ids, check_alive=not no_url_check)

        status = "PASS" if result["passed"] else "FAIL"
        icon = "  " if result["passed"] else "  "
        print(f"{icon} {status}  {result['file']}")

        if not result["passed"]:
            failed += 1
            for err in result["errors"]:
                print(f"         {err}")
        else:
            passed += 1

    print(f"\n{'='*50}")
    print(f"총 {total}개 | 통과 {passed}개 | 실패 {failed}개")

    sys.exit(1 if failed > 0 else 0)


if __name__ == "__main__":
    main()
