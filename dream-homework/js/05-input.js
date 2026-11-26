/* ============================================================
 * 파일: js/05-input.js
 * 역할: 키보드/터치 입력과 충전-발사 이동
 * 들어있는 것: cancelAllCharges, launchDir, tryPressDir, releaseDir, 키 입력 연결(WASD/방향키/E/공격 키/ESC), 화면 D패드·E 버튼·공격(⚔) 버튼 연결
 * 먼저 로드돼야 하는 파일: 03-world-player.js, 04-audio.js
 * 주의: 단서방(clueGame)에서는 위/아래가 레인 전환으로 쓰이므로 tryPressDir 맨 위의 상태 분기를 건드릴 때 주의
 *       원 미니게임(clueGameCircle)에서는 4방향 모두 충전으로 움직이고, 잠금 상태와 상관없음 (처리는 09b-clue-game-circle.js)
 *       시작 구역(freeMoveActive) 안에서는 충전하지 않고 heldDirs 만 기록 → 실제 이동은 12-update.js 에서 처리
 *       노트/쪽지 읽기 화면(readerOpen), 인벤토리(inventoryOpen), 설정의 키 바꾸기(keyCaptureActive)가 열려 있으면 키 입력을 그쪽이 먼저 가져감
 *       인벤토리 키와 공격 키는 플레이어가 정한 키(02b-keybinds.js 의 matchesBinding)
 *       E: 가까이에 상호작용할 것이 있으면 상호작용, 없고 방패를 끼고 있으면 누르는 동안 방패로 막기. 공격 키/⚔ 버튼: 검·방패는 한 번 치기, 화염방사기는 누르는 동안 불 뿜기 (11b-weapons.js)
 *       계산 미니게임(clueGameCompute)에서는 방향키가 충전 이동, 숫자 1~4 가 보기 선택 (09c-clue-game-compute.js)
 * ============================================================ */
const BUILD_05 = 47; // 이 파일의 버전 번호 (index.html 의 "파일 버전 검사"가 씀). 파일을 크게 고치면 숫자를 올리고 index.html 의 검사 목록(BUILD)도 같이 올릴 것


function cancelAllCharges() {
  ['up', 'down', 'left', 'right'].forEach(name => {
    if (chargeStart[name] !== null) { chargeStart[name] = null; stopChargeSound(name); }
  });
}

