#!/usr/bin/env python3
"""대안공간 풀 / Art Space Pool (altpool.org) 전시 아카이브 스크레이퍼.

레거시 ASP 게시판(HTTP 전용, EUC-KR, 프레임셋). 콘텐츠는 /_v3/board/.
- 목록: list.asp?b_type=8&pageNo=M → 행은 javascript:goView(board_id), 제목 《》 표기
- 상세: view.asp?board_id=X → .itemTitle / .itemDate / .itemContent(○ 전시명/작가/기획/기간/장소)

Source-First + (codex 교차검증으로 합의한) 무결성 가드:
- itemTitle(아카이브 표제) ≠ ○ 전시명(전시 제목) → 둘 다 보존, 분리.
- 날짜는 원문(date_text_original) 보존, ISO는 파싱 성공 시에만 별도.
- 작가는 ○ 작가 쉼표 분리까지만. 단체명/병기 의심은 flag, 디자이너·공간디자인 등은 작가로 안 섞음.
- 영문 제목 병기는 title.en 자동삽입 금지 → en_candidate로 보류(사람 확인).
- 출처 = 재구성한 상세 URL(루트/목록 URL 금지).

stdlib만 사용(bs4 불필요). 결과는 JSON 배열로 stdout.
사용:
    python scripts/scrape/altpool.py --pages 1            # 1페이지(검증 샘플)
    python scripts/scrape/altpool.py --all --out /tmp/altpool.json
"""
from __future__ import annotations
import argparse
import html as _html
import json
import re
import sys
import time
import urllib.parse
import urllib.request

BASE = "http://www.altpool.org/_v3/board"
LIST_URL = BASE + "/list.asp"
VIEW_URL = BASE + "/view.asp"
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15"}
B_TYPE_EXHIBITION = 8  # 전시 아카이브 (교차검증 확인)

# 작가 필드에서 단체/협업/병기/비-작가 역할 의심 신호(자동 분리 보류 → flag, 사람 확인)
GROUP_HINTS = ("형제", "콜렉티브", "collective", "그룹", "팀", "duo", "외 ", " 및 ",
               "프로젝트", "콜로니", "(", " X ", " x ", "×")


def fetch(url, params=None, retries=3):
    if params:
        url = url + "?" + urllib.parse.urlencode(params)
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=UA)
            raw = urllib.request.urlopen(req, timeout=30).read()
            for enc in ("euc-kr", "cp949", "utf-8"):
                try:
                    return raw.decode(enc), url
                except UnicodeDecodeError:
                    continue
            return raw.decode("euc-kr", "replace"), url
        except Exception as e:  # 레거시 서버 간헐 타임아웃 → 재시도
            last = e
            time.sleep(2)
    raise RuntimeError(f"fetch 실패({retries}회): {url} :: {last}")


def clean(s):
    if not s:
        return ""
    s = _html.unescape(s)
    s = s.replace(" ", " ").replace("⠀", " ")  # nbsp, braille-blank(채움문자)
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def list_board_ids(page_no):
    """목록 페이지에서 (board_id, 목록제목) 추출. goView(id)가 행 키."""
    txt, _ = fetch(LIST_URL, {"pageNo": page_no, "b_type": B_TYPE_EXHIBITION, "time_type": "", "year": ""})
    out = []
    seen = set()
    # goView(123) 와 인접 《제목》을 함께 — anchor 단위로 스캔
    for m in re.finditer(r"goView\((\d+)\)(.*?)(?:</a>|</li>)", txt, re.S):
        bid = m.group(1)
        if bid in seen:
            continue
        seen.add(bid)
        tm = re.search(r"[《≪]([^》≫]{1,80})[》≫]", m.group(2))
        out.append((bid, clean(tm.group(1)) if tm else ""))
    return out


def parse_labeled(content_text):
    """'○ 전시명: ... ○ 작가: ...' 라벨 블록 → dict. ○/● 구분자 기준 분리."""
    fields = {}
    # ○ 또는 ● 로 시작하는 'label: value' 조각
    for seg in re.split(r"[○●]", content_text):
        seg = seg.strip()
        m = re.match(r"([가-힣A-Za-z /]+?)\s*[:：]\s*(.+)", seg)
        if m:
            label = m.group(1).strip()
            fields[label] = clean(m.group(2))
    return fields


def split_artists(value):
    if not value:
        return [], False
    flagged = any(h in value for h in GROUP_HINTS)
    parts = [clean(p) for p in re.split(r"\s*,\s*", value)]
    return [p for p in parts if p], flagged


