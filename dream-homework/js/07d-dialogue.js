/* ============================================================
 * 파일: js/07d-dialogue.js   (새 파일)
 * 역할: 게임 중에 나오는 대사창(주인공의 혼잣말 등)과 스토리 장면 모음
 * 들어있는 것: askChoice(선택지 물음: 노멀 엔딩 A 의 선택에 씀), playDialogue(대사창 띄우기), STORY_BEATS(상황별 대사 모음), storyBeat(id)(한 번만 보여줌), onRoomEntered(방에 들어갔을 때), onGameCleared(마지막 출구에 도착했을 때의 결말), 졸음 스택에 따른 대사
 * 먼저 로드돼야 하는 파일: 01-core.js (quizOpen, gameState), 07-inventory-interact.js (showToast), 07c-inventory-ui.js (unlockEnding)
 * 주의: 대사창이 열려 있는 동안 게임은 멈춤(quizOpen 을 같이 씀). 다른 창(인벤토리/정답 입력 등)이 열려 있으면 그게 닫힐 때까지 기다렸다가 나옴.
 *       글은 모두 "대충 넣은 임시 글"임 → 이야기가 정해지면 STORY_BEATS / ENDING_SCENES 의 글만 고치면 됨. 대사는 { name, text } 또는 그냥 문자열(이름 없는 혼잣말)
 *       키 입력(SPACE/Enter/E)은 05-input.js 의 keydown 맨 위에서 handleDialogKey 로 넘어옴
 * ============================================================ */
const BUILD_07D = 47; // 이 파일의 버전 번호 (index.html 의 "파일 버전 검사"가 씀)

// 상황별 대사(STORY_BEATS)와 결말 장면(ENDING_SCENES)의 글은 01b-story-text.js 에 있음

// ---- 대사창 ----
const dialogBoxEl = document.getElementById('dialogBox');
const dialogNameEl = document.getElementById('dialogName');
const dialogTextEl = document.getElementById('dialogText');
let dialogOpen = false, dialogLines = [], dialogIndex = 0, dialogDone = null, dialogWaiting = false;
const dialogTypist = makeTypist(dialogTextEl); // 글자가 하나씩 나오는 효과 (02-story-settings.js)
const dialogQueue = [];
const beatsSeen = {};

function playDialogue(lines, onDone) {
  dialogQueue.push({ lines: lines, onDone: onDone });
  tryStartDialogue();
}
function tryStartDialogue() {
  if (dialogOpen || !dialogQueue.length) return;
  if (quizOpen || gameState !== 'playing') { // 다른 창이 열려 있으면 닫힐 때까지 기다림
    if (!dialogWaiting) { dialogWaiting = true; setTimeout(() => { dialogWaiting = false; tryStartDialogue(); }, 250); }
    return;
  }
  const d = dialogQueue.shift();
  dialogLines = d.lines; dialogDone = d.onDone || null; dialogIndex = 0;
  dialogOpen = true;
  quizOpen = true; // 열려 있는 동안 게임을 멈춤
  cancelAllCharges(); stopFlame(); stopShieldHold();
  showDialogLine();
  dialogBoxEl.style.display = 'block';
}
function showDialogLine() {
  const l = dialogLines[dialogIndex];
  const name = (typeof l === 'string') ? '' : (l.name || '');
  dialogNameEl.style.display = name ? 'block' : 'none';
  dialogNameEl.textContent = name;
  typeStart(dialogTypist, (typeof l === 'string') ? l : l.text); // 글자가 하나씩 나오며 타자 소리
}
function advanceDialogue() {
  if (!dialogOpen) return;
  if (choiceOpen) { typeSkip(dialogTypist); return; } // 선택지가 떠 있으면 글만 한 번에 보여주고, 넘어가지 않음
  if (typeSkip(dialogTypist)) return; // 글자가 나오는 중이면 먼저 한 번에 다 보여줌
  dialogIndex++;
  if (dialogIndex < dialogLines.length) { showDialogLine(); return; }
  dialogOpen = false;
  quizOpen = false;
  dialogBoxEl.style.display = 'none';
  const done = dialogDone; dialogDone = null;
  if (done) done();
  setTimeout(tryStartDialogue, 120); // 기다리던 다음 대사가 있으면 이어서
}
function handleDialogKey(e) {
  if (e.repeat) return;
  const k = e.key;
  if (choiceOpen) { if (k >= '1' && k <= '9') pickChoice(parseInt(k, 10) - 1); else typeSkip(dialogTypist); return; }
  if (k === ' ' || k === 'Enter' || k === 'e' || k === 'E' || k === 'Escape') advanceDialogue();
}
// 선택지 물음 (예: 노멀 엔딩 A). options = [{ label: '글', disabled: true/false, onPick: 고르면 할 일 }, ...]. 숫자 키 1, 2... 또는 눌러서 고름
const dialogChoicesEl = document.getElementById('dialogChoices');
const dialogHintEl = document.getElementById('dialogHint');
let choiceOpen = false, choiceOptions = [];
function askChoice(promptText, options) {
  choiceOptions = options; choiceOpen = true; dialogOpen = true; quizOpen = true;
  cancelAllCharges(); stopFlame(); stopShieldHold();
  dialogNameEl.style.display = 'none';
  typeStart(dialogTypist, promptText);
  dialogHintEl.style.display = 'none';
  dialogChoicesEl.innerHTML = '';
  options.forEach((o, i) => {
    const b = document.createElement('div');
    b.className = 'dialogChoice' + (o.disabled ? ' disabled' : '');
    b.textContent = (i + 1) + ') ' + o.label;
    if (!o.disabled) b.addEventListener('click', (e) => { e.stopPropagation(); pickChoice(i); });
    dialogChoicesEl.appendChild(b);
  });
  dialogChoicesEl.style.display = 'block';
  dialogBoxEl.style.display = 'block';
}
function pickChoice(i) {
  const o = choiceOptions[i];
  if (!choiceOpen || !o || o.disabled) return;
  choiceOpen = false; dialogOpen = false; quizOpen = false;
  dialogBoxEl.style.display = 'none';
  dialogChoicesEl.style.display = 'none';
  dialogHintEl.style.display = '';
  if (o.onPick) o.onPick();
  setTimeout(tryStartDialogue, 120);
}
dialogBoxEl.addEventListener('click', advanceDialogue);
dialogBoxEl.addEventListener('touchstart', (e) => { e.preventDefault(); advanceDialogue(); });

