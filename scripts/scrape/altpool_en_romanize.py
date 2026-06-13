#!/usr/bin/env python3
"""대안공간 풀 영문판(/_v3/en/)에서 작가 로마자 + 전시 영문명 추출 → KR과 매칭.

발견: 풀 영문판 상세(en/board/view.asp)가 KR과 동일 구조(○ Title/Artist/Curator)로
**기관 공식 영문 표기**를 담고 있다. board_id는 KR과 다르나 itemDate(영문 날짜)는 동일 →
날짜로 KR↔EN 전시 매칭 → 작가 위치 정렬로 {한글명: 로마자} 맵 생성(기관 GOLD 출처).

보수성: 작가 수가 KR=EN 같을 때만 위치 정렬(다르면 그 전시 skip). 같은 한글명에 로마자 충돌 시 flag.

사용:
    python scripts/scrape/altpool_en_romanize.py --kr crawl-archive/altpool/altpool_20260613.json \
        --out crawl-archive/altpool/en_romanization_20260613.json [--limit N]
"""
from __future__ import annotations
import argparse
import html as _html
import json
import re
import sys
import time
import urllib.request

EN_LIST = "http://www.altpool.org/_v3/en/board/list.asp"
EN_VIEW = "http://www.altpool.org/_v3/en/board/view.asp"
UA = {"User-Agent": "Mozilla/5.0 (Macintosh) Safari/605.1.15"}


def fetch(url, tries=3):
    for i in range(tries):
        try:
            raw = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read()
            for enc in ("euc-kr", "cp949", "utf-8"):
                try:
                    return raw.decode(enc)
                except UnicodeDecodeError:
                    continue
            return raw.decode("euc-kr", "replace")
        except Exception:
            if i < tries - 1:
                time.sleep(3)
    return ""


def clean(s):
    return re.sub(r"\s+", " ", _html.unescape(re.sub(r"<[^>]+>", " ", s or "")).replace(" ", " ")).strip()


def split_names(value):
    """KR/EN 공통 작가 분리(다중구분자 + 공백 한글3토큰). EN은 콤마 위주."""
    parts = re.split(r"[,，、ㆍ·∙•;；]|\s+및\s+|\s+와\s+|\s+과\s+", value or "")
    out = []
    for p in (clean(x) for x in parts):
        if not p:
            continue
        toks = p.split()
        if len(toks) >= 3 and all(re.fullmatch(r"[가-힣]{2,4}", t) for t in toks):
            out.extend(toks)
        else:
            out.append(p)
    return out


def strip_members(name):
    """'Choi Soomyeon(Rho Jae Oon X IM Youngzoo)' → 'Choi Soomyeon' (대표명만). KR도 동일 처리됨."""
    return re.sub(r"\s*[(（].*?[)）]\s*$", "", name).strip()


def label(text, *names):
    for n in names:
        m = re.search(r"[○●]\s*" + n + r"\s*[:：]\s*(.+?)(?=[○●]|$)", text)
        if m:
            return clean(m.group(1))
    return ""


def parse_en(bid):
    h = fetch(f"{EN_VIEW}?b_type=8&board_id={bid}")
    date = ""
    dm = re.search(r'<div class="itemDate">(.*?)</div>', h, re.S)
    if dm:
        date = clean(dm.group(1))
    cm = re.search(r'<div class="itemContent">(.*?)<!--', h, re.S) or re.search(r'<div class="itemContent">(.*)', h, re.S)
    ct = clean(cm.group(1)) if cm else ""
    return {
        "en_board_id": bid,
        "item_date": date,
        "title_en": label(ct, "Title"),
        "artists_en": label(ct, "Artist", "Artists"),
    }


def crawl_en(limit):
    ids, page = [], 1
    while page <= 60:
        h = fetch(f"{EN_LIST}?b_type=8&pageNo={page}")
        found = list(dict.fromkeys(re.findall(r"goView\((\d+)\)", h)))
        if not found:
            break
        ids += [i for i in found if i not in ids]
        page += 1
    if limit:
        ids = ids[:limit]
    return [parse_en(b) for b in ids]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--kr", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()

    kr = json.load(open(a.kr, encoding="utf-8"))
    kr_by_date = {}
    for r in kr:
        d = (r.get("date_text_original") or "").strip()
        if d:
            kr_by_date.setdefault(d, []).append(r)

    en_recs = crawl_en(a.limit)
    sys.stderr.write(f"en 전시 {len(en_recs)}건 크롤\n")

    roman = {}        # 한글명 → {en, source, exhibition}
    conflicts = []
    title_en = {}     # KR 전시 title_ko → en
    matched = 0
    for en in en_recs:
        krs = kr_by_date.get(en["item_date"], [])
        if len(krs) != 1:
            continue  # 날짜 모호/부재 → skip
        k = krs[0]
        matched += 1
        if k.get("title_ko") and en["title_en"]:
            title_en[k["title_ko"]] = en["title_en"]
        ko_names = [strip_members(x) for x in split_names("，".join(k.get("artists", [])) if isinstance(k.get("artists"), list) else "")]
        # KR artists는 이미 리스트 → 그대로 + 멤버 strip
        ko_names = [strip_members(x) for x in (k.get("artists") or [])]
        en_names = [strip_members(x) for x in split_names(en["artists_en"])]
        if len(ko_names) != len(en_names) or not ko_names:
            continue  # 수 불일치 → 위치정렬 불가, skip(보수)
        for ko, en_n in zip(ko_names, en_names):
            if not re.search(r"[가-힣]", ko) or not re.search(r"[A-Za-z]", en_n):
                continue
            if ko in roman and roman[ko]["en"] != en_n:
                conflicts.append((ko, roman[ko]["en"], en_n))
                continue
            roman[ko] = {"en": en_n, "source": f"{EN_VIEW}?b_type=8&board_id={en['en_board_id']}",
                         "exhibition": en["title_en"]}

    out = {"romanization": roman, "title_en": title_en,
           "matched_exhibitions": matched, "conflicts": conflicts}
    json.dump(out, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    sys.stderr.write(f"매칭 전시 {matched} | 작가 로마자 {len(roman)} | 전시 EN {len(title_en)} | 충돌 {len(conflicts)}\n")


if __name__ == "__main__":
    main()
