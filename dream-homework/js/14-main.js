/* ============================================================
 * 파일: js/14-main.js
 * 역할: 게임 시작 (반드시 맨 마지막)
 * 들어있는 것: 게임 루프(loop, 오류가 나면 멈추고 화면 아래 빨간 상자로 알림), 처음 화면 크기 맞추기와 루프 시작
 * 먼저 로드돼야 하는 파일: 위의 모든 파일
 * 주의: 이 파일은 항상 마지막에 불러와야 함
 * ============================================================ */
const BUILD_14 = 40; // 이 파일의 버전 번호 (index.html 의 "파일 버전 검사"가 씀). 파일을 크게 고치면 숫자를 올리고 index.html 의 검사 목록(BUILD)도 같이 올릴 것


let loopStopped = false;
function loop() {
  if (loopStopped) return;
  try {
    update();
    draw();
  } catch (err) {
    // 코드 오류가 나면 게임이 조용히 멈추는 대신, 어떤 오류인지 빨간 상자(index.html 의 errorBox)로 알려줌
    loopStopped = true;
    console.error(err);
    const where = (String(err.stack || '').match(/([\w\-.]+\.js):(\d+)/) || []);
    const msg = '코드 오류: ' + err.message + (where[1] ? '\n(파일: ' + where[1] + ', ' + where[2] + '번째 줄)' : '')
              + '\n→ 이 글자를 그대로 복사해서 알려주세요. 파일 버전이 서로 달라서 생기는 경우가 많아요.';
    if (window.showGameError) window.showGameError(msg);
    return;
  }
  requestAnimationFrame(loop);
}
resize();
loop();
