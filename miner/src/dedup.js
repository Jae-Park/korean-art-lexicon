// dedup: dist/lexicon.json의 기존 엔트리로 key Set을 만들어 신규 후보만 남긴다.
// dist/lexicon.json이 정본 dedup 기준(빌드 산출물). 노션 pending dedup은 Phase 2.
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
