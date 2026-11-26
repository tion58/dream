/* ============================================================
 * 파일: js/06-lock-quiz.js
 * 역할: 방향키 잠금 표시(자물쇠)와 "과제를 풀자" 수학 문제
 * 들어있는 것: D패드 자물쇠 아이콘/해금 애니메이션, 수학 문제 생성·제출(submitQuiz), 서랍 같은 "방향 해금이 아닌" 문제(openActionQuiz), 비밀 관리자 모드 처리, 관리자 도구(enableAdminTools: 무적 켜고 끄기, 아이템 바로 얻기)
 * 먼저 로드돼야 하는 파일: 03-world-player.js, 05-input.js
 * 주의: submitQuiz 안의 비밀 관리자 모드는 삭제하거나 화면/문서에 드러내지 말 것. 수학 문제 난이도 조절은 generateQuizProblem
 * ============================================================ */
const BUILD_06 = 46; // 이 파일의 버전 번호 (index.html 의 "파일 버전 검사"가 씀). 파일을 크게 고치면 숫자를 올리고 index.html 의 검사 목록(BUILD)도 같이 올릴 것


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
let freeZoneToastShown = false; // 노란 점선 안내 문구를 이미 보여줬는지
let quizA = 0, quizB = 0;
let quizSuccessAction = null; // 방향 해금이 아닌 문제(예: 서랍)를 풀었을 때 실행할 일
let quizCancelable = false;   // true면 취소 버튼으로 그만둘 수 있음 (선택해서 푸는 문제용)
const quizCancelBtn = document.getElementById('quizCancel');
function generateQuizProblem() {
  quizA = 1 + Math.floor(Math.random() * 9);
  quizB = 1 + Math.floor(Math.random() * 9);
  quizProblemEl.textContent = `${quizA} + ${quizB} = ?`;
}
// 방향 해금이 아닌 문제: 풀면 onSuccess()를 실행함. cancelable 이 true면 취소 버튼이 보임
function openActionQuiz(labelText, onSuccess, cancelable) {
  currentQuizDir = null;
  quizSuccessAction = onSuccess;
  quizCancelable = !!cancelable;
  quizCancelBtn.style.display = quizCancelable ? 'inline-block' : 'none';
  quizOpen = true;
  quizDirLabelEl.textContent = labelText;
  generateQuizProblem();
  quizAnswerEl.value = '';
  quizFeedbackEl.textContent = '';
  quizScreen.classList.add('show');
  setTimeout(() => quizAnswerEl.focus(), 50);
}
function cancelQuiz() {
  if (!quizCancelable) return;
  quizOpen = false;
  quizScreen.classList.remove('show');
  quizSuccessAction = null;
  quizCancelable = false;
  quizCancelBtn.style.display = 'none';
  quizAnswerEl.blur();
}
function openQuiz(dir) {
  quizSuccessAction = null;
  quizCancelable = false;
  quizCancelBtn.style.display = 'none';
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
    if (freeZoneUnlocked() && !freeZoneToastShown) { freeZoneToastShown = true; showToast('왠지... 노란 점선 안쪽에서는 자유롭게 움직일 수 있을 것 같다!', 3600); } // 위/아래를 둘 다 해금했을 때 한 번만
  }
  currentQuizDir = null;
  const action = quizSuccessAction; // 서랍 같은 문제라면 풀었을 때의 일을 실행
  quizSuccessAction = null;
  quizCancelable = false;
  quizCancelBtn.style.display = 'none';
  if (action) action();
}
function submitQuiz() {
  const raw = quizAnswerEl.value.trim();
  if (raw === '318321') { // 비밀 코드: 관리자 모드 - 모든 방향 즉시 해제 + 충전 없이 어디서든 자유 이동
    adminMode = true;
    player.lockedDirs.up = false; player.lockedDirs.down = false;
    player.lockedDirs.left = false; player.lockedDirs.right = false;
    refreshDpadIcons();
    enableAdminTools(); // 관리자 도구(무적/아이템)가 화면 왼쪽 위에 나타남
    quizOpen = false;
    quizScreen.classList.remove('show');
    currentQuizDir = null;
    quizSuccessAction = null; quizCancelable = false; quizCancelBtn.style.display = 'none';
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
quizAnswerEl.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Enter') submitQuiz();
  if (e.key === 'Escape') cancelQuiz(); // 취소할 수 있는 문제일 때만 닫힘
});
quizCancelBtn.addEventListener('click', cancelQuiz);

// ---- 관리자 도구: 관리자 모드가 켜졌을 때만 왼쪽 위에 🛠 버튼이 나타남. 누르면 무적 켜고 끄기, 아이템 바로 얻기 ----
function enableAdminTools() {
  const btn = document.getElementById('adminBtn'), panel = document.getElementById('adminPanel');
  btn.style.display = 'flex';
  if (btn.dataset.ready) return; // 이미 만들어 둠
  btn.dataset.ready = '1';
  panel.innerHTML = '<div class="adminRow"><span>무적</span><span id="adminGodBtn" class="adminToggle">OFF</span></div>' +
    '<div class="adminTitle">아이템 바로 얻기 (누르면 1개)</div><div id="adminQuick"></div><div id="adminItems"></div>';
  const give = (id) => {
    addItem(id);
    const def = ITEM_DEFS[id];
    if (def.kind === 'weapon' && !equippedWeapon) equipWeapon(id);
    showToast(def.name + ' 얻음 ' + def.icon, 1200);
  };
  const quick = document.getElementById('adminQuick');
  [['부품 1~4 모두', ['part1', 'part2', 'part3', 'part4']], ['서류 뭉치', ['recipeDoc']], ['망치', ['hammer']]].forEach(q => {
    const b = document.createElement('div'); b.className = 'adminItem adminQuickBtn'; b.textContent = q[0];
    b.addEventListener('click', () => q[1].forEach(give)); quick.appendChild(b);
  });
  const list = document.getElementById('adminItems');
  Object.keys(ITEM_DEFS).forEach(id => {
    const b = document.createElement('div'); b.className = 'adminItem';
    b.textContent = ITEM_DEFS[id].icon + ' ' + ITEM_DEFS[id].name;
    b.addEventListener('click', () => give(id)); list.appendChild(b);
  });
  const god = document.getElementById('adminGodBtn');
  god.addEventListener('click', () => {
    adminInvincible = !adminInvincible;
    god.textContent = adminInvincible ? 'ON' : 'OFF';
    god.classList.toggle('on', adminInvincible);
  });
  btn.addEventListener('click', () => { panel.style.display = (panel.style.display === 'block') ? 'none' : 'block'; });
}
