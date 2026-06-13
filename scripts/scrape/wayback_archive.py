#!/usr/bin/env python3
"""Wayback 출처 보존 — URL 목록을 Internet Archive에 스냅샷 + 라이브↔스냅샷 매핑 기록.

fragile 사이트(altpool 등) 출처를 영구화한다. 어휘집 출처에 라이브 URL + Wayback 스냅샷 +
접속일을 함께 둘 수 있게 매핑 JSON을 남긴다.

레이트리밋 대응: 요청 간격 + 503/429 지수 백오프. 이미 최근(올해) 스냅샷이 있으면 재저장 생략.
증분/재개: 출력 JSON에 이미 있는 URL은 건너뜀(중단돼도 진행분 보존, 재실행 시 이어감).

사용:
    python scripts/scrape/wayback_archive.py --urls-from crawl-archive/altpool/altpool_20260613.json \
        --field source_url --extra http://www.altpool.org/_v3/en/about/mission.asp \
        --out crawl-archive/altpool/wayback_20260613.json --gap 6
"""
from __future__ import annotations
import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

UA = {"User-Agent": "korean-art-lexicon source-preservation (contact: readingroom.me)"}


def http(url, timeout, tries=1):
    last = None
    for i in range(tries):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout)
        except urllib.error.HTTPError as e:
            last = e
            if e.code in (429, 502, 503, 504, 520, 523) and i < tries - 1:
                time.sleep(15 * (i + 1))
                continue
            return e
        except Exception as e:
            last = e
            if i < tries - 1:
                time.sleep(8)
                continue
            return None
    return last


def recent_snapshot(url):
    """올해 스냅샷이 이미 있으면 (snapshot_url, ts) 반환, 없으면 (None, None)."""
    q = "http://archive.org/wayback/available?url=" + urllib.parse.quote(url, safe="") + "&timestamp=2026"
    r = http(q, 20)
    if r is None or isinstance(r, Exception):
        return None, None
    try:
        d = json.loads(r.read())
        snap = d.get("archived_snapshots", {}).get("closest", {})
        if snap.get("available") and snap.get("timestamp", "").startswith("2026"):
            return snap["url"], snap["timestamp"]
    except Exception:
        pass
    return None, None


def save(url):
    """save 트리거 → 스냅샷 URL. urllib이 302 따라가니 최종 archived URL 또는 Content-Location."""
    r = http("https://web.archive.org/save/" + url, 70, tries=3)
    if r is None or isinstance(r, Exception):
        code = getattr(r, "code", "?")
        return None, None, f"save_fail:{code}"
    cl = r.headers.get("Content-Location") or ""
    m = re.search(r"/web/(\d{14})/", cl) or re.search(r"/web/(\d{14})/", r.geturl())
    if m:
        ts = m.group(1)
        snap = ("https://web.archive.org" + cl) if cl else r.geturl()
        return snap, ts, "saved"
    return r.geturl(), "", "saved_no_ts"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--urls-from", required=True, help="JSON 파일(레코드 배열)")
    ap.add_argument("--field", default="source_url")
    ap.add_argument("--extra", nargs="*", default=[])
    ap.add_argument("--out", required=True)
    ap.add_argument("--gap", type=float, default=6.0, help="요청 간격(초)")
    ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()

    recs = json.load(open(a.urls_from, encoding="utf-8"))
    urls = []
    seen = set()
    for u in list(a.extra) + [r.get(a.field) for r in recs if isinstance(r, dict)]:
        if u and u not in seen:
            seen.add(u)
            urls.append(u)
    if a.limit:
        urls = urls[: a.limit]

    out = json.load(open(a.out, encoding="utf-8")) if os.path.exists(a.out) else {}
    todo = [u for u in urls if u not in out]
    print(f"대상 {len(urls)} / 이미완료 {len(urls)-len(todo)} / 남음 {len(todo)}", file=sys.stderr)

    done = 0
    for u in todo:
        snap, ts = recent_snapshot(u)
        if snap:
            out[u] = {"wayback": snap, "timestamp": ts, "status": "existing"}
        else:
            time.sleep(a.gap)
            snap, ts, status = save(u)
            out[u] = {"wayback": snap, "timestamp": ts, "status": status}
        done += 1
        # 증분 저장(중단 대비)
        json.dump(out, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        if done % 10 == 0:
            ok = sum(1 for v in out.values() if v.get("wayback"))
            print(f"  진행 {done}/{len(todo)} | 누적 스냅샷 {ok}", file=sys.stderr)
        time.sleep(a.gap)

    ok = sum(1 for v in out.values() if v.get("wayback"))
    print(f"완료: 스냅샷 {ok}/{len(out)} → {a.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
