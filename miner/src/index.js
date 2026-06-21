#!/usr/bin/env node
// Korean Art Lexicon miner — CLI 진입점.  usage: index.js mine|harvest [--client X] [--dry-run]
// Source-First: 절대 data/에 자동 쓰기 없음. mine=후보 수집→(웹검증)→Notion push, harvest=승인분 materialize.
// 현재 구현: MVP — translation-db(style_registry) 피더 → dedup vs lexicon.json → dry-run 출력.
import { config, assertNoApiKey } from "./config.js";
import { fromStyleRegistry } from "./feeders/styleRegistry.js";
import { fromMMCA } from "./feeders/mmca.js";
import { fromAltpool } from "./feeders/altpool.js";
import { fromGgcf } from "./feeders/ggcf.js";
import { fromNeolook } from "./feeders/neolook.js";
import { fromSema } from "./feeders/sema.js";
import { loadExistingKeys, filterNew } from "./dedup.js";
import { verifyBatch } from "./verify/index.js";
import { buildMentionIndex, computeWeight } from "./weight.js";
import { normInstitution } from "./institutions.js";
import { createCandidate, candidateMentionIndex, setWeight, queryReviewable } from "./notion.js";
import { harvest as runHarvest } from "./harvest.js";
import { enrichEn } from "./enrich.js";
import { log } from "../lib/log.js";

const cmd = process.argv[2];
const args = process.argv.slice(3);
const has = (f) => args.includes(f);
const val = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};

async function mine() {
  assertNoApiKey();
  const clientArg = val("--client");
  const clients = clientArg ? [clientArg] : null;
  const source = val("--source") || "style"; // style | mmca | all
  const pages = Number(val("--pages")) || 2;
  log(`mine: source=${source}${source !== "mmca" && clients ? ` client=${clientArg}` : ""}`);

  let leads = [];
  if (source === "mmca" || source === "all") {
    const m = await fromMMCA({ pages });
    log(`leads from MMCA(GOLD, ${pages}p): ${m.length}`);
    leads.push(...m);
  }
  if (source === "style" || source === "all") {
    const s = fromStyleRegistry({ clients });
    log(`leads from style_registry(SILVER): ${s.length}`);
    leads.push(...s);
  }
  if (source === "altpool") {
    const a = fromAltpool({ jsonPath: val("--altpool-json") || undefined });
    log(`leads from altpool(GOLD): ${a.length}`);
    leads.push(...a);
  }
  if (source === "ggcf") {
    const a = await fromGgcf({
      site: val("--site") || "gmoma",
      fromId: Number(val("--from")) || 1,
      toId: Number(val("--to")) || 260,
    });
    log(`leads from ggcf(${val("--site") || "gmoma"}): ${a.length}`);
    leads.push(...a);
  }
  if (source === "neolook") {
    const a = fromNeolook({ mirrorPath: val("--mirror") });
    log(`leads from neolook(board, press): ${a.length}`);
    leads.push(...a);
  }
  if (source === "sema") {
    const a = await fromSema({ service: val("--service"), max: Number(val("--max")) || 100000 });
    log(`leads from sema(GOLD): ${a.length}`);
    leads.push(...a);
  }

  const existing = loadExistingKeys();
  log(`lexicon existing dedup keys: ${existing.size}`);

  const fresh = filterNew(leads, existing);
  const dropped = leads.length - fresh.length;
  log(`new (not in lexicon): ${fresh.length}  (dropped ${dropped}: 이미 등재/배치중복)`);

  let result = fresh;
  if (has("--verify")) {
    log(`verify: Tier0(Wikidata)+Tier2(pageMatch), $0, on ${fresh.length} candidates...`);
    result = await verifyBatch(fresh);
    const ok = result.filter((r) => r.verified).length;
    const unresolved = result.filter((r) => r.verifyTier === "unresolved").length;
    log(`verified: ${ok} confirmed / ${result.length - ok} not (unresolved→Tier1 codex: ${unresolved})`);

    // 업로드/검수 순서 가중치 → 정렬(높을수록 먼저). 기관 먼저, 인물은 기관 언급빈도.
    // mentionIdx = style_registry + 노션 후보 코퍼스(도메인) → 다기관 교차등장이 weight에 반영(cross-run).
    const mIdx = await mergedMentionIndex(result);
    for (const r of result) r.weight = computeWeight(r, mIdx);
    result.sort((a, b) => (b.weight || 0) - (a.weight || 0));
    log(`weighted+sorted: top=${result[0]?.ko}(w${result[0]?.weight}) bottom=${result[result.length - 1]?.ko}(w${result[result.length - 1]?.weight})`);
  }

  const dryRun = has("--dry-run") || !config.notionToken;
  if (dryRun) {
    if (!config.notionToken) log("NOTION_TOKEN 미설정 → dry-run(JSON stdout). Notion push는 토큰 설정 후.");
    process.stdout.write(JSON.stringify({ count: result.length, candidates: result }, null, 2) + "\n");
    return;
  }
  log(`Notion push: ${result.length}건...`);
  let pushed = 0;
  for (const c of result) {
    try {
      if (await createCandidate(c)) pushed++;
    } catch (e) {
      log(`push 실패 ${c.ko}: ${e.message}`);
    }
  }
  log(`pushed ${pushed}/${result.length}`);
}

