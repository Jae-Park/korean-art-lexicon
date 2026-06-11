// 영문 표기 웹검색 — codex --search($0)로 작가/기관이 "실제 쓰는" 영문명 + 그 출처를 찾는다.
// Source-First: Wikidata 라벨 같은 기계 표기 금지. 재단·미술관·갤러리가 페이지에서 실제 쓰는 형태 그대로.
import { spawn } from "node:child_process";

export function romanizeViaWeb(ko, { origin = "", timeoutMs = 175000 } = {}) {
  const hint =
    origin === "foreign"
      ? "이 한글 이름은 외국 인물의 음역일 수 있다. 그러면 원어 본명(Latin alphabet)을 찾아라."
      : "한국 인물이면 작가 본인·재단·기관이 실제 쓰는 공식 영문 로마자를 찾아라.";
  const prompt =
    `한국 미술 맥락의 인물 '${ko}'의 영문 표기를 실제 웹에서 찾아라. ${hint}\n` +
    `우선순위: ① 작가 본인/재단/유족 공식 페이지 ② 국립현대미술관(MMCA)·리움 등 미술관 영문 페이지 ③ 주요 갤러리/경매사(국제·현대·학고재·서울옥션 등) ④ 영문 위키/언론.\n` +
    `반드시 그 페이지가 실제로 쓰는 형태 그대로 적어라(이름 순서·하이픈·대소문자 포함). 기관마다 표기가 다르면 가장 권위있는 출처(재단>미술관>갤러리) 것을 채택.\n` +
    `반드시 네가 실제로 연 페이지 기준. 추측·기계적 로마자 변환·날조 금지. 그 인물 자체를 다루는 적합한 페이지 없으면 NONE.\n` +
    `출력 마지막 줄: 정확히 "NAME: <영문명> | SRC: <url>" 또는 "NAME: NONE".`;
  return new Promise((resolve) => {
    const args = ["--search", "exec", "--skip-git-repo-check", "--sandbox", "read-only", "--color", "never", prompt];
    const proc = spawn("codex", args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      resolve({ en: null, reason: "timeout" });
    }, timeoutMs);
    proc.stdout.on("data", (d) => (out += d));
    proc.on("error", () => {
      clearTimeout(timer);
      resolve({ en: null, reason: "spawn-fail" });
    });
    proc.on("close", () => {
      clearTimeout(timer);
      if (/NAME:\s*NONE/i.test(out)) return resolve({ en: null, reason: "none" });
      const m = [...out.matchAll(/NAME:\s*(.+?)\s*\|\s*SRC:\s*(\S+)/gi)].pop();
      if (m && /^https?:\/\//.test(m[2])) {
        const en = m[1].trim().replace(/^["'`]|["'`]$/g, "");
        if (en && en.length <= 60) return resolve({ en, src: m[2].replace(/[.,)\]]+$/, ""), reason: "found" });
      }
      resolve({ en: null, reason: "unparsed" });
    });
  });
}