// 처음 한 번만 보여주는 장면
function storyBeat(id) {
  if (beatsSeen[id] || !STORY_BEATS[id]) return;
  beatsSeen[id] = true;
  playDialogue(STORY_BEATS[id]);
}

// ---- 게임 흐름에 연결 ----
// 방에 들어갔을 때 (11-combat-camera.js 의 crossRoom 끝에서 부름)
function onRoomEntered(idx, prevIdx) {
  if (idx === HIDDEN_ROOM_IDX) storyBeat('enterHidden1');
  else if (idx === 2) storyBeat('enterRoom2');
  else if (idx === HIDDEN_ROOM_IDX2) storyBeat('enterHidden2');
  else if (idx === HIDDEN_ROOM_IDX3) storyBeat('enterHidden3');
  else if (idx === HIDDEN_ROOM_IDX4) storyBeat('enterHidden4');
  // 3번째 방(히든방3)에서 2번째 방(히든방2)으로 되돌아온 횟수를 셈 (노멀 엔딩 A 의 조건에 쓸 예정: "3번 이상")
  if (prevIdx === HIDDEN_ROOM_IDX3 && idx === HIDDEN2_LAST) {
    gameStats.backCount = (gameStats.backCount || 0) + 1;
    if (gameStats.backCount === 3) storyBeat('back3');
  }
}
// 졸음 스택에 따른 혼잣말 (0.5초마다 확인)
setInterval(() => {
  if (gameState !== 'playing' || quizOpen) return;
  if (sleepStack >= 900) storyBeat('sleep900');
  else if (sleepStack >= 500) storyBeat('sleep500');
}, 500);

// 마지막 출구에 도착했을 때 (12-update.js): 조건에 맞는 결말 장면을 보여주고 카드를 채움
function hasAnyWeapon() { return !!(inventory.sword || inventory.shield || inventory.flame); }
function onGameCleared() {
  let scene;
  if (gameStats.kills === 0 && hasAnyWeapon()) scene = ENDING_SCENES.true;   // 아무도 죽이지 않고 무기를 가진 채 (임시 조건)
  else if (gameStats.kills > 0) scene = ENDING_SCENES.hurt;                  // 감시자를 해쳤음
  else scene = ENDING_SCENES.plain;                                          // 무기 없이 탈출
  playDialogue(scene.lines, () => {
    if (scene.card) unlockEnding(scene.card);
    clearMsg.textContent = '🎉 ' + scene.title;
    clearMsg.style.display = 'block';
  });
}
