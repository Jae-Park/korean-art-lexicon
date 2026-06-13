// GOLD 피더 — 대안공간 풀(altpool.org) 전시 아카이브.
// scripts/scrape/altpool.py가 뽑은 JSON을 읽어 exhibition/person/org 후보로 매핑.
// 상세 view.asp URL이 곧 풀 기관 1차 출처(GOLD) → verified:true. http 전용 사이트라 출처도 http.
// 1회 백필 용도(정기 피더 아님): mine --source altpool 로 노션 후보 push → 사람 검수.
import { readFileSync } from "node:fs";
import { nfc, dedupKey, proposedId, cleanName, guessOrigin } from "../normalize.js";

const DEFAULT_JSON = process.env.ALTPOOL_JSON || "/tmp/altpool_full.json";
const ORG_KO = "대안공간 풀";
const ORG_EN = "Art Space Pool"; // 본문 표기(현재). 영문판 site title은 "Alternative Space Pool" — 둘 다 병용(변이).
const ORG_SRC = "http://www.altpool.org/_v3/en/about/mission.asp"; // 본문 'Art Space Pool' + <title> 'alternative space pool' 동시 출처

// 정리 후에도 다중인명(괄호/협업X·×/슬래시)이면 단일 인명 아님 → person 후보 제외(전시 evidence엔 남음).
function isMultiName(name) {
  return /[(){}\[\]]|\sx\s|\sX\s|×|\//.test(name);
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

  // 기관 1건. 영문명 변천(Alternative Space Pool ↔ Art Space Pool) 둘 다 풀 영문판 자체 출처.
  out.push(mk("organization", ORG_KO, ORG_EN, ORG_SRC,
    "대안공간 풀 — 1999년 설립 한국 대표 대안공간(서울 종로). 영문명 'Art Space Pool'(본문)과 'Alternative Space Pool'(영문판 site title) 병용.", "",
    "GOLD: 대안공간 풀 기관. 영문명 변이 Alternative Space Pool / Art Space Pool(출처: en/about). 검수 시 name.variants로 둘 다 보존."));

  for (const r of recs) {
    const title = nfc(r.title_ko || r.archive_title || "");
    if (!title) continue;
    const year =
      (r.date_start || "").slice(0, 4) ||
      ((r.archive_title || "").match(/\b(?:19|20)\d\d\b/) || [])[0] ||
      "";
    const dateNote = r.date_warning
      ? `${r.date_text_original}(원문 날짜 모순-확인요)`
      : r.date_text_original || "";
    const ev = `대안공간 풀 / ${dateNote} / 기획 ${(r.curators || []).join(", ") || "-"}`;
    // 병기형 제목(《… ENGLISH》)의 EN을 en 칸에 표면화(미확정 — 검수자가 공식 EN 확정). 없으면 빈칸(한국어 전용=정상).
    const exEn = r.en_candidate || "";
    const exNote = exEn ? `EN 병기(미확정, 검수 확인 요): ${exEn}` : undefined;
    out.push(mk("exhibition", title, exEn, r.source_url, ev, year, exNote));

    // 참여작가 → person. 끝 괄호(멤버 병기) 제거 후: 다중인명이면 제외, 단체어면 flag해서 포함.
    for (const a of r.artists || []) {
      const name = cleanName(a); // "팽창콜로니 ( 김주원 X 이은새 )" → "팽창콜로니"
      if (!name || name.length < 2 || name.length > 20) continue;
      if (isMultiName(name)) continue; // 정리 후에도 다중인명이면 보류
      const grp = GROUP_WORDS.test(name);
      out.push(mk("person", name, "", r.source_url,
        `대안공간 풀 전시 '${title}' 참여작가 (${year})`, year,
        grp ? "GOLD: 대안공간 풀. 단체/콜렉티브 가능 — 유형(person/org) 검수 확인." : undefined));
    }
  }
  return out;
}
