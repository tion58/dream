/* ============================================================
 * 파일: js/07b-reader.js
 * 역할: 연구 노트 / 찢어진 쪽지를 읽는 화면 (쪽을 넘기는 느낌의 애니메이션 포함)
 * 들어있는 것: NOTEBOOK_PAGES(노트 내용), TORN_NOTE_PAGES(쪽지 내용), openReader, closeReader, turnReaderPage, handleReaderKey
 * 먼저 로드돼야 하는 파일: 01-core.js (quizOpen 변수를 일시정지용으로 같이 씀)
 * 주의: 노트 그림이 아직 없어서, 종이 모양의 임시 화면 + 쪽 넘김 효과만 있음. 모양은 style.css 의 #readerScreen / .readerPage 쪽
 *       화면 구조(HTML)는 index.html 의 #readerScreen
 * ============================================================ */
const BUILD_07B = 46; // 이 파일의 버전 번호 (index.html 의 "파일 버전 검사"가 씀). 파일을 크게 고치면 숫자를 올리고 index.html 의 검사 목록(BUILD)도 같이 올릴 것


// 노트/쪽지/서류의 글(NOTEBOOK_PAGES 등)은 01b-story-text.js 에 있음

let readerOpen = false;
let readerPages = [], readerIndex = 0, readerBusy = false, readerCloseCb = null; // readerCloseCb: 다 읽고 닫을 때 실행할 일 (선택)
const readerScreen = document.getElementById('readerScreen');
const readerBookEl = document.getElementById('readerBook');
const readerTitleEl = document.getElementById('readerTitle');
const readerUnderEl = document.getElementById('readerPageUnder'); // 아래에 깔린 쪽 (다음 쪽/지금 쪽)
const readerTurnEl = document.getElementById('readerPageTurn');   // 위에서 넘어가는 쪽
const readerNumEl = document.getElementById('readerPageNum');
const readerPrevBtn = document.getElementById('readerPrev');
const readerNextBtn = document.getElementById('readerNext');
const READER_TURN_MS = 460; // 쪽 넘김 애니메이션 시간 (style.css 의 0.45s 와 맞춤)

function updateReaderButtons() {
  const multi = readerPages.length > 1;
  readerPrevBtn.style.display = multi ? '' : 'none';
  readerNextBtn.style.display = multi ? '' : 'none';
  readerNumEl.style.display = multi ? '' : 'none';
  readerNumEl.textContent = `${readerIndex + 1} / ${readerPages.length}`;
  readerPrevBtn.classList.toggle('disabled', readerIndex <= 0);
  readerNextBtn.classList.toggle('disabled', readerIndex >= readerPages.length - 1);
}
function openReader(pages, kind, title, onClose) {
  readerPages = pages; readerIndex = 0; readerBusy = false; readerCloseCb = onClose || null;
  const isPaper = kind === 'paper';
  readerBookEl.classList.toggle('paper', isPaper);
  readerTitleEl.textContent = title || (isPaper ? '찢어진 쪽지' : '연구 노트');
  readerUnderEl.textContent = pages[0];
  readerTurnEl.textContent = pages[0];
  readerTurnEl.classList.remove('turnOut', 'turnIn');
  updateReaderButtons();
  readerOpen = true;
  quizOpen = true; // 읽는 동안 게임을 멈춤 (적이 멈추고 새 피격은 무시됨)
  readerScreen.classList.add('show');
}
function closeReader() {
  readerOpen = false;
  quizOpen = false;
  readerScreen.classList.remove('show');
  const cb = readerCloseCb; readerCloseCb = null;
  if (cb) cb();
}
// step: +1 다음 쪽, -1 이전 쪽. 쪽이 위에서 왼쪽으로 넘어가는(또는 되돌아오는) 느낌을 줌
function turnReaderPage(step) {
  if (readerBusy) return;
  const target = readerIndex + step;
  if (target < 0 || target >= readerPages.length) return;
  readerBusy = true;
  if (step > 0) {
    readerUnderEl.textContent = readerPages[target];   // 아래에는 다음 쪽이 보이고
    readerTurnEl.classList.add('turnOut');             // 지금 쪽이 넘어가며 사라짐
  } else {
    readerUnderEl.textContent = readerPages[readerIndex];
    readerTurnEl.textContent = readerPages[target];    // 이전 쪽이 다시 덮이며 돌아옴
    readerTurnEl.classList.add('turnIn');
  }
  setTimeout(() => {
    readerIndex = target;
    readerUnderEl.textContent = readerPages[target];
    readerTurnEl.textContent = readerPages[target];
    readerTurnEl.classList.remove('turnOut', 'turnIn');
    readerBusy = false;
    updateReaderButtons();
  }, READER_TURN_MS);
}
// 마지막 쪽에서 "다음"을 누르면 닫힘 (한 장짜리 쪽지는 바로 닫힘)
function readerNextOrClose() {
  if (readerIndex >= readerPages.length - 1) { if (!readerBusy) closeReader(); }
  else turnReaderPage(1);
}
function handleReaderKey(e) {
  if (e.repeat) return; // 키를 꾹 누르고 있을 때 연속으로 넘어가거나 열자마자 닫히는 것 방지
  const k = e.key;
  if (k === 'ArrowRight' || k === 'd' || k === 'D' || k === ' ' || k === 'Enter') { e.preventDefault(); readerNextOrClose(); }
  else if (k === 'ArrowLeft' || k === 'a' || k === 'A') { e.preventDefault(); turnReaderPage(-1); }
  else if (k === 'Escape' || k === 'e' || k === 'E') { closeReader(); }
}
readerNextBtn.addEventListener('click', () => turnReaderPage(1));
readerPrevBtn.addEventListener('click', () => turnReaderPage(-1));
document.getElementById('readerClose').addEventListener('click', closeReader);
readerBookEl.addEventListener('click', readerNextOrClose); // 종이를 눌러도 다음 쪽으로
