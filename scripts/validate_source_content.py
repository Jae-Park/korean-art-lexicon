#!/usr/bin/env python3
"""
Korean Art Lexicon — 출처 내용 대조 검증 (Source Content Verification)

YAML 데이터의 핵심 필드가 출처 URL 페이지에 실제로 존재하는지 확인한다.
형식이 아닌 진위를 검증하는 스크립트.

검증 3단계:
  1. URL 생존 확인: 404 = DEAD_URL (허구 출처 의심), 403 = BOT_BLOCKED
  2. 내용 대조: 페이지 텍스트에 YAML 핵심 필드가 존재하는지
  3. Playwright fallback: urllib 차단 시 헤드리스 브라우저로 재시도

사용법:
  python3 validate_source_content.py [data|staging] [--verbose] [--no-playwright]
  python3 validate_source_content.py data/exhibitions/mmca-hyundai-2019.yaml --verbose
"""

from __future__ import annotations
import sys
import os
import re
import time
import yaml
import urllib.request
import urllib.error
from pathlib import Path
from html.parser import HTMLParser
from typing import Optional, Tuple

PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Playwright 사용 가능 여부
PLAYWRIGHT_AVAILABLE = False
try:
    from playwright.sync_api import sync_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    pass


# --- HTML → 텍스트 변환기 ---

class HTMLTextExtractor(HTMLParser):
    """HTML에서 텍스트만 추출"""
    def __init__(self):
        super().__init__()
        self._text = []
        self._skip = False

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "noscript"):
            self._skip = True

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript"):
            self._skip = False

    def handle_data(self, data):
        if not self._skip:
            self._text.append(data)

    def get_text(self) -> str:
        return " ".join(self._text)


def html_to_text(html: str) -> str:
    extractor = HTMLTextExtractor()
    extractor.feed(html)
    return extractor.get_text()


# --- URL 접근 결과 타입 ---

class FetchResult:
    """URL fetch 결과를 상태 코드와 함께 반환"""
    def __init__(self, status: str, code: int = 0, text: str = "", url: str = ""):
        self.status = status   # "ok", "dead_url", "bot_blocked", "error"
        self.code = code       # HTTP status code
        self.text = text       # 추출된 텍스트
        self.url = url


# --- URL 페이지 내용 가져오기 ---

def fetch_with_urllib(url: str, timeout: int = 15) -> FetchResult:
    """urllib로 URL fetch. HTTP 상태 코드를 구분하여 반환."""
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        })
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            charset = resp.headers.get_content_charset() or "utf-8"
            html = resp.read().decode(charset, errors="replace")
            text = html_to_text(html)

            # Cloudflare challenge 감지
            if "just a moment" in text.lower() and "cloudflare" in html.lower():
                return FetchResult("bot_blocked", 403, "", url)

            return FetchResult("ok", 200, text, url)

    except urllib.error.HTTPError as e:
        if e.code == 404:
            return FetchResult("dead_url", 404, "", url)
        elif e.code == 403:
            return FetchResult("bot_blocked", 403, "", url)
        elif e.code in (429, 503):
            return FetchResult("bot_blocked", e.code, "", url)
        else:
            return FetchResult("error", e.code, "", url)
    except Exception as e:
        return FetchResult("error", 0, "", url)


def fetch_with_playwright(url: str, timeout: int = 30000) -> FetchResult:
    """Playwright 헤드리스 브라우저로 URL fetch."""
    if not PLAYWRIGHT_AVAILABLE:
        return FetchResult("error", 0, "", url)
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            resp = page.goto(url, wait_until="networkidle", timeout=timeout)
            code = resp.status if resp else 0

            if code == 404:
                browser.close()
                return FetchResult("dead_url", 404, "", url)

            text = page.inner_text("body")
            browser.close()

            if not text.strip():
                return FetchResult("error", code, "", url)

            return FetchResult("ok", code, text, url)
    except Exception as e:
        return FetchResult("error", 0, "", url)


