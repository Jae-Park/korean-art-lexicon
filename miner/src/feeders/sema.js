// GOLD 피더 — 서울시립미술관 전시 OpenAPI (서울 열린데이터광장 OA-15323 국문 / OA-15324 영문).
// 두 경로: (A) 라이브 API ListExhibitionOfSeoulMOAInfo, (B) 사이트에서 받은 JSON 덤프 파일.
//   ※ openapi.seoul.go.kr:8088이 일부 망에서 unreachable → 파일 덤프(data.seoul.go.kr 제공)가 안전.
// 필드: DP_NAME(전시명) DP_SUBNAME(부제) DP_PLACE(장소) DP_START/DP_END(기간) DP_ARTIST(출품작가)
//       DP_EX_NO(detail exNo) DP_SEQ(전시일련번호=국영 매칭키) DP_LNK(링크).
// 기관 1차 공식 → verified=true/high(GOLD). 4관(서소문·북서울·남서울·난지) 전시+작가+백필.
import { readFileSync, existsSync } from "node:fs";
import { config } from "../config.js";
import { nfc, dedupKey, proposedId, cleanName } from "../normalize.js";
import { log } from "../../lib/log.js";

const HOST = "http://openapi.seoul.go.kr:8088";
const PAGE = 1000;
const UA = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15" };

async function fetchRange(service, start, end) {
  const u = `${HOST}/${config.seoulApiKey}/json/${service}/${start}/${end}/`; // 키 포함 — 로그 금지
  const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error(`http ${r.status}`);
  return (await r.json())[service] || {};
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

// 응답/덤프 어디에 있든 row 배열을 뽑는다. API=…/row, 파일덤프(서울 열린데이터광장)=DATA(필드 소문자).
function extractRows(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.DATA)) return parsed.DATA; // 파일 덤프
  if (Array.isArray(parsed?.row)) return parsed.row;
  for (const v of Object.values(parsed || {})) {
    if (v && Array.isArray(v.row)) return v.row;
    if (Array.isArray(v) && (v[0]?.DP_NAME || v[0]?.dp_name)) return v;
  }
  return [];
}

// 키 대문자화 — 덤프는 dp_name(소문자), API는 DP_NAME. rowToLeads는 DP_* 기준이라 통일.
const up = (r) => {
  const o = {};
  for (const k in r) o[k.toUpperCase()] = r[k];
  return o;
};

// 한 행 → leads. enRow(영문 동일 DP_SEQ)가 있으면 EN 병합(전시 제목 + 작가 수 같을 때 위치매칭).
export function rowToLeads(e, enRow = null) {
  const out = [];
  const ko = cleanName(nfc(e.DP_NAME || "").replace(/\s+/g, " "));
  const year = (e.DP_START || "").slice(0, 4);
  const venue = nfc(e.DP_PLACE || "");
  const url = e.DP_LNK || (e.DP_EX_NO ? `https://sema.seoul.go.kr/kr/whatson/exhibition/detail?exNo=${e.DP_EX_NO}` : "https://sema.seoul.go.kr");
  const sub = nfc(e.DP_SUBNAME || "");
  if (ko) out.push(mk("exhibition", ko, enRow ? nfc(enRow.DP_NAME || "") : "", url, `SeMA ${venue} / ${sub} / ${e.DP_START || ""}~${e.DP_END || ""}`, year));
  const koA = parseArtists(e.DP_ARTIST);
  const enA = enRow ? parseArtists(enRow.DP_ARTIST) : [];
  const paired = enA.length === koA.length; // 수 같을 때만 로마자 위치매칭(아니면 EN 비움)
  koA.forEach((name, i) => out.push(mk("person", name, paired ? enA[i] : "", url, `SeMA 전시 '${ko}' 출품작가 (${venue}, ${year})`, year)));
  return out;
}

// (B) 로컬 JSON 덤프 모드 — 사이트에서 받은 국문(+영문) 파일.
export function fromSemaFile({ file, fileEn } = {}) {
  if (!file || !existsSync(file)) {
    log(`SeMA 국문 파일 없음: ${file}`);
    return [];
  }
  const ko = extractRows(JSON.parse(readFileSync(file, "utf8"))).map(up);
  log(`SeMA 국문 덤프: ${ko.length}행`);
  let enMap = null;
  if (fileEn && existsSync(fileEn)) {
    const en = extractRows(JSON.parse(readFileSync(fileEn, "utf8"))).map(up);
    enMap = new Map(en.filter((r) => r.DP_EX_NO).map((r) => [String(r.DP_EX_NO), r]));
    log(`SeMA 영문 덤프: ${en.length}행 (dp_ex_no 매칭 → 로마자 병합)`);
  }
  const out = [];
  for (const e of ko) out.push(...rowToLeads(e, enMap?.get(String(e.DP_EX_NO)) || null));
  return out;
}

// (A) 라이브 API 모드 — :8088 닿는 망에서만.
export async function fromSema({ service = "ListExhibitionOfSeoulMOAInfo", max = 100000 } = {}) {
  if (!config.seoulApiKey) {
    log("SEOUL_API_KEY 미설정 → SeMA API skip");
    return [];
  }
  let first;
  try {
    first = await fetchRange(service, 1, PAGE);
  } catch (e) {
    log(`SeMA API 연결 실패: ${e.message} — :8088 안 닿으면 --file 덤프 모드 사용`);
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
      rows.push(...((await fetchRange(service, s, Math.min(s + PAGE - 1, total)))?.row || []));
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

function mk(type, ko, en, url, evidence, year) {
  const origin = type === "person" ? (/\s/.test(ko) ? "foreign" : "korean") : null;
  return {
    type,
    ko,
    en: en || "",
    origin,
    stream: "sema-gold",
    sourceUrl: url,
    sourceType: "institutional",
    confidence: "high",
    verified: true, // 출처가 SeMA 공식 데이터 → GOLD
    verifyTier: "sema-gold",
    verifyNote: "서울 열린데이터광장 SeMA 전시 데이터(OA-15323/15324, 기관 1차)",
    evidence: nfc(evidence).trim().slice(0, 300),
    proposedId: proposedId(type, en, ko),
    dedupKey: dedupKey(type, ko, { year }),
    institution: "서울시립미술관", // cross-institution mention 단위
    notes: "GOLD: SeMA 공식 데이터(서울 열린데이터광장).",
  };
}
