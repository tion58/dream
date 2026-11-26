/* ============================================================
 * 파일: js/12c-story-events.js   (새 파일)
 * 역할: 엔딩으로 이어지는 사건들 - ■■를 먹은 뒤의 폭주(노멀 엔딩 B), 히든방3의 이상 증세(3→2 되돌아감)와 스스로 끝내는 선택(노멀 엔딩 A), 엔딩 화면
 * 들어있는 것: finishWithEnding(결말 장면 → 카드 → 엔딩 화면), eatPill/startRampage/stepRampage(폭주), stepAnomaly/startAnomaly(이상 증세), 선택지(askSelfChoice)
 * 먼저 로드돼야 하는 파일: 07d-dialogue.js (playDialogue, askChoice), 07c-inventory-ui.js (unlockEnding, ENDINGS), 12b-sleep.js (졸음 바), 01b-story-text.js (글)
 * 글은 모두 01b-story-text.js 에 있음 (ENDING_SCENES, EAT_PILL_LINES, ANOMALY_*, SELF_CHOICE_*)
 * 규칙(임시, 사람이 정한 큰 흐름을 바탕으로 내가 정한 것):
 *   - 노멀 B: 인벤토리에서 ■■를 먹으면(한 번 더 눌러 확인) 폭주가 시작됨. 약 10초 동안 조작 불가, 무적, 닿은 적은 쓰러지고, 졸음 스택이 1000을 뚫고 걷잡을 수 없이 오르다가 바가 깨지며 노멀 엔딩 B
 *   - 노멀 A: 히든방3에 약 20초 있으면 "이상 증세"로 몸이 히든방2(맨 위 방)로 되돌아감. 3번 이상 되돌아온 뒤부터 "스스로 이 꿈을 끝낼지" 선택지가 뜨고, 도구(무기)를 가진 채 고르면 노멀 엔딩 A
 * ============================================================ */
const BUILD_12C = 47; // 이 파일의 버전 번호 (index.html 의 "파일 버전 검사"가 씀)

// ---- 엔딩 화면 ----
const endingScreenEl = document.getElementById('endingScreen');
const endingTitleEl = document.getElementById('endingTitle');
const endingTextEl = document.getElementById('endingText');
const rampageVeilEl = document.getElementById('rampageVeil');
const fadeBlackEl = document.getElementById('gameOverFade');
document.getElementById('endingRetry').addEventListener('click', () => location.reload()); // 얻은 엔딩 카드는 저장돼 있어서 다시 시작해도 남음

// 결말 장면(ENDING_SCENES[key])을 보여주고 → 엔딩 카드를 얻고 → 엔딩 화면을 띄움
function finishWithEnding(key) {
  const scene = ENDING_SCENES[key];
  cleared = true;                   // 게임 진행을 멈춤
  rampage.active = false;
  rampageVeilEl.style.opacity = '0';
  playDialogue(scene.lines, () => {
    if (scene.card) unlockEnding(scene.card);
    gameState = 'gameOver';         // 조작 불가
    const card = ENDINGS.find(e => e.id === scene.card);
    endingTitleEl.textContent = scene.title;
    endingTextEl.textContent = card ? card.text : '';
    endingScreenEl.classList.add('show');
  });
}

// ---- 노멀 엔딩 B: ■■를 먹으면 폭주 ----
const RAMPAGE_FRAMES = 600;      // 폭주가 이어지는 시간 (600프레임 = 10초)
const RAMPAGE_DASH_EVERY = 22;   // 이만큼 프레임마다 멋대로 한 방향으로 돌진함
const rampage = { active: false, t: 0, dashT: 0, startStack: 0 };
const sleepBarEl = document.getElementById('sleepBar');

