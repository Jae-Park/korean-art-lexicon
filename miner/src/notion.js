// 노션 REST 헬퍼 (헤드리스). 토큰=.env NOTION_TOKEN. 후보 push + 승인 행 query + materialized flip.
// MCP가 아니라 raw fetch(news-roundup 패턴) — launchd 무인 실행용. 토큰 미설정 시 no-op/[].
import { config } from "./config.js";
import { geunggeo } from "./geunggeo.js";
import { normInstitution, DOMAIN_INSTITUTION } from "./institutions.js";

const V = "2022-06-28";
const API = "https://api.notion.com/v1";
const today = () => new Date().toISOString().slice(0, 10);
const headers = () => ({
  Authorization: `Bearer ${config.notionToken}`,
  "Notion-Version": V,
  "Content-Type": "application/json",
});

const title = (s) => ({ title: [{ text: { content: (s || "").slice(0, 1900) } }] });
const txt = (s) => ({ rich_text: s ? [{ text: { content: String(s).slice(0, 1900) } }] : [] });
const sel = (s) => ({ select: s ? { name: s } : null });
const urlp = (s) => ({ url: s || null });
const nump = (n) => ({ number: typeof n === "number" ? n : null });
const datep = (s) => ({ date: s ? { start: s } : null });

// 후보 1건 → Candidates DB 행 생성. 한국어는 fetch가 그대로 보냄(escape 없음 → 자모 안전).
export async function createCandidate(c) {
  if (!config.notionToken || !config.notionDbId) return false;
  const props = {
    "이름/제목": title(c.ko),
    "EN/romanization": txt(c.en),
    엔티티: sel(c.type),
    신뢰도: sel(c.confidence),
    처리: sel(c.sourceUrl ? "new" : "rework"),
    출처유형: sel(c.sourceType),
    근거: txt(geunggeo(c)),
    evidence: txt(`[${today()}] ${c.evidence || ""}`),
    proposed_id: txt(c.proposedId),
    dedup_key: txt(c.dedupKey),
    우선순위: nump(c.weight),
    "출처 URL": urlp(c.sourceUrl),
    run_date: datep(today()),
  };
  if (c.type === "person" && c.origin) props.origin = sel(c.origin);
  if (!c.sourceUrl) props["지시"] = txt(`[${today()}: 출처확인 필요] ${c.notes || ""}`);
  const r = await fetch(`${API}/pages`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ parent: { database_id: config.notionDbId }, properties: props }),
  });
  if (!r.ok) throw new Error(`notion create ${r.status}: ${(await r.text()).slice(0, 160)}`);
  return true;
}

// 이미 큐에 있는 dedup_key(노션 pending dedup, Phase 2). 모든 비-rejected/materialized 행.
export async function pendingKeys() {
  const rows = await queryFilter({ property: "dedup_key", rich_text: { is_not_empty: true } });
  return new Set(rows.map((r) => r.dedup_key).filter(Boolean));
}

// 처리=approved 행 → 평탄 dict 리스트
export async function queryApproved() {
  return queryFilter({ property: "처리", select: { equals: "approved" } });
}

// 검수 대상(new/rework) 행 전체 — reweight용.
export async function queryReviewable() {
  return queryFilter({
    or: [
      { property: "처리", select: { equals: "new" } },
      { property: "처리", select: { equals: "rework" } },
    ],
  });
}

const domainOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};

// 후보 행 → 정규화된 기관(장소). 도메인이 곧 1기관인 피더는 도메인맵, 애그리게이터(neolook)는
// 근거의 '@장소'를 파싱. 도메인 ≠ 기관(neolook 1도메인=N장소)이라 도메인 대신 이걸로 교차집계.
function rowInstitution(r) {
  const dom = domainOf(r["출처 URL"]);
  if (dom === "neolook.com") {
    const ev = `${r["근거"] || ""} ${r["evidence"] || ""}`;
    const m = ev.match(/@\s*([^|(\n]+?)(?:\s*[(|]|—|$)/);
    if (m && m[1].trim()) return normInstitution(m[1]);
  }
  if (DOMAIN_INSTITUTION[dom]) return DOMAIN_INSTITUTION[dom];
  return normInstitution(dom || "");
}

// 노션 후보 코퍼스 전체에서 dedup_key → 서로 다른 '기관'(정규화) 집합.
// 같은 작가가 여러 기관(경기·금호·백남준…)에 등장하면 교차 집계 → weight 상승(cross-institution).
export async function candidateMentionIndex() {
  const idx = new Map();
  const rows = await queryFilter({ property: "dedup_key", rich_text: { is_not_empty: true } });
  for (const r of rows) {
    const key = r.dedup_key;
    const inst = rowInstitution(r);
    if (!key || !inst) continue;
    if (!idx.has(key)) idx.set(key, new Set());
    idx.get(key).add(inst);
  }
  return idx;
}

// 우선순위(weight) 갱신.
export async function setWeight(pageId, weight) {
  if (!config.notionToken) return false;
  const r = await fetch(`${API}/pages/${pageId}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ properties: { 우선순위: { number: weight } } }),
  });
  return r.ok;
}

async function queryFilter(filter) {
  if (!config.notionToken || !config.notionDbId) return [];
  const out = [];
  let cursor;
  do {
    const body = { filter, page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const r = await fetch(`${API}/databases/${config.notionDbId}/query`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`notion query ${r.status}`);
    const d = await r.json();
    out.push(...d.results.map(flatten));
    cursor = d.has_more ? d.next_cursor : null;
  } while (cursor);
  return out;
}

function flatten(page) {
  const o = { _pageId: page.id };
  for (const [k, v] of Object.entries(page.properties || {})) {
    if (v.type === "title") o[k] = v.title?.[0]?.plain_text || "";
    else if (v.type === "rich_text") o[k] = (v.rich_text || []).map((t) => t.plain_text).join("");
    else if (v.type === "select") o[k] = v.select?.name || "";
    else if (v.type === "url") o[k] = v.url || "";
    else if (v.type === "number") o[k] = v.number;
    else if (v.type === "date") o[k] = v.date?.start || "";
  }
  return o;
}

export async function markMaterialized(pageId) {
  if (!config.notionToken) return false;
  const r = await fetch(`${API}/pages/${pageId}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ properties: { 처리: { select: { name: "materialized" } } } }),
  });
  return r.ok;
}
