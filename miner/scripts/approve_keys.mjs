#!/usr/bin/env node
// 지정 dedup_key의 Candidates 행만 new/rework → approved로 바꾼다.
// 실행: node miner/scripts/approve_keys.mjs path/to/keys.json
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "../src/config.js";
import { queryCandidatesByDedupKey, setProcessingStatus } from "../src/notion.js";

function usage() {
  console.error("usage: node miner/scripts/approve_keys.mjs path/to/keys.json");
}

function loadKeys(path) {
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  const keys = Array.isArray(parsed) ? parsed : parsed?.dedupKeys;
  if (!Array.isArray(keys) || keys.some((key) => typeof key !== "string" || !key)) {
    throw new Error("JSON은 문자열 배열 또는 { dedupKeys: 문자열 배열 } 이어야 합니다.");
  }
  return [...new Set(keys)];
}

async function main() {
  const input = process.argv[2];
  if (!input || process.argv.length !== 3) {
    usage();
    process.exitCode = 2;
    return;
  }
  if (!config.notionToken || !config.notionDbId) {
    throw new Error("NOTION_TOKEN 및 NOTION_CANDIDATES_DB_ID가 필요합니다.");
  }

  const keys = loadKeys(resolve(input));
  let approved = 0;
  let failed = 0;
  const skips = [];

  for (const dedupKey of keys) {
    const rows = await queryCandidatesByDedupKey(dedupKey);
    const target = rows.filter((row) => row.처리 === "new" || row.처리 === "rework");
    const alreadyProcessed = rows.filter((row) => row.처리 !== "new" && row.처리 !== "rework");
    if (!rows.length) {
      skips.push(`${dedupKey}: 미발견`);
      continue;
    }
    if (!target.length) {
      skips.push(`${dedupKey}: 이미처리 (${rows.map((row) => row.처리 || "상태없음").join(", ")})`);
      continue;
    }

    let changed = 0;
    for (const row of target) {
      if (await setProcessingStatus(row._pageId, "approved")) changed++;
      else failed++;
    }
    approved += changed;
    console.log(`${dedupKey}: approved ${changed}/${target.length}${target.length > 1 ? " (복수 행)" : ""}`);
    if (alreadyProcessed.length) {
      skips.push(`${dedupKey}: 이미처리 ${alreadyProcessed.length}행 (${alreadyProcessed.map((row) => row.처리 || "상태없음").join(", ")})`);
    }
  }

  console.log(`approved ${approved}`);
  for (const skip of skips) console.log(`skip ${skip}`);
  if (failed) {
    console.error(`PATCH 실패 ${failed}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
