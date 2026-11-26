/* ============================================================
 * 파일: js/08-tutorial-box.js
 * 역할: 방0 왼쪽 아래의 튜토리얼 상자 연출
 * 들어있는 것: 상자를 열었을 때 멘트 팝업, 상자를 처음 발견했을 때의 확대(BOX_NOTICE_IN) → 유지(HOLD) → 복귀(OUT) 연출과 "저 상자는 뭐지?" 대사
 * 먼저 로드돼야 하는 파일: 01-core.js, 05-input.js(cancelAllCharges)
 * 주의: 확대 연출의 시간은 BOX_NOTICE_IN / HOLD / OUT 세 숫자로 조절. 상자 위치와 닿았을 때의 처리는 10-rooms.js(배치)와 12-update.js(판정)에 있음
 * ============================================================ */
const BUILD_08 = 42; // 이 파일의 버전 번호 (index.html 의 "파일 버전 검사"가 씀)


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
// 연출은 세 구간: 커지는 구간 → 그대로 유지하는 구간 → 풀리는 구간 (60프레임 = 1초)
const BOX_NOTICE_IN = 50;    // 상자 쪽으로 서서히 확대되는 시간
const BOX_NOTICE_HOLD = 70;  // 확대한 채로 가만히 상자를 보여주는 시간 (더 오래 보여주고 싶으면 이 숫자를 키우기)
const BOX_NOTICE_OUT = 50;   // 다시 원래 화면으로 돌아오는 시간
const BOX_NOTICE_DURATION = BOX_NOTICE_IN + BOX_NOTICE_HOLD + BOX_NOTICE_OUT; // 전체 프레임 수 (170 = 약 2.8초)
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
// 0 → 1 → 1 → 0 곡선: 확대(부드럽게 시작해서 부드럽게 끝남) → 유지(1) → 복귀
function boxNoticeZoomAmount() {
  const t = boxNoticeTimer;
  const ease = (x) => x * x * (3 - 2 * x); // 시작과 끝이 부드러운 곡선
  if (t < BOX_NOTICE_IN) return ease(t / BOX_NOTICE_IN);
  if (t < BOX_NOTICE_IN + BOX_NOTICE_HOLD) return 1;
  return ease(Math.max(0, 1 - (t - BOX_NOTICE_IN - BOX_NOTICE_HOLD) / BOX_NOTICE_OUT));
}