function eatPill() {
  if (!useItem('pill')) return;
  closeInventory();
  playDialogue(EAT_PILL_LINES, startRampage);
}
function startRampage() {
  rampage.active = true; rampage.t = 0; rampage.dashT = 0; rampage.startStack = sleepStack;
  cancelAllCharges(); stopFlame(); stopShieldHold();
  sleepFillEl.style.background = '#d94a4a';
}
// 매 프레임 (12-update.js): 멋대로 돌진, 닿은 적 쓰러뜨림, 졸음 스택 폭주, 붉은 화면. 끝나면 바가 깨지고 노멀 엔딩 B
function stepRampage() {
  if (!rampage.active || quizOpen) return;
  rampage.t++;
  const p = Math.min(1, rampage.t / RAMPAGE_FRAMES);
  // 졸음 스택: 실제 값은 999 까지만 올리고(1000이 되면 보통의 게임 오버가 되어버려서), 바에는 1000을 훌쩍 넘는 숫자를 보여줌
  const target = Math.min(999, Math.round(rampage.startStack + (999 - rampage.startStack) * Math.min(1, p * 2)));
  if (sleepStack < target) addSleep(target - sleepStack);
  const shown = p < 0.5 ? sleepStack : Math.round(1000 + Math.pow((p - 0.5) * 2, 2) * 8999);
  sleepTextEl.textContent = '졸음 ' + shown + ' / 1000';
  sleepFillEl.style.width = '100%';
  rampageVeilEl.style.opacity = String(0.25 + 0.2 * Math.sin(rampage.t * 0.35) + 0.25 * p);
  // 멋대로 돌진
  if (--rampage.dashT <= 0) {
    rampage.dashT = RAMPAGE_DASH_EVERY;
    const d = ['up', 'down', 'left', 'right'][Math.floor(Math.random() * 4)];
    const power = 5.5 + Math.random() * 2;
    launchDir(d, power); onPlayerLaunch(power); playReleaseThud();
  }
  // 닿은 적은 쓰러짐
  for (const en of enemies) {
    if (en.dead || !isDamageable(en)) continue;
    if (Math.hypot(en.x - player.x, en.y - player.y) < en.r + 12) hitEnemy(en, 99, 9);
  }
  if (rampage.t >= RAMPAGE_FRAMES) {
    sleepBarEl.classList.add('broken'); // 졸음 바가 깨짐
    finishWithEnding('normalB');
  }
}

// ---- 노멀 엔딩 A: 이상 증세 (히든방3 → 히든방2 되돌아감)와 선택 ----
const ANOMALY_FRAMES = 1200;     // 히든방3에서 이만큼(20초) 있으면 이상 증세 (미니게임/대사/인벤토리 중에는 안 셈)
let anomalyTimer = 0, anomalyBusy = false;
function stepAnomaly() {
  if (roomIndex !== HIDDEN_ROOM_IDX3) { anomalyTimer = 0; return; }
  if (quizOpen || anomalyBusy || rampage.active) return;
  if (++anomalyTimer >= ANOMALY_FRAMES) startAnomaly();
}
function startAnomaly() {
  anomalyBusy = true; anomalyTimer = 0;
  quizOpen = true; cancelAllCharges(); stopFlame(); stopShieldHold();
  fadeBlackEl.style.transition = 'opacity 0.5s'; fadeBlackEl.style.opacity = '1'; // 눈앞이 캄캄해짐
  const first = !(gameStats.backCount > 0);
  playDialogue(first ? ANOMALY_FIRST : ANOMALY_AGAIN); // (아래 teleport 로 quizOpen 이 풀린 뒤에 나옴)
  setTimeout(() => {
    player.y = ROOM_HEIGHT + 5;                       // 히든방3의 아래 통로로 내려간 것처럼 이어붙여서
    crossRoom(HIDDEN2_LAST, 'down', H2_DOOR_L);       // 히든방2의 맨 위 방(방6)으로 (gameStats.backCount 도 여기서 오름)
    player.y = ROOM_HEIGHT / 2 + 20; player.vx = 0; player.vy = 0; player.knockVX = 0; player.knockVY = 0;
    fadeBlackEl.style.opacity = '0';
    quizOpen = false;
    anomalyBusy = false;
    if ((gameStats.backCount || 0) >= 3) askSelfChoice(); // 3번 이상 되돌아왔으면 선택지
  }, 700);
}
// "스스로 이 꿈을 끝낼 것인가" 선택 (도구가 있어야 고를 수 있음). 노멀 엔딩 A
function askSelfChoice() {
  playDialogue(SELF_CHOICE_TEXT, () => {
    askChoice(SELF_CHOICE_PROMPT, [
      { label: hasAnyWeapon() ? SELF_CHOICE_YES : SELF_CHOICE_NO_TOOL, disabled: !hasAnyWeapon(), onPick: () => finishWithEnding('normalA') },
      { label: SELF_CHOICE_NO },
    ]);
  });
}
