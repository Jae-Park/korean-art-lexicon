#!/usr/bin/env python3
"""인물 다중소스 보강 — 한 인물(또는 배치)에 다른 기관 출처를 추가해 레퍼런스·표기변이 풍부화.

어휘집 핵심 가치 = 한 인물이 기관마다 어떻게 표기·참조되는지(sources[].name_used = 표기 변이).
altpool 등 1개 출처만 있는 인물에 다른 권위 출처(미술관·갤러리·AAA·e-flux·encykorea 등)를 더해
sources[]에 append. 각 출처에서 그 페이지가 쓰는 표기(name_used)를 따 변이를 문서화.

Source-First: 애그리게이터(Artnet/MutualArt/Invaluable/Artsy) 제외, 루트URL 금지(공식사이트 예외),
기존 sources URL과 dedup, URL 생존 확인, 날조 금지(페이지에서 확인된 것만).

검색: Naver-Playwright(국내 기관, $0 무제한) 기본. (codex --search는 쿼터 있어 옵션 외부 연동.)
기본 dry-run(보고만). --apply 시 YAML sources[]에 추가 + dist 재빌드.

사용:
    python scripts/person_source_enrich.py person.kim-beom            # 1명 dry-run
    python scripts/person_source_enrich.py 김범 --apply --max 6        # 이름으로, 적용
    python scripts/person_source_enrich.py --batch /tmp/ids.txt --apply
"""
from __future__ import annotations
import argparse
import datetime
import glob
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request

import yaml

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PERSONS = os.path.join(REPO, "data", "persons")
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15"}

# 권위 도메인(국내·국제 기관/문헌). 애그리게이터·SNS·블로그 제외.
AUTH = re.compile(r"(museum|gallery|\.go\.kr|\.or\.kr|\.ac\.kr|encykorea|aaa\.org|e-flux|ocula|frieze|"
                  r"artforum|artreview|koreaherald|koreatimes|neolook|daljin|theartro|mmca|sema|arko|"
                  r"leeum|amorepacific|kukje|pkmgallery|hakgojae|galleryhyundai|guggenheim|moma|tate|"
                  r"metmuseum|walkerart|biennale|foundation|kunst)", re.I)
BLOCK = re.compile(r"(blog|cafe|post\.naver|tistory|instagram|facebook|twitter|x\.com|youtube|namu\.wiki|"
                   r"search\.naver|dict\.|kin\.naver|shopping|map\.|news\.naver|artnet|mutualart|"
                   r"invaluable|artsy|wikipedia|pinterest)", re.I)
ROOT = re.compile(r"^https?://[^/]+/?$")
LAT = r"[A-Z][A-Za-z]*(?:[ \-][A-Z]?[a-z]+){0,2}"
TODAY = datetime.date.today().isoformat()


def alive(url):
    try:
        urllib.request.urlopen(urllib.request.Request(url, method="HEAD", headers=UA), timeout=12)
        return True
    except urllib.error.HTTPError as e:
        return e.code in (403, 405, 429, 503)
    except Exception:
        return False


def find_person(key):
    for f in glob.glob(os.path.join(PERSONS, "*.yaml")):
        d = yaml.safe_load(open(f, encoding="utf-8"))
        if not d:
            continue
        ko = d.get("name", {}).get("ko", {})
        full = ko.get("full", "") if isinstance(ko, dict) else (ko or "")
        if d.get("id") == key or full == key or os.path.basename(f)[:-5] == key:
            return f, d, full
    return None, None, None


def name_used_on(page_text, ko, domain):
    """페이지가 쓰는 표기 추출 — 괄호 짝(한글(Latin)/Latin(한글)) 우선, 없으면 도메인 성격으로."""
    m = re.search(re.escape(ko) + r"\s*[(（]\s*(" + LAT + r")\s*[)）]", page_text) or \
        re.search(r"(" + LAT + r")\s*[(（]\s*" + re.escape(ko) + r"\s*[)）]", page_text)
    if m and 2 <= len(m.group(1)) <= 40:
        return m.group(1).strip()
    if re.search(r"\.go\.kr|\.or\.kr|encykorea|neolook|daljin|theartro", domain):
        return ko  # 국내 기관 페이지 = 한글 표기 사용
    return None  # 영문 페이지인데 표기 못 잡으면 보류(날조 금지)


def harvest_naver(ko, existing_urls, want):
    from playwright.sync_api import sync_playwright
    found = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page()
        try:
            ok = False
            for attempt in range(3):  # 검색 페이지 goto 타임아웃 격리 — 재시도
                try:
                    pg.goto("https://search.naver.com/search.naver?query=" + ko + " 작가 미술",
                            wait_until="domcontentloaded", timeout=25000)
                    ok = True
                    break
                except Exception:
                    pg.wait_for_timeout(1500)
            if not ok:
                return found  # 검색 자체 실패 → 빈손(크래시 금지)
            pg.wait_for_timeout(900)
            hrefs = pg.eval_on_selector_all("a", "els=>els.map(e=>e.href)")
            cands = []
            for h in hrefs:
                if not h or h in existing_urls or ROOT.match(h):
                    continue
                if AUTH.search(h) and not BLOCK.search(h) and h not in cands:
                    cands.append(h)
            for url in cands:
                if len(found) >= want:
                    break
                try:
                    pg.goto(url, wait_until="domcontentloaded", timeout=15000)
                    pg.wait_for_timeout(700)
                    txt = pg.inner_text("body")
                except Exception:
                    continue
                if ko not in txt:
                    continue  # 그 인물 페이지가 맞는지(한글명 등장)
                nu = name_used_on(txt, ko, url)
                if not nu:
                    continue
                if not alive(url):
                    continue
                dom = re.sub(r"^https?://(www\.)?", "", url).split("/")[0]
                i = txt.find(ko)
                snip = re.sub(r"\s+", " ", txt[max(0, i - 130):i + 170]) if i >= 0 else ""
                found.append({"url": url, "name_used": nu, "note": f"{dom} — {ko} 참조",
                              "accessed": TODAY, "snippet": snip, "domain": dom})
                existing_urls.add(url)
        finally:
            b.close()
    return found


