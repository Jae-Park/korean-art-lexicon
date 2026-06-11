// Tier 3 — claude -p WebSearch (구독, 모델 사다리 sonnet 바닥/opus 희소). codex도 못 잡은 어려운 잔여만.
// 다른 모델 패밀리라 codex가 놓친 걸 잡을 수 있음. Source-First: 실제 연 URL만(프롬프트 강제).
import { spawn } from "node:child_process";
import { config, assertNoApiKey } from "../config.js";

const TYPE_KO = {
  person: "인물(작가/큐레이터/비평가)",
  organization: "기관(미술관/갤러리/비엔날레/대학/단체)",
  exhibition: "전시",
  term: "용어",
  publication: "출판물",
};

export function claudeFindUrl(cand, { model, timeoutMs = 150000 } = {}) {
  assertNoApiKey(); // 구독 claude -p 만. API 키 경로 차단.
  const useModel = model || config.minerModel || "claude-sonnet-4-6";
  const t = TYPE_KO[cand.type] || cand.type;
  const prompt =
    `한국 미술 ${t} '${cand.ko}'${cand.en ? `(${cand.en})` : ""}을(를) **주제로 다루는** 실제 웹페이지 URL을 하나 찾아라.\n` +
    `단순 언급된 페이지(고향 도시 항목 등)는 거부 — 반드시 그 인물/기관 자체를 다루는 페이지.\n` +
    `우선순위: 기관 공식(미술관·갤러리·비엔날레·대학) 작가/소개 페이지 > 한국어 출처(ko.wikipedia.org 해당 항목, namu.wiki, 한국 언론) > 영문 언론.\n` +
    `반드시 실제로 연 URL만. 날조 금지. 적합한 페이지 없으면 NONE.\n` +
    `출력: 마지막 줄에 정확히 "URL: <주소>" 또는 "URL: NONE".`;
  return new Promise((resolve) => {
    const args = ["-p", "--output-format", "text", "--allowedTools", "WebSearch", "--model", useModel];
    const proc = spawn("claude", args, { stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      resolve({ url: null, reason: "timeout", model: useModel });
    }, timeoutMs);
    proc.stdout.on("data", (d) => (out += d));
    proc.on("error", () => {
      clearTimeout(timer);
      resolve({ url: null, reason: "spawn-fail", model: useModel });
    });
    proc.on("close", () => {
      clearTimeout(timer);
      const m = [...out.matchAll(/URL:\s*(\S+)/gi)].pop();
      const v = m && m[1];
      if (v && /^https?:\/\//.test(v)) return resolve({ url: v.replace(/[.,)\]]+$/, ""), reason: "found", model: useModel });
      if (/URL:\s*NONE/i.test(out)) return resolve({ url: null, reason: "none", model: useModel });
      const u = [...out.matchAll(/https?:\/\/\S+/g)].pop();
      resolve({ url: u ? u[0].replace(/[.,)\]]+$/, "") : null, reason: u ? "fallback-url" : "unparsed", model: useModel });
    });
    proc.stdin.write(prompt);
    proc.stdin.end();
  });
}
