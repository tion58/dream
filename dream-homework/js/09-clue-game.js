/* ============================================================
 * 파일: js/09-clue-game.js
 * 역할: 단서 미니게임(단서방)과 다음 방 입구의 정답 입력
 * 들어있는 것: 단서방 상태/시작/종료, 힌트 글자 공개, 정답 입력 화면, 레인 2칸 회피 게임의 update/draw
 * 먼저 로드돼야 하는 파일: 01-core.js, 05-input.js, 07-inventory-interact.js
 * 주의: 정답은 CLUE_GAME_ANSWER(지금은 임시값). 일시정지는 quizOpen 변수를 재사용 중. drawClueGame은 13-render.js의 px() 함수를 씀
 * ============================================================ */

// ---- 단서 미니게임: 단서방 (임시) ----
// 자동으로 오른쪽으로 나아가는 느낌으로, 화면 고정 위치의 플레이어를 기준으로 적이 오른쪽에서 왼쪽으로 달려나옴
// 위/아래 두 칸(레인) 중 하나로 옮겨다니며 피하고, 피할 때마다 정답 힌트 글자가 하나씩 공개됨
const CLUE_GAME_ANSWER = '졸음신호'; // (임시 플레이스홀더 정답)
const clueGameHintEl = document.getElementById('clueGameHint');
const clueGameHintTextEl = document.getElementById('clueGameHintText');
const clueGameHintSubEl = document.getElementById('clueGameHintSub');

let clueGameLane = 0; // 0 = 위 칸, 1 = 아래 칸
let clueGameVisualY = 0; // 실제 렌더링에 쓰는 매끄럽게 보간된 y 좌표
let clueGameEnemies = [];
let clueGameDodges = 0;
let clueGameSpawnTimer = 0;
let clueGameHitFlash = 0;
let clueGameFinishing = false;
let clueGameEnterTimer = 0;
const CLUE_ENTER_DURATION = 26;
let pendingClueStart = null;
let pendingClue = null; // { cp, answer } - 단서방은 끝냈지만 아직 정답을 안 맞춘 상태

function startClueGameEnter(cp) {
  pendingClueStart = cp;
  gameState = 'clueGameEnter';
  clueGameEnterTimer = 0;
}
function startClueGame(cp) {
  currentCluePoint = cp;
  gameState = 'clueGame';
  clueGameLane = 0;
  clueGameVisualY = GAME_H * 0.5 + 90 * 0.28;
  clueGameEnemies = [];
  clueGameDodges = 0;
  clueGameSpawnTimer = 60;
  clueGameHitFlash = 0;
  clueGameHintSubEl.textContent = '적의 공격을 피하면서 힌트를 모으자!';
  updateClueGameHintDisplay();
  clueGameHintEl.style.display = 'block';
}
function exitClueGame() {
  gameState = 'playing';
  clueGameHintEl.style.display = 'none';
  currentCluePoint = null;
}
function finishClueGameCollect() {
  if (currentCluePoint) {
    pendingClue = { cp: currentCluePoint, answer: CLUE_GAME_ANSWER };
    addItem('memo'); // 단서를 인벤토리에 메모 아이템으로 담아둠
  }
  exitClueGame();
}
function updateClueGameHintDisplay() {
  let display = '';
  for (let i = 0; i < CLUE_GAME_ANSWER.length; i++) display += (i < clueGameDodges) ? CLUE_GAME_ANSWER[i] : '_';
  clueGameHintTextEl.textContent = display.split('').join(' ');
  if (clueGameDodges >= CLUE_GAME_ANSWER.length && !clueGameFinishing) {
    clueGameFinishing = true;
    clueGameHintSubEl.textContent = '힌트를 다 모았다! 단서를 챙겨간다...';
    setTimeout(() => { clueGameFinishing = false; finishClueGameCollect(); }, 900);
  }
}

