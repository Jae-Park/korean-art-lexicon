#!/usr/bin/env python3
"""작가 로마자 enrichment — 한글 작가명의 로마자 표기를 권위 출처에서 보수적으로 추출.

Source-First + (이번 세션 교훈) 보수성:
- WebSearch는 US-앵커라 한국 콘텐츠 약함 → Naver-Playwright로 검색.
- 추출은 **괄호 짝짓기**만 신뢰: '한글명(Latin)' 또는 'Latin(한글명)'처럼 페이지가
  명시적으로 짝지은 경우만 채택(encykorea 한자 앵커 방식과 동형). 못 찾으면 비움(날조 금지).
- 애그리게이터(artnet/mutualart/invaluable/artsy) 제외. 권위 도메인 우선.
- 신진 작가는 공식 로마자가 없을 수 있음 → "없음"은 정당한 결과(부정결론 게이트: 방법 아닌 부재).

사용:
    python scripts/scrape/romanize_artists.py --names /tmp/altpool_artists.txt --out /tmp/roman.json [--limit N]
"""
from __future__ import annotations
import argparse
import json
import re
import sys

AUTH = re.compile(
    r"(go\.kr|or\.kr|ac\.kr|encykorea|e-flux\.com|ocula\.com|frieze\.com|artforum\.com|"
    r"artreview\.com|koreaherald|koreatimes|hani\.co\.kr|joongang|donga\.com|"
    r"gallery|museum|art|kunst|biennale|foundation|studio)", re.I)
BLOCK = re.compile(
    r"(blog|cafe|post\.naver|tistory|instagram|facebook|twitter|youtube|namu\.wiki|"
    r"search\.naver|dict\.|kin\.naver|shopping|map\.|artnet|mutualart|invaluable|artsy)", re.I)
# 로마자 이름: Title Case 1~3 토큰(하이픈 허용)
LAT = r"[A-Z][A-Za-z]*(?:[ \-][A-Z]?[a-z]+){0,2}"


def extract_roman(text, ko):
    """페이지에서 한글명에 괄호로 짝지어진 로마자만 추출(양방향)."""
    # 한글명(Latin)
    m = re.search(re.escape(ko) + r"\s*[(（]\s*(" + LAT + r")\s*[)）]", text)
    if m:
        return m.group(1).strip()
    # Latin(한글명)
    m = re.search(r"(" + LAT + r")\s*[(（]\s*" + re.escape(ko) + r"\s*[)）]", text)
    if m:
        return m.group(1).strip()
    return None


def run(names, limit, delay=1.5):
    from playwright.sync_api import sync_playwright
    if limit:
        names = names[:limit]
    found, missing = {}, []
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page()
        for ko in names:
            roman = None
            src = None
            try:
                # 한글명 앵커 + 영문 맥락(닭-달걀 깨기)
                pg.goto("https://search.naver.com/search.naver?query=" + ko + " 작가 artist",
                        wait_until="domcontentloaded", timeout=25000)
                pg.wait_for_timeout(1000)
                hrefs = pg.eval_on_selector_all("a", "els=>els.map(e=>e.href)")
                cands = []
                for h in hrefs:
                    if h and AUTH.search(h) and not BLOCK.search(h):
                        if h not in cands:
                            cands.append(h)
                for url in cands[:4]:
                    try:
                        pg.goto(url, wait_until="domcontentloaded", timeout=20000)
                        pg.wait_for_timeout(800)
                        txt = pg.inner_text("body")
                    except Exception:
                        continue
                    r = extract_roman(txt, ko)
                    if r and 2 <= len(r) <= 40:
                        roman, src = r, url
                        break
            except Exception as e:
                sys.stderr.write(f"  {ko}: 오류 {str(e)[:40]}\n")
            if roman:
                found[ko] = {"romanization": roman, "source": src}
                print(f"  + {ko} → {roman}")
            else:
                missing.append(ko)
            pg.wait_for_timeout(int(delay * 1000))
        b.close()
    return found, missing


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--names", required=True)
    ap.add_argument("--out", default="/tmp/roman.json")
    ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()
    names = [n.strip() for n in open(a.names, encoding="utf-8") if n.strip()]
    found, missing = run(names, a.limit)
    json.dump({"found": found, "missing": missing}, open(a.out, "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)
    print(f"\n로마자 확보 {len(found)} / 미확보 {len(missing)} (대상 {len(found)+len(missing)})", file=sys.stderr)


if __name__ == "__main__":
    main()
