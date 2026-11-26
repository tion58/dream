/* ============================================================
 * 파일: js/09-clue-game.js
 * 역할: 단서 미니게임(단서방)과 다음 방 입구의 정답 입력
 * 들어있는 것: 단서방 상태/시작/종료, 힌트 글자 공개, 정답 입력 화면, 레인 2칸 회피 게임(첫 번째 미니게임)의 update/draw
 *             ※ 두 번째 미니게임(원 안에서 보라색 몬스터의 공격 피하기)은 09b-clue-game-circle.js, 세 번째(공격을 피하면서 컴퓨터 계산 문제 풀기)는 09c-clue-game-compute.js
 * 먼저 로드돼야 하는 파일: 01-core.js, 05-input.js, 07-inventory-interact.js
 * 주의: 정답은 CLUE_GAME_ANSWER(지금은 임시값). 일시정지는 quizOpen 변수를 재사용 중. drawClueGame은 13-render.js의 px() 함수를 씀
 * ============================================================ */
const BUILD_09 = 46; // 이 파일의 버전 번호 (index.html 의 "파일 버전 검사"가 씀). 파일을 크게 고치면 숫자를 올리고 index.html 의 검사 목록(BUILD)도 같이 올릴 것


// ---- 단서 미니게임: 단서방 (임시) ----
// 자동으로 오른쪽으로 나아가는 느낌으로, 화면 고정 위치의 플레이어를 기준으로 적이 오른쪽에서 왼쪽으로 달려나옴
// 위/아래 두 칸(레인) 중 하나로 옮겨다니며 피하고, 피할 때마다 정답 힌트 글자가 하나씩 공개됨
const CLUE_GAME_ANSWER = '졸음신호'; // (임시 플레이스홀더 정답) 단서 오브젝트에 answer 가 없을 때만 쓰는 기본값. 단서마다 정답은 10-rooms.js 의 단서 오브젝트(answer)에 있음
let clueGameAnswer = CLUE_GAME_ANSWER; // 지금 하는 단서방의 정답 (startClueGame 에서 단서 오브젝트의 answer 로 바뀜)
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
  cancelAllCharges(); // 이동 중이던 충전은 멈춤
  nearbyInteractable = null;
  interactPromptEl.style.display = 'none'; // "E 상호작용" 안내가 미니게임 화면에 남아 있지 않게
  pendingClueStart = cp;
  gameState = 'clueGameEnter';
  clueGameEnterTimer = 0;
}
function startClueGame(cp) {
  currentCluePoint = cp;
  clueGameAnswer = cp.answer || CLUE_GAME_ANSWER;
  if (cp.game === 'circle') { startCircleGame(cp); return; } // 두 번째 미니게임 (09b-clue-game-circle.js)
  if (cp.game === 'compute') { startComputeGame(cp); return; } // 세 번째 미니게임 (09c-clue-game-compute.js)
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
  resetCircleGame(); // 원 미니게임의 충전 소리/상태 정리 (09b)
  resetComputeGame(); // 계산 미니게임의 충전 소리/상태/화면 정리 (09c)
  gameState = 'playing';
  clueGameHintEl.style.display = 'none';
  currentCluePoint = null;
}
function finishClueGameCollect() {
  if (currentCluePoint) {
    // useAtRoom: 이 단서의 정답을 적어야 하는 방 번호 (그 방으로 넘어가는 순간 정답 입력 화면이 뜸. 값은 10-rooms.js 의 단서 오브젝트에 있음)
    const alreadyHave = pendingClue && pendingClue.cp === currentCluePoint; // 같은 단서방을 다시 하면 메모가 또 생기지 않게
    pendingClue = { cp: currentCluePoint, answer: clueGameAnswer, useAtRoom: currentCluePoint.useAtRoom };
    if (!alreadyHave) addItem('memo'); // 단서를 인벤토리에 메모 아이템으로 담아둠
    const cp = currentCluePoint;
    if (cp.reward && !cp.rewarded) { // 미니게임을 처음 끝냈을 때만 주는 보상 (예: 컴퓨터 미니게임의 부품3)
      cp.rewarded = true;
      addItem(cp.reward);
      showToast(ITEM_DEFS[cp.reward].name + ' 획득! ' + ITEM_DEFS[cp.reward].icon, 3600);
    }
  }
  exitClueGame();
}
function updateClueGameHintDisplay() {
  let display = '';
  for (let i = 0; i < clueGameAnswer.length; i++) display += (i < clueGameDodges) ? clueGameAnswer[i] : '_';
  clueGameHintTextEl.textContent = display.split('').join(' ');
  if (clueGameDodges >= clueGameAnswer.length && !clueGameFinishing) {
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
  if (drawSprite('playerIdle', px_, py_)) { // 주인공 그림 (맞으면 붉게)
    if (clueGameHitFlash > 0) drawSprite('playerIdle', px_, py_, { tint: 'red', alpha: 0.5 });
  } else {
    const bodyColor = clueGameHitFlash > 0 ? '#ff5c5c' : '#ffffff';
    px(px_ - 8, py_ - 9, 16, 18, bodyColor);
    px(px_ - 5, py_ - 6, 3, 3, '#4a7fd6');
    px(px_ + 2, py_ - 6, 3, 3, '#4a7fd6');
  }

  clueGameEnemies.forEach(en => {
    const ey = en.lane === 0 ? laneTopY : laneBotY;
    if (!drawSprite('enemyRed', en.x, ey, { scale: 0.6 })) { // 빨간 적 그림 (없으면 예전 네모)
      px(en.x - 8, ey - 8, 16, 16, '#e05a6b');
      px(en.x - 4, ey - 3, 3, 3, '#ffffff');
      px(en.x + 1, ey - 3, 3, 3, '#ffffff');
    }
  });
}