// ---- 단서 정답 입력: 단서방이 아니라 다음 방으로 넘어갈 때 ----
const clueAnswerScreen = document.getElementById('clueAnswerScreen');
const clueAnswerScreenInput = document.getElementById('clueAnswerScreenInput');
const clueAnswerScreenFeedback = document.getElementById('clueAnswerScreenFeedback');
function openClueAnswerScreen() {
  quizOpen = true; // 기존 일시정지/이동잠금 로직을 그대로 재사용
  clueAnswerScreenInput.value = '';
  clueAnswerScreenFeedback.textContent = '';
  clueAnswerScreen.classList.add('show');
  setTimeout(() => clueAnswerScreenInput.focus(), 50);
}
function submitClueAnswerScreen() {
  const val = clueAnswerScreenInput.value.trim();
  if (pendingClue && val === pendingClue.answer) {
    if (pendingClue.cp) pendingClue.cp.solved = true;
    useItem('memo');
    pendingClue = null;
    quizOpen = false;
    clueAnswerScreen.classList.remove('show');
  } else {
    clueAnswerScreenFeedback.textContent = '틀렸어... 다시 떠올려보자';
  }
}
document.getElementById('clueAnswerScreenSubmit').addEventListener('click', submitClueAnswerScreen);
clueAnswerScreenInput.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Enter') submitClueAnswerScreen();
});

const CLUE_PLAYER_X_FRAC = 0.22; // 화면상 플레이어의 고정 x 위치(비율)
function updateClueGame() {
  clueGameSpawnTimer--;
  if (clueGameSpawnTimer <= 0) {
    clueGameSpawnTimer = 55 + Math.floor(Math.random() * 25);
    clueGameEnemies.push({ x: GAME_W + 20, lane: Math.random() < 0.5 ? 0 : 1, passed: false });
  }
  const speed = 2.4;
  const px_ = GAME_W * CLUE_PLAYER_X_FRAC;
  for (let i = clueGameEnemies.length - 1; i >= 0; i--) {
    const en = clueGameEnemies[i];
    en.x -= speed;
    if (!en.passed && Math.abs(en.x - px_) < 14) {
      en.passed = true;
      if (en.lane === clueGameLane) {
        clueGameHitFlash = 14; // 맞음: 임시로 페널티는 없고 화면만 살짝 반응
      } else {
        clueGameDodges++;
        updateClueGameHintDisplay();
      }
    }
    if (en.x < -20) clueGameEnemies.splice(i, 1);
  }
  if (clueGameHitFlash > 0) clueGameHitFlash--;
  // 레인 전환을 매끄럽게 보간 (딱 끊기지 않고 부드럽게 이동)
  const bandY_ = GAME_H * 0.5, bandH_ = 90;
  const targetY = bandY_ + (clueGameLane === 0 ? bandH_ * 0.28 : bandH_ * 0.72);
  clueGameVisualY += (targetY - clueGameVisualY) * 0.28;
}
function drawClueGame() {
  bctx.fillStyle = '#bdf5e0';
  bctx.fillRect(0, 0, GAME_W, GAME_H);
  const bandY = GAME_H * 0.5, bandH = 90;
  bctx.fillStyle = '#8fe3c4';
  bctx.fillRect(0, bandY, GAME_W, bandH);
  bctx.fillStyle = 'rgba(255,255,255,0.45)';
  bctx.fillRect(0, bandY + bandH / 2 - 1, GAME_W, 2);
  const laneTopY = bandY + bandH * 0.28, laneBotY = bandY + bandH * 0.72;

  const px_ = GAME_W * CLUE_PLAYER_X_FRAC;
  const py_ = clueGameVisualY;
  const bodyColor = clueGameHitFlash > 0 ? '#ff5c5c' : '#ffffff';
  px(px_ - 8, py_ - 9, 16, 18, bodyColor);
  px(px_ - 5, py_ - 6, 3, 3, '#4a7fd6');
  px(px_ + 2, py_ - 6, 3, 3, '#4a7fd6');

  clueGameEnemies.forEach(en => {
    const ey = en.lane === 0 ? laneTopY : laneBotY;
    px(en.x - 8, ey - 8, 16, 16, '#e05a6b');
    px(en.x - 4, ey - 3, 3, 3, '#ffffff');
    px(en.x + 1, ey - 3, 3, 3, '#ffffff');
  });
}
