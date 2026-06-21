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
import { fromSema, fromSemaFile } from "./feeders/sema.js";
import { loadExistingKeys, filterNew } from "./dedup.js";
import { verifyBatch } from "./verify/index.js";
import { buildMentionIndex, computeWeight } from "./weight.js";
import { normInstitution } from "./institutions.js";
import { createCandidate, candidateMentionIndex, setWeight, queryReviewable, rowInstitution } from "./notion.js";
import { writeFileSync, mkdirSync } from "node:fs";
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
    const file = val("--file");
    const a = file
      ? fromSemaFile({ file, fileEn: val("--file-en") })
      : await fromSema({ service: val("--service"), max: Number(val("--max")) || 100000 });
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

// publish-gate — 인물 교차검증 퍼블리시 게이트. (SeMA∧MMCA) 또는 (정규화 기관 ≥N) 통과 인물을
// 로마자 일치로 분류: ready(자동스테이지 가능) / 로마자보강필요(fast-track) / 로마자충돌(동명이인·변이검토).
// data/·노션 안 건드림 — 검토용 파일만 출력(인간 배치 승인 후 materialize는 별도).
async function gate() {
  const minInst = Number(val("--min-inst")) || 3;
  const rows = await queryReviewable();
  log(`publish-gate: 검수풀 ${rows.length}행 분석`);
  const byPerson = new Map();
  for (const r of rows) {
    if (r["엔티티"] !== "person" || !r.dedup_key) continue;
    if (!byPerson.has(r.dedup_key)) byPerson.set(r.dedup_key, { ko: r["이름/제목"], rows: [] });
    byPerson.get(r.dedup_key).rows.push(r);
  }
  const ready = [], needRoman = [], conflict = [];
  for (const [key, p] of byPerson) {
    const insts = new Set(), romans = new Set(), sources = new Set();
    for (const r of p.rows) {
      const inst = rowInstitution(r);
      if (inst) insts.add(inst);
      const en = (r["EN/romanization"] || "").trim();
      if (en) romans.add(en);
      if (r["출처 URL"]) sources.add(r["출처 URL"]);
    }
    const pass = (insts.has("서울시립미술관") && insts.has("국립현대미술관")) || insts.size >= minInst;
    if (!pass) continue;
    const rl = [...romans];
    const norm = new Set(rl.map((s) => s.toLowerCase().replace(/[\s.\-]/g, "")));
    const rec = { ko: p.ko, dedupKey: key, institutions: [...insts], n: insts.size, romanizations: rl, sources: [...sources] };
    if (rl.length <= 1) needRoman.push(rec); // 로마자 0~1개 = 교차확인 안 됨(동명이인 미해소) → 사람
    else if (norm.size === 1) ready.push(rec); // 로마자 ≥2개 일치 = 진짜 교차확인 → 동명이인 위험 낮음
    else conflict.push(rec); // 로마자 ≥2개 충돌 → 동명이인이거나 변이, 사람 판단
  }
  const byN = (a, b) => b.n - a.n;
  ready.sort(byN); needRoman.sort(byN); conflict.sort(byN);
  const total = ready.length + needRoman.length + conflict.length;
  log(`통과 인물 ${total}명 (min-inst=${minInst} 또는 SeMA∧MMCA)`);
  log(`  ✅ auto-stage 준비(로마자 ≥2 교차확인): ${ready.length}`);
  log(`  ✍️  로마자 교차확인 안 됨(≤1개) → fast-track 사람: ${needRoman.length}`);
  log(`  ⚠️  로마자 충돌(동명이인/변이 검토): ${conflict.length}`);
  log(`  상위: ${[...ready, ...needRoman].slice(0, 10).map((r) => `${r.ko}(${r.n})`).join(", ")}`);
  mkdirSync(config.reportsDir, { recursive: true });
  const path = `${config.reportsDir}/publish-gate.json`;
  writeFileSync(path, JSON.stringify({ minInst, counts: { ready: ready.length, needRoman: needRoman.length, conflict: conflict.length }, ready, needRoman, conflict }, null, 2));
  log(`→ ${path} (인간 배치 승인용 — data/·노션 미접촉)`);
}

async function harvest() {
  await runHarvest({ push: has("--push") });
}

async function enrich() {
  await enrichEn({ concurrency: Number(val("--concurrency")) || 3 });
}

const run = { mine, harvest, enrich, reweight, gate }[cmd];
if (!run) {
  console.error(
    "usage:\n" +
      "  index.js mine [--source style|mmca|altpool|ggcf|neolook|sema|all] [--pages N] [--file X --file-en Y] [--verify] [--dry-run]\n" +
      "  index.js reweight [--dry-run]   # 노션 후보를 다기관 교차등장(cross-institution) 기준으로 재가중\n" +
      "  index.js gate [--min-inst N]    # 인물 교차검증 퍼블리시 게이트(로마자 일치 분류) → 검토 파일\n" +
      "  index.js harvest [--push]"
  );
  process.exit(2);
}
run().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
