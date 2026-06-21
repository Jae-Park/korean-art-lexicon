#!/usr/bin/env python3
# neolook 보드 하베스터 (forward-only). /archives + 홈 보드의 서버렌더 카드 메타만 수확.
# 디테일/연도/날짜 라우트는 전부 0B octet-stream 다운로드라 자력 접근 불가(전수 검증됨) →
# 과거 백필(2000~2016)은 운영자 DB export 필요. 본 스크립트는 '현재+예정' 보드를 매일 가볍게 누적.
# 정중: 이미지/폰트 차단(robots /images/ 존중), 페이지 2개만 로드, 무한스크롤 없음.
import os, json, time, re
from datetime import datetime, timezone

MIRROR = os.path.expanduser("~/Developer/korean-art-lexicon/miner/data-mirror/neolook")
os.makedirs(MIRROR, exist_ok=True)
now_iso = lambda: datetime.now(timezone.utc).isoformat()

EXTRACT = r"""
() => {
  const cards = []; const seen = new Set();
  document.querySelectorAll("a[href^='/archives/']").forEach(a => {
    const m = (a.getAttribute('href')||'').match(/\/archives\/(\d{8}[a-z])$/);
    if (!m) return; const id = m[1]; if (seen.has(id)) return; seen.add(id);
    const cont = a.closest('li') || a;
    const lis = Array.from(cont.querySelectorAll('li[title]'))
      .map(li => ({title: (li.getAttribute('title')||'').trim(), red: li.className.includes('bright-red')}))
      .filter(x => x.title);
    cards.push({id, lis});
  });
  return cards;
}
"""

def split_bil(s, sep):
    if sep in s:
        a, b = s.split(sep, 1); return a.strip(), b.strip()
    return s.strip(), ""

# 카드 4-li 모델: [R]헤드라인 / 보조 / 날짜(▶) / @장소. 헤드라인 "작가展"=개인전.
CALL = re.compile(r'공모|공개모집|선정결과|선정작|지원\s*작가|미술대전|접수마감|당선작')
MAG  = re.compile(r'월간미술|아트인컬처|미술세계|퍼블릭아트|Vol\.\s*\d|\d+월호')
SOLO = re.compile(r'(展|个展|個展)$')
# 展으로 끝나도 개인전 아닌 것(전시유형어가 名 자리에): 작가전/기획전/단체전 등 → 단체·주제전 처리
NOT_SOLO = re.compile(r'(작가전|기획전|초대전|청년전|기념전|특별전|정기전|회원전|단체전|소장품전'
                      r'|순회전|공모전|교류전|기증전|상설전|졸업전|동문전|수료전|선정전|입주작가|기획초대전)\s*$')
MEDIA = {"painting","sculpture","photograph","photography","video","installation",
         "drawing","print","printmaking","ceramic","ceramics","craft","media",
         "performance","mixed media","textile","calligraphy","object"}

