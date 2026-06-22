// 에디터 블랙리스트 — 어휘집에서 제외할 인물(미투 연루 등). 정본=miner/blacklist.json(gitignore, 비공개).
// 이름은 사용자(에디터)가 명시 지정한 것만. LLM이 추측으로 추가 금지(허위 연루 방지).
// 매칭: nfc + 공백제거 정규화. 피더 push 전·gate에서 필터.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { nfc } from "./normalize.js";

const BL_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "blacklist.json");
const norm = (s) => nfc(String(s || "")).replace(/\s+/g, "").toLowerCase();

let _set = null;
function load() {
  if (_set) return _set;
  _set = new Set();
  if (existsSync(BL_PATH)) {
    try {
      const j = JSON.parse(readFileSync(BL_PATH, "utf8"));
      for (const e of j.persons || []) if (e.name) _set.add(norm(e.name));
    } catch {}
  }
  return _set;
}

export function isBlacklisted(name) {
  if (!name) return false;
  return load().has(norm(name));
}

export function blacklistSize() {
  return load().size;
}
