// 번역 DB 피더 (SILVER 스트림). style_registry.json의 official_names(→organization) +
// romanization(→person) → 후보 lead. 각자 박재용 확정 표기 + authority + provenance(note).
// 이건 "무엇을 웹 교차검증할지"의 고품질 시드 — sourceUrl은 verify 단계에서 채운다.
// origin: 한국인=KO 정본·EN 로마자(우선) / 외국인=원어 정본·KO 음역(포함, 우선순위 낮음).
import { readFileSync, existsSync } from "node:fs";
import { config } from "../config.js";
import { nfc, dedupKey, proposedId, cleanName, looksLikeRole, guessOrigin } from "../normalize.js";

export function fromStyleRegistry({ clients } = {}) {
  if (!existsSync(config.styleRegistry)) return [];
  const d = JSON.parse(readFileSync(config.styleRegistry, "utf8"));
  const cl = d.clients || {};
  const out = [];
  for (const [cname, c] of Object.entries(cl)) {
    if (clients && !clients.includes(cname)) continue;
    const reg = c.registry || {};
    for (const on of reg.official_names || []) {
      const rawKo = nfc(on.ko);
      if (!rawKo) continue;
      // 역할 주석(관장/대표 등)이 붙은 official_names는 기관이 아니라 사람 → 재분류.
      const type = looksLikeRole(rawKo) ? "person" : "organization";
      out.push(mk(type, cleanName(rawKo), nfc(on.en), cname, on));
    }
    for (const r of reg.romanization || []) {
      const rawKo = nfc(r.ko);
      if (!rawKo) continue;
      out.push(mk("person", cleanName(rawKo), nfc(r.name || r.en), cname, r));
    }
  }
  return out;
}

function mk(type, ko, en, client, rec) {
  const origin = type === "person" ? guessOrigin(ko) : null;
  const confidence = rec.authority === "source-confirmed" ? "medium" : "low";
  // 우선순위(정렬·배치 선별): medium 신뢰도 +2, 한국 작가(한>영) 또는 비인물 +1. 외국 음역은 낮게.
  const priority = (confidence === "medium" ? 2 : 0) + (origin === "foreign" ? 0 : 1);
  return {
    type,
    ko,
    en,
    origin,
    stream: "translation-db",
    sourceUrl: null, // 웹 교차검증 단계에서 채움
    sourceType: "bibliographic",
    confidence,
    priority,
    authority: rec.authority || "translator-decided",
    evidence: `${client} / ${rec.scope || ""} / ${rec.note || ""}`.trim().slice(0, 300),
    proposedId: proposedId(type, en, ko),
    dedupKey: dedupKey(type, ko),
    notes: `번역 DB(style_registry, client=${client}); 박재용 확정 표기. 웹 교차검증 필요.`,
  };
}
