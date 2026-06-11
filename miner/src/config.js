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
  minerModel: process.env.MINER_MODEL || "",
  allowAnthropicApi: process.env.ALLOW_ANTHROPIC_API === "1",
  archiveExtractPy:
    process.env.ARCHIVE_EXTRACT_PY ||
    join(homedir(), ".claude", "scripts", "archive_alayer_extract.py"),
  styleRegistry: join(
    homedir(),
    "Documents/Apps_Obsidian/500 Translation/510 Terminology/style_registry.json"
  ),
};

// miner는 구독 claude -p / codex만 쓴다. API 키 경로 차단(bot-fleet 표준 가드).
export function assertNoApiKey() {
  if (process.env.ANTHROPIC_API_KEY && !config.allowAnthropicApi) {
    throw new Error(
      "API 종량 경로 차단: ANTHROPIC_API_KEY 감지. miner는 구독 claude -p / codex만 허용. 의도적이면 ALLOW_ANTHROPIC_API=1."
    );
  }
}
