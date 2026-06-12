// harvest — 노션 처리=approved → materialize → staging → validate → (--push) promote+PR.
// 사람 승인(approved)이 게이트. data/ 자동쓰기 없음(staging까지; promote+PR은 --push + 사람 최종확인).
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { config } from "./config.js";
import { queryApproved, markMaterialized } from "./notion.js";
import { log } from "../lib/log.js";

// 리포 스크립트는 yaml 필요 → 전용 venv. (시스템 python엔 PyYAML 없음 — PEP668)
const VENV = process.env.LEXICON_VENV || join(homedir(), ".venvs/lexicon/bin/python");

export async function harvest({ push = false } = {}) {
  const rows = await queryApproved();
  log(`approved 후보: ${rows.length}`);
  if (!rows.length) {
    log("승인 행 없음 — 노션에서 처리=approved 로 바꾼 뒤 재실행.");
    return;
  }
  const tmp = "/tmp/lexicon_approved.json";
  writeFileSync(tmp, JSON.stringify(rows), "utf8");

  const mat = JSON.parse(execFileSync(VENV, [join(config.repoRoot, "scripts/materialize.py"), tmp], { encoding: "utf8" }));
  log(`materialize: ${mat.materialized.length} → staging / ${mat.skipped.length} skip`);
  for (const s of mat.skipped) log(`  skip ${s["이름"]}: ${s["사유"]}`);

  let valOut = "";
  let valPassed = true;
  try {
    valOut = execFileSync(VENV, [join(config.repoRoot, "scripts/validate_auto.py"), "staging/", "--no-url-check"], {
      cwd: config.repoRoot,
      encoding: "utf8",
    });
  } catch (e) {
    valOut = (e.stdout || "") + (e.stderr || ""); // validate 비-0 종료 = 검증 실패(루트URL/404/스키마 등)
    valPassed = false;
  }
  log("validate_auto:\n" + valOut.trim());

  if (!valPassed) {
    log("⚠️ 검증 실패 — 위 FAIL 항목의 출처를 노션에서 상세 URL로 고치거나(처리=rework) 승인 취소 후 재harvest. promote/PR 중단(잘못된 엔트리 승격 방지).");
    return;
  }

  if (!push) {
    log("dry-run: staging 작성 + 검증 통과. data/ 자동쓰기 없음. --push 로 promote+PR(사람 최종확인).");
    return;
  }

  // promote: staging → data/(status:reviewed) + dist 재빌드
  const prom = JSON.parse(execFileSync(VENV, [join(config.repoRoot, "scripts/promote.py")], { cwd: config.repoRoot, encoding: "utf8" }));
  log(`promote: ${prom.moved.length} → data/ (build rc=${prom.build_rc})`);
  if (prom.build_rc !== 0) {
    log("build 실패 — PR 중단.");
    return;
  }

  // 한자 enrichment (Phase1 자동, 고신뢰·검색0): 한국 인물 중 encykorea 출처 보유분의
  // name.ko.hanja를 그 페이지에서 추출. 기억 아닌 출처 기반(Source-First). 실패해도 harvest 진행.
  // Phase2(검색)는 별도 수동: scripts/enrich_hanja.py --search --apply --accessed YYYY-MM-DD
  try {
    const hj = execFileSync(VENV, [join(config.repoRoot, "scripts/enrich_hanja.py"), "--apply"], { cwd: config.repoRoot, encoding: "utf8" });
    log("enrich_hanja(Phase1):\n" + hj.trim().split("\n").slice(-4).join("\n"));
  } catch (e) {
    log("enrich_hanja 건너뜀(harvest 계속): " + (((e.stdout || "") + (e.stderr || "")).slice(-160)));
  }

  // git 브랜치 + 커밋(데이터만, pathspec) + push + gh PR — 거버넌스=PR 게이트(자동 merge 없음)
  const day = new Date().toISOString().slice(0, 10);
  const stamp = new Date().toISOString().slice(11, 16).replace(":", ""); // HHMM — 같은 날 재실행 충돌 방지
  const branch = `miner/harvest-${day}-${stamp}`;
  const git = (a) => execFileSync("git", a, { cwd: config.repoRoot, encoding: "utf8" });
  const names = prom.moved.map((p) => p.split("/").pop().replace(".yaml", "")).join(", ");
  git(["checkout", "-b", branch]);
  git(["add", "data/", "dist/"]);
  git(["commit", "-m",
    `harvest: ${prom.moved.length}개 엔트리 승격 (${day})\n\n` +
    `노션 Lexicon Candidates 승인분 → materialize → 검증 → data/. ${names}\n\n` +
    `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`]);
  git(["push", "-u", "origin", branch]);
  const body =
    `노션 Lexicon Candidates DB에서 처리=approved 행을 materialize→validate→promote한 결과.\n\n` +
    `- 엔트리 ${prom.moved.length}개 (status: reviewed)\n` +
    `- 출처: 전부 기관/문헌 1차 URL (Source-First)\n` +
    `- skip(검수 필요): ${mat.skipped.length}\n\n` +
    `🤖 Generated with [Claude Code](https://claude.com/claude-code)`;
  const pr = execFileSync("gh", ["pr", "create", "--title", `harvest: ${prom.moved.length} entries (${day})`, "--body", body], { cwd: config.repoRoot, encoding: "utf8" });
  log("PR: " + pr.trim());

  // 노션 행 처리=materialized flip (drift 방지)
  for (const r of rows) {
    try {
      await markMaterialized(r._pageId);
    } catch (e) {
      log(`materialized flip 실패: ${e.message}`);
    }
  }
}
