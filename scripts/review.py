#!/usr/bin/env python3
"""
Korean Art Lexicon — 엔트리 리뷰 CLI
pending_review 엔트리를 확인하고 승인/거부한다.
Claude Code 내부에서 실행 가능하도록 서브커맨드 방식.

Usage:
  python3 scripts/review.py list                    # pending 목록
  python3 scripts/review.py show <id>               # 상세 보기
  python3 scripts/review.py approve <id> [<id>...]  # 승인 → reviewed
  python3 scripts/review.py reject <id> [<id>...]   # 거부 → rejected
  python3 scripts/review.py status                  # 전체 status 통계
"""

import sys
import yaml
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"

ENTITY_DIRS = {
    "persons": DATA_DIR / "persons",
    "exhibitions": DATA_DIR / "exhibitions",
    "organizations": DATA_DIR / "organizations",
    "terms": DATA_DIR / "terms",
    "publications": DATA_DIR / "publications",
}


def load_all_entries() -> list[tuple[Path, dict]]:
    """모든 YAML 엔트리 로드."""
    entries = []
    for category, directory in ENTITY_DIRS.items():
        if not directory.exists():
            continue
        for f in sorted(directory.glob("*.yaml")):
            with open(f) as fh:
                doc = yaml.safe_load(fh)
            if doc:
                entries.append((f, doc))
    return entries


def get_entry_name(doc: dict) -> str:
    """엔트리의 대표 이름/제목 추출."""
    # person
    name_obj = doc.get("name", {})
    if isinstance(name_obj, dict):
        ko = name_obj.get("ko", {})
        if isinstance(ko, dict) and ko.get("full"):
            latn = name_obj.get("latn", {})
            preferred = latn.get("preferred", "") if isinstance(latn, dict) else ""
            return f"{ko['full']} ({preferred})" if preferred else ko["full"]
        elif isinstance(ko, str):
            en = name_obj.get("en", "")
            return f"{ko} ({en})" if en else ko

    # exhibition / publication
    title_obj = doc.get("title", {})
    if isinstance(title_obj, dict):
        ko = title_obj.get("ko", "")
        en = title_obj.get("en", "")
        if ko and en:
            return f"{ko} ({en})"
        return ko or en

    # term
    term_obj = doc.get("term", {})
    if isinstance(term_obj, dict):
        ko = term_obj.get("ko", "")
        en_obj = term_obj.get("en", {})
        en = en_obj.get("preferred", "") if isinstance(en_obj, dict) else ""
        if ko and en:
            return f"{ko} ({en})"
        return ko

    return doc.get("id", "?")


def get_source_summary(doc: dict) -> str:
    """출처 요약."""
    sources = doc.get("sources", [])
    count = len(sources)
    urls = []
    for s in sources[:3]:
        if isinstance(s, str):
            urls.append(s[:60])
        elif isinstance(s, dict):
            urls.append(s.get("url", "")[:60])
    summary = f"{count}개 출처"
    if urls:
        summary += ":\n" + "\n".join(f"    - {u}" for u in urls)
        if count > 3:
            summary += f"\n    ... 외 {count - 3}개"
    return summary


def cmd_list(entries):
    """pending_review 목록."""
    pending = [(f, d) for f, d in entries if d.get("status") == "pending_review"]

    if not pending:
        print("pending_review 엔트리 없음.")
        return

    print(f"pending_review: {len(pending)}건")
    print("─" * 60)
    for filepath, doc in pending:
        doc_id = doc.get("id", "?")
        name = get_entry_name(doc)
        sources_count = len(doc.get("sources", []))
        print(f"  {doc_id}")
        print(f"    {name}  |  출처 {sources_count}개")
    print("─" * 60)
    print(f"\n상세: python3 scripts/review.py show <id>")
    print(f"승인: python3 scripts/review.py approve <id>")
    print(f"거부: python3 scripts/review.py reject <id>")