def fetch_page(url: str, use_playwright: bool = True, verbose: bool = False) -> FetchResult:
    """
    URL을 fetch. urllib 실패 시 Playwright fallback.
    반환: FetchResult
    """
    result = fetch_with_urllib(url)

    # urllib로 성공하면 그대로 반환
    if result.status == "ok":
        return result

    # 404는 확정 — Playwright로도 동일하므로 재시도 불필요
    if result.status == "dead_url":
        return result

    # 봇 차단이면 Playwright fallback 시도
    if result.status == "bot_blocked" and use_playwright and PLAYWRIGHT_AVAILABLE:
        if verbose:
            print(f"         🔄 봇 차단 → Playwright 재시도...")
        pw_result = fetch_with_playwright(url)
        if pw_result.status == "ok":
            return pw_result
        # Playwright도 실패하면 원래 결과 반환
        return result

    return result


# --- 텍스트 매칭 ---

def normalize(text: str) -> str:
    """비교를 위한 정규화: 공백 통합, 소문자"""
    text = re.sub(r"\s+", " ", text).strip()
    return text


def text_contains(haystack: str, needle: str) -> bool:
    """정규화된 텍스트에서 needle이 존재하는지 확인"""
    if not needle or not haystack:
        return False
    h = normalize(haystack).lower()
    n = normalize(needle).lower()
    # 정확한 문자열 포함
    if n in h:
        return True
    # 공백/특수문자 차이 허용 (예: "꽃,숲" vs "꽃, 숲")
    n_compact = re.sub(r"[^a-z0-9가-힣]", "", n)
    h_compact = re.sub(r"[^a-z0-9가-힣]", "", h)
    if n_compact and n_compact in h_compact:
        return True
    return False


# --- 엔티티별 핵심 필드 추출 ---

def get_check_fields(doc: dict, entity_type: str) -> list[dict]:
    """YAML 문서에서 출처 대조할 핵심 필드를 추출."""
    fields = []

    if entity_type == "exhibitions":
        title = doc.get("title", {})
        if isinstance(title, dict):
            if title.get("ko"):
                fields.append({"field": "title.ko", "value": title["ko"], "critical": True})
            if title.get("en"):
                fields.append({"field": "title.en", "value": title["en"], "critical": True})
        dates = doc.get("dates", {})
        if isinstance(dates, dict):
            for key in ("start", "end"):
                val = dates.get(key, "")
                if val:
                    fields.append({"field": f"dates.{key}", "value": val, "critical": True})

    elif entity_type == "persons":
        name = doc.get("name", {})
        ko = name.get("ko", {})
        latn = name.get("latn", {})
        if ko.get("full"):
            fields.append({"field": "name.ko.full", "value": ko["full"], "critical": True})
        if latn.get("preferred"):
            fields.append({"field": "name.latn.preferred", "value": latn["preferred"], "critical": True})

    elif entity_type == "organizations":
        name = doc.get("name", {})
        if name.get("ko"):
            fields.append({"field": "name.ko", "value": name["ko"], "critical": True})
        if name.get("en"):
            fields.append({"field": "name.en", "value": name["en"], "critical": False})

    elif entity_type == "terms":
        term = doc.get("term", {})
        if term.get("ko"):
            fields.append({"field": "term.ko", "value": term["ko"], "critical": True})
        en = term.get("en", {})
        if isinstance(en, dict) and en.get("preferred"):
            fields.append({"field": "term.en.preferred", "value": en["preferred"], "critical": False})

    return fields


def check_date_in_text(page_text: str, date_str: str) -> bool:
    """날짜 문자열이 페이지에 존재하는지 다양한 형식으로 확인"""
    if not date_str:
        return False
    if date_str in page_text:
        return True
    if date_str.replace("-", ".") in page_text:
        return True
    parts = date_str.split("-")
    if len(parts) == 3:
        y, m, d = parts
        # 다양한 한국어 날짜 형식
        formats = [
            f"{y}년 {int(m)}월 {int(d)}일",
            f"{y}. {int(m)}. {int(d)}",
            f"{y}.{m}.{d}",
            f"{y}. {m}. {d}",
            f"{y}/{m}/{d}",
        ]
        for fmt in formats:
            if fmt in page_text:
                return True
        # 최소한 연도+월은 포함되는지
        ym_formats = [f"{y}.{m}", f"{y}-{m}", f"{y}. {int(m)}."]
        for ym in ym_formats:
            if ym in page_text:
                return True
    return False


