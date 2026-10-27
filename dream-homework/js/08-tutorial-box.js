/* ============================================================
 * 파일: js/08-tutorial-box.js
 * 역할: 방0 왼쪽 아래의 튜토리얼 상자 연출
 * 들어있는 것: 상자를 열었을 때 멘트 팝업, 상자를 처음 발견했을 때의 확대/복귀 연출과 "저 상자는 뭐지?" 대사
 * 먼저 로드돼야 하는 파일: 01-core.js, 05-input.js(cancelAllCharges)
 * 주의: 상자 위치와 닿았을 때의 처리는 10-rooms.js(배치)와 12-update.js(판정)에 있음
 * ============================================================ */

// ---- 튜토리얼 상자: 닿으면 자동으로 뜨는 짧은 멘트 ----
const tutorialBoxPopupEl = document.getElementById('tutorialBoxPopup');
function showTutorialBoxPopup() {
  tutorialBoxPopupEl.style.display = 'block';
  requestAnimationFrame(() => { tutorialBoxPopupEl.style.opacity = '1'; });
  setTimeout(() => {
    tutorialBoxPopupEl.style.opacity = '0';
    setTimeout(() => { tutorialBoxPopupEl.style.display = 'none'; }, 350);
  }, 2600);
}

// ---- 상자 발견 연출: 상자 쪽으로 확대됐다가 원래대로 돌아오면서 "저 상자는 뭐지?" 대사가 뜸 ----
const boxNoticeTextEl = document.getElementById('boxNoticeText');
const BOX_NOTICE_DURATION = 110; // 프레임 수 (약 1.8초)
const BOX_NOTICE_MAX_ZOOM = 1.7;
let boxNoticeTimer = 0;
let boxNoticeTarget = null;
function startBoxNotice(box) {
  boxNoticeTarget = box;
  boxNoticeTimer = 0;
  gameState = 'boxNotice';
  boxNoticeTextEl.style.display = 'block';
  // 이동 중이던 충전/속도는 연출 동안 멈추게
  cancelAllCharges();
}
function updateBoxNotice() {
  boxNoticeTimer++;
  if (boxNoticeTimer >= BOX_NOTICE_DURATION) {
    boxNoticeTextEl.style.display = 'none';
    boxNoticeTarget = null;
    gameState = 'playing';
  }
}
// 0→1→0으로 부드럽게 올라갔다 내려오는 곡선 (확대 후 다시 원래 화면으로)
function boxNoticeZoomAmount() {
  const t = boxNoticeTimer / BOX_NOTICE_DURATION;
  return Math.sin(Math.PI * t);
}
