#!/usr/bin/env python3
"""노션 승인 후보(JSON) → 스키마 YAML (staging/<type>/). 확인된 필드만, status: pending_review.
Source-First: 출처 URL 없으면 skip. person은 EN/romanization 필수(id+latn.preferred). 추정/날조 없음.
사용: python3 materialize.py <approved.json>   (approved.json = 노션 행 프로퍼티 dict 리스트)
"""
import sys
import json
import re
from pathlib import Path

try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False

ROOT = Path(__file__).resolve().parent.parent
STAGING = ROOT / "staging"
TODAY = "2026-06-11"


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-")[:80]


def to_yaml(doc):
    if HAS_YAML:
        return yaml.safe_dump(doc, allow_unicode=True, sort_keys=False)
    raise RuntimeError("PyYAML 필요 (validate_auto도 yaml 사용)")


def materialize(row):
    typ = row.get("엔티티")
    ko = (row.get("이름/제목") or "").strip()
    en = (row.get("EN/romanization") or "").strip()
    url = (row.get("출처 URL") or "").strip()
    note = (row.get("evidence") or row.get("근거") or "").strip()
    src_note = re.sub(r"^\[\d{4}-\d{2}-\d{2}\]\s*", "", note)[:220]  # evidence의 날짜 prefix 제거

    if not url:
        return None, "출처 URL 없음 (Source-First 위반 — 재작업)"

    if typ == "person":
        if not en:
            return None, "EN/romanization 없음 → person id + latn.preferred 둘 다 EN 필요"
        pid = row.get("proposed_id", "")
        if not re.match(r"^person\.[a-z0-9-]+$", pid):
            pid = "person." + slug(en)
        doc = {
            "id": pid,
            "name": {"ko": {"full": ko}, "latn": {"preferred": en}},
            "sources": [{"url": url, "name_used": en, "note": src_note, "accessed": TODAY}],
            "status": "pending_review",
        }
        return ("persons", pid, doc), None

    if typ == "exhibition":
        pid = row.get("proposed_id", "")
        if not re.match(r"^exhibition\.[a-z0-9-]+$", pid):
            pid = "exhibition." + slug(en or ko)
        title = {"ko": ko}
        if en:
            title["en"] = en
        doc = {
            "id": pid,
            "title": title,
            "sources": [{"url": url, "note": src_note, "accessed": TODAY}],
            "status": "pending_review",
        }
        return ("exhibitions", pid, doc), None

    if typ == "organization":
        pid = row.get("proposed_id", "")
        if not re.match(r"^org\.[a-z0-9-]+$", pid):
            pid = "org." + slug(en or ko)
        name = {"ko": ko}
        if en:
            name["en"] = en
        doc = {
            "id": pid,
            "name": name,
            "sources": [{"url": url, "note": src_note, "accessed": TODAY}],
            "status": "pending_review",
        }
        return ("organizations", pid, doc), None

    return None, f"미지원 유형: {typ}"


def main():
    rows = json.load(open(sys.argv[1], encoding="utf-8"))
    made, skipped = [], []
    for r in rows:
        res, err = materialize(r)
        if err:
            skipped.append({"이름": r.get("이름/제목"), "사유": err})
            continue
        subdir, pid, doc = res
        d = STAGING / subdir
        d.mkdir(parents=True, exist_ok=True)
        fn = d / (pid.split(".", 1)[1] + ".yaml")
        fn.write_text(to_yaml(doc), encoding="utf-8")
        made.append(str(fn.relative_to(ROOT)))
    print(json.dumps({"materialized": made, "skipped": skipped}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
