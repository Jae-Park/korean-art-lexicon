// EN 보강 — 노션 person 후보의 영문 표기를 "웹검색으로 실제 쓰이는 용례 + 출처"로 채운다($0 codex --search).
// Source-First: 기계 표기(Wikidata 라벨/자동 로마자) 금지. 재단·미술관·갤러리가 실제 쓰는 형태를 그 출처와 함께.
// 대상 = EN 빈 person + 과거 Wikidata로 채운(불신뢰) person 둘 다. 미술직군 맥락 프롬프트로 동명이인 회피.
import { config } from "./config.js";
import { romanizeViaWeb } from "./verify/romanize.js";
import { log } from "../lib/log.js";

const API = "https://api.notion.com/v1";
const today = () => new Date().toISOString().slice(0, 10);
const H = () => ({
  Authorization: `Bearer ${config.notionToken}`,
  "Notion-Version": "2022-06-28",
  "Content-Type": "application/json",
});

async function targetPersons() {
  const out = [];
  let cursor;
  do {
    const body = { filter: { property: "엔티티", select: { equals: "person" } }, page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const r = await fetch(`${API}/databases/${config.notionDbId}/query`, { method: "POST", headers: H(), body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`query ${r.status}: ${(await r.text()).slice(0, 120)}`);
    const d = await r.json();
    for (const p of d.results) {
      const en = (p.properties["EN/romanization"]?.rich_text || []).map((t) => t.plain_text).join("");
      const evidence = (p.properties["evidence"]?.rich_text || []).map((t) => t.plain_text).join("");
      // EN 없거나, 과거 Wikidata-라벨로 채운(불신뢰) 행 → 웹 재검증
      if (!en.trim() || /Wikidata 영문명/.test(evidence)) {
        out.push({
          pageId: p.id,
          ko: (p.properties["이름/제목"]?.title || []).map((t) => t.plain_text).join(""),
          origin: p.properties["origin"]?.select?.name || "",
          evidence,
        });
      }
    }
    cursor = d.has_more ? d.next_cursor : null;
  } while (cursor);
  return out;
}

// evidence 앞쪽 이전 enrich 노트(웹/Wikidata)를 MMCA 원본 경계까지 제거 — 재타깃 시 누적 방지.
// lazy + lookahead로 끊어 URL 속 마침표(mmca.go.kr 등)에 안 걸림. MMCA 노트 없으면 노트 전체 제거($).
function stripOldFlag(ev) {
  return (ev || "").replace(/^\[\d{4}-\d{2}-\d{2}\]\s*(영문표기|Wikidata 영문명)[^]*?(?=\[\d{4}-\d{2}-\d{2}\]\s*MMCA|$)/, "").trim();
}

async function patch(pageId, en, evidence) {
  const r = await fetch(`${API}/pages/${pageId}`, {
    method: "PATCH",
    headers: H(),
    body: JSON.stringify({
      properties: {
        "EN/romanization": { rich_text: [{ text: { content: en } }] },
        evidence: { rich_text: [{ text: { content: evidence.slice(0, 1900) } }] },
      },
    }),
  });
  if (!r.ok) throw new Error(`patch ${r.status}`);
  return true;
}

export async function enrichEn({ concurrency = 3 } = {}) {
  if (!config.notionToken) {
    log("NOTION_TOKEN 미설정 → enrich 불가");
    return;
  }
  const rows = await targetPersons();
  log(`웹검색 EN 보강 대상 person: ${rows.length} (codex --search, $0)`);
  let filled = 0;
  const miss = [];
  let idx = 0;

  async function worker() {
    while (idx < rows.length) {
      const row = rows[idx++];
      const res = await romanizeViaWeb(row.ko, { origin: row.origin });
      if (res.en && res.src) {
        const ev = `[${today()}] 영문표기 '${res.en}' — 실제 용례 확인: ${res.src}. ` + stripOldFlag(row.evidence);
        try {
          await patch(row.pageId, res.en, ev);
          filled++;
          log(`  ✓ ${row.ko} → ${res.en}  [${res.src}]`);
        } catch (e) {
          log(`  set실패 ${row.ko}: ${e.message}`);
        }
      } else {
        miss.push(row.ko);
        log(`  · ${row.ko} → 용례 못 찾음 (${res.reason})`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, () => worker()));
  log(`완료: ${filled} 채움(출처 동반) / ${miss.length} 미발견`);
  if (miss.length) log(`미발견(수동): ${miss.join(", ")}`);
}
