/* ============================================================
 * 파일: js/05-input.js
 * 역할: 키보드/터치 입력과 충전-발사 이동
 * 들어있는 것: cancelAllCharges, launchDir, tryPressDir, releaseDir, 키 입력 연결(WASD/방향키/E/ESC), 화면 D패드·E 버튼 연결
 * 먼저 로드돼야 하는 파일: 03-world-player.js, 04-audio.js
 * 주의: 단서방(clueGame)에서는 위/아래가 레인 전환으로 쓰이므로 tryPressDir 맨 위의 상태 분기를 건드릴 때 주의
 * ============================================================ */

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
}
function tryPressDir(name) {
  if (gameState === 'boxNotice' || gameState === 'clueGameEnter') return; // 연출 중엔 조작 불가
  if (gameState === 'clueGame') {
    if (name === 'up') clueGameLane = 0;
    if (name === 'down') clueGameLane = 1;
    return;
  }
  if (clueOpen) return; // 단서 퀴즈 푸는 중엔 이동 불가
  if (player.lockedDirs[name]) {
    if (quizUnlockKnown && !quizOpen) openQuiz(name); // 상자를 찾기 전엔 눌러도 아무 반응 없음
    return;
  }
  if (adminMode) { launchDir(name, MAX_LAUNCH); playReleaseThud(); return; } // 충전 없이 즉시 최대 발사
  if (chargeStart[name] === null) { chargeStart[name] = frameCount; startChargeSound(name); }
}
function releaseDir(name) {
  if (chargeStart[name] === null) return;
  const held = frameCount - chargeStart[name];
  chargeStart[name] = null;
  stopChargeSound(name);
  playReleaseThud();
  const frac = Math.min(1, held / MAX_CHARGE_FRAMES);
  const eased = frac * frac; // 초반엔 천천히, 오래 누를수록 훨씬 세지도록
  const power = MIN_LAUNCH + eased * (MAX_LAUNCH - MIN_LAUNCH);
  launchDir(name, power);
}
const MOVE_KEYS = {
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
};
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { toggleSettings(); return; }
  if ((e.key === 'e' || e.key === 'E') && gameState === 'playing') { tryInteract(); return; }
  if (quizOpen || clueOpen) return;
  const dir = MOVE_KEYS[e.key];
  if (dir) tryPressDir(dir);
});
window.addEventListener('keyup', (e) => {
  const dir = MOVE_KEYS[e.key];
  if (dir) releaseDir(dir);
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
document.getElementById('interactBtn').addEventListener('touchstart', (e) => { e.preventDefault(); tryInteract(); });
document.getElementById('interactBtn').addEventListener('mousedown', () => tryInteract());
