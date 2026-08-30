// 업로드/검수 순서 가중치. "기관 먼저, 인물은 주요 기관 언급 많을수록"(사용자 지침 2026-06-11).
// 검증품질(검증·신뢰도·출처)을 1차로, 타입가중을 2차로 합성 → 높을수록 먼저 검수(노션 우선순위 정렬).
import { readStyleRegistry } from "./config.js";
import { nfc, dedupKey, cleanName, looksLikeRole } from "./normalize.js";

// 각 엔티티가 style_registry의 몇 개 (서로 다른) 클라이언트=기관에 등장하나 → 명성/언급빈도 proxy.
export function buildMentionIndex() {
  const idx = new Map(); // dedupKey -> Set(client)
  const d = readStyleRegistry();
  const add = (type, ko, client) => {
    if (!ko) return;
    const k = dedupKey(type, ko);
    if (!idx.has(k)) idx.set(k, new Set());
    idx.get(k).add(client);
  };
  for (const [cname, c] of Object.entries(d.clients || {})) {
    const reg = c.registry || {};
    for (const on of reg.official_names || []) {
      const rk = nfc(on.ko);
      add(looksLikeRole(rk) ? "person" : "organization", cleanName(rk), cname);
    }
    for (const r of reg.romanization || []) add("person", cleanName(nfc(r.ko)), cname);
  }
  return idx;
}

const CONF = { high: 3, medium: 2, low: 1 };
const STYPE = { institutional: 3, bibliographic: 2, press: 1 };

export function computeWeight(c, mentionIdx) {
  let w = 0;
  if (c.verified) w += 4; // 페이지 검증된 것 먼저(빠른 승인)
  w += CONF[c.confidence] || 1;
  w += STYPE[c.sourceType] || 0;
  if (c.type === "organization" || c.origin === "korean") w += 1; // 한>영 / 기관
  if (c.type === "organization") {
    w += 2; // 기관 먼저
  } else {
    const mentions = mentionIdx.get(c.dedupKey)?.size || 1;
    w += Math.min(mentions, 3); // 인물: 주요 기관 언급 많을수록 (cap 3)
    c.instMentions = mentions; // 디버그/표시용
  }
  return w;
}
