#!/usr/bin/env python3
"""대안공간 풀(altpool.org) 전체 사이트 미러 — 원본 HTML 통째 다운로드.

박재용 지시: 특정 페이지만 타겟하다 계속 누락 → 사이트를 통째로 내려받아 로컬에서 추출.
전 b_type × 전 board_id × (KR /_v3/board/ + EN /_v3/en/board/) 상세 HTML + 정적 페이지를
crawl-archive/altpool/mirror/ 에 원본(euc-kr 바이트) 그대로 저장. 증분/재개(이미 받은 건 skip).

이후 모든 추출(전시·작가·EN·로마자 등)은 이 로컬 미러에서 — 재fetch 없음, 누락 없음.

사용:
    python scripts/scrape/altpool_mirror.py [--btypes 8,9,11] [--gap 0.6] [--refetch]
"""
from __future__ import annotations
import argparse
import json
import os
import re
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MIRROR = os.path.join(ROOT, "crawl-archive", "altpool", "mirror")
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15"}
HOST = "http://www.altpool.org"


def get(url, tries=4, timeout=30):
    for i in range(tries):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout).read()
        except Exception:
            if i < tries - 1:
                time.sleep(3 * (i + 1))
    return None


def text(raw):
    if raw is None:
        return ""
    for enc in ("euc-kr", "cp949", "utf-8"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("euc-kr", "replace")


def discover_btypes():
    found = []
    for bt in range(1, 16):
        h = text(get(f"{HOST}/_v3/board/list.asp?b_type={bt}&pageNo=1", tries=2))
        if re.search(r"goView\(\d+\)", h) or re.search(r'class="item', h):
            found.append(bt)
    return found


def enumerate_ids(btypes, gap):
    """전 b_type의 KR+EN 목록을 훑어 board_id 집합 수집(어느 쪽이 있는지 기록)."""
    ids = {}  # board_id -> {"kr_btypes": set, "en_btypes": set}
    for side, base in (("kr", "/_v3/board/list.asp"), ("en", "/_v3/en/board/list.asp")):
        for bt in btypes:
            page = 1
            while page <= 80:
                h = text(get(f"{HOST}{base}?b_type={bt}&pageNo={page}", tries=3))
                got = re.findall(r"goView\((\d+)\)", h)
                if not got:
                    break
                for bid in got:
                    ids.setdefault(bid, {"kr": [], "en": []})[side].append(bt)
                page += 1
                time.sleep(gap)
    return ids


def save_raw(path, raw):
    if raw is None:
        return False
    with open(path, "wb") as f:
        f.write(raw)
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--btypes", default="")
    ap.add_argument("--gap", type=float, default=0.6)
    ap.add_argument("--refetch", action="store_true")
    a = ap.parse_args()
    os.makedirs(MIRROR, exist_ok=True)

    btypes = [int(x) for x in a.btypes.split(",") if x] or discover_btypes()
    sys.stderr.write(f"b_types: {btypes}\n")

    ids = enumerate_ids(btypes, a.gap)
    sys.stderr.write(f"board_id 수집: {len(ids)}\n")

    # 정적 페이지
    statics = ["/_v3/main/main_new.asp", "/_v3/en/main/main_new.asp",
               "/_v3/about/about.asp", "/_v3/about/mission.asp", "/_v3/en/about/mission.asp",
               "/_v3/about/facility.asp", "/_v3/partner/partner.asp", "/_v3/board/networkSubmain.asp"]
    for sp in statics:
        fn = os.path.join(MIRROR, "static_" + sp.strip("/").replace("/", "_"))
        if a.refetch or not os.path.exists(fn):
            save_raw(fn, get(HOST + sp))
            time.sleep(a.gap)

    # 상세: 각 board_id의 KR + EN (b_type은 found 중 첫 값으로 — 상세는 board_id 기준)
    done, fetched = 0, 0
    manifest = {}
    for bid, sides in ids.items():
        for side, sub in (("kr", "/_v3/board/view.asp"), ("en", "/_v3/en/board/view.asp")):
            bt = (sides[side] or sides["kr"] or sides["en"] or [8])[0]
            fn = os.path.join(MIRROR, f"{bid}_{side}.html")
            if not a.refetch and os.path.exists(fn):
                continue
            raw = get(f"{HOST}{sub}?b_type={bt}&board_id={bid}&time_type=&year=")
            if save_raw(fn, raw):
                fetched += 1
            time.sleep(a.gap)
        manifest[bid] = {"kr_btypes": sides["kr"], "en_btypes": sides["en"]}
        done += 1
        if done % 25 == 0:
            sys.stderr.write(f"  진행 {done}/{len(ids)} | fetched {fetched}\n")
    json.dump({"btypes": btypes, "board_ids": manifest, "count": len(ids)},
              open(os.path.join(MIRROR, "_manifest.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    sys.stderr.write(f"완료: board_id {len(ids)} | 새로 받은 파일 {fetched} → {MIRROR}\n")


if __name__ == "__main__":
    main()
