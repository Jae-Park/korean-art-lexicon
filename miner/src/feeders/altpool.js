// GOLD 피더 — 대안공간 풀(altpool.org) 전시 아카이브.
// scripts/scrape/altpool.py가 뽑은 JSON을 읽어 exhibition/person/org 후보로 매핑.
// 상세 view.asp URL이 곧 풀 기관 1차 출처(GOLD) → verified:true. http 전용 사이트라 출처도 http.
// 1회 백필 용도(정기 피더 아님): mine --source altpool 로 노션 후보 push → 사람 검수.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { nfc, dedupKey, proposedId, cleanName, guessOrigin } from "../normalize.js";

const DEFAULT_JSON = process.env.ALTPOOL_JSON || "/tmp/altpool_full.json";
// 풀 영문판에서 추출한 작가 로마자 + 전시 영문명 맵(기관 GOLD). altpool_en_romanize.py 산출. 없으면 빈 맵.
// feeders→src→miner→repoRoot. CWD 무관 절대경로.
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const EN_MAP_PATH = process.env.ALTPOOL_EN_MAP || join(REPO_ROOT, "crawl-archive/altpool/en_romanization_20260613.json");
const EN_MAP = (() => {
  try {
    return existsSync(EN_MAP_PATH) ? JSON.parse(readFileSync(EN_MAP_PATH, "utf8")) : {};
  } catch {
    return {};
  }
})();
const ROMAN = EN_MAP.romanization || {};   // 한글명 → {en, source}
const TITLE_EN = EN_MAP.title_en || {};    // 전시 title_ko → en
const ORG_KO = "대안공간 풀";
const ORG_EN = "Art Space Pool"; // 본문 표기(현재). 영문판 site title은 "Alternative Space Pool" — 둘 다 병용(변이).
const ORG_SRC = "http://www.altpool.org/_v3/en/about/mission.asp"; // 본문 'Art Space Pool' + <title> 'alternative space pool' 동시 출처

// 깨끗한 전시 제목: ○전시명(title_ko) 우선, 없으면 archive_title 《》에서 도출(옛 페이지는 ○전시명 부재
// → "2015 풀 프로덕션 《제목》" 형태만 있음). '작가 : 제목'(솔로)이면 제목만. en-extractor와 동일 규칙.
function cleanExhTitle(r) {
  const tk = nfc(r.title_ko || "");
  if (tk) return tk;
  const m = (r.archive_title || "").match(/[《≪](.+?)[》≫]/);
  let inner = m ? m[1].trim() : nfc(r.archive_title || "");
  if (inner.includes(" : ")) inner = inner.split(" : ").slice(1).join(" : ").trim(); // 작가:제목 → 제목
  return nfc(inner);
}

