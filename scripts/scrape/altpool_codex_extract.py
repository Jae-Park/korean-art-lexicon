#!/usr/bin/env python3
"""미러 전시 페이지를 codex(LLM)로 전수 의미추출 — regex 비일관성 whack-a-mole 종결.

박재용 통찰: altpool은 20년치 itemTitle이 비일관(《제목》/작가:제목/프로그램:작가/산문)이라
결정론 regex는 패턴마다 깨짐. LLM이 본문을 읽고 의미로 {제목·작가·유형}을 뽑으면 흡수.
codex 검증서 정정주(프로그램:작가)·탈선(빈 itemTitle→본문서 제목) 등 regex 오류 다 해결됨.

흐름: 미러 b_type=8 KR 전시 + EN(날짜 페어) 텍스트 → 배치(~12) → codex 병렬 추출 →
{board_id,title_ko,title_en,type,artists_ko,romanization,curators} 집계.
Source-First: codex에 '본문 근거만, 날조 금지'. 로컬 미러서 — 재fetch 0, $0(ChatGPT 구독).

사용: python scripts/scrape/altpool_codex_extract.py [--batch 12] [--workers 3]
"""
from __future__ import annotations
import argparse
import glob
import html as _html
import json
import os
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MIRROR = os.path.join(REPO, "crawl-archive", "altpool", "mirror")
OUT = os.path.join(REPO, "crawl-archive", "altpool", "codex_extract.json")
BATCH_DIR = "/tmp/altpool_batches"


def read_html(path):
    raw = open(path, "rb").read()
    for enc in ("euc-kr", "cp949", "utf-8"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("euc-kr", "replace")


def clean(s):
    return re.sub(r"\s+", " ", _html.unescape(re.sub(r"<[^>]+>", " ", s or ""))).strip()


def fields(path):
    h = read_html(path)
    if not re.search(r'class="item(Title|Content)"', h):
        return None
    def d(cls):
        m = re.search(r'<div class="%s">(.*?)</div>' % cls, h, re.S)
        return clean(m.group(1)) if m else ""
    cm = re.search(r'<div class="itemContent">(.*?)<!--', h, re.S) or re.search(r'<div class="itemContent">(.*)', h, re.S)
    return {"itemTitle": d("itemTitle"), "itemDate": d("itemDate"),
            "itemContent": clean(cm.group(1))[:900] if cm else ""}


def build_records():
    mani = json.load(open(os.path.join(MIRROR, "_manifest.json"), encoding="utf-8"))
    bmap = mani.get("board_ids", {})
    # KR b_type=8
    kr = {}
    for f in glob.glob(os.path.join(MIRROR, "*_kr.html")):
        bid = os.path.basename(f).split("_")[0]
        if 8 not in ((bmap.get(bid, {}) or {}).get("kr_btypes") or []):
            continue
        fl = fields(f)
        if fl:
            kr[bid] = fl
    # EN(전부) — 날짜로 페어
    en_by_date = {}
    for f in glob.glob(os.path.join(MIRROR, "*_en.html")):
        fl = fields(f)
        if fl and fl["itemDate"]:
            en_by_date.setdefault(fl["itemDate"], []).append(fl)
    recs = []
    for bid, k in kr.items():
        en = ""
        cands = en_by_date.get(k["itemDate"], [])
        en_fl = cands[0] if len(cands) == 1 else None
        recs.append({
            "board_id": bid,
            "kr_title": k["itemTitle"], "kr_date": k["itemDate"], "kr_content": k["itemContent"],
            "en_title": en_fl["itemTitle"] if en_fl else "",
            "en_content": en_fl["itemContent"] if en_fl else "",
        })
    return recs


PROMPT = (
    "{path} 파일을 읽어라(대안공간 풀 전시 배열; 각 board_id/kr_title/kr_date/kr_content/en_title/en_content). "
    "각 전시에서 다음을 추출해 JSON 배열로만 반환(설명·마크다운 금지): "
    "{{board_id, "
    "title_ko: 실제 전시 한국어 제목(작가명·프로그램명·'YYYY 풀 프로덕션/기획초대/새로운 시각' 같은 접두 시리즈명이 아닌 제목 그 자체. "
    "itemTitle이 시리즈명뿐이면 itemContent 본문에서 진짜 제목을 찾아라. 솔로 초대전이라 별도 제목이 없으면 null), "
    "title_en: 영문 제목 또는 null, "
    "type: 'solo' 또는 'group', "
    "artists_ko: 참여작가 한글명 리스트(기획자·큐레이터·그래픽/공간 디자이너·주최기관 제외. 단체명은 그대로), "
    "romanization: 객체 {{한글작가명: 영문로마자}}, en_content에 영문 작가명이 있을 때만 채우고 위치/문맥으로 정확히 대응, "
    "curators: 기획자 한글명 리스트}}. "
    "반드시 제공된 본문 텍스트에 근거해서만 추출하고, 없는 정보는 null/빈 배열로 두라(날조 절대 금지)."
)


def run_codex(idx, path):
    try:
        p = subprocess.run(
            ["codex", "exec", "--sandbox", "read-only", "--color", "never", PROMPT.format(path=path)],
            capture_output=True, text=True, stdin=subprocess.DEVNULL, timeout=420, cwd=REPO)
        out = p.stdout or ""
        ms = re.findall(r"\[\s*\{.*\}\s*\]", out, re.S)
        if ms:
            return idx, json.loads(ms[-1])
    except Exception as e:
        return idx, {"_error": str(e)[:80]}
    return idx, []


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--batch", type=int, default=12)
    ap.add_argument("--workers", type=int, default=3)
    a = ap.parse_args()
    os.makedirs(BATCH_DIR, exist_ok=True)

    recs = build_records()
    print(f"전시 {len(recs)}건 → 배치 {a.batch}개씩", flush=True)
    batches = [recs[i:i + a.batch] for i in range(0, len(recs), a.batch)]
    paths = []
    for i, b in enumerate(batches):
        p = os.path.join(BATCH_DIR, f"b{i:02d}.json")
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
            print(f"  배치 {done}/{len(paths)} 완료 | 누적 추출 {n}", flush=True)

    merged = []
    for r in results:
        merged.extend(r or [])
    json.dump(merged, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"완료: {len(merged)} 전시 추출 → {OUT}", flush=True)


if __name__ == "__main__":
    main()
