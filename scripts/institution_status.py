#!/usr/bin/env python3
"""기관 스크랩 진행 상태 렌더러. specs/institutions.yaml(정본) + dist/lexicon.json(라이브 published).

published 카운트는 레지스트리 수기값이 아니라 dist/lexicon.json에서 도메인 매칭으로 실시간 계산
(엔트리의 sources[].url에 기관 도메인이 들어간 항목 수) → 항상 정확.
나머지(crawled/candidates/pushed/approved/stage)는 institutions.yaml 수기 추적.

사용:
    python scripts/institution_status.py            # 콘솔 표 + reports/institutions_status.md 갱신
    python scripts/institution_status.py --md-only   # md만
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
REG = ROOT / "specs" / "institutions.yaml"
DIST = ROOT / "dist" / "lexicon.json"
OUT = ROOT / "reports" / "institutions_status.md"

STAGE_ORDER = ["planned", "recon", "scraper", "crawled", "pushed",
               "reviewing", "harvested", "published", "live"]
STAGE_ICON = {
    "planned": "⬜", "recon": "🔍", "scraper": "🔧", "crawled": "📥",
    "pushed": "📤", "reviewing": "👀", "harvested": "🌾", "published": "✅", "live": "🟢",
}


def count_published(lexicon, domain):
    """dist에서 sources[].url에 domain 들어간 엔트리 수(유형 무관)."""
    n = 0
    for entries in lexicon.values():
        if not isinstance(entries, list):
            continue
        for e in entries:
            for s in (e.get("sources") or []):
                url = s.get("url", "") if isinstance(s, dict) else (s or "")
                if domain in url:
                    n += 1
                    break
    return n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--md-only", action="store_true")
    a = ap.parse_args()

    reg = yaml.safe_load(REG.read_text(encoding="utf-8"))
    insts = reg.get("institutions", [])
    lexicon = json.loads(DIST.read_text(encoding="utf-8")) if DIST.exists() else {}

    # stage 순서로 정렬(진행도 높은 것 먼저)
    insts.sort(key=lambda i: STAGE_ORDER.index(i.get("stage", "planned")) if i.get("stage") in STAGE_ORDER else 0,
               reverse=True)

    rows = []
    for i in insts:
        c = i.get("counts") or {}
        pub = count_published(lexicon, i.get("domain", "")) if i.get("domain") else 0
        stage = i.get("stage", "planned")
        rows.append((
            f"{STAGE_ICON.get(stage,'')} {stage}",
            f"{i.get('name_ko','')} ({i.get('name_en','')})",
            i.get("domain", ""),
            str(c.get("crawled") if c.get("crawled") is not None else "·"),
            str(c.get("candidates") if c.get("candidates") is not None else "·"),
            str(c.get("pushed") if c.get("pushed") is not None else "·"),
            str(pub),
            i.get("coverage", ""),
            str(i.get("updated", "")),
        ))

    hdr = ["단계", "기관", "도메인", "crawled", "candidates", "pushed", "published(live)", "범위", "갱신"]
    lines = ["# 기관 스크랩 진행 상태", "",
             f"_정본: specs/institutions.yaml · published는 dist에서 라이브 계산 · {len(insts)}개 기관_", "",
             "| " + " | ".join(hdr) + " |",
             "|" + "|".join(["---"] * len(hdr)) + "|"]
    for r in rows:
        lines.append("| " + " | ".join(r) + " |")

    # 크롤 체크포인트 — 언제/어디까지/어디 저장(재크롤 증분 기준)
    crawled = [i for i in insts if i.get("crawl")]
    if crawled:
        lines += ["", "## 크롤 체크포인트", "",
                  "_재크롤 시 high_water 초과분만 증분 수집. local_archive = 영구 저장본._", "",
                  "| 기관 | 최근 크롤 | 레코드 | 범위(extent) | high_water | 로컬 저장본 |",
                  "|---|---|---|---|---|---|"]
        for i in crawled:
            cw = i["crawl"]
            hw = cw.get("high_water", {})
            hw_s = ", ".join(f"{k}={v}" for k, v in hw.items())
            lines.append("| " + " | ".join([
                i.get("name_ko", ""), str(cw.get("last_run", "")),
                str(cw.get("record_count", "")), cw.get("extent", ""),
                hw_s, f"`{cw.get('local_archive','')}`",
            ]) + " |")

    md = "\n".join(lines) + "\n"

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(md, encoding="utf-8")
    if not a.md_only:
        print(md)
    print(f"→ {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
