// GOLD 피더 — MMCA 전시 AjaxExhibitionList.do (JSON API, JS렌더 우회, $0).
// 전시 → exhibition 후보, exhArtist(참여작가) → person 후보. 각자 기관 상세 URL이 곧 GOLD 1차 출처.
// MMCA 자체 API에서 나왔으니 출처 검증 불필요(verified=true, high) — 그래서 GOLD.
import { nfc, dedupKey, proposedId, cleanName } from "../normalize.js";

const BASE = "https://www.mmca.go.kr";
const UA = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15" };

async function fetchPage(pageNo) {
  const u = `${BASE}/exhibitions/AjaxExhibitionList.do?currentPageNo=${pageNo}`;
  try {
    const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(15000) });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

// "이중섭, 김환기 등 100여명" → ["이중섭","김환기"]. 등/외 N명 꼬리·기관·숫자 제거.
function parseArtists(s) {
  if (!s) return [];
  return nfc(s)
    .split(/[,、·]/)
    .map((x) => x.replace(/\s*(등|외)\s*[\d０-９]*\s*(여|명|인|점)*.*$/u, "").trim())
    .filter((x) => x && !/^[\d]/.test(x) && x.length >= 2 && x.length <= 20)
    .filter((x) => !/(미술관|갤러리|재단|위원회|센터|컬렉션|단|팀)$/u.test(x))
    .filter((x) => !/^(외|등|기타|미정|등등)$/u.test(x));
}

export async function fromMMCA({ pages = 2 } = {}) {
  const out = [];
  for (let p = 1; p <= pages; p++) {
    const d = await fetchPage(p);
    for (const e of d?.exhibitionsList || []) {
      const url = `${BASE}/exhibitions/exhibitionsDetail.do?exhId=${e.exhId}`;
      const ko = cleanName(nfc(e.exhTitle).replace(/\s+/g, " "));
      const year = (e.exhStDt || "").slice(0, 4);
      const venue = nfc(e.exhPlaNm || "");
      if (ko) {
        out.push(mk("exhibition", ko, "", url, `MMCA ${venue} / ${nfc(e.exhTpCd || "")} / ${e.exhStDt || ""}~${e.exhEdDt || ""}`, year));
      }
      for (const name of parseArtists(e.exhArtist)) {
        out.push(mk("person", name, "", url, `MMCA 전시 '${ko}' 참여작가 (${venue}, ${year})`));
      }
    }
    await new Promise((s) => setTimeout(s, 300));
  }
  return out;
}

function mk(type, ko, en, url, evidence, year) {
  const origin = type === "person" ? (/\s/.test(ko) ? "foreign" : "korean") : null;
  return {
    type,
    ko,
    en,
    origin,
    stream: "mmca-gold",
    sourceUrl: url,
    sourceType: "institutional",
    confidence: "high", // 기관 1차 출처
    verified: true, // 출처가 MMCA 자체 API → 검증 불필요(GOLD)
    verifyTier: "mmca-gold",
    verifyNote: "MMCA AjaxExhibitionList.do (기관 1차 API)",
    evidence: nfc(evidence).trim().slice(0, 300),
    proposedId: proposedId(type, en, ko),
    dedupKey: dedupKey(type, ko, { year }),
    notes: "GOLD: MMCA 기관 크롤. 상세 URL이 1차 출처.",
  };
}
