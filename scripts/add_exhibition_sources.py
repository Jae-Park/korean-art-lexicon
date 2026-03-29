#!/usr/bin/env python3
"""Add verified press/media sources to exhibition YAML files."""

import yaml
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXH_DIR = os.path.join(BASE, "data", "exhibitions")

# Verified sources from agent search — press coverage of MMCA Hyundai Motor Series + Venice 2024
# Selecting most valuable: e-flux (authoritative), sources with title/name variations
NEW_SOURCES = {
    "mmca-hyundai-2014": [
        {"url": "https://www.e-flux.com/announcements/30347/mmca-hyundai-motor-series-2014-lee-bul",
         "name_used": "Lee Bul", "note": "e-flux announcement — title: 'MMCA Hyundai Motor series 2014: Lee Bul'"},
    ],
    "mmca-hyundai-2015": [
        {"url": "https://www.art-it.asia/en/u/admin_expht_e/fxzkhf2wqucrb4v9ypcn/",
         "name_used": "Ahn Kyuchul", "note": "ART iT — 'MMCA HYUNDAI MOTOR SERIES 2015: Ahn Kyuchul: Invisible Land of Love'"},
        {"url": "https://www.timeout.com/seoul/art/ahn-kyu-chul-invisible-land-of-love",
         "name_used": "Ahn Kyu-chul", "note": "TimeOut Seoul — hyphenated romanization 'Ahn Kyu-chul'"},
    ],
    "mmca-hyundai-2016": [
        {"url": "https://www.hyundai.com/worldwide/en/company/newsroom/hyundai-motor-presents-%E2%80%98mmca-hyundai-motor-series-2016-kimsooja--archive-of-mind%E2%80%99-0000006299",
         "name_used": "KIMSOOJA", "note": "Hyundai Newsroom — artist name all caps, English subtitle 'Archive of Mind'"},
    ],
    "mmca-hyundai-2017": [
        {"url": "https://www.e-flux.com/announcements/150475/im-heung-soonthings-that-do-us-part-belief-faith-love-betrayal-hatred-fear-ghost",
         "name_used": "Im Heung-soon", "note": "e-flux — 'Things that Do Us Part'"},
        {"url": "https://artlab.hyundai.com/project/mmca-hyundai-motor-series-2017-im-heung-soon",
         "name_used": "IM Heung-soon", "note": "Hyundai Artlab — family name capitalized 'IM'"},
    ],
    "mmca-hyundai-2018": [
        {"url": "https://www.e-flux.com/announcements/223318/choijeonghwablooming-matrix/",
         "name_used": "CHOIJEONGHWA", "note": "e-flux — one word, all caps"},
        {"url": "https://www.mmca.go.kr/eng/exhibitions/exhibitionsDetail.do?exhId=201802260001022",
         "name_used": "CHOIJEONGHWA", "note": "MMCA English page — 'Blooming Matrix', one-word name"},
    ],
    "mmca-hyundai-2019": [
        {"url": "https://www.e-flux.com/announcements/296546/park-chan-kyonggathering",
         "name_used": "Park Chan-kyong", "note": "e-flux — English title 'Gathering'"},
    ],
    "mmca-hyundai-2020": [
        {"url": "https://www.e-flux.com/announcements/339015/haegue-yango2-h2o/",
         "name_used": "Haegue Yang", "note": "e-flux — 'O2 & H2O'"},
    ],
    "mmca-hyundai-2021": [
        {"url": "https://www.e-flux.com/announcements/410989/moon-kyungwon-and-jeon-joonhonews-from-nowhere-freedom-village",
         "name_used": "Moon Kyungwon and Jeon Joonho", "note": "e-flux — 'News from Nowhere, Freedom Village'"},
        {"url": "https://ocula.com/magazine/features/moon-kyungwon-and-jeon-joonho-news-from-nowhere/",
         "name_used": "Moon Kyungwon and Jeon Joonho", "note": "Ocula feature"},
    ],
    "mmca-hyundai-2022": [
        {"url": "https://www.e-flux.com/announcements/483822/choe-u-ramlittle-ark",
         "name_used": "Choe U-Ram", "note": "e-flux — 'Little Ark'"},
    ],
    "mmca-hyundai-2023": [
        {"url": "https://www.e-flux.com/announcements/558165/jung-yeondooone-hundred-years-of-travels/",
         "name_used": "Jung Yeondoo", "note": "e-flux — family-given order 'Jung Yeondoo'"},
        {"url": "https://artreview.com/yeondoo-jung-one-hundred-years-of-travels/",
         "name_used": "Yeondoo Jung", "note": "ArtReview — given-family order 'Yeondoo Jung'"},
    ],
    "korean-pavilion-venice-2024": [
        {"url": "https://www.artforum.com/news/koo-jeong-a-to-represent-south-korea-at-venice-biennale-252597/",
         "name_used": "Koo Jeong-a", "note": "Artforum — hyphenated lowercase 'Jeong-a'"},
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
    for exh_id, new_sources in NEW_SOURCES.items():
        filepath = os.path.join(EXH_DIR, f"{exh_id}.yaml")
        if not os.path.exists(filepath):
            print(f"  ⚠ File not found: {filepath}")
            continue

        data = load_yaml(filepath)

        # Normalize existing sources to list of dicts
        sources = data.get('sources', [])
        normalized = []
        for s in sources:
            if isinstance(s, str):
                normalized.append({'url': s})
            else:
                normalized.append(s)
        data['sources'] = normalized

        existing_urls = {s['url'] for s in normalized}

        added = 0
        for src in new_sources:
            if src['url'] not in existing_urls:
                data['sources'].append(src)
                added += 1

        if added > 0:
            save_yaml(filepath, data)
            print(f"  ✓ {exh_id}: +{added} sources (total: {len(data['sources'])})")
            total_added += added
        else:
            print(f"  - {exh_id}: no new sources")

    print(f"\n총 {total_added}개 전시 출처 추가")


if __name__ == "__main__":
    main()
