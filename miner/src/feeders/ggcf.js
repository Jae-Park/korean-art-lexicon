// GOLD 피더 — 경기문화재단 미술기관(경기도미술관 gmoma, 백남준아트센터 njp). 동일 CMS.
// /exhibitions/{id} 상세 = 정적 HTML(curl 가능). og:title + 참여작가 + 기획(큐레이터) + 기간.
// 리스트가 JS load-more라 id 범위를 직접 열거(404/빈 페이지 skip). 상세 URL이 곧 기관 1차 출처.
import { nfc, dedupKey, proposedId, cleanName, guessOrigin } from "../normalize.js";

const SITES = {
  gmoma: { base: "https://gmoma.ggcf.kr", ko: "경기도미술관" },
  njp: { base: "https://njp.ggcf.kr", ko: "백남준아트센터" },
};
const UA = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
};

async function fetchDetail(base, id) {
  try {
    const r = await fetch(`${base}/exhibitions/${id}`, { headers: UA, signal: AbortSignal.timeout(15000) });
    return r.ok ? await r.text() : null;
  } catch {
    return null;
  }
}

const decode = (s) =>
  (s || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&lsquo;|&rsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&middot;/g, "·")
    .replace(/&hellip;/g, "…")
    .replace(/&mdash;|&ndash;/g, "-")
    .replace(/&nbsp;/g, " ")
    .replace(/&[a-z]+;/gi, ""); // 남은 명명 엔티티 제거

const plain = (html) =>
  decode(nfc(html || ""))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function ogTitle(html) {
  const m = html.match(/og:title"\s+content="([^"]+)"/) || html.match(/<title>([^<]+)<\/title>/);
  let t = m ? m[1] : "";
  t = t.replace(/\s*\|\s*(경기도미술관|백남준아트센터).*$/u, "").trim();
  t = t.replace(/^[《<〈]\s*|\s*[》>〉]$/gu, "").trim();
  return t;
}

const LABELS = "참여작가|기획|주최|주관|후원|기간|장소|관람|도슨트|작품|오프닝";
// "참여작가 …" → 다음 라벨 직전까지
function afterLabel(text, label) {
  const m = text.match(new RegExp(`${label}\\s+(.*?)\\s*(?:${LABELS})`, "u"));
  return m ? m[1].trim() : "";
}

// 참여작가/기획 필드 → 이름 리스트. 라벨이 설명문 앞에 붙은 경우(참여작가 필드 부재)는
// '프로즈 가드'로 통째 폐기 — 이름 형식(순수 한글 2~5자) 아닌 토큰이 많으면 설명문으로 간주.
function splitNames(s) {
  if (!s) return [];
  const toks = nfc(s)
    .split(/[,、·&]|\s및\s/)
    .map((x) => x.replace(/\s*(등|외)\s*[\d０-９]*\s*(여|명|인|점)*.*$/u, "").trim())
    .map((x) => x.replace(/\s*(학예연구사|학예사|큐레이터|작가|관장|감독|협력기획|협력|기획)$/u, "").trim())
    .filter(Boolean);
  const names = toks.filter((x) => /^[가-힣]{2,5}$/.test(x) && !/(미술관|갤러리|재단|위원회|센터|컬렉션)$/u.test(x));
  // 이름 형식 아닌 토큰이 2개 초과면 설명문 캡처로 보고 폐기(garbage 방지).
  if (toks.length - names.length > 2) return [];
  return names;
}

export async function fromGgcf({ site = "gmoma", fromId = 1, toId = 260 } = {}) {
  const s = SITES[site];
  if (!s) throw new Error(`unknown ggcf site: ${site} (gmoma|njp)`);
  const out = [];
  let hits = 0;
  for (let id = fromId; id <= toId; id++) {
    const html = await fetchDetail(s.base, id);
    if (!html) continue;
    const title = ogTitle(html);
    if (!title) continue;
    hits++;
    const url = `${s.base}/exhibitions/${id}`;
    const text = plain(html);
    const year = (text.match(/(19\d{2}|20\d{2})\s*[.\-~년]/) || [])[1] || "";
    out.push(mk("exhibition", title, url, `${s.ko} 전시 (${year})`, year, s.ko));
    for (const a of splitNames(afterLabel(text, "참여작가")))
      out.push(mk("person", cleanName(a), url, `${s.ko} '${title}' 참여작가 (${year})`, year, s.ko));
    const cur = splitNames(afterLabel(text, "기획"))[0];
    if (cur) out.push(mk("person", cleanName(cur), url, `${s.ko} '${title}' 기획/큐레이터 (${year})`, year, s.ko));
    await new Promise((r) => setTimeout(r, 250));
  }
  return out;
}

function mk(type, ko, url, evidence, year, instKo) {
  return {
    type,
    ko,
    en: "",
    origin: type === "person" ? guessOrigin(ko) : null,
    stream: "ggcf-gold",
    sourceUrl: url,
    sourceType: "institutional",
    confidence: "high",
    verified: true,
    verifyTier: "ggcf-gold",
    verifyNote: `${instKo} 기관 상세페이지 (1차 출처)`,
    evidence: nfc(evidence).trim().slice(0, 300),
    proposedId: proposedId(type, "", ko),
    dedupKey: dedupKey(type, ko, { year }),
    notes: `GOLD: ${instKo} 기관 크롤. 상세 URL이 1차 출처.`,
  };
}
