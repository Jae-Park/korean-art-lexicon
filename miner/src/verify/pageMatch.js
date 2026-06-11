// Tier 2 — 페이지 대조 (결정론, LLM 0, $0). URL을 fetch해 이름(ko 또는 en)이 실제로 있는지 텍스트 매칭.
// 404=죽은 출처(fail) / 403·429=봇차단(pass, URL 자체는 존재) / 200+매칭=확인. validate_source_content.py 철학.
import { nfc } from "../normalize.js";

const UA = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) korean-art-lexicon-miner" };

function compact(s) {
  return nfc(s).replace(/\s+/g, "");
}

export async function pageContains(url, names, { timeoutMs = 12000 } = {}) {
  if (!url) return { ok: false, reason: "no-url" };
  try {
    const r = await fetch(url, { headers: UA, redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
    if (r.status === 404 || r.status === 410) return { ok: false, status: r.status, reason: "dead" };
    if (r.status === 403 || r.status === 429) return { ok: true, status: r.status, reason: "bot-blocked-pass" };
    if (!r.ok) return { ok: false, status: r.status, reason: "http-error" };
    const html = await r.text();
    const hay = compact(html.replace(/<[^>]+>/g, " "));
    for (const n of names.filter(Boolean)) {
      if (hay.includes(compact(n))) return { ok: true, status: r.status, reason: "match", matched: n };
    }
    return { ok: false, status: r.status, reason: "no-match" };
  } catch (e) {
    return { ok: false, status: 0, reason: `fetch-fail: ${String(e.message).slice(0, 60)}` };
  }
}
