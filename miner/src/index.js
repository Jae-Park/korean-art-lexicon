#!/usr/bin/env node
// Korean Art Lexicon miner — CLI 진입점.  usage: index.js mine|harvest [--client X] [--dry-run]
// Source-First: 절대 data/에 자동 쓰기 없음. mine=후보 수집→(웹검증)→Notion push, harvest=승인분 materialize.
// 현재 구현: MVP — translation-db(style_registry) 피더 → dedup vs lexicon.json → dry-run 출력.
import { config, assertNoApiKey } from "./config.js";
import { fromStyleRegistry } from "./feeders/styleRegistry.js";
import { fromMMCA } from "./feeders/mmca.js";
import { loadExistingKeys, filterNew } from "./dedup.js";
import { verifyBatch } from "./verify/index.js";
import { buildMentionIndex, computeWeight } from "./weight.js";
import { createCandidate } from "./notion.js";
import { harvest as runHarvest } from "./harvest.js";
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
    const mIdx = buildMentionIndex();
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

async function harvest() {
  await runHarvest({ push: has("--push") });
}

const run = { mine, harvest }[cmd];
if (!run) {
  console.error(
    "usage:\n" +
      "  index.js mine [--source style|mmca|all] [--client X] [--pages N] [--verify] [--dry-run]\n" +
      "  index.js harvest [--push]"
  );
  process.exit(2);
}
run().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