function launchDir(name, power) {
  if (name === 'left') player.vx = -power;
  if (name === 'right') player.vx = power;
  if (name === 'up') player.vy = -power;
  if (name === 'down') player.vy = power;
  player.facing = name;
  if (name === 'left') player.faceX = -1;
  if (name === 'right') player.faceX = 1;
}
function tryPressDir(name) {
  if (rampage.active) return; // 폭주 중에는 조작할 수 없음 (12c-story-events.js)
  if (gameState === 'boxNotice' || gameState === 'clueGameEnter') return; // 연출 중엔 조작 불가
  if (gameState === 'clueGame') {
    if (name === 'up') clueGameLane = 0;
    if (name === 'down') clueGameLane = 1;
    return;
  }
  if (gameState === 'clueGameCircle') { circleGamePress(name); return; } // 원 미니게임: 충전 시작
  if (gameState === 'clueGameCompute') { computeGamePress(name); return; } // 계산 미니게임: 충전 시작
  if (clueOpen) return; // 단서 퀴즈 푸는 중엔 이동 불가
  if (player.lockedDirs[name]) {
    if (quizUnlockKnown && !quizOpen) openQuiz(name); // 상자를 찾기 전엔 눌러도 아무 반응 없음
    return;
  }
  heldDirs[name] = true;
  player.facing = name; // 방향키를 누르는 순간부터 그 방향을 바라봄 (검을 휘두르는/방패로 막는/불을 뿜는 방향)
  if (name === 'left') player.faceX = -1; // 충전을 시작하는 순간부터 그 쪽을 바라봄
  if (name === 'right') player.faceX = 1;
  if (freeMoveActive()) { player.facing = name; return; } // 시작 구역 안, 또는 관리자 모드: 충전 없이 자유 이동 (이동은 update에서)
  if (chargeStart[name] === null) { chargeStart[name] = frameCount; startChargeSound(name); }
}
function releaseDir(name) {
  heldDirs[name] = false;
  if (gameState === 'clueGameCircle') { circleGameRelease(name); return; } // 원 미니게임: 충전한 만큼 발사
  if (gameState === 'clueGameCompute') { computeGameRelease(name); return; } // 계산 미니게임: 충전한 만큼 발사
  if (chargeStart[name] === null) return;
  const held = frameCount - chargeStart[name];
  chargeStart[name] = null;
  stopChargeSound(name);
  playReleaseThud();
  const frac = Math.min(1, held / chargeFramesNow()); // 졸음 스택이 쌓일수록 풀차징까지 오래 걸림 (12b-sleep.js)
  const eased = frac * frac; // 초반엔 천천히, 오래 누를수록 훨씬 세지도록
  const power = MIN_LAUNCH + eased * (MAX_LAUNCH - MIN_LAUNCH);
  launchDir(name, power);
  onPlayerLaunch(power); // 구름 잔상 (03b-sprites.js)
  addSleep(1);           // 차징해서 발사할 때마다 졸음 스택 +1 (12b-sleep.js)
}
const MOVE_KEYS = {
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
};
window.addEventListener('keydown', (e) => {
  if (keyCaptureActive()) { handleKeyCapture(e); return; }  // 설정에서 새 키를 기다리는 중
  if (dialogOpen) { e.preventDefault(); handleDialogKey(e); return; } // 대사창이 열려 있는 중 (07d-dialogue.js)
  if (readerOpen) { handleReaderKey(e); return; }          // 노트/쪽지를 읽는 중
  if (inventoryOpen) { handleInventoryKey(e); return; }    // 인벤토리가 열려 있는 중
  if (matchesBinding(e, 'inventory') && gameState === 'playing' && !quizOpen) { e.preventDefault(); toggleInventory(); return; } // 인벤토리 키
  if (e.key === 'Escape') { toggleSettings(); return; }
  if ((e.key === 'e' || e.key === 'E') && gameState === 'playing') { if (!e.repeat) tryInteract(); return; } // E: 상호작용, 없으면 방패 들기(누르는 동안)
  if (matchesBinding(e, 'attack') && gameState === 'playing') { e.preventDefault(); if (!e.repeat) attackPress(); return; } // 공격 키: 장착한 무기로 공격 (화염방사기는 누르는 동안)
  if (gameState === 'clueGameCompute' && e.key >= '1' && e.key <= '4') { if (!e.repeat) computeAnswer(parseInt(e.key, 10) - 1); return; } // 계산 미니게임: 숫자 키로 보기 고르기
  if (quizOpen || clueOpen) return;
  const dir = MOVE_KEYS[e.key];
  if (dir) tryPressDir(dir);
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'e' || e.key === 'E') stopShieldHold();       // E 를 떼면 방패를 내림
  if (matchesBinding(e, 'attack')) attackRelease();            // 공격 키를 떼면 불이 꺼짐
  const dir = MOVE_KEYS[e.key];
  if (dir) releaseDir(dir);
});
// 창이 다른 곳으로 넘어가면(알트탭 등) 키를 뗀 신호를 못 받으니, 눌림 상태를 모두 풀어 줌
window.addEventListener('blur', () => {
  ['up', 'down', 'left', 'right'].forEach(n => { heldDirs[n] = false; });
  cancelAllCharges();
  cancelCircleCharges();
  cancelComputeCharges();
  stopShieldHold(); stopFlame();
});
function bindDirHold(el, dirName) {
  el.addEventListener('touchstart', (e) => { e.preventDefault(); tryPressDir(dirName); });
  el.addEventListener('touchend', (e) => { e.preventDefault(); releaseDir(dirName); });
  el.addEventListener('touchcancel', (e) => { e.preventDefault(); releaseDir(dirName); });
  el.addEventListener('mousedown', () => tryPressDir(dirName));
  el.addEventListener('mouseup', () => releaseDir(dirName));
  el.addEventListener('mouseleave', () => releaseDir(dirName));
}
bindDirHold(document.getElementById('dUp'), 'up');
bindDirHold(document.getElementById('dDown'), 'down');
bindDirHold(document.getElementById('dLeft'), 'left');
bindDirHold(document.getElementById('dRight'), 'right');
// 화면 E 버튼: 가까이에 상호작용할 것이 있으면 상호작용, 없고 방패를 끼고 있으면 누르는 동안 방패로 막기
const interactBtnEl = document.getElementById('interactBtn');
interactBtnEl.addEventListener('touchstart', (e) => { e.preventDefault(); tryInteract(); });
interactBtnEl.addEventListener('touchend', (e) => { e.preventDefault(); stopShieldHold(); });
interactBtnEl.addEventListener('touchcancel', (e) => { e.preventDefault(); stopShieldHold(); });
interactBtnEl.addEventListener('mousedown', () => tryInteract());
interactBtnEl.addEventListener('mouseup', () => stopShieldHold());
interactBtnEl.addEventListener('mouseleave', () => stopShieldHold());
// 화면 ⚔ 공격 버튼 (휴대폰용. 무기를 끼고 있을 때만 보임): 공격 키와 같음
const atkBtnEl2 = document.getElementById('atkBtn');
atkBtnEl2.addEventListener('touchstart', (e) => { e.preventDefault(); attackPress(); });
atkBtnEl2.addEventListener('touchend', (e) => { e.preventDefault(); attackRelease(); });
atkBtnEl2.addEventListener('touchcancel', (e) => { e.preventDefault(); attackRelease(); });
atkBtnEl2.addEventListener('mousedown', () => attackPress());
atkBtnEl2.addEventListener('mouseup', () => attackRelease());
atkBtnEl2.addEventListener('mouseleave', () => attackRelease());
