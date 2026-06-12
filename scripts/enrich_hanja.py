#!/usr/bin/env python3
"""한자(Hanja) enrichment — 한국 인물의 name.ko.hanja를 권위 출처에서 추출해 채운다.

Source-First 준수: LLM 기억으로 한자를 쓰지 않는다. 렌더된 권위 페이지(encykorea =
한국민족문화대백과사전)에서 **한글명에 앵커된 한자**만 추출한다. encykorea 표제어는
"고희동⏎高羲東"(괄호 아니라 개행) 형식이라, 한글명 바로 뒤의 CJK 런을 잡고
글자수(음절수 ±1)로 sanity-check 한다 → 동명이인/오추출 차단.

Phase 1 (기본, 검색 0회, 고신뢰):
    이미 encykorea 출처가 달린 인물 → 그 URL을 렌더해 한자 추출.
Phase 2 (--search, 보수적):
    출처 없는 인물 → Naver 앵커 검색으로 encykorea Article URL 발견 → 표제어 한글 일치
    (+ birth_year 있으면 대조)로 인물 확정 → 한자 추출 + encykorea URL을 출처로 추가.

부정결론 게이트: 못 채운 인물은 사유(no_source / extract_fail / hangul_native_or_no_hanja
/ person_mismatch)와 함께 로그한다. 조용히 "한자 없음"으로 단정하지 않는다.

기본은 dry-run(보고만). --apply 시 YAML 기록 + dist 재빌드.
사용:
    python scripts/enrich_hanja.py                 # Phase1 dry-run 보고
    python scripts/enrich_hanja.py --apply         # Phase1 적용(루틴 기본)
    python scripts/enrich_hanja.py --search --apply # Phase1+2 적용(검색, 사람 확인 권장)
"""
from __future__ import annotations
import argparse
import glob
import json
import os
import re
import subprocess
import sys

import yaml

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PERSONS = os.path.join(REPO, "data", "persons")
# CJK 통합 한자 + 확장 A (한국 인명 한자 커버)
HANJA = r"[一-鿿㐀-䶿]"
ENCY = "encykorea.aks.ac.kr"


def is_korean_personal_name(full: str) -> bool:
    """순 한글 인명만 (외국 작가 음역 제외은 호출측에서 nationality로도 거름)."""
    return bool(re.fullmatch(r"[가-힣]+", full or ""))


def extract_hanja(text: str, full: str):
    """렌더 텍스트에서 한글명에 앵커된 한자 런 추출. 음절수 ±1 sanity-check."""
    m = re.search(re.escape(full) + r"[\s(（]*(" + HANJA + r"+)", text)
    if not m:
        return None
    hanja = m.group(1)
    if len(full) <= len(hanja) <= len(full) + 1:
        return hanja
    return None  # 길이 불일치 = 오추출 의심


def headword_matches(text: str, full: str) -> bool:
    """페이지 상단에 한글 표제어가 실제로 존재하는지(엉뚱한 페이지 차단)."""
    return full in text[:400]


def load_persons():
    for f in sorted(glob.glob(os.path.join(PERSONS, "*.yaml"))):
        with open(f, encoding="utf-8") as fh:
            d = yaml.safe_load(fh)
        if not d:
            continue
        yield f, d


def find_targets():
    """한자 없는 한글 인명 인물. (file, doc, full, ency_url|None) 반환."""
    out = []
    for f, d in load_persons():
        ko = (d.get("name") or {}).get("ko")
        if not isinstance(ko, dict) or ko.get("hanja"):
            continue
        full = ko.get("full", "")
        if not is_korean_personal_name(full):
            continue
        if d.get("nationality") and d["nationality"] != "KR":
            continue  # 외국 작가 음역(국적 명시) 제외
        ency = next(
            (s.get("url") for s in d.get("sources", [])
             if isinstance(s, dict) and ENCY in (s.get("url") or "")),
            None,
        )
        out.append((f, d, full, ency))
    return out


def write_hanja(f: str, d: dict, hanja: str):
    """name.ko에 hanja 삽입(순서: full/family/given/hanja) 후 저장."""
    ko = d["name"]["ko"]
    new_ko = {}
    for k in ("full", "family", "given"):
        if k in ko:
            new_ko[k] = ko[k]
    new_ko["hanja"] = hanja
    for k in ko:
        if k not in new_ko:
            new_ko[k] = ko[k]
    d["name"]["ko"] = new_ko
    with open(f, "w", encoding="utf-8") as fh:
        fh.write(yaml.safe_dump(d, allow_unicode=True, sort_keys=False))


def add_encykorea_source(d: dict, url: str, full: str):
    urls = {(s.get("url") if isinstance(s, dict) else s) for s in d.get("sources", [])}
    if url in urls:
        return
    d.setdefault("sources", []).append({
        "url": url,
        "name_used": full,
        "note": "한국민족문화대백과사전 — 한자 병기 출처",
        "accessed": ACCESSED,
    })


