// 로그 위생: 단계·개수·소요·에러 요약만. 민감 본문(URL 본문·LLM 답변)은 로그에 넣지 않는다.
// stdout을 결과(JSON/마크다운) 전용으로 쓰므로 진행 로그는 stderr로 보낸다. (bot-fleet lib 기반)
function ts() {
  return new Date().toISOString();
}

export function log(msg) {
  console.error(`[${ts()}] ${msg}`);
}

export function logErr(msg) {
  console.error(`[${ts()}] ERR ${msg}`);
}
