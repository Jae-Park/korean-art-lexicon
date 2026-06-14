#!/usr/bin/env python3
"""로컬 미러(crawl-archive/altpool/mirror/)에서 전수 추출 — 재fetch 없음, 누락 없음.

altpool_mirror.py가 받은 전 b_type × board_id × (KR/EN) 원본 HTML을 로컬에서 파싱:
- 전시(b_type=8): KR itemTitle→깨끗한 제목, itemDate, ○작가/산문, + EN 매칭(날짜)으로 영문제목·로마자.
- 그 외 b_type: 콘텐츠 수만 집계(전시 외 프로그램·토크 등 규모 파악).

산출: crawl-archive/altpool/extract_from_mirror.json (전시 레코드 + EN), 콘솔에 카테고리별 통계.
"""
from __future__ import annotations
import glob
import html as _html
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MIRROR = os.path.join(ROOT, "crawl-archive", "altpool", "mirror")
OUT = os.path.join(ROOT, "crawl-archive", "altpool", "extract_from_mirror.json")
EXHIBITION_BTYPE = 8


def read(path):
    raw = open(path, "rb").read()
    for enc in ("euc-kr", "cp949", "utf-8"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("euc-kr", "replace")


def clean(s):
    return re.sub(r"\s+", " ", _html.unescape(re.sub(r"<[^>]+>", " ", s or ""))).strip()


def div(h, cls):
    m = re.search(r'<div class="%s">(.*?)</div>' % cls, h, re.S)
    return clean(m.group(1)) if m else ""


def item_content(h):
    m = re.search(r'<div class="itemContent">(.*?)<!--', h, re.S) or re.search(r'<div class="itemContent">(.*)', h, re.S)
    return clean(m.group(1)) if m else ""


# 프로그램/시리즈명 신호(콜론 앞이 이거면 콜론 뒤가 작가) — 초대전·기획전 등.
_PROGRAM = re.compile(r"\d{4}|기획\s*초대|새로운\s*(작가|시각)|초대전|기획전|신진|프로덕션|기금마련|Production|Invitation|Project")


def derive_title_artist(item_title):
    """itemTitle → (제목, 작가). 콜론 형식 분기:
    'Artist : Title'(앞=작가) vs 'Program : Artist'(앞=연도/프로그램 → 뒤가 작가)."""
    m = re.search(r"[《≪](.+?)[》≫]", item_title)
    inner = (m.group(1).strip() if m
             else re.sub(r"^\s*\d{4}\s+(Pool Production|Production|풀 프로덕션|기획전시|기금마련전)\s*[:：]?\s*", "", item_title).strip())
    if " : " in inner:
        before, after = [p.strip() for p in inner.split(" : ", 1)]
        if _PROGRAM.search(before) and not _PROGRAM.search(after):
            # 'Program : Artist' — 작가=뒤, 제목은 전체 유지(작가명이 제목으로 둔갑 방지)
            return item_title.strip(), after
        return after, before  # 'Artist : Title'
    return inner, ""


def label(text, *names):
    for n in names:
        m = re.search(r"[○●]\s*" + n + r"\s*[:：]\s*(.+?)(?=[○●]|$)", text)
        if m:
            return clean(m.group(1))
    return ""


# 다음 크레딧 라벨(여기서 작가 목록 끝남) — ○ 유무 무관, 산문판 대응.
_BOUND = (r"(?=[○●]|기획\s*[:：]|전시기획|주최|주관|일정\s*[:：]|기간\s*[:：]|장소\s*[:：]|관람|후원|협찬|"
          r"그래픽|공간\s*(디자인|연출)|디자인\s*[:：]|텍스트|Curator|Director|Graphic|Space|Organized|Supported|$)")


def artist_value(text, en=False):
    """작가 목록 추출 — ○ 마커 있든 없든. '참여작가:'/'작가:'/'Artist:' 다음, 다음 크레딧 전까지."""
    pats = [r"Artists?"] if en else [r"참여\s*작가", r"출품\s*작가", r"참여자", r"작가"]
    for p in pats:
        m = re.search(r"[○●]?\s*" + p + r"\s*[:：]\s*(.+?)" + _BOUND, text)
        if m:
            v = clean(m.group(1))
            v = re.sub(r"\s*[<〈《][^>〉》]*[>〉》]", "", v)  # <작품명> 제거
            if 2 <= len(v) <= 400:
                return v
    return ""


def split_names(value):
    parts = re.split(r"[,，、ㆍ·∙•;；]|\s+및\s+|\s+와\s+|\s+과\s+", value or "")
    out = []
    for p in (clean(x) for x in parts):
        if not p:
            continue
        toks = p.split()
        if len(toks) >= 3 and all(re.fullmatch(r"[가-힣]{2,4}", t) for t in toks):
            out.extend(toks)
        elif len(toks) == 2 and re.fullmatch(r"[가-힣]", toks[0]) and re.fullmatch(r"[가-힣]{2,3}", toks[1]):
            out.append("".join(toks))
        else:
            out.append(p)
    return [x for x in out if x]


def strip_members(name):
    return re.sub(r"\s*[(（].*?[)）]\s*", "", name).strip()


def clean_solo(name):
    """itemTitle의 '작가 개인전'/'Artist Solo Exhibition' → 작가명만."""
    return re.sub(r"\s*(개인전|개인展|個人展|展|초대전|Solo Exhibition|solo exhibition)\s*$", "", name).strip()


def looks_like_title(n):
    """솔로 itemTitle 전반부가 작가명 아니라 제목조각인 신호(차단용 블랙리스트)."""
    if not n or len(n) > 22 or re.search(r"\d", n):
        return True
    if re.search(r"(작가|프로덕션|전시|기획전|기금|프로젝트|선정|초대|아카이브|워크숍|세미나|포럼)$", n):
        return True
    if re.search(r"(에서|으로|하는|에게|에 대한)$", n):  # 명백한 조사·연결어미만 = 구
        return True
    if len([t for t in n.split() if re.search(r"[가-힣]", t)]) >= 3:  # 한글 3+ 토큰 = 구
        return True
    return False


def valid_artist(n):
    """개별 작가명 검증 — 문장/문단/뭉친이름/카테고리어 차단(산문 파싱 잡음 제거)."""
    if not n or not (2 <= len(n) <= 16) or re.search(r"\d", n):
        return False
    if re.search(r"(작가|전시|졸업|대학|디자인|프로젝트팀|오프닝|프로덕션|선정|영역)", n):
        return False
    if len([t for t in n.split() if re.search(r"[가-힣]", t)]) >= 3:  # 한글 3+ 어절 = 구
        return False
    if " " in n and re.search(r"(는|다|에서|으로|통해|위해|이며|관심|표현|대한)", n):  # 문장 신호
        return False
    if re.fullmatch(r"[가-힣]{7,}", n):  # 7+ 음절 단일토큰 = 이름 뭉침 의심
        return False
    return True


def artists_for(rec, en=False):
    """○작가/참여작가(○유무 무관) 우선, 없으면 솔로 itemTitle. 각 이름 valid_artist로 검증."""
    lab = rec.get("artists_raw") or ""
    if lab:
        return [x for x in (strip_members(y) for y in split_names(lab)) if valid_artist(x) or en]
    solo = clean_solo(rec.get("solo_artist") or "")
    if solo and not looks_like_title(solo) and (en or valid_artist(solo)):
        return [solo]
    return []


def is_real(h):
    """프레임셋/빈 페이지 제외 — itemTitle 또는 itemContent 있어야 실 콘텐츠."""
    return bool(re.search(r'class="item(Title|Content)"', h))


def parse_side(path, en=False):
    h = read(path)
    if not is_real(h):
        return None
    it = div(h, "itemTitle")
    date = div(h, "itemDate")
    ct = item_content(h)
    title, solo = derive_title_artist(it)
    artists = artist_value(ct, en=en)
    return {"item_title": it, "title": title, "solo_artist": solo, "date": date, "artists_raw": artists, "content_len": len(ct)}


def main():
    manifest_path = os.path.join(MIRROR, "_manifest.json")
    mani = json.load(open(manifest_path, encoding="utf-8")) if os.path.exists(manifest_path) else {}
    bmap = mani.get("board_ids", {})

    kr_recs, en_recs = [], []
    btype_counts = {}
    for f in glob.glob(os.path.join(MIRROR, "*_kr.html")):
        bid = os.path.basename(f).split("_")[0]
        rec = parse_side(f, en=False)
        if not rec:
            continue
        bts = (bmap.get(bid, {}) or {}).get("kr_btypes") or [None]
        bt = bts[0]
        btype_counts[bt] = btype_counts.get(bt, 0) + 1
        rec["board_id"] = bid
        rec["b_type"] = bt
        kr_recs.append(rec)
    for f in glob.glob(os.path.join(MIRROR, "*_en.html")):
        rec = parse_side(f, en=True)
        if not rec:
            continue
        rec["board_id"] = os.path.basename(f).split("_")[0]
        en_recs.append(rec)

    # 전시(b_type=8) KR + EN 매칭(날짜)
    kr_ex = [r for r in kr_recs if r["b_type"] == EXHIBITION_BTYPE]
    en_by_date = {}
    for e in en_recs:
        if e["date"]:
            en_by_date.setdefault(e["date"], []).append(e)

    exhibitions = []
    en_matched = 0
    roman = {}
    for k in kr_ex:
        en = None
        cands = en_by_date.get(k["date"], [])
        if len(cands) == 1:
            en = cands[0]
            en_matched += 1
        title_en = en["title"] if en else ""
        ko_names = artists_for(k, en=False)
        if en:
            en_names = artists_for(en, en=True)
            if ko_names and len(ko_names) == len(en_names):
                for ko, en_n in zip(ko_names, en_names):
                    if re.search(r"[가-힣]", ko) and re.search(r"[A-Za-z]", en_n) and ko not in roman:
                        roman[ko] = en_n
        exhibitions.append({
            "board_id": k["board_id"], "title_ko": k["title"], "title_en": title_en,
            "date": k["date"], "artists_ko": ko_names,
            "source_url": f"http://www.altpool.org/_v3/board/view.asp?b_type=8&board_id={k['board_id']}",
        })

    json.dump({"exhibitions": exhibitions, "romanization": roman}, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    # 보고
    print("== 미러 전수 추출 ==")
    print(f"KR 실콘텐츠 {len(kr_recs)} | EN 실콘텐츠 {len(en_recs)}")
    print("b_type별 KR 콘텐츠 수:", dict(sorted((str(k), v) for k, v in btype_counts.items())))
    print(f"\n전시(b_type=8): {len(exhibitions)}건")
    print(f"  EN 제목 매칭: {sum(1 for e in exhibitions if e['title_en'])}")
    print(f"  작가 로마자: {len(roman)}")
    with_artists = sum(1 for e in exhibitions if e["artists_ko"])
    print(f"  작가 추출된 전시: {with_artists}")
    print(f"→ {OUT}")


if __name__ == "__main__":
    main()
