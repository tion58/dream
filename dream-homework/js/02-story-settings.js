/* ============================================================
 * 파일: js/02-story-settings.js
 * 역할: 타이틀 → 스토리 대사 → 설정 화면
 * 들어있는 것: PLAY 버튼, STORY_LINES(도입부 대사), 스토리 진행/SKIP/뒤로가기, 설정 열고 닫기(toggleSettings)
 * 먼저 로드돼야 하는 파일: 01-core.js
 * 주의: 대사를 바꾸거나 추가할 때는 STORY_LINES 배열만 고치면 됨
 * ============================================================ */

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

// ---- 임시: 도입부 스토리 (과제하다 졸려서 잠들어 게임 세계로 들어옴) ----
const STORY_LINES = [
  { name: '', text: '오늘도 밤늦게까지 과제를 붙잡고 있었다.' },
  { name: '', text: '눈이 자꾸 감긴다... 딱 5분만 눈 좀 붙이자...' },
  { name: '???', text: '...음? 여긴 어디지?' },
  { name: '???', text: '분명 방금까지 책상 앞이었는데...' },
  { name: '???', text: '일단 이 이상한 곳을 벗어나야 할 것 같아. 과제도 마쳐야 하니까.' },
  { name: '???', text: '어라... 몸이 이상하게 말을 안 듣네? 일단 아래쪽으로는 움직일 수 있는 것 같아.' },
];
let storyIndex = 0;
function showStoryLine() {
  const line = STORY_LINES[storyIndex];
  storyNameEl.style.display = line.name ? 'block' : 'none';
  storyNameEl.textContent = line.name;
  storyTextEl.textContent = line.text;
}
function advanceStory() {
  if (gameState !== 'story') return;
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
