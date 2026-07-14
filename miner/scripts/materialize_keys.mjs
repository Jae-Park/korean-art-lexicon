#!/usr/bin/env node
// 지정 dedup_key의 Candidates 행 중 approved를 materialized로 내린다(수확 후 큐 정리).
// 실행: node miner/scripts/materialize_keys.mjs path/to/keys.json
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "../src/config.js";
import { queryCandidatesByDedupKey, setProcessingStatus } from "../src/notion.js";

function loadKeys(path) {
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  const keys = Array.isArray(parsed) ? parsed : parsed?.dedupKeys ?? parsed?.includeKeys;
  if (!Array.isArray(keys) || keys.some((key) => typeof key !== "string" || !key)) {
    throw new Error("JSON은 문자열 배열 또는 { dedupKeys | includeKeys: 문자열 배열 } 이어야 합니다.");
  }
  return [...new Set(keys)];
}

async function main() {
  const input = process.argv[2];
  if (!input || process.argv.length !== 3) {
    console.error("usage: node miner/scripts/materialize_keys.mjs path/to/keys.json");
    process.exitCode = 2;
    return;
  }
  if (!config.notionToken || !config.notionDbId) {
    throw new Error("NOTION_TOKEN 및 NOTION_CANDIDATES_DB_ID가 필요합니다.");
  }

  const keys = loadKeys(resolve(input));
  let done = 0, failed = 0;
  const skips = [];

  for (const dedupKey of keys) {
    const rows = await queryCandidatesByDedupKey(dedupKey);
    const target = rows.filter((row) => row.처리 === "approved");
    if (!rows.length) { skips.push(`${dedupKey}: 미발견`); continue; }
    if (!target.length) { skips.push(`${dedupKey}: approved 없음 (${rows.map((r) => r.처리 || "상태없음").join(", ")})`); continue; }
    let changed = 0;
    for (const row of target) {
      if (await setProcessingStatus(row._pageId, "materialized")) changed++;
      else failed++;
    }
    done += changed;
    console.log(`${dedupKey}: materialized ${changed}/${target.length}`);
  }

  console.log(`materialized ${done}`);
  for (const skip of skips) console.log(`skip ${skip}`);
  if (failed) { console.error(`PATCH 실패 ${failed}`); process.exitCode = 1; }
}

main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