def parse_card(c):
    lis = c["lis"]
    red = next((li["title"] for li in lis if li["red"]), "")
    others = [li["title"] for li in lis if not li["red"]]
    venue = next((t for t in others if t.startswith("@")), "")
    secondary = next((t for t in others if not t.startswith("@") and "▶" not in t), "")
    d = c["id"]
    venue_ko, venue_en = split_bil(venue[1:].strip(), " | ") if venue else ("", "")
    out = {"id": d, "date": f"{d[0:4]}-{d[4:6]}-{d[6:8]}", "kind": "exhibition",
           "venue_ko": venue_ko, "venue_en": venue_en,
           "title_ko": "", "title_en": "", "artist_ko": "", "artist_en": "",
           "artist_hanja": "", "medium": "", "source_url": f"https://neolook.com/archives/{d}"}
    if CALL.search(red) or CALL.search(secondary):
        out["kind"] = "call"
    elif MAG.search(secondary) or MAG.search(venue):
        out["kind"] = "magazine"
    hp = [p.strip() for p in red.split(" / ")]
    h_ko = hp[0] if hp else ""
    if out["kind"] != "exhibition":
        out["title_ko"], out["title_en"] = split_bil(red, " / ")
        return out
    cand = re.sub(r'^故\s*', '', re.sub(r'(展|个展|個展)$', '', h_ko)).strip()
    if SOLO.search(h_ko) and not NOT_SOLO.search(h_ko) and looks_like_name(cand):
        # 개인전: 헤드라인=작가展, 타이틀=보조(부제)
        out["artist_ko"] = cand
        out["artist_en"] = hp[1] if len(hp) > 1 else ""
        third = hp[2] if len(hp) > 2 else ""
        if re.search(r'[一-鿿]', third): out["artist_hanja"] = third
        elif third.lower() in MEDIA: out["medium"] = third
        out["title_ko"], out["title_en"] = split_bil(secondary, " / ")
    else:  # 단체/주제전: 헤드라인=전시제목, 단일 작가 없음
        out["title_ko"], out["title_en"] = split_bil(red, " / ")
    return out

# 개인전 작가명꼴 가드: 이름은 짧고(≤12) 숫자·구분기호 없고 공백 최대 1개(외국명/호+명 허용)
def looks_like_name(s):
    if not s or len(s) > 12: return False
    if re.search(r'[\d/:_·∙、「」<>《》(){}\[\]]', s): return False
    if s.count(' ') > 1: return False
    return bool(re.search(r'[가-힣]', s))

def harvest():
    from playwright.sync_api import sync_playwright
    cards = []
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        ctx = b.new_context(viewport={"width":1280,"height":2200})
        ctx.route("**/*", lambda r: r.abort() if r.request.resource_type in ("image","font","media") else r.continue_())
        pg = ctx.new_page(); pg.on("download", lambda d: None)
        for url in ["https://neolook.com/archives", "https://neolook.com/"]:
            pg.goto(url, wait_until="domcontentloaded"); time.sleep(2.5)
            cards += pg.evaluate(EXTRACT)
        b.close()
    byid = {}
    for c in cards:
        byid.setdefault(c["id"], c)
    return [parse_card(c) for c in byid.values()]

def merge(entries):
    path = os.path.join(MIRROR, "board.jsonl")
    existing = {}
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            try: o = json.loads(line); existing[o["id"]] = o
            except: pass
    ts = now_iso(); new = 0
    for e in entries:
        if e["id"] not in existing:
            e["harvested_at"] = ts; existing[e["id"]] = e; new += 1
    with open(path, "w", encoding="utf-8") as f:
        for o in sorted(existing.values(), key=lambda x: x["id"]):
            f.write(json.dumps(o, ensure_ascii=False) + "\n")
    return new, len(existing)

if __name__ == "__main__":
    es = harvest()
    new, total = merge(es)
    from collections import Counter
    kinds = Counter(e["kind"] for e in es)
    print(f"harvested {len(es)} cards | mirror: +{new} new, {total} total | {dict(kinds)}")
    solo = [e for e in es if e["kind"]=="exhibition" and e["artist_ko"]]
    grp  = [e for e in es if e["kind"]=="exhibition" and not e["artist_ko"]]
    print(f"개인전(작가 추출) {len(solo)} | 단체/주제전 {len(grp)}")
    print("=== 개인전 샘플 (작가+한자) ===")
    for e in solo[:8]:
        h = f" [{e['artist_hanja']}]" if e["artist_hanja"] else ""
        print(f"  {e['artist_ko'][:10]:10}{h:8} 《{e['title_ko'][:18]}》 @ {e['venue_ko'][:16]}")
    print("=== 단체/주제전 샘플 ===")
    for e in grp[:5]:
        print(f"  《{e['title_ko'][:24]:24}》 @ {e['venue_ko'][:16]}")
