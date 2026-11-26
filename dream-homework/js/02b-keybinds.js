/* ============================================================
 * 파일: js/02b-keybinds.js
 * 역할: 플레이어가 정하는 키 (인벤토리 키, 공격 키)
 * 들어있는 것: 기본 키(KEY_ACTIONS), 저장/불러오기(브라우저 localStorage), matchesBinding(키가 해당 동작의 키인지), 설정 화면의 키 바꾸기(startKeyCapture/handleKeyCapture)
 * 먼저 로드돼야 하는 파일: 01-core.js, 02-story-settings.js (설정 화면)
 * 주의: 키는 글자가 아니라 "키 위치 이름"(e.code, 예: 'Space', 'Tab', 'KeyF')으로 저장함 → 한글/영문 자판과 상관없이 같은 키.
 *       이동 키(WASD/방향키), E, ESC, Enter 는 이미 쓰이고 있어서 정할 수 없음(KEY_RESERVED)
 * ============================================================ */
const BUILD_02B = 41; // 이 파일의 버전 번호 (index.html 의 "파일 버전 검사"가 씀)

// 동작 이름 → { 화면에 보이는 이름, 기본 키 }. 새 동작(키)을 추가하면 index.html 설정 화면에도 버튼을 추가할 것
const KEY_ACTIONS = {
  inventory: { label: '인벤토리', def: 'Tab' },
  attack:    { label: '공격',     def: 'Space' },
};
const KEY_RESERVED = ['Escape', 'Enter', 'NumpadEnter', 'KeyE', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
const KEY_STORAGE = 'dreamKeys';

function defaultKeyBindings() {
  const b = {};
  Object.keys(KEY_ACTIONS).forEach(k => { b[k] = KEY_ACTIONS[k].def; });
  return b;
}
function loadKeyBindings() {
  const b = defaultKeyBindings();
  try {
    const saved = JSON.parse(localStorage.getItem(KEY_STORAGE) || '{}');
    Object.keys(b).forEach(k => { if (typeof saved[k] === 'string' && saved[k]) b[k] = saved[k]; });
  } catch (e) { /* 저장 기능을 못 쓰는 환경이면 기본 키로 */ }
  return b;
}
function saveKeyBindings() {
  try { localStorage.setItem(KEY_STORAGE, JSON.stringify(keyBindings)); } catch (e) { /* 무시 */ }
}
let keyBindings = loadKeyBindings();

// 키 위치 이름 → 화면에 보일 이름
function keyCodeLabel(code) {
  if (code === 'Space') return 'SPACE';
  if (code === 'Tab') return 'TAB';
  if (code.indexOf('Key') === 0) return code.slice(3);
  if (code.indexOf('Digit') === 0) return code.slice(5);
  if (code.indexOf('Numpad') === 0) return 'NUM ' + code.slice(6);
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'SHIFT';
  if (code === 'ControlLeft' || code === 'ControlRight') return 'CTRL';
  if (code === 'AltLeft' || code === 'AltRight') return 'ALT';
  if (code === 'Backspace') return 'BACKSPACE';
  return code.toUpperCase();
}
function matchesBinding(e, action) { return e.code === keyBindings[action]; }

// ---- 설정 화면의 키 바꾸기 ----
const keyBtnEls = { inventory: document.getElementById('keyBtnInventory'), attack: document.getElementById('keyBtnAttack') };
const keyFeedbackEl = document.getElementById('keyFeedback');
let keyCaptureAction = null; // 지금 새 키를 기다리는 동작 (없으면 null)
function keyCaptureActive() { return keyCaptureAction !== null; }

function refreshKeyButtons() {
  Object.keys(KEY_ACTIONS).forEach(a => {
    const el = keyBtnEls[a];
    if (!el) return;
    el.textContent = (keyCaptureAction === a) ? '키를 누르세요…' : keyCodeLabel(keyBindings[a]);
    el.classList.toggle('waiting', keyCaptureAction === a);
  });
}
function startKeyCapture(action) {
  keyCaptureAction = action;
  keyFeedbackEl.textContent = KEY_ACTIONS[action].label + ' 키로 쓸 키를 누르세요 (ESC: 취소)';
  refreshKeyButtons();
}
function cancelKeyCapture() {
  if (keyCaptureAction === null) return;
  keyCaptureAction = null;
  keyFeedbackEl.textContent = '';
  refreshKeyButtons();
}
// 키를 기다리는 중에 눌린 키 처리 (05-input.js 의 keydown 맨 위에서 호출)
function handleKeyCapture(e) {
  e.preventDefault();
  const action = keyCaptureAction;
  if (e.repeat) return;
  if (e.code === 'Escape') { cancelKeyCapture(); return; }
  if (KEY_RESERVED.indexOf(e.code) >= 0) {
    keyFeedbackEl.textContent = '이 키는 이미 게임에서 쓰고 있어서 정할 수 없어요. 다른 키를 눌러 주세요.';
    return;
  }
  const other = Object.keys(KEY_ACTIONS).find(a => a !== action && keyBindings[a] === e.code);
  if (other) {
    keyFeedbackEl.textContent = '"' + KEY_ACTIONS[other].label + '" 키와 같아요. 다른 키를 눌러 주세요.';
    return;
  }
  keyBindings[action] = e.code;
  saveKeyBindings();
  keyCaptureAction = null;
  keyFeedbackEl.textContent = KEY_ACTIONS[action].label + ' 키를 ' + keyCodeLabel(e.code) + ' 로 바꿨어요.';
  refreshKeyButtons();
}
Object.keys(KEY_ACTIONS).forEach(a => {
  if (keyBtnEls[a]) keyBtnEls[a].addEventListener('click', () => startKeyCapture(a));
});
document.getElementById('keyReset').addEventListener('click', () => {
  keyBindings = defaultKeyBindings();
  saveKeyBindings();
  keyCaptureAction = null;
  keyFeedbackEl.textContent = '키를 기본값으로 되돌렸어요.';
  refreshKeyButtons();
});
document.getElementById('closeSettingsBtn').addEventListener('click', cancelKeyCapture); // 설정을 닫으면 키 기다리기도 끝
refreshKeyButtons();