// 작가 한 칸을 개별 이름으로 분리. 한국어 명단은 쉼표·가운뎃점(ㆍ·∙•)·슬래시·세미콜론·및/와/과로
// 섞여 구분되고, 공백으로만 나열되기도 함("강동주 이미래 장서영"=세 사람). 단일명에 공백이 끼기도 함("김 보민"=김보민).
function splitArtistCell(cell) {
  const parts = String(cell)
    .split(/[,，、ㆍ·∙•/／;；]|\s+및\s+|\s+와\s+|\s+과\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out = [];
  for (const p of parts) {
    const toks = p.split(/\s+/);
    if (toks.length >= 3 && toks.every((t) => /^[가-힣]{2,4}$/.test(t))) {
      out.push(...toks); // 한글명 3+ 공백나열 = 리스트 → 분리
    } else if (toks.length === 2 && /^[가-힣]$/.test(toks[0]) && /^[가-힣]{2,3}$/.test(toks[1])) {
      out.push(toks.join("")); // 1음절 성 + 이름 = 공백 끼인 단일명 → 병합("김 보민"→"김보민")
    } else {
      out.push(p); // 2토큰 외국명(할릴 알틴데레)·단체명은 그대로
    }
  }
  return out;
}
// 정리 후에도 다중인명(괄호/협업X·×/슬래시)이면 단일 인명 아님 → person 후보 제외(전시 evidence엔 남음).
function isMultiName(name) {
  return /[(){}\[\]]|\sx\s|\sX\s|×|\//.test(name);
}
// 숫자/라틴-only = 작가명 아님(잡음, 예: '25hr sailing') → 제외.
function isJunkName(name) {
  return /\d/.test(name) || /^[A-Za-z0-9 .,'\-]+$/.test(name);
}
// 단체/콜렉티브 의심 어미 — 제외하진 않고 flag(검수자가 person/org 유형 확정).
const GROUP_WORDS = /(형제|콜렉티브|컬렉티브|콜로니|그룹|팀|프로젝트|컴퍼니|듀오)$/u;

function mk(type, ko, en, url, evidence, year, extraNotes) {
  return {
    type,
    ko: nfc(ko),
    en: nfc(en || ""),
    origin: type === "person" ? guessOrigin(ko) : null,
    stream: "altpool-gold",
    sourceUrl: url,
    sourceType: "institutional",
    confidence: "high",
    verified: true, // 상세 URL = 풀 기관 1차 페이지 → GOLD(웹검증 생략)
    verifyTier: "altpool-gold",
    verifyNote: "altpool.org 전시 상세(기관 1차)",
    evidence: nfc(evidence).trim().slice(0, 300),
    proposedId: proposedId(type, en, ko),
    dedupKey: dedupKey(type, ko, { year }),
    notes: extraNotes || "GOLD: 대안공간 풀 아카이브. 상세 URL이 1차 출처.",
  };
}

export function fromAltpool({ jsonPath = DEFAULT_JSON } = {}) {
  const recs = JSON.parse(readFileSync(jsonPath, "utf8"));
  const out = [];

  // 기관 1건. 영문명은 변이가 아니라 시기적 개칭(~2010): Alternative Space Pool → Art Space Pool.
  // Wayback 스냅샷이 시기별 dated 출처. (검수 시 name.en=Art Space Pool + variants[former: Alternative Space Pool, ~2009까지])
  out.push(mk("organization", ORG_KO, ORG_EN, ORG_SRC,
    "대안공간 풀 — 1999년 설립 한국 대표 대안공간(서울 종로). 영문 자기규정 시기전환: 1999~2009경 'Alternative Space Pool', 2010경부터 'Art Space Pool'(Wayback altpool.org 2009.10 alternative→2010.12 art). 뉴욕 New Museum 'Museum as Hub'(2013) 'art space pool, Seoul'.", "",
    "GOLD: 대안공간 풀 기관. 영문명 ~2010 개칭(변이 아님). 출처: Wayback 스냅샷(2009/2010, dated) + altpool en/about + New Museum archive(archive.newmuseum.org/exhibitions/1691)."));

  for (const r of recs) {
    const title = cleanExhTitle(r);
    if (!title) continue;
    const year =
      (r.date_start || "").slice(0, 4) ||
      ((r.archive_title || "").match(/\b(?:19|20)\d\d\b/) || [])[0] ||
      "";
    const dateNote = r.date_warning
      ? `${r.date_text_original}(원문 날짜 모순-확인요)`
      : r.date_text_original || "";
    const ev = `대안공간 풀 / ${dateNote} / 기획 ${(r.curators || []).join(", ") || "-"}`;
    // EN 제목: 영문판 매칭(기관 GOLD) 우선, 없으면 병기형 제목 파싱(미확정), 없으면 빈칸(한국어 전용 전시).
    const exEn = TITLE_EN[title] || r.en_candidate || "";
    const exNote = TITLE_EN[title]
      ? "EN: 풀 영문판 공식 제목(기관 GOLD)"
      : (exEn ? `EN 병기(미확정, 검수 확인 요): ${exEn}` : undefined);
    out.push(mk("exhibition", title, exEn, r.source_url, ev, year, exNote));

    // 참여작가 → person. 한 칸을 개별 이름으로 분리(다중구분자·공백리스트) 후 각각:
    // 잡음(숫자/라틴)·다중인명(괄호·X) 제외, 단체어는 flag해서 포함.
    const seenArtist = new Set();
    for (const cell of r.artists || []) {
      for (const raw of splitArtistCell(cell)) {
        const name = cleanName(raw); // "팽창콜로니 ( 김주원 X 이은새 )" → "팽창콜로니"
        if (!name || name.length < 2 || name.length > 20) continue;
        if (isMultiName(name) || isJunkName(name)) continue;
        if (seenArtist.has(name)) continue; // 같은 전시 내 중복
        seenArtist.add(name);
        const grp = GROUP_WORDS.test(name);
        const roman = ROMAN[name] ? ROMAN[name].en : ""; // 풀 영문판 공식 로마자(기관 GOLD)
        const note = roman
          ? "GOLD: 대안공간 풀. EN=풀 영문판 공식 로마자."
          : (grp ? "GOLD: 대안공간 풀. 단체/콜렉티브 가능 — 유형(person/org) 검수 확인." : undefined);
        out.push(mk("person", name, roman, r.source_url,
          `대안공간 풀 전시 '${title}' 참여작가 (${year})`, year, note));
      }
    }
  }
  return out;
}
