#!/usr/bin/env python3
"""작가명 웹 교차검증 — codex --search(라이브 웹서치, $0)로 실제 작가 여부 + 로마자 + 출처 확인.

altpool codex 추출 작가 690명을 웹검색으로 교차검증:
- verdict: artist | non_artist(디자인스튜디오·연구소·잡음) | uncertain
- romanization: 작가 본인/기관 영문표기(찾으면)
- note: 웹 근거(URL 포함, Source-First)

토큰 효율: codex --search 사용($0, ChatGPT 구독 — Claude 토큰 안 씀). 배치 병렬.
사용: python scripts/scrape/altpool_verify_artists.py [--names FILE] [--batch 12] [--workers 4]
"""
from __future__ import annotations
import argparse
import json
import os
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(REPO, "crawl-archive", "altpool", "artist_verify.json")
BATCH_DIR = "/tmp/altpool_verify_batches"

PROMPT = (
    "{path} 파일을 읽어라(한국어 작가 후보명 배열). 각 이름을 웹검색해서 "
    "'대안공간 풀 등 한국 미술계에 참여한 실제 시각예술 작가(미술가/콜렉티브)인지' 판정하라. "
    "JSON 배열로만 반환(설명·마크다운 금지): "
    "{{name, verdict('artist'|'non_artist'|'uncertain'), "
    "romanization(작가 본인/기관이 쓰는 영문 표기를 찾으면, 없으면 null), "
    "note(한 줄 근거, 출처 URL 포함)}}. "
    "디자인 스튜디오·연구소·주최기관·전시제목 조각·잡음(숫자/영문코드)은 non_artist. "
    "웹 근거로만 판정하고 날조 금지(불확실하면 uncertain)."
)


def run_codex(idx, path):
    try:
        p = subprocess.run(
            ["codex", "--search", "exec", "--sandbox", "read-only", "--color", "never", PROMPT.format(path=path)],
            capture_output=True, text=True, stdin=subprocess.DEVNULL, timeout=600, cwd=REPO)
        ms = re.findall(r"\[\s*\{.*\}\s*\]", p.stdout or "", re.S)
        if ms:
            return idx, json.loads(ms[-1])
    except Exception as e:
        return idx, {"_error": str(e)[:80]}
    return idx, []


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--names", default="/tmp/altpool_artists_all.txt")
    ap.add_argument("--batch", type=int, default=12)
    ap.add_argument("--workers", type=int, default=4)
    a = ap.parse_args()
    os.makedirs(BATCH_DIR, exist_ok=True)

    all_names = [n.strip() for n in open(a.names, encoding="utf-8") if n.strip()]
    # 재개: 이미 판정된 이름은 건너뛰고 누락분만 처리 → 기존과 병합
    existing = json.load(open(OUT, encoding="utf-8")) if os.path.exists(OUT) else []
    verified = {x["name"] for x in existing if isinstance(x, dict) and x.get("verdict")}
    names = [n for n in all_names if n not in verified]
    print(f"전체 {len(all_names)} | 기판정 {len(verified)} | 이번 {len(names)} → 배치 {a.batch}", flush=True)
    batches = [names[i:i + a.batch] for i in range(0, len(names), a.batch)]
    paths = []
    for i, b in enumerate(batches):
        p = os.path.join(BATCH_DIR, f"v{i:02d}.json")
        json.dump(b, open(p, "w", encoding="utf-8"), ensure_ascii=False)
        paths.append(p)

    results = [None] * len(paths)
    with ThreadPoolExecutor(max_workers=a.workers) as ex:
        futs = {ex.submit(run_codex, i, p): i for i, p in enumerate(paths)}
        done = 0
        for fut in as_completed(futs):
            idx, res = fut.result()
            results[idx] = res if isinstance(res, list) else []
            done += 1
            n = sum(len(r) for r in results if r)
            print(f"  배치 {done}/{len(paths)} | 누적 판정 {n}", flush=True)

    merged = list(existing)  # 기존 판정 유지 + 이번 신규 병합
    for r in results:
        merged.extend(r or [])
    json.dump(merged, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    from collections import Counter
    print(f"완료: 누적 {len(merged)} 판정 → {OUT}", flush=True)
    print("verdict:", dict(Counter(x.get("verdict") for x in merged)), flush=True)


if __name__ == "__main__":
    main()