def cmd_show(entries, target_id: str):
    """엔트리 상세 보기."""
    for filepath, doc in entries:
        if doc.get("id") == target_id:
            print(f"{'=' * 60}")
            print(f"ID: {doc['id']}")
            print(f"이름: {get_entry_name(doc)}")
            print(f"Status: {doc.get('status', '(없음)')}")
            print(f"파일: {filepath.relative_to(PROJECT_ROOT)}")
            print(f"{'─' * 60}")

            # 주요 필드 출력
            for key in ["nationality", "birth_year", "death_year", "venue", "city",
                         "country", "publisher", "year"]:
                if key in doc:
                    print(f"{key}: {doc[key]}")

            # dates
            if "dates" in doc:
                dates = doc["dates"]
                parts = []
                if "start" in dates:
                    parts.append(f"start: {dates['start']}")
                if "end" in dates:
                    parts.append(f"end: {dates['end']}")
                if "year" in dates:
                    parts.append(f"year: {dates['year']}")
                print(f"dates: {', '.join(parts)}")

            # type / category
            for key in ["type", "category"]:
                if key in doc:
                    val = doc[key]
                    if isinstance(val, dict) and "aat" in val:
                        print(f"{key}: AAT {val['aat']}")
                    else:
                        print(f"{key}: {val}")

            # role
            if "role" in doc:
                roles = [r.get("aat", "?") for r in doc["role"]]
                print(f"role: AAT {', '.join(roles)}")

            # related
            if "related" in doc:
                print(f"related: {', '.join(doc['related'])}")

            # external_ids
            if "external_ids" in doc:
                for k, v in doc["external_ids"].items():
                    print(f"external_ids.{k}: {v}")

            # variants
            name_obj = doc.get("name", doc.get("title", doc.get("term", {})))
            variants = name_obj.get("variants", []) if isinstance(name_obj, dict) else []
            if variants:
                print(f"\nvariants ({len(variants)}개):")
                for v in variants[:5]:
                    src = f" [{v['source']}]" if "source" in v else ""
                    print(f"  - {v.get('form', '?')} ({v.get('lang', '?')}/{v.get('script', '?')}, {v.get('type', '?')}){src}")
                if len(variants) > 5:
                    print(f"  ... 외 {len(variants) - 5}개")

            # sources
            print(f"\n출처:")
            sources = doc.get("sources", [])
            for i, s in enumerate(sources):
                if isinstance(s, str):
                    print(f"  [{i+1}] {s}")
                elif isinstance(s, dict):
                    url = s.get("url", "")
                    name_used = s.get("name_used", "")
                    note = s.get("note", "")
                    accessed = s.get("accessed", "")
                    print(f"  [{i+1}] {url}")
                    if name_used:
                        print(f"       name_used: {name_used}")
                    if note:
                        print(f"       note: {note}")
                    if accessed:
                        print(f"       accessed: {accessed}")

            # notes
            if "notes" in doc:
                print(f"\nnotes: {doc['notes']}")

            print(f"{'=' * 60}")
            return

    print(f"엔트리 없음: '{target_id}'")


def cmd_change_status(entries, target_ids: list[str], new_status: str):
    """엔트리 status 변경."""
    changed = []
    not_found = []

    for target_id in target_ids:
        found = False
        for filepath, doc in entries:
            if doc.get("id") == target_id:
                found = True
                old_status = doc.get("status", "(없음)")
                doc["status"] = new_status

                with open(filepath, "w", encoding="utf-8") as f:
                    yaml.dump(doc, f, default_flow_style=False,
                              allow_unicode=True, sort_keys=False)

                changed.append((target_id, old_status, get_entry_name(doc)))
                break

        if not found:
            not_found.append(target_id)

    if changed:
        action = "승인" if new_status == "reviewed" else "거부"
        print(f"{action} 완료 ({len(changed)}건):")
        for doc_id, old, name in changed:
            print(f"  ✓ {doc_id} — {name}")
            print(f"    {old} → {new_status}")

    if not_found:
        print(f"\n찾을 수 없음:")
        for doc_id in not_found:
            print(f"  ✗ {doc_id}")


def cmd_status(entries):
    """전체 status 통계."""
    stats = {}
    for filepath, doc in entries:
        status = doc.get("status", "(없음)")
        if status not in stats:
            stats[status] = []
        stats[status].append(doc.get("id", "?"))

    print(f"전체 엔트리: {len(entries)}개")
    print("─" * 40)
    for status in ["stable", "firsthand", "reviewed", "pending_review",
                    "submitted", "rejected"]:
        if status in stats:
            print(f"  {status:20s}  {len(stats[status]):3d}개")
    # 기타
    for status, ids in stats.items():
        if status not in ["stable", "firsthand", "reviewed", "pending_review",
                          "submitted", "rejected"]:
            print(f"  {status:20s}  {len(ids):3d}개")
    print("─" * 40)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(0)

    cmd = sys.argv[1]
    entries = load_all_entries()

    if cmd == "list":
        cmd_list(entries)
    elif cmd == "show":
        if len(sys.argv) < 3:
            print("사용법: review.py show <id>")
            sys.exit(1)
        cmd_show(entries, sys.argv[2])
    elif cmd == "approve":
        if len(sys.argv) < 3:
            print("사용법: review.py approve <id> [<id>...]")
            sys.exit(1)
        cmd_change_status(entries, sys.argv[2:], "reviewed")
    elif cmd == "reject":
        if len(sys.argv) < 3:
            print("사용법: review.py reject <id> [<id>...]")
            sys.exit(1)
        cmd_change_status(entries, sys.argv[2:], "rejected")
    elif cmd == "status":
        cmd_status(entries)
    else:
        print(f"알 수 없는 명령: '{cmd}'")
        print("사용 가능: list, show, approve, reject, status")
        sys.exit(1)


if __name__ == "__main__":
    main()
