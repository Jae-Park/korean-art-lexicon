#!/usr/bin/env python3
"""
Korean Art Lexicon — VIAF 후보 조회 (읽기 전용)
person/org 엔트리에 대해 VIAF 검색을 수행하고, 매칭 후보를 보여준다.
YAML 파일은 절대 수정하지 않는다. 사람이 확인 후 수동 등록한다.

Usage:
  python3 scripts/lookup_viaf.py                  # 전체 person 조회
  python3 scripts/lookup_viaf.py --entity person   # person만
  python3 scripts/lookup_viaf.py --entity org      # org만
  python3 scripts/lookup_viaf.py --id person.lee-ufan  # 특정 엔트리만
"""

import sys
import time
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import yaml
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"

VIAF_SEARCH_URL = "https://viaf.org/viaf/search"
NS = {
    "srw": "http://www.loc.gov/zing/srw/",
    "viaf": "http://viaf.org/viaf/terms#",
}

# VIAF 요청 간 대기 (rate limit 방지)
REQUEST_DELAY = 1.0


def search_viaf(name: str, max_records: int = 5) -> list[dict]:
    """VIAF SRU 검색. 후보 리스트 반환."""
    query = f'local.personalNames all "{name}"'
    params = urllib.parse.urlencode({
        "query": query,
        "sortKeys": "holdingscount",
        "maximumRecords": str(max_records),
        "httpAccept": "text/xml",
    })
    url = f"{VIAF_SEARCH_URL}?{params}"

    req = urllib.request.Request(url, headers={
        "Accept": "text/xml",
        "User-Agent": "KoreanArtLexicon/1.0 (research; +https://github.com/)",
    })

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read()
    except Exception as e:
        return [{"error": str(e)}]

    root = ET.fromstring(data)
    candidates = []

    for rec in root.findall(".//srw:record", NS):
        cluster = rec.find(".//viaf:VIAFCluster", NS)
        if cluster is None:
            continue

        viaf_id_el = cluster.find("viaf:viafID", NS)
        name_type_el = cluster.find("viaf:nameType", NS)
        birth_el = cluster.find(".//viaf:birthDate", NS)
        death_el = cluster.find(".//viaf:deathDate", NS)

        viaf_id = viaf_id_el.text if viaf_id_el is not None else None
        name_type = name_type_el.text if name_type_el is not None else None
        birth = birth_el.text if birth_el is not None else None
        death = death_el.text if death_el is not None else None

        # 이름 변형 수집
        name_forms = []
        for data_el in cluster.findall(".//viaf:mainHeadings/viaf:data", NS):
            text_el = data_el.find("viaf:text", NS)
            sources_el = data_el.find("viaf:sources", NS)
            src_list = []
            if sources_el is not None:
                for s in sources_el.findall("viaf:s", NS):
                    if s.text:
                        src_list.append(s.text)
            if text_el is not None and text_el.text:
                name_forms.append({
                    "text": text_el.text,
                    "sources": src_list,
                })

        # 소스 기관 수집
        source_orgs = []
        sources_el = cluster.find("viaf:sources", NS)
        if sources_el is not None:
            for s in sources_el.findall("viaf:source", NS):
                if s.text:
                    source_orgs.append(s.text)

        # Wikidata ID 추출
        wikidata = None
        for s in source_orgs:
            if s.startswith("WKP|"):
                wikidata = s.split("|")[1]
                break

        # KRNLK (한국국립중앙도서관) 여부
        has_korean_source = any("KRNLK" in s for s in source_orgs)

        candidates.append({
            "viaf_id": viaf_id,
            "name_type": name_type,
            "birth": birth,
            "death": death,
            "name_forms": name_forms,
            "source_count": len(source_orgs),
            "has_korean_source": has_korean_source,
            "wikidata": wikidata,
        })

    return candidates


def compute_confidence(entry: dict, candidate: dict) -> str:
    """매칭 신뢰도 계산."""
    score = 0
    reasons = []

    # 이름 매칭
    entry_names = set()
    name_obj = entry.get("name", {})

    # person
    ko = name_obj.get("ko", {})
    if isinstance(ko, dict):
        if ko.get("full"):
            entry_names.add(ko["full"])
    elif isinstance(ko, str):
        entry_names.add(ko)

    latn = name_obj.get("latn", {})
    if isinstance(latn, dict):
        if latn.get("preferred"):
            entry_names.add(latn["preferred"])

    # org
    if isinstance(name_obj.get("ko"), str):
        entry_names.add(name_obj["ko"])
    if isinstance(name_obj.get("en"), str):
        entry_names.add(name_obj["en"])

    for nf in candidate.get("name_forms", []):
        text = nf["text"]
        # 날짜 부분 제거 (예: "Lee, U-fan (1936- )" → "Lee, U-fan")
        clean = text.split("(")[0].split(",")[0].strip()
        for en in entry_names:
            if clean.lower() in en.lower() or en.lower() in clean.lower():
                score += 2
                reasons.append(f"이름 일치: '{en}' ≈ '{text}'")
                break

    # 생년 매칭
    entry_birth = entry.get("birth_year")
    cand_birth = candidate.get("birth")
    if entry_birth and cand_birth and cand_birth != "0":
        try:
            cand_birth_year = int(cand_birth[:4])
            if cand_birth_year == entry_birth:
                score += 3
                reasons.append(f"생년 일치: {entry_birth}")
        except (ValueError, IndexError):
            pass

    # 한국 소스 존재
    if candidate.get("has_korean_source"):
        score += 1
        reasons.append("한국국립중앙도서관(KRNLK) 소스 있음")

    # 소스 기관 수
    src_count = candidate.get("source_count", 0)
    if src_count >= 10:
        score += 1
        reasons.append(f"소스 기관 {src_count}개 (높은 커버리지)")

    # 신뢰도 판정
    if score >= 5:
        level = "HIGH"
    elif score >= 3:
        level = "MEDIUM"
    else:
        level = "LOW"

    return level, reasons


