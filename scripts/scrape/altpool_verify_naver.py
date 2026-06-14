#!/usr/bin/env python3
"""작가명 Naver 교차검증 — codex 쿼터 막힘 대체($0, 무제한).

codex --search 쿼터 소진 시, 남은 작가를 Naver-Playwright로 검증:
- presence: 권위 art 도메인(미술관·갤러리·AAA·e-flux·encykorea·미술잡지)에 '{name} 작가'로 등장하는가.
- romanization: 그 페이지에서 한글명에 짝지어진 라틴 표기 추출(있으면).
- verdict는 보수적: presence=yes → likely_artist / no → unverified(노이즈 단정 X — 파괴적 판정은 사람 검토).

codex처럼 non_artist 단정/삭제는 하지 않음(동명이인 위험). 보강(로마자)+presence 신호만 제공.
사용: python scripts/scrape/altpool_verify_naver.py --names FILE [--out OUT] [--limit N]
"""
from __future__ import annotations
import argparse
import json
import os
import re
import sys
import time

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT_DEFAULT = os.path.join(REPO, "crawl-archive", "altpool", "artist_verify_naver.json")
AUTH = re.compile(r"(museum|gallery|art|kunst|biennale|foundation|\.go\.kr|\.or\.kr|\.ac\.kr|"
                  r"encykorea|aaa\.org|e-flux|ocula|frieze|artforum|artreview|koreaherald|"
                  r"koreatimes|neolook|daljin|theartro|mmca|sema)", re.I)
BLOCK = re.compile(r"(blog|cafe|post\.naver|tistory|instagram|facebook|twitter|youtube|namu\.wiki|"
                   r"search\.naver|dict\.|kin\.naver|shopping|map\.|news\.naver|wikipedia)", re.I)
LAT = r"[A-Z][A-Za-z]*(?:[ \-][A-Z]?[a-z]+){0,2}"


def extract_roman(text, ko):
    m = re.search(re.escape(ko) + r"\s*[(（]\s*(" + LAT + r")\s*[)）]", text)
    if m:
        return m.group(1).strip()
    m = re.search(r"(" + LAT + r")\s*[(（]\s*" + re.escape(ko) + r"\s*[)）]", text)
    if m:
        return m.group(1).strip()
    return None


def run(names, out_path, limit, delay=1.2):
    from playwright.sync_api import sync_playwright
    if limit:
        names = names[:limit]
    out = json.load(open(out_path, encoding="utf-8")) if os.path.exists(out_path) else {}
    todo = [n for n in names if n not in out]
    sys.stderr.write(f"대상 {len(names)} | 기검증 {len(names)-len(todo)} | 남음 {len(todo)}\n")
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page()
        done = 0
        for ko in todo:
            presence, roman, src = False, None, None
            try:
                pg.goto("https://search.naver.com/search.naver?query=" + ko + " 작가 미술",
                        wait_until="domcontentloaded", timeout=20000)
                pg.wait_for_timeout(900)
                hrefs = pg.eval_on_selector_all("a", "els=>els.map(e=>e.href)")
                auth = [h for h in hrefs if h and AUTH.search(h) and not BLOCK.search(h)]
                presence = len(auth) > 0
                for url in auth[:3]:
                    try:
                        pg.goto(url, wait_until="domcontentloaded", timeout=15000)
                        pg.wait_for_timeout(700)
                        r = extract_roman(pg.inner_text("body"), ko)
                    except Exception:
                        continue
                    if r and 2 <= len(r) <= 40:
                        roman, src = r, url
                        break
            except Exception as e:
                sys.stderr.write(f"  {ko}: {str(e)[:30]}\n")
            out[ko] = {"verdict": "likely_artist" if presence else "unverified",
                       "presence": presence, "romanization": roman, "source": src}
            done += 1
            if done % 20 == 0:
                json.dump(out, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
                pa = sum(1 for v in out.values() if v.get("presence"))
                sys.stderr.write(f"  {done}/{len(todo)} | presence {pa}\n")
            pg.wait_for_timeout(int(delay * 1000))
        b.close()
    json.dump(out, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    pa = sum(1 for v in out.values() if v.get("presence"))
    ro = sum(1 for v in out.values() if v.get("romanization"))
    sys.stderr.write(f"완료: {len(out)} | presence {pa} | 로마자 {ro} → {out_path}\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--names", required=True)
    ap.add_argument("--out", default=OUT_DEFAULT)
    ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()
    names = [n.strip() for n in open(a.names, encoding="utf-8") if n.strip()]
    run(names, a.out, a.limit)


if __name__ == "__main__":
    main()