def naver_encykorea_url(pg, full: str):
    """Naver 검색으로 인물의 encykorea Article URL 후보를 찾는다."""
    q = f"{full} 한국민족문화대백과사전"
    pg.goto("https://search.naver.com/search.naver?query=" + q, wait_until="domcontentloaded", timeout=30000)
    pg.wait_for_timeout(1200)
    hrefs = pg.eval_on_selector_all("a", "els => els.map(e => e.href)")
    for h in hrefs:
        if ENCY in (h or "") and "/Article/" in h:
            return h.split("?")[0]
    return None


def run(apply: bool, search: bool, limit: int):
    from playwright.sync_api import sync_playwright

    targets = find_targets()
    p1 = [t for t in targets if t[3]]          # encykorea 출처 보유
    p2 = [t for t in targets if not t[3]]      # 검색 필요
    if limit:
        p1 = p1[:limit]
        p2 = p2[:limit]

    filled, skipped = [], []

    def fetch(pg, url):
        for attempt in range(2):
            try:
                pg.goto(url, wait_until="domcontentloaded", timeout=40000)
                pg.wait_for_timeout(1600)
                return pg.inner_text("body")
            except Exception:
                if attempt == 1:
                    return None
        return None

    with sync_playwright() as pw:
        b = pw.chromium.launch()
        # --- Phase 1: 기존 encykorea 출처에서 추출 ---
        for f, d, full, url in p1:
            pg = b.new_page()
            txt = fetch(pg, url)
            pg.close()
            if not txt:
                skipped.append((full, "render_fail")); continue
            hanja = extract_hanja(txt, full)
            if not hanja:
                skipped.append((full, "extract_fail")); continue
            filled.append((full, hanja, "phase1"))
            if apply:
                write_hanja(f, d, hanja)

        # --- Phase 2: 검색으로 encykorea 발견 → 인물 확정 → 추출 + 출처 추가 ---
        if search:
            for f, d, full, _ in p2:
                pg = b.new_page()
                try:
                    url = naver_encykorea_url(pg, full)
                except Exception:
                    url = None
                if not url:
                    pg.close(); skipped.append((full, "no_encykorea_found")); continue
                txt = fetch(pg, url)
                pg.close()
                if not txt or not headword_matches(txt, full):
                    skipped.append((full, "person_mismatch")); continue
                by = d.get("birth_year")
                if by and str(by) not in txt:
                    skipped.append((full, "birthyear_unconfirmed")); continue
                hanja = extract_hanja(txt, full)
                if not hanja:
                    skipped.append((full, "extract_fail")); continue
                filled.append((full, hanja, "phase2:" + url.split("/")[-1]))
                if apply:
                    add_encykorea_source(d, url, full)
                    write_hanja(f, d, hanja)
        b.close()

    return filled, skipped, len(p1), len(p2)


ACCESSED = ""  # --apply 시 인자로 주입(Date 회피: 호출측에서 ISO 날짜 전달)


def main():
    global ACCESSED
    ap = argparse.ArgumentParser(description="한자 enrichment (Source-First)")
    ap.add_argument("--apply", action="store_true", help="YAML 기록 + dist 재빌드")
    ap.add_argument("--search", action="store_true", help="Phase2: 출처 없는 인물 Naver 검색")
    ap.add_argument("--limit", type=int, default=0, help="대상 수 제한(테스트)")
    ap.add_argument("--accessed", default="", help="추가 출처의 accessed 날짜(YYYY-MM-DD)")
    ap.add_argument("--json", action="store_true", help="결과 JSON 출력")
    a = ap.parse_args()
    ACCESSED = a.accessed or ""
    if a.search and a.apply and not ACCESSED:
        print("⚠️ --search --apply 에는 --accessed YYYY-MM-DD 필요(출처 날짜).", file=sys.stderr)
        sys.exit(2)

    filled, skipped, n1, n2 = run(a.apply, a.search, a.limit)

    if a.json:
        print(json.dumps({"filled": filled, "skipped": skipped}, ensure_ascii=False))
    else:
        verb = "적용" if a.apply else "추출(dry-run)"
        print(f"== 한자 enrichment {verb} ==")
        print(f"대상: Phase1(출처보유) {n1}명, Phase2(검색) {'활성 '+str(n2)+'명' if a.search else '비활성('+str(n2)+'명 보류)'}")
        for full, hanja, src in filled:
            print(f"  + {full} → {hanja}  [{src}]")
        if skipped:
            print(f"-- 못 채움 {len(skipped)}명(사유) --")
            for full, why in skipped:
                print(f"  · {full}: {why}")
        print(f"채움 {len(filled)}명 / 미충족 {len(skipped)}명")

    if a.apply and filled:
        rc = subprocess.call([sys.executable, os.path.join(REPO, "scripts", "build.py")])
        print(f"build rc={rc}")
        sys.exit(rc)


if __name__ == "__main__":
    main()
