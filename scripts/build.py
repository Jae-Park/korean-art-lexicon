#!/usr/bin/env python3
"""
Korean Art Lexicon — YAML → JSON 빌드 스크립트
data/**/*.yaml 을 읽어 dist/lexicon.json으로 통합한다.

Usage: python3 scripts/build.py
"""

import os
import sys
import json
import datetime
import yaml
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
DIST_DIR = PROJECT_ROOT / "dist"

CATEGORIES = {
    "persons": DATA_DIR / "persons",
    "exhibitions": DATA_DIR / "exhibitions",
    "organizations": DATA_DIR / "organizations",
    "terms": DATA_DIR / "terms",
    "publications": DATA_DIR / "publications",
}


def build():
    lexicon = {}

    for key, directory in CATEGORIES.items():
        if not directory.is_dir():
            lexicon[key] = []
            continue

        files = sorted(directory.glob("*.yaml")) + sorted(directory.glob("*.yml"))
        entries = []
        for f in files:
            with open(f, "r", encoding="utf-8") as fh:
                doc = yaml.safe_load(fh)
                if doc:
                    entries.append(doc)
        lexicon[key] = entries

    DIST_DIR.mkdir(parents=True, exist_ok=True)
    out_path = DIST_DIR / "lexicon.json"

    class SafeEncoder(json.JSONEncoder):
        """datetime.date → 문자열 변환 (YAML 자동 파싱 방어)"""
        def default(self, obj):
            if isinstance(obj, (datetime.date, datetime.datetime)):
                return obj.isoformat()
            return super().default(obj)

    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(lexicon, fh, ensure_ascii=False, indent=2, cls=SafeEncoder)

    counts = ", ".join(f"{k}: {len(v)}" for k, v in lexicon.items())
    print(f"Built dist/lexicon.json ({counts})")
    return lexicon


if __name__ == "__main__":
    build()