# --- 단일 파일 검증 ---

def verify_file(filepath: Path, verbose: bool = False, use_playwright: bool = True) -> dict:
    """단일 YAML 파일의 출처 내용을 대조 검증."""
    result = {
        "file": str(filepath.relative_to(PROJECT_ROOT)),
        "checks": [],
        "source_issues": [],  # URL별 접근 결과
        "passed": True,
        "severity": "ok",     # ok, warn, fail, critical
    }

    entity_type = filepath.parent.name

    try:
        with open(filepath) as f:
            doc = yaml.safe_load(f)
    except Exception as e:
        result["checks"].append({"field": "yaml", "status": "ERROR", "detail": str(e)})
        result["passed"] = False
        result["severity"] = "critical"
        return result

    if not doc:
        result["checks"].append({"field": "yaml", "status": "ERROR", "detail": "빈 파일"})
        result["passed"] = False
        result["severity"] = "critical"
        return result

    # 핵심 필드 추출
    check_fields = get_check_fields(doc, entity_type)
    if not check_fields:
        result["checks"].append({"field": "*", "status": "SKIP", "detail": "대조할 필드 없음"})
        return result

    # --- 1단계: URL 생존 확인 + 텍스트 수집 ---
    sources = doc.get("sources", [])
    all_page_text = ""
    dead_urls = []
    blocked_urls = []
    ok_urls = []

    for src in sources:
        url = src if isinstance(src, str) else src.get("url", "")
        if not url:
            continue
        if verbose:
            print(f"         📡 {url[:80]}...")

        fetch_result = fetch_page(url, use_playwright=use_playwright, verbose=verbose)

        if fetch_result.status == "ok":
            ok_urls.append(url)
            all_page_text += " " + fetch_result.text
            result["source_issues"].append({"url": url, "status": "ok", "code": fetch_result.code})
            time.sleep(0.5)

        elif fetch_result.status == "dead_url":
            dead_urls.append(url)
            result["source_issues"].append({"url": url, "status": "dead_url", "code": 404})
            if verbose:
                print(f"         💀 DEAD URL (404): {url[:80]}")

        elif fetch_result.status == "bot_blocked":
            blocked_urls.append(url)
            result["source_issues"].append({"url": url, "status": "bot_blocked", "code": fetch_result.code})
            if verbose:
                print(f"         🤖 봇 차단 ({fetch_result.code}): {url[:80]}")

        else:
            result["source_issues"].append({"url": url, "status": "error", "code": fetch_result.code})
            if verbose:
                print(f"         ❓ 오류 ({fetch_result.code}): {url[:80]}")

    # --- 1단계 판정: DEAD URL은 즉시 CRITICAL ---
    if dead_urls:
        for url in dead_urls:
            result["checks"].append({
                "field": "sources",
                "status": "DEAD_URL",
                "detail": f"존재하지 않는 URL (404) — 허구 출처 의심: {url}",
            })
        result["passed"] = False
        result["severity"] = "critical"
        # dead URL이 있어도 나머지 URL로 내용 대조는 계속 진행

    # 모든 출처 접근 불가 (dead가 아닌 경우)
    if not all_page_text.strip() and not dead_urls:
        if blocked_urls:
            result["checks"].append({
                "field": "*",
                "status": "BOT_BLOCKED",
                "detail": f"모든 출처가 봇 차단 ({len(blocked_urls)}건)"
                          + (" — Playwright 미설치" if not PLAYWRIGHT_AVAILABLE else ""),
            })
            result["severity"] = "warn"
        else:
            result["checks"].append({
                "field": "*",
                "status": "UNREACHABLE",
                "detail": f"모든 출처 접근 불가",
            })
            result["severity"] = "warn"
        return result

    # --- 2단계: 내용 대조 ---
    if all_page_text.strip():
        for check in check_fields:
            field = check["field"]
            value = check["value"]
            critical = check["critical"]

            if field.startswith("dates."):
                found = check_date_in_text(all_page_text, value)
            else:
                found = text_contains(all_page_text, value)

            if found:
                result["checks"].append({
                    "field": field,
                    "value": value,
                    "status": "MATCH",
                })
            else:
                status = "MISMATCH" if critical else "WEAK_MISMATCH"
                result["checks"].append({
                    "field": field,
                    "value": value,
                    "status": status,
                    "detail": "출처 페이지에서 해당 값을 찾을 수 없음",
                })
                if critical and result["severity"] != "critical":
                    result["passed"] = False
                    result["severity"] = "fail"

    return result


