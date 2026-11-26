/* ============================================================
 * 파일: js/02-story-settings.js
 * 역할: 타이틀 → 스토리 대사 → 설정 화면
 * 들어있는 것: PLAY 버튼, STORY_LINES(도입부 대사), 글자가 하나씩 나오는 타자 효과(makeTypist/typeStart/typeSkip: 대사창(07d)도 같이 씀), 스토리 진행/SKIP/뒤로가기, 설정 열고 닫기(toggleSettings)
 * 먼저 로드돼야 하는 파일: 01-core.js
 * 주의: 대사를 바꾸거나 추가할 때는 STORY_LINES 배열만 고치면 됨
 * ============================================================ */

const BUILD_02 = 46; // 이 파일의 버전 번호 (index.html 의 "파일 버전 검사"가 씀)

// ---- 글자가 하나씩 나오는 효과 (스토리 화면과 게임 중 대사창이 같이 씀). 글자가 나올 때마다 타자 소리(04-audio.js 의 playTypeBlip) ----
const TYPE_MS = 34; // 글자 하나가 나오는 간격 (밀리초). 숫자가 작을수록 빨리 나옴
function makeTypist(el) { return { el: el, timer: null, full: '', pos: 0, typing: false }; }
function typeStart(t, text) {
  clearInterval(t.timer);
  t.full = text; t.pos = 0; t.typing = true;
  t.el.textContent = '';
  t.timer = setInterval(() => {
    t.pos++;
    t.el.textContent = t.full.slice(0, t.pos);
    const ch = t.full.charAt(t.pos - 1);
    if (ch && ch.trim()) playTypeBlip(); // 공백은 소리 없음
    if (t.pos >= t.full.length) { clearInterval(t.timer); t.typing = false; }
  }, TYPE_MS);
}
// 아직 글자가 나오는 중이면 한 번에 다 보여주고 true (그럴 땐 다음 대사로 넘기지 않음)
function typeSkip(t) {
  if (!t.typing) return false;
  clearInterval(t.timer); t.typing = false;
  t.el.textContent = t.full;
  return true;
}

const storyScreen = document.getElementById('storyScreen');
const storyNameEl = document.getElementById('storyName');
const storyTextEl = document.getElementById('storyText');

document.getElementById('playBtn').addEventListener('click', () => {
  titleScreen.classList.remove('show');
  gameState = 'story';
  storyIndex = 0;
  showStoryLine();
  storyScreen.classList.add('show');
});

// STORY_LINES(도입부 대사)는 01b-story-text.js 에 있음
let storyIndex = 0;
const storyTypist = makeTypist(storyTextEl);
function showStoryLine() {
  const line = STORY_LINES[storyIndex];
  storyNameEl.style.display = line.name ? 'block' : 'none';
  storyNameEl.textContent = line.name;
  typeStart(storyTypist, line.text); // 글자가 하나씩 나옴
}
function advanceStory() {
  if (gameState !== 'story') return;
  if (typeSkip(storyTypist)) return; // 글자가 나오는 중이면 먼저 한 번에 다 보여줌
  storyIndex++;
  if (storyIndex >= STORY_LINES.length) {
    storyScreen.classList.remove('show');
    gameState = 'playing';
    settingsBtn.classList.add('show');
  } else {
    showStoryLine();
  }
}
document.getElementById('storyBox').addEventListener('click', advanceStory);
document.getElementById('storySkipBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  storyScreen.classList.remove('show');
  gameState = 'playing';
  settingsBtn.classList.add('show');
});
document.getElementById('storyBackBtn').addEventListener('click', () => {
  storyScreen.classList.remove('show');
  gameState = 'title';
  titleScreen.classList.add('show');
});
document.getElementById('storySettingsBtn').addEventListener('click', toggleSettings);
window.addEventListener('keydown', (e) => {
  if (gameState === 'story' && e.key === ' ') { e.preventDefault(); advanceStory(); }
});

let stateBeforeSettings = null;
function toggleSettings() {
  if (gameState === 'settings') {
    gameState = stateBeforeSettings || 'playing';
    settingsScreen.classList.remove('show');
    if (gameState === 'story') storyScreen.classList.add('show');
  } else if (gameState === 'playing' || gameState === 'story') {
    stateBeforeSettings = gameState;
    if (gameState === 'story') storyScreen.classList.remove('show');
    gameState = 'settings';
    settingsScreen.classList.add('show');
  }
}
settingsBtn.addEventListener('click', toggleSettings);
document.getElementById('closeSettingsBtn').addEventListener('click', toggleSettings);
