// 802 확정작가 로마자 보강 — Wikidata. 동명이인 가드(엄격): 사람(Q5)+시각미술가 신호 필수+비미술 배제.
// matched=그 이름 미술가 후보 정확히 1명. 2명↑=ambiguous, 0명=nomatch. 읽기전용.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { config } from "../src/config.js";
import { isBlacklisted } from "../src/blacklist.js";
const UA = "KoreanArtLexicon/0.1 (https://github.com/Jae-Park/korean-art-lexicon; jaeyong@readingroom.me)";
const gate = JSON.parse(readFileSync(`${config.reportsDir}/publish-gate.json`, "utf8"));
const targets = gate.needRoman.filter((r) => !isBlacklisted(r.ko));
console.log(`로마자 대상: ${targets.length}명`);
const ART = /(\bartist\b|painter|photographer|sculptor|printmaker|installation|ceramic|calligrapher|engraver|미술가|화가|사진가|사진작가|조각가|판화가|설치미술|미디어\s?아트|현대미술|공예가|서예가|도예가|미술)/i;
const NONART = /(singer|rapper|idol|politician|business|diplomat|screenwriter|composer|conductor|actor|actress|footballer|athlete|\bplayer\b|fencer|swimmer|\bwriter\b|poet|novelist|journalist|musician|film director|dancer|\bchef\b|announcer|monk|정치인|가수|래퍼|기업인|외교관|작곡가|지휘자|배우|선수|소설가|시인|기자|음악가|영화감독|무용가|아나운서|성우|방송인|스님|승려)/i;
const wd = async (p) => (await fetch("https://www.wikidata.org/w/api.php?" + new URLSearchParams({ format: "json", ...p }), { headers: { "User-Agent": UA } })).json();
async function lookup(ko) {
  const s = await wd({ action: "wbsearchentities", search: ko, language: "ko", uselang: "ko", limit: "7", type: "item" });
  const ids = (s.search || []).map((x) => x.id); if (!ids.length) return [];
  const e = await wd({ action: "wbgetentities", ids: ids.join("|"), props: "labels|descriptions|aliases|claims", languages: "en|ko" });
  const out = [];
  for (const id of ids) {
    const ent = e.entities?.[id]; if (!ent) continue;
    const p31 = (ent.claims?.P31 || []).map((c) => c.mainsnak?.datavalue?.value?.id);
    const enLabel = ent.labels?.en?.value || ""; if (!p31.includes("Q5") || !enLabel) continue;
    const koLabel = ent.labels?.ko?.value || "";
    const desc = `${ent.descriptions?.en?.value || ""} ${ent.descriptions?.ko?.value || ""}`.trim();
    out.push({ id, enLabel, koLabel, desc: desc.slice(0, 70), aliases: (ent.aliases?.en || []).map((a) => a.value), isArt: ART.test(desc) && !NONART.test(desc), nameMatch: koLabel === ko });
  }
  return out;
}
const matched = [], ambiguous = [], nomatch = []; let i = 0;
for (const t of targets) {
  let c = []; try { c = await lookup(t.ko); } catch {}
  if (++i % 100 === 0) console.log(`  ${i}/${targets.length}`);
  const art = c.filter((x) => x.isArt);
  if (art.length === 1) matched.push({ ko: t.ko, qid: art[0].id, en: art[0].enLabel, aliases: art[0].aliases, desc: art[0].desc, nameMatch: art[0].nameMatch, institutions: t.institutions, n: t.n });
  else if (art.length > 1) ambiguous.push({ ko: t.ko, candidates: art.slice(0, 3).map((x) => ({ qid: x.id, en: x.enLabel, desc: x.desc })), institutions: t.institutions });
  else nomatch.push({ ko: t.ko, institutions: t.institutions });
  await new Promise((r) => setTimeout(r, 120));
}
matched.sort((a, b) => b.n - a.n);
console.log(`\n매칭 ${matched.length} (한글라벨일치 ${matched.filter((m) => m.nameMatch).length}) | 모호 ${ambiguous.length} | 무매칭 ${nomatch.length}`);
for (const m of matched.slice(0, 18)) console.log(`  ${m.ko} → ${m.en} (${m.qid}) [${m.desc.slice(0, 38)}]`);
mkdirSync(config.reportsDir, { recursive: true });
writeFileSync(`${config.reportsDir}/wikidata-romanization.json`, JSON.stringify({ matched, ambiguous, nomatch }, null, 2));
console.log("→ reports/miner/wikidata-romanization.json");
