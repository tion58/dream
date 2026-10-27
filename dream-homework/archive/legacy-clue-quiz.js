/* ============================================================
 * 보관용(지금은 불러오지 않음): 예전 '양(수량) 비교 퀴즈' 팝업 코드
 * 단서 시스템이 단서방 미니게임으로 바뀌면서 쓰지 않게 됨. 참고용으로만 남김.
 * (index.html 의 #clueScreen 과 01-core.js 의 clueScreen/clueOptA/clueOptB 등 관련 변수도 지금은 쓰이지 않음)
 * ============================================================ */

// ---- 임시: 히든방 단서 퀴즈 (수량/양 비교) ----
function generateClueQuiz() {
  clueA = 2 + Math.floor(Math.random() * 7);
  do { clueB = 2 + Math.floor(Math.random() * 7); } while (clueB === clueA);
  clueOptAEl.textContent = '●'.repeat(clueA) + `  (${clueA})`;
  clueOptBEl.textContent = '●'.repeat(clueB) + `  (${clueB})`;
}
function openClueQuiz(cp) {
  currentCluePoint = cp;
  clueOpen = true;
  generateClueQuiz();
  clueFeedbackEl.textContent = '';
  clueResultEl.style.display = 'none';
  clueScreen.classList.add('show');
}
function closeClueQuiz() {
  clueOpen = false;
  clueScreen.classList.remove('show');
  currentCluePoint = null;
}
function answerClue(letter) {
  const picked = letter === 'A' ? clueA : clueB;
  const correct = Math.max(clueA, clueB);
  if (picked === correct) {
    clueFeedbackEl.textContent = '정답!';
    clueResultEl.style.display = 'block';
    if (currentCluePoint) currentCluePoint.solved = true;
    setTimeout(closeClueQuiz, 1300);
  } else {
    clueFeedbackEl.textContent = '땡! 다시 골라봐';
    generateClueQuiz();
  }
}
clueOptAEl.addEventListener('click', () => answerClue('A'));
clueOptBEl.addEventListener('click', () => answerClue('B'));
