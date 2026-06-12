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
import subprocess
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


def git_last_modified(filepath):
    """파일의 마지막 git commit 날짜를 YYYY-MM-DD로 반환. 실패 시 None."""
    try:
        result = subprocess.run(
            ["git", "log", "-1", "--format=%aI", "--", str(filepath)],
            capture_output=True, text=True, cwd=PROJECT_ROOT
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()[:10]  # YYYY-MM-DD
    except Exception:
        pass
    return None


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
                    last_mod = git_last_modified(f)
                    if last_mod:
                        doc["_last_updated"] = last_mod
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

    inject_seo_directory(lexicon)
    return lexicon


# --- SEO: 정적 디렉터리 주입 (SPA가 JS로만 렌더 → 크롤 가능한 본문이 필요) ---
import html as _html
import re as _re


def _person_label(e):
    name = e.get("name", {}) or {}
    ko = name.get("ko", {})
    full = ko.get("full", "") if isinstance(ko, dict) else (ko or "")
    hanja = ko.get("hanja", "") if isinstance(ko, dict) else ""
    latn = name.get("latn", {}) or {}
    pref = latn.get("preferred", "") if isinstance(latn, dict) else ""
    s = full
    if hanja:
        s += f" ({hanja})"
    if pref and pref != full:
        s += " · " + pref
    if e.get("birth_year") or e.get("death_year"):
        s += f" ({e.get('birth_year', '')}–{e.get('death_year', '')})"
    return s


def _coerce_str(v):
    """문자열/숫자는 그대로, dict면 대표값 추출, 그 외 빈 문자열."""
    if isinstance(v, dict):
        return str(v.get("full") or v.get("ko") or v.get("en") or "")
    if v is None:
        return ""
    return str(v)


def _bi_label(primary):
    """제목/이름이 {ko,en} 또는 문자열인 엔트리의 라벨. 필드가 dict여도 안전."""
    if isinstance(primary, dict):
        ko = _coerce_str(primary.get("ko", ""))
        en = _coerce_str(primary.get("en", ""))
    else:
        ko, en = _coerce_str(primary), ""
    s = ko
    if en and en != ko:
        s += " · " + en
    return s


def build_seo_directory(lexicon):
    spec = [
        ("persons", "People · 인물", _person_label),
        ("exhibitions", "Exhibitions · 전시", lambda e: _bi_label(e.get("title"))),
        ("organizations", "Institutions · 기관", lambda e: _bi_label(e.get("name"))),
        ("terms", "Terms · 용어", lambda e: _bi_label(e.get("term"))),
        ("publications", "Publications · 출판물", lambda e: _bi_label(e.get("title"))),
    ]
    out = []
    for key, heading, labeler in spec:
        items = lexicon.get(key) or []
        if not items:
            continue
        out.append(f"    <h3>{heading} ({len(items)})</h3>")
        out.append("    <ul>")
        for e in sorted(items, key=lambda x: x.get("id", "")):
            eid = _html.escape(e.get("id", ""))
            label = _html.escape((labeler(e) or e.get("id", "")).strip())
            out.append(f'      <li><a href="#{eid}">{label}</a></li>')
        out.append("    </ul>")
    return "\n".join(out)


def inject_seo_directory(lexicon):
    idx = PROJECT_ROOT / "index.html"
    if not idx.exists():
        return
    txt = idx.read_text(encoding="utf-8")
    start, end = "<!-- SEO-DIRECTORY:START -->", "<!-- SEO-DIRECTORY:END -->"
    if start not in txt or end not in txt:
        return
    block = build_seo_directory(lexicon)
    new = _re.sub(
        _re.escape(start) + r".*?" + _re.escape(end),
        start + "\n" + block + "\n    " + end,
        txt,
        flags=_re.S,
    )
    if new != txt:
        idx.write_text(new, encoding="utf-8")
        n = sum(len(lexicon.get(k) or []) for k in lexicon)
        print(f"SEO 디렉터리 주입: {n} 항목 → index.html")


if __name__ == "__main__":
    build()
