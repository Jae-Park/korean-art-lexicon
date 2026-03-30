#!/usr/bin/env python3
"""
Korean Art Lexicon — 데이터 마이그레이션: 문자열 enum → AAT ID 객체
스키마 변경에 맞춰 기존 YAML 데이터를 변환한다.

변환 내용:
  1. exhibition.type: "biennale" → type: {aat: "300266309"}
  2. organization.type: "museum" → type: {aat: "300312281"}
  3. term.category: "movement" → category: {aat: "300055769"}
  4. term.en.alternatives → term.variants (variants 배열로 이동)
  5. term.category: "phenomenon" → category 필드 제거 (AAT 해당 없음)

Usage: python3 scripts/migrate_to_aat.py [--dry-run]
"""

import sys
import yaml
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"

# ── AAT 매핑 (모두 Getty AAT 페이지에서 직접 검증됨) ──────────────────

EXHIBITION_TYPE_MAP = {
    "biennale": "300266309",   # biennials (exhibitions)
    "group": "300449166",      # group exhibitions
    "solo": "300449167",       # solo exhibitions
}

ORG_TYPE_MAP = {
    "museum": "300312281",            # museums (institutions)
    "artist-run-space": "300192556",  # alternative spaces
}

TERM_CATEGORY_MAP = {
    "movement": "300055769",   # cultural movements and attitudes (guide term)
    # "phenomenon" → AAT 해당 없음, category 필드 제거
}


def migrate_exhibition(doc: dict, filepath: Path) -> list[str]:
    """exhibition type 문자열 → AAT 객체"""
    changes = []
    if "type" in doc and isinstance(doc["type"], str):
        old_val = doc["type"]
        if old_val in EXHIBITION_TYPE_MAP:
            doc["type"] = {"aat": EXHIBITION_TYPE_MAP[old_val]}
            changes.append(f"type: '{old_val}' → {{aat: '{EXHIBITION_TYPE_MAP[old_val]}'}}")
        else:
            changes.append(f"WARNING: 알 수 없는 exhibition type '{old_val}' — 수동 확인 필요")
    return changes


def migrate_organization(doc: dict, filepath: Path) -> list[str]:
    """organization type 문자열 → AAT 객체"""
    changes = []
    if "type" in doc and isinstance(doc["type"], str):
        old_val = doc["type"]
        if old_val in ORG_TYPE_MAP:
            doc["type"] = {"aat": ORG_TYPE_MAP[old_val]}
            changes.append(f"type: '{old_val}' → {{aat: '{ORG_TYPE_MAP[old_val]}'}}")
        else:
            changes.append(f"WARNING: 알 수 없는 org type '{old_val}' — 수동 확인 필요")
    return changes


def migrate_term(doc: dict, filepath: Path) -> list[str]:
    """term category 문자열 → AAT 객체 + alternatives → variants"""
    changes = []

    # 1. category 변환
    if "category" in doc and isinstance(doc["category"], str):
        old_val = doc["category"]
        if old_val in TERM_CATEGORY_MAP:
            doc["category"] = {"aat": TERM_CATEGORY_MAP[old_val]}
            changes.append(f"category: '{old_val}' → {{aat: '{TERM_CATEGORY_MAP[old_val]}'}}")
        else:
            # phenomenon 등 AAT 매핑 없는 경우 → category 제거
            del doc["category"]
            changes.append(f"category: '{old_val}' 제거 (AAT 해당 없음)")

    # 2. en.alternatives → term.variants
    term_obj = doc.get("term", {})
    en_obj = term_obj.get("en", {})
    alternatives = en_obj.get("alternatives", [])

    if alternatives:
        variants = term_obj.get("variants", [])
        for alt in alternatives:
            variant = {
                "form": alt["form"],
                "lang": "en",
                "script": "Latn",
                "type": "alternate",
            }
            if "source" in alt:
                variant["source"] = alt["source"]
            variants.append(variant)

        term_obj["variants"] = variants
        del en_obj["alternatives"]
        changes.append(f"en.alternatives ({len(alternatives)}개) → term.variants로 이동")

    return changes


def save_yaml(doc: dict, filepath: Path):
    """YAML 저장 (한국어/일본어 유니코드 유지)"""
    with open(filepath, "w", encoding="utf-8") as f:
        yaml.dump(
            doc,
            f,
            default_flow_style=False,
            allow_unicode=True,
            sort_keys=False,
        )


def main():
    dry_run = "--dry-run" in sys.argv

    print(f"{'[DRY RUN] ' if dry_run else ''}Korean Art Lexicon — AAT 마이그레이션")
    print("=" * 60)

    total_changes = 0

    # Exhibition 마이그레이션
    exh_dir = DATA_DIR / "exhibitions"
    if exh_dir.exists():
        for f in sorted(exh_dir.glob("*.yaml")):
            with open(f) as fh:
                doc = yaml.safe_load(fh)
            if not doc:
                continue
            changes = migrate_exhibition(doc, f)
            if changes:
                total_changes += len(changes)
                print(f"\n{f.relative_to(PROJECT_ROOT)}:")
                for c in changes:
                    print(f"  {c}")
                if not dry_run:
                    save_yaml(doc, f)

    # Organization 마이그레이션
    org_dir = DATA_DIR / "organizations"
    if org_dir.exists():
        for f in sorted(org_dir.glob("*.yaml")):
            with open(f) as fh:
                doc = yaml.safe_load(fh)
            if not doc:
                continue
            changes = migrate_organization(doc, f)
            if changes:
                total_changes += len(changes)
                print(f"\n{f.relative_to(PROJECT_ROOT)}:")
                for c in changes:
                    print(f"  {c}")
                if not dry_run:
                    save_yaml(doc, f)

    # Term 마이그레이션
    term_dir = DATA_DIR / "terms"
    if term_dir.exists():
        for f in sorted(term_dir.glob("*.yaml")):
            with open(f) as fh:
                doc = yaml.safe_load(fh)
            if not doc:
                continue
            changes = migrate_term(doc, f)
            if changes:
                total_changes += len(changes)
                print(f"\n{f.relative_to(PROJECT_ROOT)}:")
                for c in changes:
                    print(f"  {c}")
                if not dry_run:
                    save_yaml(doc, f)

    print(f"\n{'=' * 60}")
    if dry_run:
        print(f"[DRY RUN] 총 {total_changes}건 변경 예정 (파일 미수정)")
    else:
        print(f"총 {total_changes}건 변경 완료")


if __name__ == "__main__":
    main()
