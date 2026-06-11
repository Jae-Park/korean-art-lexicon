#!/usr/bin/env python3
"""staging/<type>/*.yaml → data/<type>/ (status: reviewed) + dist 재빌드(build.py).
사람 승인(노션 approved → materialize → staging) 통과분의 최종 promote. harvest --push가 호출.
data/ 쓰기는 이 지점에서만 — 그것도 검증 통과한 staging을 옮기는 것뿐(Source-First: 새 데이터 생성 0).
"""
import sys
import json
import subprocess
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.exit("PyYAML 필요 (~/.venvs/lexicon)")

ROOT = Path(__file__).resolve().parent.parent
STAGING = ROOT / "staging"
DATA = ROOT / "data"


def main():
    moved = []
    for f in sorted(STAGING.rglob("*.yaml")):
        typ = f.parent.name  # exhibitions | persons | organizations | terms | publications
        doc = yaml.safe_load(f.read_text(encoding="utf-8"))
        doc["status"] = "reviewed"  # pending_review → reviewed (공개 가능)
        dest_dir = DATA / typ
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / f.name
        dest.write_text(yaml.safe_dump(doc, allow_unicode=True, sort_keys=False), encoding="utf-8")
        f.unlink()
        moved.append(str(dest.relative_to(ROOT)))

    # dist/lexicon.json 재빌드 (같은 인터프리터 = venv yaml 보장)
    build = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "build.py")],
        cwd=ROOT, capture_output=True, text=True,
    )
    tail = (build.stdout or build.stderr or "").strip().splitlines()[-3:]
    print(json.dumps({"moved": moved, "build_rc": build.returncode, "build_tail": tail}, ensure_ascii=False, indent=2))
    sys.exit(build.returncode)


if __name__ == "__main__":
    main()
