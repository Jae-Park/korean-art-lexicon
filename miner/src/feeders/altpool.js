// GOLD 피더 — 대안공간 풀(altpool.org). 전체 사이트 미러 전수 추출을 단일 소스로 사용.
// scripts/scrape/altpool_extract_from_mirror.py 산출(extract_from_mirror.json):
//   exhibitions[{board_id, title_ko(깨끗), title_en, date, artists_ko(검증된 리스트), source_url}] + romanization{ko:en}
// 상세 view.asp URL = 풀 기관 1차 출처(GOLD) → verified:true. http 전용. 1회 백필.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { nfc, dedupKey, proposedId, guessOrigin } from "../normalize.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const EXTRACT_PATH = process.env.ALTPOOL_EXTRACT || join(REPO_ROOT, "crawl-archive/altpool/extract_from_mirror.json");
const DATA = (() => {
  try {
    return existsSync(EXTRACT_PATH) ? JSON.parse(readFileSync(EXTRACT_PATH, "utf8")) : {};
  } catch {
    return {};
  }
})();
const ROMAN = DATA.romanization || {}; // 한글명 → 로마자(풀 영문판 공식, GOLD)

const ORG_KO = "대안공간 풀";
const ORG_EN = "Art Space Pool"; // 현재 영문명. ~2010 'Alternative Space Pool'에서 개칭(Wayback 확정).
const ORG_SRC = "http://www.altpool.org/_v3/en/about/mission.asp";
// 단체/콜렉티브 의심 어미 — 제외 않고 flag(검수자가 person/org 유형 확정).
const GROUP_WORDS = /(형제|콜렉티브|컬렉티브|콜로니|그룹|팀|프로젝트|컴퍼니|듀오)$/u;

function yearOf(date) {
  const m = (date || "").match(/\b(?:19|20)\d\d\b/);
  return m ? m[0] : "";
}

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
    verified: true, // 상세 URL = 풀 기관 1차 페이지 → GOLD
    verifyTier: "altpool-gold",
    verifyNote: "altpool.org 전시 상세(기관 1차)",
    evidence: nfc(evidence).trim().slice(0, 300),
    proposedId: proposedId(type, en, ko),
    dedupKey: dedupKey(type, ko, { year }),
    notes: extraNotes || "GOLD: 대안공간 풀 아카이브. 상세 URL이 1차 출처.",
  };
}

export function fromAltpool() {
  const exhibitions = DATA.exhibitions || [];
  const out = [];

  // 기관 1건. 영문명은 ~2010 시기적 개칭(Alternative Space Pool → Art Space Pool, Wayback 확정).
  out.push(mk("organization", ORG_KO, ORG_EN, ORG_SRC,
    "대안공간 풀 — 1999년 설립 한국 대표 대안공간(서울 종로). 영문 자기규정 시기전환: 1999~2009경 'Alternative Space Pool', 2010경부터 'Art Space Pool'(Wayback altpool.org 2009.10 alternative→2010.12 art). 뉴욕 New Museum 'Museum as Hub'(2013) 'art space pool, Seoul'.", "",
    "GOLD: 대안공간 풀 기관. 영문명 ~2010 개칭(변이 아님). 출처: Wayback 스냅샷(2009/2010, dated) + altpool en/about + New Museum archive(archive.newmuseum.org/exhibitions/1691)."));

  const seenArtist = new Set();
  for (const e of exhibitions) {
    const title = nfc(e.title_ko || "");
    if (!title) continue;
    const year = yearOf(e.date);
    const arts = e.artists_ko || [];
    const ev = `대안공간 풀 / ${e.date || ""} / 작가 ${arts.slice(0, 6).join(", ") || "-"}${arts.length > 6 ? " 외" : ""}`;
    const exEn = nfc(e.title_en || "");
    out.push(mk("exhibition", title, exEn, e.source_url, ev, year,
      exEn ? "EN: 풀 영문판 공식 제목(기관 GOLD)" : undefined));

    for (const name of arts) {
      const nm = nfc(name);
      if (!nm || nm.length < 2 || nm.length > 20 || seenArtist.has(nm)) continue;
      seenArtist.add(nm);
      const roman = ROMAN[nm] || ""; // 풀 영문판 공식 로마자
      const grp = GROUP_WORDS.test(nm);
      const note = roman
        ? "GOLD: 대안공간 풀. EN=풀 영문판 공식 로마자."
        : (grp ? "GOLD: 대안공간 풀. 단체/콜렉티브 가능 — 유형(person/org) 검수 확인." : undefined);
      out.push(mk("person", nm, roman, e.source_url,
        `대안공간 풀 전시 '${title}' 참여작가 (${year})`, year, note));
    }
  }
  return out;
}
