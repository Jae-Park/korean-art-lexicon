// 검증 오케스트레이터 (2-pass).
//  Pass 1 — Tier0 Wikidata(직렬 페이싱, $0) + Tier2 pageMatch. best-effort: 되면 공짜 외부ID+공식URL.
//  Pass 2 — Tier1 codex --search($0, 동시성 3): Pass1 미해결만. 신뢰성 backstop.
//  Claude(Tier3)는 codex도 모호할 때만 — 다음 단계(에스컬레이션).
import { verifyWikidata } from "./wikidata.js";
import { pageContains } from "./pageMatch.js";
import { codexFindUrl } from "./codexSearch.js";
import { claudeFindUrl } from "./claudeJudge.js";
import { log } from "../../lib/log.js";

const sleep = (ms) => new Promise((s) => setTimeout(s, ms));

// Tier 0 + 2
async function viaWikidata(cand) {
  const wd = await verifyWikidata(cand);
  if (!wd.found) return { ...cand, verifyTier: "unresolved", verified: false, verifyNote: "Wikidata 미해결" };
  const pm = await pageContains(wd.sourceUrl, [cand.ko, cand.en, wd.koLabel, wd.enLabel]);
  return {
    ...cand,
    sourceUrl: wd.sourceUrl,
    sourceType: wd.sourceType,
    confidence: wd.confidence,
    verifyTier: "wikidata",
    wikidata: wd.qid,
    verified: pm.ok,
    verifyNote: [wd.note, `page:${pm.reason}`].filter(Boolean).join(" | "),
  };
}

// Tier 1 + 2
async function viaCodex(cand) {
  const r = await codexFindUrl(cand);
  if (!r.url) return { ...cand, verifyTier: "codex-none", verified: false, verifyNote: `codex: ${r.reason}` };
  const pm = await pageContains(r.url, [cand.ko, cand.en]);
  return {
    ...cand,
    sourceUrl: r.url,
    sourceType: "institutional", // codex 우선순위가 기관/언론 → 대체로. 사람검수가 최종 판정.
    confidence: pm.ok ? "medium" : "low", // codex 출처는 품질 변동 → low/medium, 사람이 확정
    verifyTier: "codex",
    verified: pm.ok,
    verifyNote: `codex-found(${r.reason}) | page:${pm.reason}`,
  };
}

export async function verifyBatch(cands, { tier1 = true, codexConcurrency = 3, pace = 400 } = {}) {
  // GOLD(MMCA 기관 1차 API 등 이미 검증된 것)는 파이프라인 건너뜀 — 출처가 곧 기관 1차.
  const gold = cands.filter((c) => c.verified && c.sourceUrl);
  const todo = cands.filter((c) => !(c.verified && c.sourceUrl));
  if (gold.length) log(`GOLD ${gold.length}개 검증 생략(기관 1차 출처) / 파이프라인 ${todo.length}개`);

  // Pass 1: Wikidata 직렬(레이트리밋 회피)
  const out = [...gold];
  for (const c of todo) {
    out.push(await viaWikidata(c).catch((e) => ({ ...c, verifyTier: "error", verified: false, verifyNote: `wd-err: ${e.message}` })));
    log(`wikidata ${out.length - gold.length}/${todo.length}`);
    await sleep(pace);
  }
  if (!tier1) return out;

  // Pass 2: 미해결만 codex (동시성)
  const unresolved = out.filter((c) => c.verifyTier === "unresolved");
  log(`tier1 codex --search on ${unresolved.length} unresolved (동시성 ${codexConcurrency})...`);
  for (let i = 0; i < unresolved.length; i += codexConcurrency) {
    const chunk = unresolved.slice(i, i + codexConcurrency);
    const res = await Promise.all(
      chunk.map((c) => viaCodex(c).catch((e) => ({ ...c, verifyTier: "codex-error", verified: false, verifyNote: `cx-err: ${e.message}` })))
    );
    for (const r of res) {
      const idx = out.findIndex((o) => o.dedupKey === r.dedupKey);
      if (idx >= 0) out[idx] = r;
    }
    log(`codex ${Math.min(i + codexConcurrency, unresolved.length)}/${unresolved.length}`);
  }

  // Pass 3: codex도 못 잡은 것만 claude(sonnet) — 다른 모델 패밀리, 어려운 disambiguation.
  const stillUnresolved = out.filter((c) => c.verifyTier === "codex-none" || c.verifyTier === "codex-error");
  if (stillUnresolved.length) {
    log(`tier3 claude(sonnet) on ${stillUnresolved.length} (codex도 미해결)...`);
    for (let i = 0; i < stillUnresolved.length; i += 2) {
      const chunk = stillUnresolved.slice(i, i + 2);
      const res = await Promise.all(chunk.map((c) => viaClaude(c).catch((e) => ({ ...c, verifyTier: "tier3-error", verified: false, verifyNote: `claude-err: ${e.message}` }))));
      for (const r of res) {
        const idx = out.findIndex((o) => o.dedupKey === r.dedupKey);
        if (idx >= 0) out[idx] = r;
      }
      log(`claude ${Math.min(i + 2, stillUnresolved.length)}/${stillUnresolved.length}`);
    }
  }
  return out;
}

// Tier 3 + 2
async function viaClaude(cand) {
  const r = await claudeFindUrl(cand);
  if (!r.url) return { ...cand, verifyTier: "tier3-none", verified: false, verifyNote: `claude(${r.model || "?"}): ${r.reason}` };
  const pm = await pageContains(r.url, [cand.ko, cand.en]);
  return {
    ...cand,
    sourceUrl: r.url,
    sourceType: "institutional",
    confidence: pm.ok ? "medium" : "low",
    verifyTier: "claude-sonnet",
    verified: pm.ok,
    verifyNote: `claude-found(${r.reason}) | page:${pm.reason}`,
  };
}