DATE_EN = re.compile(r"(\d{1,2})\.([A-Za-z]{3,4})\.(\d{4})")
MONTHS = {m: i for i, m in enumerate(
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], 1)}


def parse_iso_range(item_date):
    """'28.May.2020 - 28.Jun.2020' → (start_iso, end_iso) 파싱 성공 시만. 실패=None."""
    ms = DATE_EN.findall(item_date or "")
    def iso(d):
        day, mon, yr = d
        mi = MONTHS.get(mon[:3].title())
        return f"{yr}-{mi:02d}-{int(day):02d}" if mi else None
    if len(ms) >= 2:
        return iso(ms[0]), iso(ms[1])
    if len(ms) == 1:
        return iso(ms[0]), None
    return None, None


def parse_view(board_id):
    params = {"pageNo": 1, "b_type": B_TYPE_EXHIBITION, "board_id": board_id, "time_type": "", "year": ""}
    txt, _ = fetch(VIEW_URL, params)
    src = f"{VIEW_URL}?" + urllib.parse.urlencode(params)

    def grab(cls):
        m = re.search(r'<div class="%s">(.*?)</div>' % cls, txt, re.S)
        return clean(m.group(1)) if m else ""

    archive_title = grab("itemTitle")
    item_date = grab("itemDate")
    # itemContent는 중첩 div라 그리디하게 뷰박스 영역에서
    cm = re.search(r'<div class="itemContent">(.*?)<!--\s*//?\s*좌측', txt, re.S) or \
         re.search(r'<div class="itemContent">(.*)', txt, re.S)
    content_text = clean(cm.group(1)) if cm else ""
    fields = parse_labeled(content_text)

    artists, artist_group_flag = split_artists(fields.get("작가") or fields.get("참여작가"))
    curators, _ = split_artists(fields.get("기획"))
    start_iso, end_iso = parse_iso_range(item_date)
    # 날짜 sanity: 끝<시작(원문 오타 등)이면 ISO 무효화 + flag, 원문은 보존(날조 금지)
    date_warning = False
    if start_iso and end_iso and end_iso < start_iso:
        date_warning = True
        start_iso = end_iso = None
    # 영문 제목 병기 후보(목록제목/표제에서 라틴 덩어리)
    en_cand = ""
    em = re.search(r"[《≪][^》≫]*?([A-Za-z][A-Za-z .,'\-]{4,})\s*[》≫]", archive_title)
    if em:
        en_cand = em.group(1).strip()

    return {
        "board_id": board_id,
        "source_url": src,
        "archive_title": archive_title,        # 아카이브 표제(전시명과 다를 수 있음)
        "title_ko": fields.get("전시명", ""),    # ○ 전시명
        "en_candidate": en_cand,                # 보류(공식 EN 미확정)
        "date_text_original": item_date or fields.get("기간", ""),
        "date_start": start_iso,
        "date_end": end_iso,
        "date_warning": date_warning,  # 원문 날짜 모순(역순 등) → 사람 확인
        "venue_text": fields.get("장소", ""),
        "artists": artists,
        "artist_group_flag": artist_group_flag,  # 단체/병기 의심 → 사람 확인
        "curators": curators,
        "organizer": fields.get("주최 및 주관") or fields.get("주최", ""),
        "raw_fields": fields,
    }


def crawl(max_pages, delay=1.5):
    seen = set()
    page = 1
    while page <= max_pages:
        rows = list_board_ids(page)
        if not rows:
            break
        for bid, _ in rows:
            if bid in seen:
                continue
            seen.add(bid)
            try:
                yield parse_view(bid)
            except Exception as e:
                sys.stderr.write(f"  skip board_id={bid}: {e}\n")
            time.sleep(delay)  # 레거시 서버 예의
        page += 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pages", type=int, default=1, help="크롤 페이지 수(검증=1)")
    ap.add_argument("--all", action="store_true", help="전 페이지(max 200)")
    ap.add_argument("--out", default="", help="JSON 출력 파일(미지정=stdout)")
    a = ap.parse_args()
    records = list(crawl(200 if a.all else a.pages))
    blob = json.dumps(records, ensure_ascii=False, indent=2)
    if a.out:
        open(a.out, "w", encoding="utf-8").write(blob)
        print(f"{len(records)}건 → {a.out}", file=sys.stderr)
    else:
        print(blob)


if __name__ == "__main__":
    main()
