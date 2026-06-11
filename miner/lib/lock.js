// 단일 인스턴스 lockfile. launchd 스케줄 실행과 수동 실행이 겹치면 곤란하니 배타 생성.
// open(wx)로 배타 생성, stale(죽은 pid)이면 회수. (bot-fleet lib 기반.)
import { open, readFile } from "node:fs/promises";
import { unlinkSync } from "node:fs";

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM"; // 존재하나 권한 없음 = 살아있음
  }
}

export async function acquireLock(path) {
  try {
    const fh = await open(path, "wx"); // 이미 있으면 EEXIST
    await fh.write(String(process.pid));
    await fh.close();
  } catch (e) {
    if (e.code === "EEXIST") {
      let pid = 0;
      try {
        pid = Number((await readFile(path, "utf8")).trim());
      } catch {}
      if (pid && isAlive(pid)) {
        const err = new Error(`이미 실행 중 (pid ${pid}). lock=${path}`);
        err.code = "LOCKED";
        throw err;
      }
      try {
        unlinkSync(path); // stale lock 회수 후 재시도
      } catch {}
      return acquireLock(path);
    }
    throw e;
  }

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    try {
      unlinkSync(path);
    } catch {}
  };
  process.once("exit", release);
  return release;
}
