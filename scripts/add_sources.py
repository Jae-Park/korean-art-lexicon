#!/usr/bin/env python3
"""Add verified institutional sources to person YAML files."""

import yaml
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PERSONS_DIR = os.path.join(BASE, "data", "persons")

# Verified sources from 6 parallel agent searches + manual spot-checks
# Only dedicated artist/collection pages — no "mentioned in" pages
NEW_SOURCES = {
    "ahn-kyuchul": [
        {"url": "https://www.kukjegallery.com/artists/view?seq=369", "name_used": "Ahn Kyuchul", "note": "Kukje Gallery represented artist"},
    ],
    "choe-uram": [
        {"url": "https://www.galleryhyundai.com/artist/view/20000000113", "name_used": "Choe U-Ram", "note": "Gallery Hyundai represented artist"},
    ],
    # choi-jeonghwa: no dedicated artist pages found at target institutions
    "ha-chonghyun": [
        {"url": "https://www.kukjegallery.com/artists/view?seq=344", "name_used": "Ha Chong-Hyun", "note": "Kukje Gallery represented artist"},
        {"url": "https://www.galleryhyundai.com/artist/view/229", "name_used": "Ha Chong-Hyun", "note": "Gallery Hyundai represented artist"},
        {"url": "https://www.moma.org/artists/47861", "name_used": "Ha Chong-Hyun", "note": "MoMA artist page"},
    ],
    "im-heungsoon": [
        {"url": "https://www.moma.org/calendar/exhibitions/3695", "name_used": "IM Heung-soon", "note": "MoMA PS1 exhibition (2015)"},
    ],
    "jeon-joonho": [
        {"url": "https://www.tate.org.uk/art/artists/jeon-joonho-18174", "name_used": "Jeon Joonho", "note": "Tate artist page"},
        {"url": "https://www.galleryhyundai.com/artist/view/20000000107", "name_used": "Jeon Joonho", "note": "Gallery Hyundai represented artist"},
    ],
    "jung-yeondoo": [
        {"url": "https://www.kukjegallery.com/artists/view?seq=179", "name_used": "Yeondoo Jung", "note": "Kukje Gallery represented artist"},
        {"url": "https://www.perrotin.com/artists/Yeondoo_Jung/1", "name_used": "Yeondoo Jung", "note": "Perrotin artist page (archive)"},
    ],
    "kim-sooja": [
        {"url": "https://www.kukjegallery.com/artists/view?seq=201", "name_used": "Kimsooja", "note": "Kukje Gallery represented artist"},
        {"url": "https://www.moma.org/artists/31045", "name_used": "Kimsooja", "note": "MoMA artist page"},
        {"url": "https://www.guggenheim.org/exhibition/kimsooja-thread-routes", "name_used": "Kimsooja", "note": "Guggenheim exhibition page"},
    ],
    "koo-jeonga": [
        {"url": "https://www.tate.org.uk/art/artists/koo-jeong-a-10562", "name_used": "Koo Jeong-A", "note": "Tate artist page"},
        {"url": "https://www.moma.org/artists/31312", "name_used": "Koo Jeong-a", "note": "MoMA artist page"},
        {"url": "https://www.guggenheim.org/artwork/artist/koo-jeong-a", "name_used": "Koo Jeong-A", "note": "Guggenheim artist page"},
    ],
    "lee-bul": [
        {"url": "https://www.tate.org.uk/art/artists/lee-bul-18154", "name_used": "Lee Bul", "note": "Tate artist page"},
        {"url": "https://www.moma.org/artists/43182", "name_used": "Bul Lee", "note": "MoMA artist page — note reversed name order"},
        {"url": "https://www.guggenheim.org/artwork/artist/lee-bul", "name_used": "Lee Bul", "note": "Guggenheim artist page"},
    ],
    "lee-ufan": [
        {"url": "https://www.kukjegallery.com/artists/view?seq=190", "name_used": "Lee Ufan", "note": "Kukje Gallery represented artist"},
        {"url": "https://www.tate.org.uk/art/artists/lee-ufan-2640", "name_used": "Lee Ufan", "note": "Tate artist page"},
        {"url": "https://www.moma.org/artists/6835", "name_used": "Lee Ufan", "note": "MoMA artist page"},
        {"url": "https://www.guggenheim.org/artwork/artist/lee-ufan", "name_used": "Lee Ufan", "note": "Guggenheim artist page"},
        {"url": "https://www.galleryhyundai.com/artist/view/20000000097", "name_used": "Lee Ufan", "note": "Gallery Hyundai represented artist"},
        {"url": "https://www.pacegallery.com/artists/lee-ufan/", "name_used": "Lee Ufan", "note": "Pace Gallery represented artist"},
    ],
    "moon-kyungwon": [
        {"url": "https://www.tate.org.uk/art/artists/moon-kyungwon-18175", "name_used": "Moon Kyungwon", "note": "Tate artist page"},
        {"url": "https://www.galleryhyundai.com/artist/view/20000000093", "name_used": "Moon Kyungwon", "note": "Gallery Hyundai represented artist"},
    ],
    "park-chankyong": [
        {"url": "https://www.kukjegallery.com/artists/view?seq=348", "name_used": "Park Chan-kyong", "note": "Kukje Gallery represented artist"},
    ],
    "park-seobo": [
        {"url": "https://www.kukjegallery.com/artists/view?seq=181", "name_used": "Park Seo-Bo", "note": "Kukje Gallery represented artist"},
        {"url": "https://www.tate.org.uk/art/artists/park-seo-bo-24798", "name_used": "Park Seo-Bo", "note": "Tate artist page"},
        {"url": "https://www.moma.org/artists/48621", "name_used": "Park Seo-Bo", "note": "MoMA artist page"},
        {"url": "https://www.guggenheim.org/artwork/artist/park-seo-bo", "name_used": "Park Seo-Bo", "note": "Guggenheim artist page"},
        {"url": "https://www.perrotin.com/artists/Seo-Bo_Park/203", "name_used": "Park Seo-Bo", "note": "Perrotin represented artist (estate)"},
    ],
    "yang-haegue": [
        {"url": "https://www.kukjegallery.com/artists/view?seq=176", "name_used": "Haegue Yang", "note": "Kukje Gallery represented artist"},
        {"url": "https://www.tate.org.uk/art/artists/haegue-yang-16780", "name_used": "Haegue Yang", "note": "Tate artist page"},
        {"url": "https://www.moma.org/artists/37934", "name_used": "Haegue Yang", "note": "MoMA artist page"},
        {"url": "https://www.guggenheim.org/artwork/artist/haegue-yang", "name_used": "Haegue Yang", "note": "Guggenheim artist page"},
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
    for person_id, new_sources in NEW_SOURCES.items():
        filepath = os.path.join(PERSONS_DIR, f"{person_id}.yaml")
        if not os.path.exists(filepath):
            print(f"  ⚠ File not found: {filepath}")
            continue

        data = load_yaml(filepath)
        existing_urls = {s['url'] if isinstance(s, dict) else s for s in data.get('sources', [])}

        added = 0
        for src in new_sources:
            if src['url'] not in existing_urls:
                # Ensure sources are all dicts (some old entries might be plain strings)
                if data['sources'] and isinstance(data['sources'][0], str):
                    data['sources'] = [{'url': s} for s in data['sources']]
                data['sources'].append(src)
                added += 1

        if added > 0:
            save_yaml(filepath, data)
            print(f"  ✓ {person_id}: +{added} sources (total: {len(data['sources'])})")
            total_added += added
        else:
            print(f"  - {person_id}: no new sources")

    print(f"\n총 {total_added}개 출처 추가")


if __name__ == "__main__":
    main()
