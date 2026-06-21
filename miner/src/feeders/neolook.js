// 네오룩 보드 피더 — crawl/neolook_harvest.py가 만든 data-mirror/neolook/board.jsonl을 읽어 leads화.
// 네오룩 = 전시 보도자료 애그리게이터(press). 기관 1차(ggcf)보다 약한 출처라 verified=false/medium →
// 기본 weight 낮고, 풀·경기·백남준과 교차등장할 때만 mention 가중으로 상승(설계 의도: 노이즈는 가중치가 거름).
// 접근 한계: 보드(현재+예정)만 서버렌더 → forward-only. 과거 백필은 운영자 export 필요(디테일/연도 전부 0B 다운로드).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { nfc, dedupKey, proposedId, cleanName, guessOrigin } from "../normalize.js";
import { log } from "../../lib/log.js";

const MIRROR = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../data-mirror/neolook/board.jsonl");

export function fromNeolook({ mirrorPath } = {}) {
  const p = mirrorPath || MIRROR;
  if (!fs.existsSync(p)) {
    log(`neolook mirror 없음: ${p} — 먼저 crawl/neolook_harvest.py 실행`);
    return [];
  }
  const rows = fs
    .readFileSync(p, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try { return JSON.parse(l); } catch { return null; }
    })
    .filter(Boolean);

  const out = [];
  for (const e of rows) {
    if (e.kind !== "exhibition") continue;
    const year = (e.date || "").slice(0, 4);
    if (e.title_ko) out.push(mk("exhibition", e.title_ko, e.title_en, e, year, "전시"));
    if (e.artist_ko) out.push(mk("person", cleanName(e.artist_ko), e.artist_en, e, year, "개인전 작가"));
    if (e.venue_ko) out.push(mk("org", e.venue_ko, e.venue_en, e, year, "전시 장소"));
  }
  return out;
}

function mk(type, ko, en, e, year, role) {
  const evidence = `네오룩 '${e.title_ko}' @ ${e.venue_ko} (${e.date}) — ${role}`;
  const hanja = type === "person" && e.artist_hanja ? ` 한자:${e.artist_hanja}` : "";
  return {
    type,
    ko: nfc(ko),
    en: en || "",
    origin: type === "person" ? guessOrigin(ko) : null,
    stream: "neolook-board",
    sourceUrl: e.source_url,
    sourceType: "press",
    confidence: "medium",
    verified: false,
    verifyTier: "neolook-board",
    verifyNote: "네오룩 보드 리스팅(서버렌더 메타). 디테일은 이미지라 본문 없음 — 기관 1차 출처로 보강 필요.",
    evidence: nfc(evidence).trim().slice(0, 300),
    proposedId: proposedId(type, "", ko),
    dedupKey: dedupKey(type, ko, { year }),
    notes: `네오룩 보드 크롤(press).${hanja}`.trim(),
  };
}
