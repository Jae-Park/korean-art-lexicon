// Tier 0 — Wikidata 결정론 검증 (LLM 0, $0). 이름 매칭 → Q-id(external_id) + 공식 URL + 다국어 레이블.
// 외국 작가는 ko 레이블이 곧 한국어 음역 검증 레퍼런스. 대부분 후보가 여기서 $0 해결.
import { nfc } from "../normalize.js";

const API = "https://www.wikidata.org/w/api.php";
const UA = { "User-Agent": "korean-art-lexicon-miner/0.1 (research; contact via repo)" };

// 동시성 하에서 Wikidata가 간헐적으로 요청을 끊는다(레이트리밋) → 빈 결과를 '미해결'로 오판.
// 재시도 래퍼로 흡수. origin=*(브라우저 CORS용) 제거 — 서버사이드 node엔 불필요하고 레이트리밋 악화.
async function getJson(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) });
      if (r.ok) return await r.json();
      if (r.status === 429) await new Promise((s) => setTimeout(s, 1200 * (i + 1))); // 명시적 throttle
    } catch {}
    await new Promise((s) => setTimeout(s, 500 * (i + 1)));
  }
  return null;
}

async function wbSearch(term, lang) {
  const u = `${API}?action=wbsearchentities&search=${encodeURIComponent(term)}&language=${lang}&uselang=${lang}&format=json&limit=5`;
  return (await getJson(u))?.search || [];
}

async function wbGet(ids) {
  if (!ids.length) return {};
  const u = `${API}?action=wbgetentities&ids=${ids.join("|")}&props=labels|descriptions|claims|sitelinks/urls&languages=ko|en&format=json`;
  return (await getJson(u))?.entities || {};
}

// 미술 직군 게이트 — 동명이인(배구선수 박준범, 고려시대 홍순, 정치인 한무경 등) 오매칭 차단.
// person 후보는 description이 미술 관련이어야 통과. 아니면 탈락 → codex/claude가 재검증.
const ART_RE = /(artist|painter|sculpt|photograph|curator|printmaker|engraver|art critic|art historian|calligrapher|ceramic|illustrator|화가|미술가|조각가|사진작가|큐레이터|미술|화백|판화|설치미술|서예가|도예가|미술비평|미술사|공예가|안무|무용|영상작가|작가)/i;
function isArtPerson(ent) {
  const d = `${ent.descriptions?.ko?.value || ""} ${ent.descriptions?.en?.value || ""}`;
  return ART_RE.test(d);
}

function claimVal(ent, prop) {
  const c = ent.claims?.[prop]?.[0]?.mainsnak?.datavalue?.value;
  return typeof c === "string" ? c : c?.id || null;
}
function isHuman(ent) {
  return (ent.claims?.P31 || []).some((c) => c.mainsnak?.datavalue?.value?.id === "Q5");
}

// 후보 → {found, qid, sourceUrl, sourceType, koLabel, enLabel, confidence, note}
export async function verifyWikidata(cand) {
  const terms = [];
  if (cand.en) terms.push([cand.en, "en"]);
  if (cand.ko) terms.push([cand.ko, "ko"]);
  const hitIds = [];
  for (const [term, lang] of terms) {
    for (const h of await wbSearch(term, lang)) if (!hitIds.includes(h.id)) hitIds.push(h.id);
    if (hitIds.length >= 6) break;
  }
  if (!hitIds.length) return { found: false };

  const ents = await wbGet(hitIds.slice(0, 6));
  let best = null;
  for (const id of hitIds) {
    const ent = ents[id];
    if (!ent) continue;
    const koL = nfc(ent.labels?.ko?.value || "");
    const enL = nfc(ent.labels?.en?.value || "");
    const human = isHuman(ent);
    // 유형 게이트: person 후보는 사람(Q5)이어야. org는 사람이면 탈락.
    if (cand.type === "person" && !human) continue;
    if (cand.type === "person" && !isArtPerson(ent)) continue; // 미술 직군 게이트 — 동명이인(배구선수·정치인 등) 차단
    if (cand.type === "organization" && human) continue;
    const koExact = koL && koL.replace(/\s+/g, "") === nfc(cand.ko).replace(/\s+/g, "");
    const enExact = enL && cand.en && enL.toLowerCase() === nfc(cand.en).toLowerCase();
    const score = (koExact ? 2 : 0) + (enExact ? 2 : 0) + (koL || enL ? 1 : 0);
    if (!best || score > best.score) best = { id, ent, koL, enL, koExact, enExact, score };
  }
  if (!best || best.score < 1) return { found: false };

  // 출처 URL 우선순위: 공식 웹사이트(P856) > ko 위키 > en 위키 > Wikidata 엔티티
  const official = claimVal(best.ent, "P856");
  const koWiki = best.ent.sitelinks?.kowiki?.url;
  const enWiki = best.ent.sitelinks?.enwiki?.url;
  const sourceUrl = official || koWiki || enWiki || `https://www.wikidata.org/wiki/${best.id}`;
  const sourceType = official ? "institutional" : "bibliographic";

  // 신뢰도: 유형+ko 일치 high / 유형+en 일치 medium / 약 매칭 low. ko 레이블이 후보와 다르면 flag.
  let confidence = best.koExact ? "high" : best.enExact ? "medium" : "low";
  const notes = [];
  if (best.koL && !best.koExact) notes.push(`Wikidata ko='${best.koL}'(후보와 다름)`);
  if (best.enL && cand.en && !best.enExact) notes.push(`Wikidata en='${best.enL}'`);

  return {
    found: true,
    qid: best.id,
    sourceUrl,
    sourceType,
    koLabel: best.koL,
    enLabel: best.enL,
    confidence,
    note: notes.join("; "),
  };
}