def format_candidate(candidate: dict, confidence: str, reasons: list) -> str:
    """후보 정보를 읽기 좋게 포맷."""
    lines = []
    viaf_id = candidate["viaf_id"]
    lines.append(f"  VIAF {viaf_id}  |  https://viaf.org/viaf/{viaf_id}")
    lines.append(f"  신뢰도: {confidence}")

    if candidate.get("birth") and candidate["birth"] != "0":
        birth_str = candidate["birth"]
        death_str = candidate.get("death", "0")
        if death_str and death_str != "0":
            lines.append(f"  생몰: {birth_str} – {death_str}")
        else:
            lines.append(f"  생년: {birth_str}")

    if candidate.get("wikidata"):
        lines.append(f"  Wikidata: {candidate['wikidata']}")

    lines.append(f"  소스 기관: {candidate['source_count']}개" +
                 (" (KRNLK 포함)" if candidate.get("has_korean_source") else ""))

    lines.append("  이름 변형:")
    for nf in candidate.get("name_forms", [])[:8]:
        srcs = ", ".join(nf["sources"][:3])
        lines.append(f"    - {nf['text']}" + (f"  [{srcs}]" if srcs else ""))

    if reasons:
        lines.append("  매칭 근거:")
        for r in reasons:
            lines.append(f"    + {r}")

    return "\n".join(lines)


def load_entries(entity_type: str, target_id: str = None) -> list[tuple]:
    """엔트리 로드. (filepath, doc) 튜플 리스트."""
    entries = []
    if entity_type == "person":
        data_path = DATA_DIR / "persons"
    elif entity_type == "org":
        data_path = DATA_DIR / "organizations"
    else:
        return entries

    if not data_path.exists():
        return entries

    for f in sorted(data_path.glob("*.yaml")):
        with open(f) as fh:
            doc = yaml.safe_load(fh)
        if not doc:
            continue
        if target_id and doc.get("id") != target_id:
            continue
        entries.append((f, doc))

    return entries


def get_search_name(doc: dict) -> str:
    """검색에 사용할 라틴 이름 추출."""
    name_obj = doc.get("name", {})

    # person: latn.preferred
    latn = name_obj.get("latn", {})
    if isinstance(latn, dict) and latn.get("preferred"):
        return latn["preferred"]

    # org: en name
    if isinstance(name_obj.get("en"), str):
        return name_obj["en"]

    # fallback: ko
    ko = name_obj.get("ko", {})
    if isinstance(ko, dict):
        return ko.get("full", "")
    return str(ko)


def main():
    args = sys.argv[1:]

    entity_types = ["person", "org"]
    target_id = None

    i = 0
    while i < len(args):
        if args[i] == "--entity" and i + 1 < len(args):
            entity_types = [args[i + 1]]
            i += 2
        elif args[i] == "--id" and i + 1 < len(args):
            target_id = args[i + 1]
            # entity type 자동 추론
            if target_id.startswith("person."):
                entity_types = ["person"]
            elif target_id.startswith("org."):
                entity_types = ["org"]
            i += 2
        else:
            i += 1

    print("Korean Art Lexicon — VIAF 후보 조회")
    print("⚠️  읽기 전용 — YAML 파일 수정 없음. 사람 확인 후 수동 등록.")
    print("=" * 70)

    total = 0
    found = 0
    already_has = 0

    for etype in entity_types:
        entries = load_entries(etype, target_id)

        for filepath, doc in entries:
            doc_id = doc.get("id", "?")

            # 이미 VIAF ID가 있으면 스킵
            existing_viaf = doc.get("external_ids", {}).get("viaf")
            if existing_viaf:
                already_has += 1
                continue

            total += 1
            search_name = get_search_name(doc)
            if not search_name:
                print(f"\n{doc_id}: 검색 이름 없음 — 스킵")
                continue

            print(f"\n{'─' * 70}")
            print(f"🔍 {doc_id}  (검색: \"{search_name}\")")

            time.sleep(REQUEST_DELAY)
            candidates = search_viaf(search_name, max_records=3)

            if not candidates or (len(candidates) == 1 and "error" in candidates[0]):
                error_msg = candidates[0].get("error", "unknown") if candidates else "no response"
                print(f"  ❌ VIAF 검색 실패: {error_msg}")
                continue

            # 신뢰도 계산 및 정렬
            scored = []
            for c in candidates:
                if "error" in c:
                    continue
                level, reasons = compute_confidence(doc, c)
                scored.append((c, level, reasons))

            # HIGH 우선 정렬
            level_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
            scored.sort(key=lambda x: level_order.get(x[1], 3))

            if not scored:
                print("  결과 없음")
                continue

            found += 1
            for c, level, reasons in scored:
                print(format_candidate(c, level, reasons))
                print()

    print(f"\n{'=' * 70}")
    print(f"조회: {total}개 | 후보 발견: {found}개 | 이미 VIAF 있음: {already_has}개")
    print("⚠️  YAML 수정 없음. 위 후보를 확인 후 external_ids.viaf에 수동 등록하세요.")


if __name__ == "__main__":
    main()
