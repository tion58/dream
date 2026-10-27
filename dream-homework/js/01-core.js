/* ============================================================
 * 파일: js/01-core.js
 * 역할: 게임 전체가 같이 쓰는 기본 준비물
 * 들어있는 것: HTML 요소 가져오기, 게임 상태 변수(gameState, quizOpen 등), 화면 비율(해상도) 설정, 화면 크기/세로모드 감지(resize)
 * 먼저 로드돼야 하는 파일: 없음 (가장 먼저)
 * 주의: gameState 값 목록: title / story / playing / settings / clueGame / clueGameEnter / boxNotice. 새 상태를 추가하면 update()와 draw()에도 처리를 넣어야 함
 * ============================================================ */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const clearMsg = document.getElementById('clearMsg');
const titleScreen = document.getElementById('titleScreen');
const settingsScreen = document.getElementById('settingsScreen');
const rotateBlock = document.getElementById('rotateBlock');
const resButtonsEl = document.getElementById('resButtons');
const settingsBtn = document.getElementById('settingsBtn');
const quizScreen = document.getElementById('quizScreen');
const quizProblemEl = document.getElementById('quizProblem');
const quizAnswerEl = document.getElementById('quizAnswer');
const quizFeedbackEl = document.getElementById('quizFeedback');
const quizDirLabelEl = document.getElementById('quizDirLabel');
const clueScreen = document.getElementById('clueScreen');
const clueOptAEl = document.getElementById('clueOptA');
const clueOptBEl = document.getElementById('clueOptB');
const clueFeedbackEl = document.getElementById('clueFeedback');
const clueResultEl = document.getElementById('clueResult');

let gameState = 'title';
let blockedByPortrait = false;
let quizOpen = false;
let clueOpen = false; // 임시: 히든방 단서 퀴즈 (양/수량 비교) 열림 여부
let currentQuizDir = null;
let currentCluePoint = null;
let clueA = 0, clueB = 0;

const RES_PRESETS = [
  { ratio: 16 / 9, label: '16:9' },
  { ratio: 4 / 3, label: '4:3' },
  { ratio: 21 / 9, label: '21:9' },
];
let resIndex = 0;
const BASE_H = 270;
let GAME_W = Math.round(BASE_H * RES_PRESETS[resIndex].ratio);
let GAME_H = BASE_H;
const buf = document.createElement('canvas');
const bctx = buf.getContext('2d');
function applyResolution() {
  GAME_W = Math.round(BASE_H * RES_PRESETS[resIndex].ratio);
  GAME_H = BASE_H;
  buf.width = GAME_W; buf.height = GAME_H;
  bctx.imageSmoothingEnabled = false;
}
applyResolution();

RES_PRESETS.forEach((p, i) => {
  const b = document.createElement('div');
  b.className = 'bigBtn' + (i === resIndex ? ' selected' : '');
  b.textContent = p.label;
  b.addEventListener('click', () => {
    resIndex = i;
    applyResolution();
    [...resButtonsEl.children].forEach((c, ci) => c.classList.toggle('selected', ci === i));
  });
  resButtonsEl.appendChild(b);
});

function getViewport() {
  const w = document.documentElement.clientWidth || window.innerWidth;
  const h = document.documentElement.clientHeight || window.innerHeight;
  return { w, h };
}
function checkOrientation() {
  const { w, h } = getViewport();
  blockedByPortrait = h > w * 1.02;
  rotateBlock.classList.toggle('show', blockedByPortrait);
}
function resize() {
  const { w, h } = getViewport();
  canvas.width = w; canvas.height = h;
  ctx.imageSmoothingEnabled = false;
  checkOrientation();
}
window.addEventListener('resize', resize);
