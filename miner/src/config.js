// 설정 로더. .env를 수동 파싱(노드 --env-file 플래그 버전 의존 안 함), 경로 도출, API 가드.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { homedir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MINER_ROOT = resolve(__dirname, "..");   // miner/
const REPO_ROOT = resolve(MINER_ROOT, "..");   // korean-art-lexicon/

// .env 수동 로드 (이미 process.env에 있으면 덮지 않음 → launchd/셸 주입 우선)
(function loadEnv() {
  const p = join(MINER_ROOT, ".env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const [, k, v] = m;
    if (process.env[k] === undefined) process.env[k] = v.replace(/^["']|["']$/g, "");
  }
})();

export const config = {
  repoRoot: REPO_ROOT,
  minerRoot: MINER_ROOT,
  lexiconJson: join(REPO_ROOT, "dist", "lexicon.json"),
  stagingDir: join(REPO_ROOT, "staging"),
  reportsDir: join(REPO_ROOT, "reports", "miner"),
  sourcesYaml: join(REPO_ROOT, "specs", "sources.yaml"),
  notionToken: process.env.NOTION_TOKEN || "",
  notionDbId: process.env.NOTION_CANDIDATES_DB_ID || "",
  seoulApiKey: process.env.SEOUL_API_KEY || "", // 서울 열린데이터광장 인증키(SeMA 전시 OpenAPI)
  minerModel: process.env.MINER_MODEL || "",
  allowAnthropicApi: process.env.ALLOW_ANTHROPIC_API === "1",
  archiveExtractPy:
    process.env.ARCHIVE_EXTRACT_PY ||
    join(homedir(), ".claude", "scripts", "archive_alayer_extract.py"),
  styleRegistry: join(
    homedir(),
    "Vaults/Apps_Obsidian/500 Translation/510 Terminology/style_registry.json"
  ),
};

// style_registry는 SILVER 스트림과 weight 인덱스의 *필수* 입력이다. 없으면 조용히 빈손으로
// 도는 대신 즉시 죽는다 → 최상위 run().catch가 exit 1로 끝내고 launchd 워치독이 잡는다.
// 왜: 2026-08-30 볼트 이관(~/Documents → ~/Vaults)으로 이 경로가 깨졌는데 두 호출부가
// existsSync 실패를 빈 배열/빈 맵으로 삼켜 exit 0으로 끝났다. SILVER 리드가 11주 연속
// 278에서 0으로 떨어졌는데 로그 한 줄 말고는 아무한테도 안 닿았다.
export function readStyleRegistry() {
  if (!existsSync(config.styleRegistry)) {
    throw new Error(
      `style_registry.json 없음: ${config.styleRegistry}\n` +
        "볼트 경로가 바뀌었을 수 있다(2026-08-30 ~/Documents → ~/Vaults 이관). " +
        "miner/src/config.js의 styleRegistry를 갱신할 것."
    );
  }
  return JSON.parse(readFileSync(config.styleRegistry, "utf8"));
}

// miner는 구독 claude -p / codex만 쓴다. API 키 경로 차단(bot-fleet 표준 가드).
export function assertNoApiKey() {
  if (process.env.ANTHROPIC_API_KEY && !config.allowAnthropicApi) {
    throw new Error(
      "API 종량 경로 차단: ANTHROPIC_API_KEY 감지. miner는 구독 claude -p / codex만 허용. 의도적이면 ALLOW_ANTHROPIC_API=1."
    );
  }
}
