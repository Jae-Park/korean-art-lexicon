// GOLD 피더 — 서울시립미술관 전시 OpenAPI (서울 열린데이터광장 OA-15323, ListExhibitionOfSeoulMOAInfo).
// 기관 1차 공식 API(JSON) → verified=true/high. 4관(서소문·북서울·남서울·난지) 전시 + 출품작가 + 백필.
// 필드: DP_NAME(전시명) DP_SUBNAME(부제) DP_PLACE(장소) DP_START/DP_END(기간) DP_ARTIST(출품작가)
//       DP_EX_NO(전시NO=detail exNo) DP_LNK(링크). 응답 = {SERVICE:{list_total_count, RESULT, row[]}}.
// 연결주의: openapi.seoul.go.kr:8088 — 일부 망에서 포트 차단. 닿는 망에서 실행해야 함.
import { config } from "../config.js";
import { nfc, dedupKey, proposedId, cleanName } from "../normalize.js";
import { log } from "../../lib/log.js";

const HOST = "http://openapi.seoul.go.kr:8088";
const PAGE = 1000; // API 1회 최대 1000건(ERROR-336)
const UA = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15" };

async function fetchRange(service, start, end) {
  const u = `${HOST}/${config.seoulApiKey}/json/${service}/${start}/${end}/`; // 키 포함 — 로그 금지
  const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error(`http ${r.status}`);
  const d = await r.json();
  return d[service] || {};
}

// "이우환, 김환기 / 외 12명" → ["이우환","김환기"]. 구분자 split + 등/외 N명·기관 꼬리 제거.
export function parseArtists(s) {
  if (!s) return [];
  return nfc(s)
    .split(/[,、·\/;]|\s및\s/)
    .map((x) => x.replace(/\s*(등|외)\s*[\d０-９]*\s*(여|명|인|점)*.*$/u, "").trim())
    .map((x) => x.replace(/\([^)]*\)/g, "").trim())
    .filter((x) => x && !/^[\d]/.test(x) && x.length >= 2 && x.length <= 20 && /[가-힣A-Za-z]/.test(x))
    .filter((x) => !/(미술관|갤러리|재단|위원회|센터|컬렉션|단|팀)$/u.test(x))
    .filter((x) => !/^(외|등|기타|미정|단체|그룹)$/u.test(x));
}

// 한 행 → leads(전시 + 출품작가). fetch 분리(테스트 용이).
export function rowToLeads(e) {
  const out = [];
  const ko = cleanName(nfc(e.DP_NAME || "").replace(/\s+/g, " "));
  const year = (e.DP_START || "").slice(0, 4);
  const venue = nfc(e.DP_PLACE || "");
  const url = e.DP_LNK || (e.DP_EX_NO ? `https://sema.seoul.go.kr/kr/whatson/exhibition/detail?exNo=${e.DP_EX_NO}` : "https://sema.seoul.go.kr");
  const sub = nfc(e.DP_SUBNAME || "");
  if (ko) out.push(mk("exhibition", ko, url, `SeMA ${venue} / ${sub} / ${e.DP_START || ""}~${e.DP_END || ""}`, year));
  for (const name of parseArtists(e.DP_ARTIST))
    out.push(mk("person", name, url, `SeMA 전시 '${ko}' 출품작가 (${venue}, ${year})`, year));
  return out;
}

export async function fromSema({ service = "ListExhibitionOfSeoulMOAInfo", max = 100000 } = {}) {
  if (!config.seoulApiKey) {
    log("SEOUL_API_KEY 미설정 → SeMA skip (.env에 SEOUL_API_KEY=)");
    return [];
  }
  let first;
  try {
    first = await fetchRange(service, 1, PAGE);
  } catch (e) {
    log(`SeMA API 연결 실패: ${e.message} — openapi.seoul.go.kr:8088 닿는 망에서 실행 필요`);
    return [];
  }
  const code = first?.RESULT?.CODE;
  if (code && code !== "INFO-000") {
    log(`SeMA API ${code}: ${first?.RESULT?.MESSAGE || ""}`);
    return [];
  }
  const total = Math.min(first?.list_total_count || 0, max);
  log(`SeMA 전시 총 ${first?.list_total_count || 0}건 (수집 ${total})`);
  const rows = [...(first?.row || [])];
  for (let s = PAGE + 1; s <= total; s += PAGE) {
    try {
      const b = await fetchRange(service, s, Math.min(s + PAGE - 1, total));
      rows.push(...(b?.row || []));
    } catch (e) {
      log(`SeMA page ${s} 실패: ${e.message}`);
      break;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  const out = [];
  for (const e of rows.slice(0, total)) out.push(...rowToLeads(e));
  return out;
}

function mk(type, ko, url, evidence, year) {
  const origin = type === "person" ? (/\s/.test(ko) ? "foreign" : "korean") : null;
  return {
    type,
    ko,
    en: "",
    origin,
    stream: "sema-gold",
    sourceUrl: url,
    sourceType: "institutional",
    confidence: "high",
    verified: true, // 출처가 SeMA 공식 OpenAPI → GOLD
    verifyTier: "sema-gold",
    verifyNote: "서울 열린데이터광장 SeMA 전시 OpenAPI (OA-15323, 기관 1차)",
    evidence: nfc(evidence).trim().slice(0, 300),
    proposedId: proposedId(type, "", ko),
    dedupKey: dedupKey(type, ko, { year }),
    institution: "서울시립미술관", // cross-institution mention 단위
    notes: "GOLD: SeMA 공식 OpenAPI 크롤.",
  };
}