def enrich(key, apply, want, collect=False):
    f, d, ko = find_person(key)
    if not d:
        print(f"  인물 못 찾음: {key}")
        return [] if collect else 0
    existing = {(s.get("url") if isinstance(s, dict) else s) for s in (d.get("sources") or [])}
    new = harvest_naver(ko, set(existing), want)
    if collect:  # 수집만 — sonnet 검증용 후보 반환(적용 X)
        return {"id": d["id"], "file": f, "ko": ko, "candidates": new}
    forms_before = {s.get("name_used") for s in (d.get("sources") or []) if isinstance(s, dict)}
    added = [s for s in new if s["url"] not in existing]
    print(f"\n[{d['id']}] {ko} — 기존 출처 {len(existing)}개")
    for s in added:
        nf = " (새 표기변이)" if s["name_used"] not in forms_before else ""
        print(f"  + {s['url'][:60]} | name_used={s['name_used']}{nf}")
    if not added:
        print("  추가 출처 없음")
    if apply and added:
        d.setdefault("sources", []).extend(added)
        with open(f, "w", encoding="utf-8") as fh:
            fh.write(yaml.safe_dump(d, allow_unicode=True, sort_keys=False))
        print(f"  → {len(added)}개 sources[]에 추가")
    return len(added)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("key", nargs="?", help="person.id / 한글명 / 슬러그")
    ap.add_argument("--batch", help="id/이름 목록 파일")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--max", type=int, default=5, help="인물당 추가 출처 최대")
    ap.add_argument("--harvest-only", help="수집만 → 이 경로에 JSON(sonnet 검증용). 적용 안 함.")
    ap.add_argument("--apply-verified", help="sonnet 검증 통과 JSON([{id,approved:[{url,name_used,note,accessed}]}]) → sources[] 적용 + 빌드")
    a = ap.parse_args()
    keys = [a.key] if a.key else []
    if a.batch:
        keys += [x.strip() for x in open(a.batch, encoding="utf-8") if x.strip()]
    if not keys and not a.apply_verified:
        ap.error("key 또는 --batch 필요")
    if a.harvest_only:
        import json
        # 재개: 이미 수집된 인물은 건너뜀(크래시/타임아웃 후 이어서)
        out = json.load(open(a.harvest_only, encoding="utf-8")) if os.path.exists(a.harvest_only) else []
        done_ids = {r["id"] for r in out}
        for i, k in enumerate(keys):
            f0, d0, _ = find_person(k)
            if d0 and d0.get("id") in done_ids:
                print(f"  건너뜀 {i+1}/{len(keys)} {k} (이미 수집)", file=sys.stderr)
                continue
            try:
                r = enrich(k, False, a.max, collect=True)
            except Exception as e:  # 인물별 격리 — 한 명 실패가 배치를 죽이지 않게
                print(f"  실패 {i+1}/{len(keys)} {k}: {str(e)[:50]}", file=sys.stderr)
                continue
            if r:
                out.append(r)  # 0건도 기록(재처리 방지)
                done_ids.add(r["id"])
                json.dump(out, open(a.harvest_only, "w", encoding="utf-8"), ensure_ascii=False, indent=1)  # 증분 저장
            print(f"  수집 {i+1}/{len(keys)} {k}: {len(r.get('candidates',[])) if r else 0}건", file=sys.stderr)
        tot = sum(len(r["candidates"]) for r in out)
        print(f"수집 완료: {tot}개 후보 출처 / {len(out)}명 → {a.harvest_only}")
        return
    if a.apply_verified:
        import json
        verified = json.load(open(a.apply_verified, encoding="utf-8"))
        applied, touched = 0, []
        for v in verified:
            f, d, ko = find_person(v["id"])
            if not d:
                print(f"  인물 못 찾음: {v['id']}", file=sys.stderr)
                continue
            existing = {(s.get("url") if isinstance(s, dict) else s) for s in (d.get("sources") or [])}
            add = []
            for c in v.get("approved", []):
                if c["url"] in existing:
                    continue
                # helper 필드(snippet/domain) 제거 — sources[]엔 스키마 필드만
                add.append({"url": c["url"], "name_used": c["name_used"],
                            "note": c.get("note", ""), "accessed": c.get("accessed", TODAY)})
                existing.add(c["url"])
            if add:
                d.setdefault("sources", []).extend(add)
                with open(f, "w", encoding="utf-8") as fh:
                    fh.write(yaml.safe_dump(d, allow_unicode=True, sort_keys=False))
                applied += len(add)
                touched.append(f"{ko} +{len(add)}")
                print(f"  [{v['id']}] {ko} — {len(add)}개 추가: " +
                      ", ".join(f"{c['name_used']}" for c in add))
        print(f"\n적용 완료: {applied}개 출처 / {len(touched)}명")
        if applied:
            rc = subprocess.call([sys.executable, os.path.join(REPO, "scripts", "build.py")])
            print(f"build rc={rc}")
        return
    total = sum(enrich(k, a.apply, a.max) for k in keys)
    print(f"\n총 추가 출처 {total}개")
    if a.apply and total:
        rc = subprocess.call([sys.executable, os.path.join(REPO, "scripts", "build.py")])
        print(f"build rc={rc}")


if __name__ == "__main__":
    main()
