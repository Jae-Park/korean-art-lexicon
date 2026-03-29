#!/usr/bin/env python3
"""Add verified Korean-language sources to Venice Biennale person YAML files."""

import yaml
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PERSONS_DIR = os.path.join(BASE, "data", "persons")

ARKO_URL = "https://www.arko.or.kr/biennale/content/643"
ARKO_NOTE = "ARKO 베니스 비엔날레 한국관 아카이브 — 한글 이름 확인"

# Artists confirmed on ARKO archive page (한글 names verified)
ARKO_CONFIRMED = [
    "yun-hyongkeun", "kwak-hoon", "kim-inkyum", "jheon-soocheon",  # 1995
    "kang-ikjoong", "lee-hyungwoo",  # 1997
    "noh-sangkyoon",  # 1999 (lee-bul already has sources)
    "suh-doho",  # 2001
    "bahc-yiso", "whang-inkie", "chung-seoyoung",  # 2003
    "bae-youngwhan", "gimhongsok", "ham-jin", "kim-beom", "kim-sora",  # 2005
    "moon-sungsic", "oh-heinkuhn", "park-kiwon", "park-sejin",  # 2005
    "lee-hyungkoo",  # 2007
    "lee-yongbaek",  # 2011
    "lee-wan",  # 2017
    "nam-hwayeon", "jung-eunyoung",  # 2019
    "kim-yunchul",  # 2022
]

# Additional Korean sources per artist (from agent search)
EXTRA_KOREAN_SOURCES = {
    "choi-cody": [
        {"url": "https://biz.heraldcorp.com/article/1050392", "name_used": "코디최", "note": "헤럴드경제 — 2017 베니스 한국관 인터뷰"},
    ],
    "lee-wan": [
        {"url": "https://biz.heraldcorp.com/article/1050392", "name_used": "이완", "note": "헤럴드경제 — 2017 베니스 한국관 인터뷰"},
    ],
    "lee-hyungkoo": [
        {"url": "https://www.doosanartcenter.com/ko/exhibit/artist/134", "name_used": "이형구", "note": "두산아트센터 작가 프로필"},
    ],
    "lee-yongbaek": [
        {"url": "https://www.khan.co.kr/article/201106082107305", "name_used": "이용백", "note": "경향신문 — 2011 베니스 한국관"},
    ],
    "nam-hwayeon": [
        {"url": "https://www.theartro.kr/kor/features/features_view.asp?idx=2343&b_code=31e", "name_used": "남화연", "note": "아르트로 인터뷰 — 2019 베니스"},
    ],
    "jung-eunyoung": [
        {"url": "https://www.theartro.kr/kor/features/features_view.asp?idx=2349&b_code=31e", "name_used": "정은영", "note": "아르트로 인터뷰 — 2019 베니스"},
    ],
    "kaisen-janejin": [
        {"url": "https://www.theartro.kr/kor/features/features_view.asp?idx=2359&b_code=31e", "name_used": "제인 진 카이젠", "note": "아르트로 인터뷰 — 2019 베니스"},
    ],
    "kim-yunchul": [
        {"url": "https://www.arko.or.kr/board/view/4057?bid=557&cid=1804401", "name_used": "김윤철", "note": "ARKO 공지 — 2022 베니스 한국관"},
    ],
    "bae-youngwhan": [
        {"url": "https://www.pkmgallery.com/artists/bae-young-whan/biography", "name_used": "배영환", "note": "PKM Gallery 작가 약력"},
    ],
    "moon-sungsic": [
        {"url": "https://www.kukjegallery.com/artists/view?seq=177", "name_used": "문성식", "note": "국제갤러리 대리 작가"},
    ],
    "oh-heinkuhn": [
        {"url": "https://www.kmib.co.kr/article/view.asp?arcid=0924280605", "name_used": "오형근", "note": "국민일보 인터뷰"},
    ],
    "park-kiwon": [
        {"url": "https://www.mmca.go.kr/exhibitions/exhibitionsDetail.do?exhId=201003170002817", "name_used": "박기원", "note": "MMCA 올해의 작가 2010"},
    ],
}


def load_yaml(path):
    with open(path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def save_yaml(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        yaml.dump(data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)


def main():
    total_added = 0

    # Add ARKO source to all confirmed artists
    for person_id in ARKO_CONFIRMED:
        filepath = os.path.join(PERSONS_DIR, f"{person_id}.yaml")
        if not os.path.exists(filepath):
            print(f"  ⚠ {person_id}: file not found")
            continue

        data = load_yaml(filepath)
        existing_urls = {s['url'] for s in data.get('sources', []) if isinstance(s, dict)}

        added = 0
        if ARKO_URL not in existing_urls:
            data['sources'].append({
                "url": ARKO_URL,
                "name_used": data['name']['ko']['full'],
                "note": ARKO_NOTE,
            })
            added += 1

        # Add extra Korean sources if available
        if person_id in EXTRA_KOREAN_SOURCES:
            for src in EXTRA_KOREAN_SOURCES[person_id]:
                if src['url'] not in existing_urls:
                    data['sources'].append(src)
                    added += 1

        if added > 0:
            save_yaml(filepath, data)
            print(f"  ✓ {person_id}: +{added} Korean sources")
            total_added += added
        else:
            print(f"  - {person_id}: already has Korean sources")

    # Handle artists NOT on ARKO but verified elsewhere
    non_arko = {
        "joo-michael": [
            {"url": "https://universes.art/en/venice-biennale/2001/pavilions-tour/korea", "name_used": "Michael Joo", "note": "universes.art — 한국관 2001 (ARKO 미등재, La Biennale 공식 확인)"},
        ],
        "kaisen-janejin": EXTRA_KOREAN_SOURCES.get("kaisen-janejin", []),
        "nakion": [],  # Only confirmed via group listing
        "rhii-jewyo": [
            {"url": "https://barakatcontemporary.com/artists/56-jewyo-rhii/", "name_used": "이주요", "note": "바라캇 컨템포러리 작가 페이지"},
        ],
        "sung-nakhee": [],  # Only confirmed via group listing
    }

    for person_id, sources in non_arko.items():
        if not sources:
            continue
        filepath = os.path.join(PERSONS_DIR, f"{person_id}.yaml")
        if not os.path.exists(filepath):
            continue

        data = load_yaml(filepath)
        existing_urls = {s['url'] for s in data.get('sources', []) if isinstance(s, dict)}

        added = 0
        for src in sources:
            if src['url'] not in existing_urls:
                data['sources'].append(src)
                added += 1

        if added > 0:
            save_yaml(filepath, data)
            print(f"  ✓ {person_id}: +{added} sources (non-ARKO)")
            total_added += added

    print(f"\n총 {total_added}개 한국어 출처 추가")


if __name__ == "__main__":
    main()
