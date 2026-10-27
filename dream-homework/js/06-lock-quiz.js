/* ============================================================
 * 파일: js/06-lock-quiz.js
 * 역할: 방향키 잠금 표시(자물쇠)와 "과제를 풀자" 수학 문제
 * 들어있는 것: D패드 자물쇠 아이콘/해금 애니메이션, 수학 문제 생성·제출(submitQuiz), 비밀 관리자 모드 처리
 * 먼저 로드돼야 하는 파일: 03-world-player.js, 05-input.js
 * 주의: submitQuiz 안의 비밀 관리자 모드는 삭제하거나 화면/문서에 드러내지 말 것. 수학 문제 난이도 조절은 generateQuizProblem
 * ============================================================ */

// 잠긴 방향은 화살표 대신 자물쇠 아이콘을 보여줌
const DIR_ARROW = { up: '▲', down: '▼', left: '◀', right: '▶' };
const DIR_BTN_EL = { up: document.getElementById('dUp'), down: document.getElementById('dDown'), left: document.getElementById('dLeft'), right: document.getElementById('dRight') };
function refreshDpadIcons() {
  ['up', 'down', 'left', 'right'].forEach(d => {
    const el = DIR_BTN_EL[d];
    const locked = player.lockedDirs[d];
    el.textContent = locked ? '🔒' : DIR_ARROW[d];
    el.classList.toggle('locked', locked);
  });
}
function playUnlockAnim(dir) {
  const el = DIR_BTN_EL[dir];
  el.classList.remove('unlockAnim');
  void el.offsetWidth; // 강제 reflow로 애니메이션이 항상 다시 재생되게 함
  el.classList.add('unlockAnim');
  el.addEventListener('animationend', () => el.classList.remove('unlockAnim'), { once: true });
}
refreshDpadIcons();

const DIR_LABEL = { up: '위쪽', down: '아래쪽', left: '왼쪽', right: '오른쪽' };
let quizA = 0, quizB = 0;
function generateQuizProblem() {
  quizA = 1 + Math.floor(Math.random() * 9);
  quizB = 1 + Math.floor(Math.random() * 9);
  quizProblemEl.textContent = `${quizA} + ${quizB} = ?`;
}
function openQuiz(dir) {
  currentQuizDir = dir;
  quizOpen = true;
  quizDirLabelEl.textContent = `[ ${DIR_LABEL[dir]} 이동 잠금 해제 ]`;
  generateQuizProblem();
  quizAnswerEl.value = '';
  quizFeedbackEl.textContent = '';
  quizScreen.classList.add('show');
  setTimeout(() => quizAnswerEl.focus(), 50);
}
function closeQuizSuccess() {
  quizOpen = false;
  quizScreen.classList.remove('show');
  if (currentQuizDir) {
    player.lockedDirs[currentQuizDir] = false;
    refreshDpadIcons();
    playUnlockAnim(currentQuizDir);
  }
  currentQuizDir = null;
}
function submitQuiz() {
  const raw = quizAnswerEl.value.trim();
  if (raw === '318321') { // 비밀 코드: 관리자 모드 - 모든 방향 즉시 해제 + 충전 불필요
    adminMode = true;
    player.lockedDirs.up = false; player.lockedDirs.down = false;
    player.lockedDirs.left = false; player.lockedDirs.right = false;
    refreshDpadIcons();
    quizOpen = false;
    quizScreen.classList.remove('show');
    currentQuizDir = null;
    return;
  }
  const val = parseInt(raw, 10);
  if (val === quizA + quizB) closeQuizSuccess();
  else {
    quizFeedbackEl.textContent = '틀렸어요, 다시 풀어보세요!';
    generateQuizProblem();
    quizAnswerEl.value = '';
    quizAnswerEl.focus();
  }
}
document.getElementById('quizSubmit').addEventListener('click', submitQuiz);
quizAnswerEl.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') submitQuiz(); });