# --- 출력 포맷팅 ---

STATUS_ICONS = {
    "MATCH": "✓",
    "MISMATCH": "✗",
    "WEAK_MISMATCH": "~",
    "DEAD_URL": "💀",
    "BOT_BLOCKED": "🤖",
    "UNREACHABLE": "⚠",
    "WARN": "⚠",
    "SKIP": "-",
    "ERROR": "✗",
}

SEVERITY_LABELS = {
    "ok": "  ✓ PASS",
    "warn": "  ⚠ WARN",
    "fail": "  ✗ FAIL",
    "critical": "  💀 CRIT",
}


# --- 메인 ---

def main():
    verbose = "--verbose" in sys.argv
    no_playwright = "--no-playwright" in sys.argv
    args = [a for a in sys.argv[1:] if not a.startswith("--")]

    target = args[0] if args else "data"
    target_path = PROJECT_ROOT / target

    if target_path.is_file():
        files = [target_path]
    elif target_path.is_dir():
        files = sorted(target_path.rglob("*.yaml"))
    else:
        print(f"대상 없음: {target_path}")
        sys.exit(1)

    if not files:
        print(f"검증 대상 없음: {target_path}")
        sys.exit(0)

    use_pw = PLAYWRIGHT_AVAILABLE and not no_playwright
    pw_status = "사용" if use_pw else ("미설치" if not PLAYWRIGHT_AVAILABLE else "비활성")

    print(f"출처 내용 대조 검증 시작 ({len(files)}개 파일)")
    print(f"Playwright: {pw_status}")
    print(f"{'='*60}\n")

    total = 0
    counts = {"ok": 0, "warn": 0, "fail": 0, "critical": 0}

    for filepath in files:
        total += 1
        result = verify_file(filepath, verbose=verbose, use_playwright=use_pw)
        severity = result["severity"]
        counts[severity] = counts.get(severity, 0) + 1

        label = SEVERITY_LABELS.get(severity, "  ? UNKNOWN")
        print(f"{label}  {result['file']}")

        for check in result["checks"]:
            status = check["status"]
            icon = STATUS_ICONS.get(status, "?")

            if status == "MATCH":
                if verbose:
                    print(f"         {icon} {check['field']}: \"{check['value'][:50]}\"")
            elif status == "DEAD_URL":
                print(f"         {icon} {check.get('detail', '')}")
            elif status == "MISMATCH":
                print(f"         ✗ {check['field']}: \"{check['value'][:50]}\"")
                print(f"           → {check.get('detail', '')}")
            elif status == "WEAK_MISMATCH":
                print(f"         ~ {check['field']}: \"{check.get('value', '')[:50]}\"")
            elif status in ("BOT_BLOCKED", "UNREACHABLE"):
                print(f"         {icon} {check.get('detail', '')}")
            elif status == "SKIP":
                if verbose:
                    print(f"         - {check.get('detail', '')}")

    print(f"\n{'='*60}")
    print(f"총 {total}개 | ✓ 통과 {counts['ok']} | ⚠ 경고 {counts['warn']} | ✗ 불일치 {counts['fail']} | 💀 허구의심 {counts['critical']}")

    if counts["critical"] > 0:
        print(f"\n💀 허구 출처 의심 {counts['critical']}건 — 존재하지 않는 URL이 sources에 포함되어 있습니다.")
        print("  해당 URL을 브라우저에서 직접 열어 확인하세요.")

    if counts["fail"] > 0:
        print(f"\n✗ 내용 불일치 {counts['fail']}건 — YAML 데이터가 출처 페이지와 다릅니다.")

    sys.exit(1 if (counts["critical"] + counts["fail"]) > 0 else 0)


if __name__ == "__main__":
    main()