// style_registry + 노션 후보 코퍼스(도메인=기관) + 현재 leads 도메인을 합산한 mention index.
// 여러 기관을 따로 mine 해도 같은 작가의 교차등장(서로 다른 도메인)이 누적돼 weight에 반영된다.
async function mergedMentionIndex(leads = []) {
  // 단위 = 정규화된 기관(장소). style_registry 클라이언트도 정규화(MMCA↔국립현대 교차 매칭).
  const mIdx = new Map();
  for (const [k, set] of buildMentionIndex()) {
    mIdx.set(k, new Set([...set].map(normInstitution).filter(Boolean)));
  }
  try {
    const cIdx = await candidateMentionIndex(); // 노션 후보: dedupKey -> Set(기관)
    for (const [k, insts] of cIdx) {
      if (!mIdx.has(k)) mIdx.set(k, new Set());
      for (const i of insts) mIdx.get(k).add(i);
    }
    log(`mentionIdx: style_registry + 노션후보 ${cIdx.size}키 병합(기관 단위)`);
  } catch (e) {
    log(`candidateMentionIndex skip: ${e.message}`);
  }
  for (const r of leads) {
    if (!r.dedupKey) continue;
    let inst = r.institution ? normInstitution(r.institution) : "";
    if (!inst && r.sourceUrl) {
      try { inst = normInstitution(new URL(r.sourceUrl).hostname.replace(/^www\./, "")); } catch {}
    }
    if (!inst) continue;
    if (!mIdx.has(r.dedupKey)) mIdx.set(r.dedupKey, new Set());
    mIdx.get(r.dedupKey).add(inst);
  }
  return mIdx;
}

// 기존 노션 후보(new/rework)를 cross-institution mention 기준으로 재가중. --dry-run이면 PATCH 안 함.
async function reweight() {
  const dry = has("--dry-run") || !config.notionToken;
  const rows = await queryReviewable();
  log(`reweight: 검수대상 ${rows.length}건`);
  const mIdx = await mergedMentionIndex();
  const moved = [];
  let changed = 0;
  for (const r of rows) {
    const c = {
      type: r.엔티티,
      confidence: r.신뢰도,
      sourceType: r.출처유형,
      origin: r.origin,
      dedupKey: r.dedup_key,
      verified: r.신뢰도 === "high", // 근사: verified 플래그 미저장 → high 신뢰도를 proxy
    };
    const w = computeWeight(c, mIdx);
    if (w !== r.우선순위) {
      moved.push({ ko: r["이름/제목"], old: r.우선순위, w, m: c.instMentions });
      if (!dry && (await setWeight(r._pageId, w))) changed++;
    }
  }
  moved.sort((a, b) => b.w - a.w);
  log(`weight 변동 ${moved.length}건. 상위: ${moved.slice(0, 10).map((m) => `${m.ko}(${m.old}→${m.w},m${m.m || "-"})`).join(", ")}`);
  log(dry ? "--dry-run: PATCH 안 함(--dry-run 빼면 적용)" : `적용: ${changed}건 우선순위 갱신`);
}

async function harvest() {
  await runHarvest({ push: has("--push") });
}

async function enrich() {
  await enrichEn({ concurrency: Number(val("--concurrency")) || 3 });
}

const run = { mine, harvest, enrich, reweight }[cmd];
if (!run) {
  console.error(
    "usage:\n" +
      "  index.js mine [--source style|mmca|all] [--client X] [--pages N] [--verify] [--dry-run]\n" +
      "  index.js reweight [--dry-run]   # 노션 후보를 다기관 교차등장(cross-institution) 기준으로 재가중\n" +
      "  index.js harvest [--push]"
  );
  process.exit(2);
}
run().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
