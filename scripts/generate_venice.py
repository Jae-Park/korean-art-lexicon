#!/usr/bin/env python3
"""Generate YAML files for Venice Biennale Korean Pavilion exhibitions and new person entries."""

import yaml
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PERSONS_DIR = os.path.join(BASE, "data", "persons")
EXH_DIR = os.path.join(BASE, "data", "exhibitions")


def save_yaml(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        yaml.dump(data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)


# ── Venice Korean Pavilion exhibitions ──────────────────────────────

EXHIBITIONS = [
    {
        "id": "exhibition.korean-pavilion-venice-1995",
        "year": 1995,
        "title_ko": "제46회 베니스 비엔날레 한국관",
        "title_en": None,  # no formal title
        "artists": ["person.yun-hyongkeun", "person.kwak-hoon", "person.kim-inkyum", "person.jheon-soocheon"],
        "venue": "Korean Pavilion, Giardini, Venice",
        "dates": {"start": "1995-06-11", "end": "1995-10-15"},
        "sources": [
            {"url": "https://en.wikipedia.org/wiki/Korean_pavilion", "name_used": "Korean pavilion", "note": "Wikipedia — 1995 inaugural edition"},
        ],
    },
    {
        "id": "exhibition.korean-pavilion-venice-1997",
        "year": 1997,
        "title_ko": "제47회 베니스 비엔날레 한국관",
        "title_en": None,
        "artists": ["person.kang-ikjoong", "person.lee-hyungwoo"],
        "venue": "Korean Pavilion, Giardini, Venice",
        "dates": {"start": "1997-06-15", "end": "1997-11-09"},
        "sources": [
            {"url": "https://en.wikipedia.org/wiki/Korean_pavilion", "name_used": "Korean pavilion", "note": "Wikipedia — Kang Ik-Joong received Honorable Mention"},
        ],
    },
    {
        "id": "exhibition.korean-pavilion-venice-1999",
        "year": 1999,
        "title_ko": "제48회 베니스 비엔날레 한국관",
        "title_en": None,
        "artists": ["person.lee-bul", "person.noh-sangkyoon"],
        "venue": "Korean Pavilion, Giardini, Venice",
        "dates": {"start": "1999-06-12", "end": "1999-11-07"},
        "sources": [
            {"url": "https://en.wikipedia.org/wiki/Korean_pavilion", "name_used": "Korean pavilion", "note": "Wikipedia — Lee Bul received Honorable Mention"},
            {"url": "https://aaa.org.hk/en/collections/search/library/lee-bul-gravity-greater-than-velocity-amateurs-the-korean-pavilion-48th-venice-biennale", "name_used": "Lee Bul", "note": "Asia Art Archive catalogue record"},
        ],
    },
    {
        "id": "exhibition.korean-pavilion-venice-2001",
        "year": 2001,
        "title_ko": "제49회 베니스 비엔날레 한국관",
        "title_en": None,
        "artists": ["person.suh-doho", "person.joo-michael"],
        "venue": "Korean Pavilion, Giardini, Venice",
        "dates": {"start": "2001-06-10", "end": "2001-11-04"},
        "sources": [
            {"url": "https://en.wikipedia.org/wiki/Korean_pavilion", "name_used": "Korean pavilion", "note": "Wikipedia"},
            {"url": "https://universes.art/en/venice-biennale/2001/pavilions-tour/korea", "name_used": "Korea", "note": "universes.art pavilion page"},
        ],
    },
    {
        "id": "exhibition.korean-pavilion-venice-2003",
        "year": 2003,
        "title_ko": "제50회 베니스 비엔날레 한국관: 차이의 풍경",
        "title_en": "Landscape of Differences",
        "artists": ["person.bahc-yiso", "person.whang-inkie", "person.chung-seoyoung"],
        "venue": "Korean Pavilion, Giardini, Venice",
        "dates": {"start": "2003-06-15", "end": "2003-11-02"},
        "sources": [
            {"url": "http://universes-in-universe.de/car/venezia/bien50/kor/e-press.htm", "name_used": "Landscape of Differences", "note": "universes-in-universe press release"},
            {"url": "https://en.wikipedia.org/wiki/Korean_pavilion", "name_used": "Korean pavilion", "note": "Wikipedia"},
        ],
    },
    {
        "id": "exhibition.korean-pavilion-venice-2005",
        "year": 2005,
        "title_ko": "제51회 베니스 비엔날레 한국관: 문 뒤의 비밀",
        "title_en": "Secret Beyond the Door",
        "artists": [
            "person.bae-youngwhan", "person.bahc-yiso", "person.choi-jeonghwa",
            "person.gimhongsok", "person.ham-jin", "person.jung-yeondoo",
            "person.kim-beom", "person.kim-sora", "person.nakion",
            "person.moon-sungsic", "person.oh-heinkuhn", "person.park-kiwon",
            "person.rhii-jewyo", "person.park-sejin", "person.sung-nakhee",
        ],
        "venue": "Korean Pavilion, Giardini, Venice",
        "dates": {"start": "2005-06-12", "end": "2005-11-06"},
        "sources": [
            {"url": "https://aaa.org.hk/en/collections/search/library/secret-beyond-the-door-the-korean-pavilion-the-51st-venice-biennale", "name_used": "Secret Beyond the Door", "note": "Asia Art Archive catalogue record"},
            {"url": "https://en.wikipedia.org/wiki/Korean_pavilion", "name_used": "Korean pavilion", "note": "Wikipedia"},
        ],
    },
    {
        "id": "exhibition.korean-pavilion-venice-2007",
        "year": 2007,
        "title_ko": "제52회 베니스 비엔날레 한국관: 호모 스피시즈",
        "title_en": "The Homo Species",
        "artists": ["person.lee-hyungkoo"],
        "venue": "Korean Pavilion, Giardini, Venice",
        "dates": {"start": "2007-06-10", "end": "2007-11-21"},
        "sources": [
            {"url": "https://londonkoreanlinks.net/2007/05/20/korea-at-the-venice-biennale-2007-lee-hyungkoo-the-homo-species/", "name_used": "Lee Hyungkoo", "note": "London Korean Links"},
            {"url": "https://www.designboom.com/art/hyungkoo-lee-at-venice-art-biennale-07/", "name_used": "Hyungkoo Lee", "note": "Designboom — note reversed name order"},
        ],
    },
    {
        "id": "exhibition.korean-pavilion-venice-2009",
        "year": 2009,
        "title_ko": "제53회 베니스 비엔날레 한국관: 응축",
        "title_en": "Condensation",
        "artists": ["person.yang-haegue"],
        "venue": "Korean Pavilion, Giardini, Venice",
        "dates": {"start": "2009-06-07", "end": "2009-11-22"},
        "sources": [
            {"url": "https://www.designboom.com/art/korean-pavilion-haegue-yang-at-venice-art-biennale-09/", "name_used": "Haegue Yang", "note": "Designboom"},
            {"url": "https://vernissage.tv/2009/08/10/haegue-yang-condensation-korean-pavilion-53rd-venice-biennale-2009/", "name_used": "Haegue Yang", "note": "VernissageTV"},
        ],
    },
    {
        "id": "exhibition.korean-pavilion-venice-2011",
        "year": 2011,
        "title_ko": "제54회 베니스 비엔날레 한국관: 사랑은 가고 상처는 낫겠지",
        "title_en": "The Love Is Gone but the Scar Will Heal",
        "artists": ["person.lee-yongbaek"],
        "venue": "Korean Pavilion, Giardini, Venice",
        "dates": {"start": "2011-06-04", "end": "2011-11-27"},
        "sources": [
            {"url": "https://www.designboom.com/art/lee-yongbaek-korean-pavilion-at-venice-art-biennale-2011/", "name_used": "Lee Yongbaek", "note": "Designboom"},
            {"url": "https://en.wikipedia.org/wiki/Korean_pavilion", "name_used": "Korean pavilion", "note": "Wikipedia"},
        ],
    },
    {
        "id": "exhibition.korean-pavilion-venice-2013",
        "year": 2013,
        "title_ko": "제55회 베니스 비엔날레 한국관: 숨쉬기: 보따리",
        "title_en": "To Breathe: Bottari",
        "artists": ["person.kim-sooja"],
        "venue": "Korean Pavilion, Giardini, Venice",
        "dates": {"start": "2013-06-01", "end": "2013-11-24"},
        "sources": [
            {"url": "https://www.e-flux.com/announcements/32876/kimsooja", "name_used": "Kimsooja", "note": "e-flux announcement"},
            {"url": "https://www.tanyabonakdargallery.com/exhibitions/713-kimsooja-to-breathe-bottari-korean-pavilion-55th-international-art-exhibition-la/", "name_used": "Kimsooja", "note": "Tanya Bonakdar Gallery"},
        ],
    },
    {
        "id": "exhibition.korean-pavilion-venice-2015",
        "year": 2015,
        "title_ko": "제56회 베니스 비엔날레 한국관: 축지법과 비행술",
        "title_en": "The Ways of Folding Space & Flying",
        "artists": ["person.moon-kyungwon", "person.jeon-joonho"],
        "venue": "Korean Pavilion, Giardini, Venice",
        "dates": {"start": "2015-05-09", "end": "2015-11-22"},
        "sources": [
            {"url": "https://www.e-flux.com/announcements/29700/moon-kyungwon-jeon-joonho-at-the-korean-pavilion-at-the-venice-biennale", "name_used": "Moon Kyungwon & Jeon Joonho", "note": "e-flux announcement"},
            {"url": "https://www.designboom.com/art/venice-biennale-2015-korean-pavilion-05-11-2015/", "name_used": "Moon Kyungwon & Jeon Joonho", "note": "Designboom"},
        ],
    },
    {
        "id": "exhibition.korean-pavilion-venice-2017",
        "year": 2017,
        "title_ko": "제57회 베니스 비엔날레 한국관: 카운터밸런스: 돌과 산",
        "title_en": "Counterbalance: The Stone and the Mountain",
        "artists": ["person.choi-cody", "person.lee-wan"],
        "venue": "Korean Pavilion, Giardini, Venice",
        "dates": {"start": "2017-05-13", "end": "2017-11-26"},
        "sources": [
            {"url": "https://news.artnet.com/art-world/cody-choi-lee-wan-korean-pavilion-venice-854561", "name_used": "Cody Choi & Lee Wan", "note": "Artnet News"},
            {"url": "https://artlab.hyundai.com/project/counterbalance-the-stone-and-the-mountain", "name_used": "Counterbalance: The Stone and the Mountain", "note": "Hyundai Artlab"},
        ],
    },
    {
        "id": "exhibition.korean-pavilion-venice-2019",
        "year": 2019,
        "title_ko": "제58회 베니스 비엔날레 한국관: 역사가 우리를 망쳐놨지만 그래도 상관없다",
        "title_en": "History Has Failed Us, but No Matter",
        "artists": ["person.nam-hwayeon", "person.jung-eunyoung", "person.kaisen-janejin"],
        "venue": "Korean Pavilion, Giardini, Venice",
        "dates": {"start": "2019-05-11", "end": "2019-11-24"},
        "sources": [
            {"url": "https://www.labiennale.org/en/art/2019/national-participations/republic-korea", "name_used": "Republic of Korea", "note": "La Biennale official"},
            {"url": "https://www.e-flux.com/announcements/223088/history-has-failed-us-but-no-matter", "name_used": "History Has Failed Us, but No Matter", "note": "e-flux announcement"},
        ],
    },
    {
        "id": "exhibition.korean-pavilion-venice-2022",
        "year": 2022,
        "title_ko": "제59회 베니스 비엔날레 한국관: 자이르",
        "title_en": "Gyre",
        "artists": ["person.kim-yunchul"],
        "venue": "Korean Pavilion, Giardini, Venice",
        "dates": {"start": "2022-04-23", "end": "2022-11-27"},
        "sources": [
            {"url": "https://www.labiennale.org/en/art/2022/korea-republic", "name_used": "Korea (Republic of)", "note": "La Biennale official"},
            {"url": "https://www.e-flux.com/announcements/452046/yunchul-kimgyre", "name_used": "Yunchul Kim", "note": "e-flux announcement"},
            {"url": "https://www.arko.or.kr/pavilion/22pavilion/index.html", "name_used": "Yunchul Kim: Gyre", "note": "ARKO official"},
        ],
    },
]

# ── New person entries ──────────────────────────────────────────────
# Only artists NOT already in the lexicon
# Source: Venice Korean Pavilion verified data

NEW_PERSONS = [
    # 1995
    {"id": "person.yun-hyongkeun", "ko": {"full": "윤형근", "family": "윤", "given": "형근"},
     "latn": {"preferred": "Yun Hyong Keun", "family": "Yun", "given": "Hyong Keun"},
     "sources": [{"url": "https://en.wikipedia.org/wiki/Korean_pavilion", "name_used": "Yoon Hyong Keun", "note": "Venice Biennale Korean Pavilion 1995"}]},
    {"id": "person.kwak-hoon", "ko": {"full": "곽훈", "family": "곽", "given": "훈"},
     "latn": {"preferred": "Kwak Hoon", "family": "Kwak", "given": "Hoon"},
     "sources": [{"url": "https://en.wikipedia.org/wiki/Korean_pavilion", "name_used": "Kwak Hoon", "note": "Venice Biennale Korean Pavilion 1995"}]},
    {"id": "person.kim-inkyum", "ko": {"full": "김인겸", "family": "김", "given": "인겸"},
     "latn": {"preferred": "Kim In Kyum", "family": "Kim", "given": "In Kyum"},
     "sources": [{"url": "https://en.wikipedia.org/wiki/Korean_pavilion", "name_used": "Kim In Kyum", "note": "Venice Biennale Korean Pavilion 1995"}]},
    {"id": "person.jheon-soocheon", "ko": {"full": "전수천", "family": "전", "given": "수천"},
     "latn": {"preferred": "Jheon Soocheon", "family": "Jheon", "given": "Soocheon"},
     "sources": [{"url": "https://en.wikipedia.org/wiki/Korean_pavilion", "name_used": "Jheon Soocheon", "note": "Venice Biennale Korean Pavilion 1995 — Special Mention"}]},
    # 1997
    {"id": "person.kang-ikjoong", "ko": {"full": "강익중", "family": "강", "given": "익중"},
     "latn": {"preferred": "Kang Ik-Joong", "family": "Kang", "given": "Ik-Joong"},
     "sources": [{"url": "https://en.wikipedia.org/wiki/Korean_pavilion", "name_used": "Ik-joong Kang", "note": "Venice Biennale Korean Pavilion 1997 — Honorable Mention"}]},
    {"id": "person.lee-hyungwoo", "ko": {"full": "이형우", "family": "이", "given": "형우"},
     "latn": {"preferred": "Lee Hyungwoo", "family": "Lee", "given": "Hyungwoo"},
     "sources": [{"url": "https://en.wikipedia.org/wiki/Korean_pavilion", "name_used": "Hyungwoo Lee", "note": "Venice Biennale Korean Pavilion 1997"}]},
    # 1999
    {"id": "person.noh-sangkyoon", "ko": {"full": "노상균", "family": "노", "given": "상균"},
     "latn": {"preferred": "Noh Sang-Kyoon", "family": "Noh", "given": "Sang-Kyoon"},
     "sources": [{"url": "https://aaa.org.hk/en/collections/search/library/lee-bul-gravity-greater-than-velocity-amateurs-the-korean-pavilion-48th-venice-biennale", "name_used": "Noh Sang-Kyoon", "note": "Asia Art Archive — 48th Venice Biennale catalogue"}]},
    # 2001
    {"id": "person.suh-doho", "ko": {"full": "서도호", "family": "서", "given": "도호"},
     "latn": {"preferred": "Do-Ho Suh", "family": "Suh", "given": "Do-Ho"},
     "sources": [{"url": "https://universes.art/en/venice-biennale/2001/pavilions-tour/korea", "name_used": "Do-Ho Suh", "note": "universes.art — Venice Biennale 2001 Korean Pavilion"}]},
    {"id": "person.joo-michael", "ko": {"full": "마이클 주", "family": "주", "given": "마이클"},
     "latn": {"preferred": "Michael Joo", "family": "Joo", "given": "Michael"},
     "sources": [{"url": "https://universes.art/en/venice-biennale/2001/pavilions-tour/korea", "name_used": "Michael Joo", "note": "universes.art — Venice Biennale 2001 Korean Pavilion"}]},
    # 2003
    {"id": "person.bahc-yiso", "ko": {"full": "박이소", "family": "박", "given": "이소"},
     "latn": {"preferred": "Bahc Yiso", "family": "Bahc", "given": "Yiso"},
     "sources": [{"url": "http://universes-in-universe.de/car/venezia/bien50/kor/e-press.htm", "name_used": "Bahc Yiso", "note": "Venice Biennale 2003 Korean Pavilion press release"}]},
    {"id": "person.whang-inkie", "ko": {"full": "황인기", "family": "황", "given": "인기"},
     "latn": {"preferred": "Whang Inkie", "family": "Whang", "given": "Inkie"},
     "sources": [{"url": "http://universes-in-universe.de/car/venezia/bien50/kor/e-press.htm", "name_used": "Whang In Kie", "note": "Venice Biennale 2003 Korean Pavilion press release"}]},
    {"id": "person.chung-seoyoung", "ko": {"full": "정서영", "family": "정", "given": "서영"},
     "latn": {"preferred": "Chung Seoyoung", "family": "Chung", "given": "Seoyoung"},
     "sources": [{"url": "http://universes-in-universe.de/car/venezia/bien50/kor/e-press.htm", "name_used": "Chung Seoyoung", "note": "Venice Biennale 2003 Korean Pavilion press release"}]},
    # 2005 — 15-artist group show, creating entries for key artists
    {"id": "person.bae-youngwhan", "ko": {"full": "배영환", "family": "배", "given": "영환"},
     "latn": {"preferred": "Bae Youngwhan", "family": "Bae", "given": "Youngwhan"},
     "sources": [{"url": "https://aaa.org.hk/en/collections/search/library/secret-beyond-the-door-the-korean-pavilion-the-51st-venice-biennale", "name_used": "Bae Youngwhan", "note": "AAA — Venice 2005 Korean Pavilion catalogue"}]},
    {"id": "person.gimhongsok", "ko": {"full": "김홍석", "family": "김", "given": "홍석"},
     "latn": {"preferred": "Gimhongsok", "family": "Kim", "given": "Hongsok"},
     "sources": [{"url": "https://aaa.org.hk/en/collections/search/library/secret-beyond-the-door-the-korean-pavilion-the-51st-venice-biennale", "name_used": "Gimhongsok", "note": "AAA — Venice 2005 Korean Pavilion catalogue"}]},
    {"id": "person.ham-jin", "ko": {"full": "함진", "family": "함", "given": "진"},
     "latn": {"preferred": "Ham Jin", "family": "Ham", "given": "Jin"},
     "sources": [{"url": "https://aaa.org.hk/en/collections/search/library/secret-beyond-the-door-the-korean-pavilion-the-51st-venice-biennale", "name_used": "Ham Jin", "note": "AAA — Venice 2005 Korean Pavilion catalogue"}]},
    {"id": "person.kim-beom", "ko": {"full": "김범", "family": "김", "given": "범"},
     "latn": {"preferred": "Kim Beom", "family": "Kim", "given": "Beom"},
     "sources": [{"url": "https://aaa.org.hk/en/collections/search/library/secret-beyond-the-door-the-korean-pavilion-the-51st-venice-biennale", "name_used": "Kim Beom", "note": "AAA — Venice 2005 Korean Pavilion catalogue"}]},
    {"id": "person.kim-sora", "ko": {"full": "김소라", "family": "김", "given": "소라"},
     "latn": {"preferred": "Sora Kim", "family": "Kim", "given": "Sora"},
     "sources": [{"url": "https://aaa.org.hk/en/collections/search/library/secret-beyond-the-door-the-korean-pavilion-the-51st-venice-biennale", "name_used": "Sora Kim", "note": "AAA — Venice 2005 Korean Pavilion catalogue"}]},
    {"id": "person.nakion", "ko": {"full": "나키온", "family": "나", "given": "키온"},
     "latn": {"preferred": "Nakion", "family": "Na", "given": "Kion"},
     "sources": [{"url": "https://aaa.org.hk/en/collections/search/library/secret-beyond-the-door-the-korean-pavilion-the-51st-venice-biennale", "name_used": "Nakion", "note": "AAA — Venice 2005 Korean Pavilion catalogue"}]},
    {"id": "person.moon-sungsic", "ko": {"full": "문성식", "family": "문", "given": "성식"},
     "latn": {"preferred": "Moon Sungsic", "family": "Moon", "given": "Sungsic"},
     "sources": [{"url": "https://aaa.org.hk/en/collections/search/library/secret-beyond-the-door-the-korean-pavilion-the-51st-venice-biennale", "name_used": "Moon Sungsic", "note": "AAA — Venice 2005 Korean Pavilion catalogue"}]},
    {"id": "person.oh-heinkuhn", "ko": {"full": "오형근", "family": "오", "given": "형근"},
     "latn": {"preferred": "Oh Heinkuhn", "family": "Oh", "given": "Heinkuhn"},
     "sources": [{"url": "https://aaa.org.hk/en/collections/search/library/secret-beyond-the-door-the-korean-pavilion-the-51st-venice-biennale", "name_used": "Oh Heinkuhn", "note": "AAA — Venice 2005 Korean Pavilion catalogue"}]},
    {"id": "person.park-kiwon", "ko": {"full": "박기원", "family": "박", "given": "기원"},
     "latn": {"preferred": "Park Kiwon", "family": "Park", "given": "Kiwon"},
     "sources": [{"url": "https://aaa.org.hk/en/collections/search/library/secret-beyond-the-door-the-korean-pavilion-the-51st-venice-biennale", "name_used": "Park Kiwon", "note": "AAA — Venice 2005 Korean Pavilion catalogue"}]},
    {"id": "person.rhii-jewyo", "ko": {"full": "이주요", "family": "이", "given": "주요"},
     "latn": {"preferred": "Jewyo Rhii", "family": "Rhii", "given": "Jewyo"},
     "sources": [{"url": "https://aaa.org.hk/en/collections/search/library/secret-beyond-the-door-the-korean-pavilion-the-51st-venice-biennale", "name_used": "Jewyo Rhii", "note": "AAA — Venice 2005 Korean Pavilion catalogue"}]},
    {"id": "person.park-sejin", "ko": {"full": "박세진", "family": "박", "given": "세진"},
     "latn": {"preferred": "Park Sejin", "family": "Park", "given": "Sejin"},
     "sources": [{"url": "https://aaa.org.hk/en/collections/search/library/secret-beyond-the-door-the-korean-pavilion-the-51st-venice-biennale", "name_used": "Park Sejin", "note": "AAA — Venice 2005 Korean Pavilion catalogue"}]},
    {"id": "person.sung-nakhee", "ko": {"full": "성낙희", "family": "성", "given": "낙희"},
     "latn": {"preferred": "Sung Nakhee", "family": "Sung", "given": "Nakhee"},
     "sources": [{"url": "https://aaa.org.hk/en/collections/search/library/secret-beyond-the-door-the-korean-pavilion-the-51st-venice-biennale", "name_used": "Sung Nakhee", "note": "AAA — Venice 2005 Korean Pavilion catalogue"}]},
    # 2007
    {"id": "person.lee-hyungkoo", "ko": {"full": "이형구", "family": "이", "given": "형구"},
     "latn": {"preferred": "Lee Hyungkoo", "family": "Lee", "given": "Hyungkoo"},
     "sources": [
         {"url": "https://londonkoreanlinks.net/2007/05/20/korea-at-the-venice-biennale-2007-lee-hyungkoo-the-homo-species/", "name_used": "Lee Hyungkoo", "note": "London Korean Links"},
         {"url": "https://www.designboom.com/art/hyungkoo-lee-at-venice-art-biennale-07/", "name_used": "Hyungkoo Lee", "note": "Designboom — reversed name order"},
     ]},
    # 2011
    {"id": "person.lee-yongbaek", "ko": {"full": "이용백", "family": "이", "given": "용백"},
     "latn": {"preferred": "Lee Yongbaek", "family": "Lee", "given": "Yongbaek"},
     "sources": [{"url": "https://www.designboom.com/art/lee-yongbaek-korean-pavilion-at-venice-art-biennale-2011/", "name_used": "Lee Yongbaek", "note": "Designboom — Venice 2011"}]},
    # 2017
    {"id": "person.choi-cody", "ko": {"full": "코디 최", "family": "최", "given": "코디"},
     "latn": {"preferred": "Cody Choi", "family": "Choi", "given": "Cody"},
     "sources": [{"url": "https://news.artnet.com/art-world/cody-choi-lee-wan-korean-pavilion-venice-854561", "name_used": "Cody Choi", "note": "Artnet — Venice 2017"}]},
    {"id": "person.lee-wan", "ko": {"full": "이완", "family": "이", "given": "완"},
     "latn": {"preferred": "Lee Wan", "family": "Lee", "given": "Wan"},
     "sources": [{"url": "https://news.artnet.com/art-world/cody-choi-lee-wan-korean-pavilion-venice-854561", "name_used": "Lee Wan", "note": "Artnet — Venice 2017"}]},
    # 2019
    {"id": "person.nam-hwayeon", "ko": {"full": "남화연", "family": "남", "given": "화연"},
     "latn": {"preferred": "Hwayeon Nam", "family": "Nam", "given": "Hwayeon"},
     "sources": [
         {"url": "https://www.labiennale.org/en/art/2019/national-participations/republic-korea", "name_used": "Hwayeon Nam", "note": "La Biennale official"},
         {"url": "https://www.e-flux.com/announcements/223088/history-has-failed-us-but-no-matter", "name_used": "Hwayeon Nam", "note": "e-flux"},
     ]},
    {"id": "person.jung-eunyoung", "ko": {"full": "정은영", "family": "정", "given": "은영"},
     "latn": {"preferred": "siren eun young jung", "family": "jung", "given": "eun young"},
     "sources": [
         {"url": "https://www.labiennale.org/en/art/2019/national-participations/republic-korea", "name_used": "siren eun young jung", "note": "La Biennale official — all lowercase as artist's stylistic choice"},
         {"url": "https://www.e-flux.com/announcements/223088/history-has-failed-us-but-no-matter", "name_used": "siren eun young jung", "note": "e-flux"},
     ]},
    {"id": "person.kaisen-janejin", "ko": {"full": "제인 진 카이젠", "family": "카이젠", "given": "제인 진"},
     "latn": {"preferred": "Jane Jin Kaisen", "family": "Kaisen", "given": "Jane Jin"},
     "sources": [
         {"url": "https://www.labiennale.org/en/art/2019/national-participations/republic-korea", "name_used": "Jane Jin Kaisen", "note": "La Biennale official — Korean-Danish artist"},
         {"url": "https://www.e-flux.com/announcements/223088/history-has-failed-us-but-no-matter", "name_used": "Jane Jin Kaisen", "note": "e-flux"},
     ]},
    # 2022
    {"id": "person.kim-yunchul", "ko": {"full": "김윤철", "family": "김", "given": "윤철"},
     "latn": {"preferred": "Yunchul Kim", "family": "Kim", "given": "Yunchul"},
     "sources": [
         {"url": "https://www.labiennale.org/en/art/2022/korea-republic", "name_used": "Yunchul Kim", "note": "La Biennale official"},
         {"url": "https://www.e-flux.com/announcements/452046/yunchul-kimgyre", "name_used": "Yunchul Kim", "note": "e-flux"},
         {"url": "https://www.arko.or.kr/pavilion/22pavilion/index.html", "name_used": "Yunchul Kim", "note": "ARKO official"},
     ]},
]


def main():
    # Generate exhibition YAML files
    exh_created = 0
    for exh in EXHIBITIONS:
        filename = exh["id"].replace("exhibition.", "") + ".yaml"
        filepath = os.path.join(EXH_DIR, filename)

        if os.path.exists(filepath):
            print(f"  - {filename}: already exists, skipping")
            continue

        data = {
            "id": exh["id"],
            "title": {"ko": exh["title_ko"]},
            "dates": exh["dates"],
            "venue": exh["venue"],
            "artists": exh["artists"],
            "sources": exh["sources"],
            "status": "pending_review",
        }
        if exh["title_en"]:
            data["title"]["en"] = exh["title_en"]

        save_yaml(filepath, data)
        exh_created += 1
        print(f"  ✓ {filename}")

    # Generate person YAML files
    person_created = 0
    for p in NEW_PERSONS:
        filename = p["id"].replace("person.", "") + ".yaml"
        filepath = os.path.join(PERSONS_DIR, filename)

        if os.path.exists(filepath):
            print(f"  - {filename}: already exists, skipping")
            continue

        data = {
            "id": p["id"],
            "name": {
                "ko": p["ko"],
                "latn": p["latn"],
            },
            "sources": p["sources"],
            "status": "pending_review",
        }

        save_yaml(filepath, data)
        person_created += 1
        print(f"  ✓ {filename}")

    print(f"\n전시 {exh_created}개, 인물 {person_created}명 생성")


if __name__ == "__main__":
    main()
