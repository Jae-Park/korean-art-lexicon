// dedup: 확정 lexicon 및 Notion 후보 코퍼스의 key Set으로 재유입 후보를 제거한다.
import { readFileSync } from "node:fs";
import { dedupKey } from "./normalize.js";
import { config } from "./config.js";

export function loadExistingKeys() {
  const lex = JSON.parse(readFileSync(config.lexiconJson, "utf8"));
  const keys = new Set();
  const add = (type, ko, year) => {
    if (ko) keys.add(dedupKey(type, ko, { year }));
  };
  for (const p of lex.persons || []) add("person", p.name?.ko?.full || p.name?.ko);
  for (const o of lex.organizations || []) add("organization", o.name?.ko?.full || o.name?.ko);
  for (const e of lex.exhibitions || []) add("exhibition", e.title?.ko, (e.dates?.start || "").slice(0, 4));
  for (const t of lex.terms || []) add("term", t.term?.ko?.full || t.term?.ko);
  for (const pub of lex.publications || []) add("publication", pub.title?.ko, pub.year);
  return keys;
}

// 후보 배열에서 (1) 이미 lexicon에 있는 것 (2) 배치 내 중복 을 제거. 드롭 사유 태깅.
export function filterNew(candidates, existing) {
  const seen = new Set();
  const out = [];
  for (const c of candidates) {
    if (existing.has(c.dedupKey)) {
      c._drop = "in-lexicon";
      continue;
    }
    if (seen.has(c.dedupKey)) {
      c._drop = "dup-in-batch";
      continue;
    }
    seen.add(c.dedupKey);
    out.push(c);
  }
  return out;
}

// Notion Candidates DB에 한 번이라도 만들어진 키는 처리 상태와 무관하게 재생성하지 않는다.
// rejected/materialized도 이력으로 보존해 재실행이 새 행을 증식시키지 않게 한다.
// 호출 위치는 반드시 Notion create 직전이어야 한다(동일 mine 재실행의 최종 안전망).
export function filterNotionExisting(candidates, existingKeys) {
  const out = [];
  for (const c of candidates) {
    if (existingKeys.has(c.dedupKey)) {
      c._drop = "in-notion";
      continue;
    }
    out.push(c);
  }
  return out;
}
