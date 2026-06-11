// 정규화 + dedup_key 생성. NFC + 유형별 정규 키. lexicon 비교와 노션 dedup 공용.
// 목적: 재실행/스트림 중복이 같은 후보를 두 번 만들지 않게 안정적 키를 만든다.
const LEGAL = /(주식회사|유한회사|재단법인|사단법인|\(재\)|\(사\)|재단법인|조직위원회)/g;

export function nfc(s) {
  return (s || "").normalize("NFC").trim();
}
function koCompact(s) {
  return nfc(s).replace(/\s+/g, "");
}
function koCompactNoPunct(s) {
  return nfc(s).replace(/[^0-9A-Za-z가-힣]/g, "");
}
function stripLegal(s) {
  return nfc(s).replace(LEGAL, "").replace(/\s+/g, "");
}

// 유형별 정규 dedup 키. KO를 앵커로(가장 안정적), 기관은 법인격 제거, 전시/출판은 연도 결합.
export function dedupKey(type, ko, { year } = {}) {
  const k = koCompact(ko);
  switch (type) {
    case "person":
      return `person|${k}`;
    case "organization":
      return `org|${stripLegal(ko)}`;
    case "term":
      return `term|${k}`;
    case "exhibition":
      return `exhibition|${koCompactNoPunct(ko)}|${year || ""}`;
    case "publication":
      return `publication|${koCompactNoPunct(ko)}|${year || ""}`;
    default:
      return `${type}|${k}`;
  }
}

// 괄호 주석(표기 잔재) 제거: "국립현대미술관 청주(관)" → "국립현대미술관 청주"
export function cleanName(s) {
  return nfc(s).replace(/\s*[(（][^)）]*[)）]\s*$/u, "").trim();
}

// 역할 주석(관장/대표/디렉터 등) = 기관이 아니라 사람 신호 → person으로 재분류.
const ROLE_RE = /[(（]\s*(관장|대표|디렉터|감독|큐레이터|위원장|이사장|작가)\s*[)）]/u;
export function looksLikeRole(s) {
  return ROLE_RE.test(nfc(s));
}

// 외국 인명 음역 추정: KO에 내부 공백이면 외국(한국 인명은 보통 붙여 씀). 보조 신호일 뿐, 사람검수가 확정.
export function guessOrigin(ko) {
  return /\s/.test(nfc(ko)) ? "foreign" : "korean";
}

export function slugify(s) {
  return nfc(s)
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const ID_PREFIX = {
  person: "person",
  organization: "org",
  exhibition: "exhibition",
  term: "term",
  publication: "publication",
};

// 후보 슬러그 id (검수 편의용 제안값 — 영문/로마자 우선, 없으면 KO).
export function proposedId(type, en, ko) {
  const base = slugify(en || "") || slugify(ko || "");
  return `${ID_PREFIX[type] || type}.${base || "unknown"}`;
}
