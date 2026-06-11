// Tier 1 — codex --search ($0, ChatGPT 구독). 미해결 후보의 실제 출처 URL을 라이브 웹서치로 찾는다.
// Source-First: codex가 실제로 연 URL만(프롬프트 강제). claude 크레딧 0. (codex --search = top-level 플래그)
import { spawn } from "node:child_process";

const TYPE_KO = {
  person: "인물(작가/큐레이터/비평가)",
  organization: "기관(미술관/갤러리/비엔날레/대학/단체)",
  exhibition: "전시",
  term: "용어",
  publication: "출판물",
};

export function codexFindUrl(cand, { timeoutMs = 110000 } = {}) {
  const t = TYPE_KO[cand.type] || cand.type;
  const prompt =
    `한국 미술 ${t} '${cand.ko}'${cand.en ? `(${cand.en})` : ""}을(를) **주제로 다루는** 실제 웹페이지 URL을 하나 찾아라.\n` +
    `중요: 그 대상이 단순 언급된 페이지(예: 고향 도시 항목)는 거부. 반드시 그 인물/기관 자체를 다루는 페이지.\n` +
    `우선순위: 기관 공식(미술관·갤러리·비엔날레·대학) 작가/소개 페이지 > 한국어 출처(ko.wikipedia.org 해당 항목, namu.wiki, 한국 언론) > 영문 언론(e-flux, artforum). 한국 작가는 한국어 출처 우선.\n` +
    `반드시 네가 실제로 연 URL만. 추측/날조 금지. 적합한 페이지 없으면 NONE.\n` +
    `출력: 마지막 줄에 정확히 "URL: <주소>" 또는 "URL: NONE". 다른 설명 최소화.`;
  return new Promise((resolve) => {
    const args = ["--search", "exec", "--skip-git-repo-check", "--sandbox", "read-only", "--color", "never", prompt];
    const proc = spawn("codex", args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      resolve({ url: null, reason: "timeout" });
    }, timeoutMs);
    proc.stdout.on("data", (d) => (out += d));
    proc.on("error", () => {
      clearTimeout(timer);
      resolve({ url: null, reason: "spawn-fail" });
    });
    proc.on("close", () => {
      clearTimeout(timer);
      const m = [...out.matchAll(/URL:\s*(\S+)/gi)].pop();
      const v = m && m[1];
      if (v && /^https?:\/\//.test(v)) return resolve({ url: clean(v), reason: "found" });
      if (/URL:\s*NONE/i.test(out)) return resolve({ url: null, reason: "none" });
      const u = [...out.matchAll(/https?:\/\/\S+/g)].pop(); // 폴백: 마지막 https URL
      resolve({ url: u ? clean(u[0]) : null, reason: u ? "fallback-url" : "unparsed" });
    });
  });
}

function clean(u) {
  return u.replace(/[.,)\]]+$/, "");
}
