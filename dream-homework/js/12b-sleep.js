/* ============================================================
 * 파일: js/12b-sleep.js
 * 역할: 졸음 스택 (0 ~ 1000, 화면 왼쪽 위의 회색 바)
 * 들어있는 것: 졸음 스택 값(sleepStack)과 늘리기(addSleep), 스택에 따른 효과(차징 시간/공격 간격 늘어남, 화면 어두워짐, 1000이 되면 5초 후 게임 오버), 바 표시
 * 먼저 로드돼야 하는 파일: 01-core.js, 03-world-player.js (MAX_CHARGE_FRAMES)
 * 주의: 스택은 지금은 줄어드는 방법이 없음(늘기만 함). 늘어나는 곳: 차징해서 발사할 때 +1 (05-input.js, 09b), 무기로 공격할 때 (11b-weapons.js: 검 +1, 작살 +3, 방패 +1)
 *       차징 시간과 공격 간격은 이 파일의 chargeFramesNow() / attackCooldownExtraFrames() 로 늘어난 값을 가져다 씀
 * ============================================================ */
const BUILD_12B = 41; // 이 파일의 버전 번호 (index.html 의 "파일 버전 검사"가 씀)

const SLEEP_MAX = 1000;                 // 최대 졸음 스택
const SLEEP_DARK_AT = 750;              // 이 값부터 화면이 조금 어두워짐
const SLEEP_STEP = 50;                  // 스택이 이만큼 쌓일 때마다 아래 두 가지가 한 단계씩 느려짐
const SLEEP_CHARGE_FRAMES_PER_STEP = 6; // 차징 시간 +0.1초 (60프레임 = 1초)
const SLEEP_ATTACK_FRAMES_PER_STEP = 12;// 공격 간격 +0.2초
const SLEEP_GAMEOVER_MS = 5000;         // 스택이 1000이 된 뒤 게임 오버까지 걸리는 시간 (그동안 화면이 서서히 어두워짐)

let sleepStack = 0;
let sleepOverStart = null;   // 스택이 1000이 된 시각 (아직 아니면 null)
let sleepGameOver = false;

const sleepFillEl = document.getElementById('sleepFill');
const sleepTextEl = document.getElementById('sleepText');
const sleepVeilEl = document.getElementById('sleepVeil');
const fadeOutEl = document.getElementById('gameOverFade');
const gameOverScreenEl = document.getElementById('gameOverScreen');

function sleepSteps() { return Math.floor(sleepStack / SLEEP_STEP); }
// 지금 풀차징까지 걸리는 프레임 수 (졸음이 쌓일수록 길어짐)
function chargeFramesNow() { return MAX_CHARGE_FRAMES + SLEEP_CHARGE_FRAMES_PER_STEP * sleepSteps(); }
// 무기 공격 간격에 더해지는 프레임 수
function attackCooldownExtraFrames() { return SLEEP_ATTACK_FRAMES_PER_STEP * sleepSteps(); }

function updateSleepUI() {
  sleepFillEl.style.width = (100 * sleepStack / SLEEP_MAX) + '%';
  sleepTextEl.textContent = '졸음 ' + sleepStack + ' / ' + SLEEP_MAX;
}
function addSleep(n) {
  if (sleepGameOver || !n) return;
  const before = sleepStack;
  sleepStack = Math.min(SLEEP_MAX, sleepStack + n);
  if (sleepStack >= SLEEP_MAX && sleepOverStart === null) sleepOverStart = performance.now();
  if (sleepStack !== before) updateSleepUI();
}

// 매 프레임 (12-update.js 의 update 맨 위): 화면 어두워짐, 게임 오버 연출
function stepSleepEffects() {
  if (sleepStack >= SLEEP_DARK_AT) {
    // 750에서 약간 어둡게(0.18) 시작해서 1000에서 0.35까지
    sleepVeilEl.style.opacity = String(0.18 + 0.17 * Math.min(1, (sleepStack - SLEEP_DARK_AT) / (SLEEP_MAX - SLEEP_DARK_AT)));
  } else if (sleepVeilEl.style.opacity !== '0') {
    sleepVeilEl.style.opacity = '0';
  }
  if (sleepOverStart !== null && !sleepGameOver) {
    const t = Math.min(1, (performance.now() - sleepOverStart) / SLEEP_GAMEOVER_MS);
    fadeOutEl.style.opacity = String(t);
    if (t >= 1) {
      sleepGameOver = true;
      gameState = 'gameOver';
      cancelAllCharges();
      gameOverScreenEl.classList.add('show');
    }
  }
}
document.getElementById('gameOverRetry').addEventListener('click', () => location.reload());
updateSleepUI();
