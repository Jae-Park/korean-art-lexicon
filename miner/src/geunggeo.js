// 검증 근거 한 줄 — "왜 이 출처를 믿나"(검수 판단용). 본문에 묻힌 verify 정보를 컬럼으로 승격.
// evidence(번역DB provenance·로마자 노트)와 역할 구분: 근거=웹 검증, evidence=표기 출처.
const TIER = {
  wikidata: "Wikidata",
  codex: "codex",
  "claude-sonnet": "claude",
  "tier3-none": "미해결",
  "codex-none": "미해결",
  unresolved: "미해결",
  error: "오류",
};

function domain(u) {
  const m = /^https?:\/\/([^/]+)/.exec(u || "");
  return m ? m[1].replace(/^www\./, "") : "";
}

export function geunggeo(c) {
  if (c.verifyTier === "mmca-gold")
    return "MMCA 기관 API(AjaxExhibitionList) · 전시 제목/참여작가 직접 추출 · 기관 1차 출처(검증 불필요)";
  if (!c.sourceUrl) return "미해결: Wikidata/codex/claude 모두 출처 못 찾음. 수동 확인 필요.";
  const tier = TIER[c.verifyTier] || c.verifyTier;
  const note = c.verifyNote || "";
  let pm;
  if (c.verified) pm = "페이지서 이름 확인";
  else if (/dead/.test(note)) pm = "⚠️URL 404, 재확인 필요";
  else if (/no-match/.test(note)) pm = "⚠️페이지 표기 차이 확인 필요";
  else pm = "⚠️대조 보류(JS렌더 등), 출처 자체는 유효";
  const dom = domain(c.sourceUrl);
  const wd = c.wikidata ? ` ${c.wikidata}` : "";
  return `${tier} 검증${wd} · ${dom} · ${pm}`;
}
