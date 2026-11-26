/* ============================================================
 * 파일: js/13b-themes.js   (새 파일)
 * 역할: 히든방 4곳의 테마 장식 ("기억이 투영된" 느낌의 반투명한 탑뷰 가구 실루엣)과 히든방3의 컴퓨터 모양
 * 들어있는 것: 가구 그리기 도우미(ghostRect 등), 테마별 그리기(drawLectureTheme / drawLoungeTheme / drawWorkshopTheme / drawExperimentTheme),
 *             drawHiddenTheme(방 번호에 맞는 테마를 골라 그림), drawComputerTerminal(히든방3의 컴퓨터 오브젝트)
 * 테마: 히든방1(방3) = 강의실(칠판, 책상 줄) / 히든방2(방4·5·6) = 휴게실(소파, 자판기, 화분) / 히든방3(방7) = 작업실(컴퓨터, 서류 더미, 서버) / 히든방4(방8) = 실험 공간(실험관, 장비, 수술대 같은 기계)
 * 먼저 로드돼야 하는 파일: 03-world-player.js (hiddenGroup 등), 13-render.js (px 는 그릴 때 쓰임)
 * 주의: 장식은 아주 옅게(alpha 0.1~0.3) 깔아서 오브젝트(노트, 상자, 부품 등)와 통로가 잘 보이게 함. 통로(문)가 있는 벽 가까이에는 큰 가구를 놓지 않음.
 *       모양을 바꾸고 싶으면 해당 테마 함수 안의 숫자(위치/크기)만 고치면 됨. 모든 도형은 정수 좌표의 사각형(도트 느낌), 원은 의자/화분/조명에만 씀
 * ============================================================ */
const BUILD_13B = 43; // 이 파일의 버전 번호 (index.html 의 "파일 버전 검사"가 씀)

const GHOST_LIGHT = '#e8ecff', GHOST_DARK = '#0d0f2b';

// ---- 그리기 도우미 (x 는 방 안 좌표, camX 만큼 빼서 화면 좌표로) ----
function ghostRect(camX, x, y, w, h, alpha, color) {
  bctx.save();
  bctx.globalAlpha = alpha;
  bctx.fillStyle = color || GHOST_LIGHT;
  bctx.fillRect(Math.round(x - camX), Math.round(y), Math.round(w), Math.round(h));
  bctx.restore();
}
function ghostCircle(camX, x, y, r, alpha, color) {
  bctx.save();
  bctx.globalAlpha = alpha;
  bctx.fillStyle = color || GHOST_LIGHT;
  bctx.beginPath(); bctx.arc(Math.round(x - camX), Math.round(y), r, 0, Math.PI * 2); bctx.fill();
  bctx.restore();
}
// 책상(탑뷰) + 의자. 의자는 책상 아래쪽에
function ghostDesk(camX, x, y, w, h, chair) {
  ghostRect(camX, x, y, w, h, 0.14);
  ghostRect(camX, x + 2, y + 2, w - 4, 2, 0.1);
  if (chair) ghostCircle(camX, x + w / 2, y + h + 9, 6, 0.12);
}
function ghostSofa(camX, x, y, w) { // 소파: 등받이 + 방석들
  ghostRect(camX, x, y, w, 12, 0.18);                    // 등받이
  ghostRect(camX, x - 6, y + 2, 7, 30, 0.16);            // 팔걸이
  ghostRect(camX, x + w - 1, y + 2, 7, 30, 0.16);
  for (let i = 0; i + 26 <= w; i += 26) ghostRect(camX, x + 2 + i, y + 12, 24, 20, 0.12); // 방석
}
function ghostVending(camX, x, y) { // 자판기: 세로로 긴 상자, 진열 칸, 투입구
  ghostRect(camX, x, y, 36, 52, 0.2);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) ghostRect(camX, x + 4 + c * 9, y + 5 + r * 10, 7, 7, 0.22, GHOST_DARK);
  ghostRect(camX, x + 4, y + 38, 28, 9, 0.18, GHOST_DARK);
}
function ghostPlant(camX, x, y) { // 화분: 둥근 잎 + 화분
  ghostCircle(camX, x, y, 11, 0.16);
  ghostCircle(camX, x - 6, y + 3, 7, 0.14);
  ghostCircle(camX, x + 6, y + 3, 7, 0.14);
  ghostRect(camX, x - 5, y + 11, 10, 7, 0.2);
}
function ghostServer(camX, x, y, h) { // 서버 랙: 세로로 긴 상자 + 불빛
  ghostRect(camX, x, y, 28, h, 0.2);
  for (let i = 0; i < h; i += 9) {
    ghostRect(camX, x + 3, y + 3 + i, 22, 5, 0.18, GHOST_DARK);
    const on = Math.sin(frameCount * 0.05 + i) > 0;
    ghostRect(camX, x + 20, y + 4 + i, 3, 3, on ? 0.5 : 0.18, on ? '#9dffb4' : GHOST_LIGHT);
  }
}
function ghostPapers(camX, x, y, n) { // 서류 더미: 살짝씩 어긋난 종이들
  for (let i = 0; i < n; i++) ghostRect(camX, x + (i % 2) * 2, y - i * 2, 16, 11, 0.16);
}
function ghostTube(camX, x, y, h) { // 실험관(캡슐): 둥근 머리 + 긴 유리관 + 받침
  ghostRect(camX, x - 9, y + 8, 18, h, 0.14);
  ghostCircle(camX, x, y + 8, 9, 0.14);
  ghostRect(camX, x - 6, y + 14 + Math.round(h * 0.3), 12, Math.round(h * 0.6), 0.1, '#9fd0ff'); // 안의 액체
  ghostRect(camX, x - 12, y + 8 + h, 24, 5, 0.22);
}

// ---- 히든방1: 강의실 (칠판, 교탁, 책상 줄) ----
function drawLectureTheme(camX, left, right) {
  // 칠판: 위쪽 벽을 따라 (가운데 통로 자리는 비움)
  const doorL = HIDDEN_GAP_X - GAP_HALF_X - 10, doorR = HIDDEN_GAP_X + GAP_HALF_X + 10;
  ghostRect(camX, left + 40, WALL_THICK + 4, doorL - (left + 40), 22, 0.2);
  ghostRect(camX, doorR, WALL_THICK + 4, right - 40 - doorR, 22, 0.2);
  ghostRect(camX, left + 52, WALL_THICK + 10, 120, 2, 0.35, GHOST_DARK); // 칠판 글씨
  ghostRect(camX, left + 52, WALL_THICK + 16, 80, 2, 0.35, GHOST_DARK);
  ghostRect(camX, right - 190, WALL_THICK + 10, 110, 2, 0.35, GHOST_DARK);
  ghostRect(camX, left + 60, WALL_THICK + 34, 36, 14, 0.18); // 교탁
  // 책상 줄: 3줄 × 6칸
  const cols = 6, gap = (right - left - 160) / (cols - 1);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < cols; c++) ghostDesk(camX, left + 80 + c * gap - 17, 78 + r * 38, 34, 15, false);
  }
  for (let c = 0; c < cols; c++) ghostCircle(camX, left + 80 + c * gap, 78 + 2 * 38 + 28, 6, 0.1); // 맨 뒷줄 의자
}

// ---- 히든방2: 휴게실 (소파, 자판기, 화분, 탁자). k = 0(맨 아래 방) / 1(가운데) / 2(맨 위) ----
function drawLoungeTheme(camX, left, right, k) {
  if (k === 0) {
    ghostRect(camX, 600, 92, 180, 62, 0.07);          // 러그
    ghostSofa(camX, 630, 96, 104);
    ghostRect(camX, 650, 138, 64, 22, 0.16);          // 탁자
    ghostVending(camX, right - 74, 50);               // 오른쪽 벽의 자판기
    ghostPlant(camX, left + 38, 56);
    ghostPlant(camX, right - 24, 130);
  } else if (k === 1) {
    ghostRect(camX, 560, 80, 240, 90, 0.07);          // 큰 러그
    ghostRect(camX, 640, 106, 80, 34, 0.14);          // 탁자
    ghostRect(camX, 590, 100, 22, 22, 0.16); ghostRect(camX, 590, 130, 22, 22, 0.16);   // 안락의자 두 개
    ghostRect(camX, 748, 100, 22, 22, 0.16); ghostRect(camX, 748, 130, 22, 22, 0.16);
    ghostVending(camX, left + 24, 54);
    ghostPlant(camX, right - 30, 60);
    ghostPlant(camX, left + 36, 170);
  } else {
    ghostSofa(camX, 690, 100, 104);
    ghostRect(camX, 706, 142, 72, 20, 0.16);          // 탁자
    ghostCircle(camX, right - 40, 104, 11, 0.16);     // 정수기(탑뷰 원)
    ghostRect(camX, right - 46, 118, 12, 20, 0.14);
    ghostPlant(camX, left + 36, 60);
    ghostPlant(camX, right - 30, 170);
  }
}

// ---- 히든방3: 작업실 (컴퓨터 책상, 서류 더미, 서버) ----
function drawWorkshopTheme(camX, left, right) {
  // 위쪽 벽을 따라 긴 작업대 (아래 통로 쪽이 아니라 위쪽 통로(오른쪽 끝) 자리는 비움)
  ghostRect(camX, left + 30, WALL_THICK + 4, H3_DOOR_TOP - GAP_HALF_X - 10 - (left + 30), 22, 0.15);
  for (let x = left + 70; x < H3_DOOR_TOP - GAP_HALF_X - 40; x += 120) { // 작업대 위의 모니터
    ghostRect(camX, x, WALL_THICK + 6, 28, 14, 0.2);
    ghostRect(camX, x + 10, WALL_THICK + 20, 8, 3, 0.2);
  }
  // 가운데 책상 + 모니터 + 의자
  ghostDesk(camX, 640, 96, 96, 36, true);
  ghostRect(camX, 676, 102, 24, 14, 0.22, GHOST_DARK);
  // 서류 더미들
  ghostPapers(camX, left + 36, 124, 4);
  ghostPapers(camX, left + 66, 150, 3);
  ghostPapers(camX, right - 150, 160, 5);
  ghostPapers(camX, 560, 170, 3);
  // 서버 랙 (오른쪽 벽)
  ghostServer(camX, right - 44, 56, 54);
  ghostServer(camX, right - 44, 116, 54);
  // 바닥을 지나는 전선
  ghostRect(camX, left + 60, 188, right - left - 150, 2, 0.12);
}

// ---- 히든방4: 실험 공간 (실험관, 수술대 같은 기계, 장비 서랍) ----
function drawExperimentTheme(camX, left, right) {
  // 위쪽 벽을 따라 실험관(캡슐) 줄
  for (let i = 0; i < 9; i++) ghostTube(camX, left + 70 + i * ((right - left - 140) / 8), WALL_THICK + 8, 34);
  // 가운데: 수술대 같은 기계 + 위의 조명 + 끈
  ghostRect(camX, 700, 104, 130, 44, 0.14);
  ghostRect(camX, 706, 110, 118, 32, 0.08);
  ghostRect(camX, 744, 100, 6, 52, 0.18, GHOST_DARK); ghostRect(camX, 780, 100, 6, 52, 0.18, GHOST_DARK); // 묶는 끈
  ghostCircle(camX, 765, 90, 14, 0.12);                                                                   // 수술 조명
  ghostRect(camX, 835, 112, 42, 30, 0.2); ghostCircle(camX, 856, 127, 8, 0.25, GHOST_DARK);               // 옆의 기계
  // 장비 서랍(캐비닛) + 배관
  ghostRect(camX, left + 24, 150, 54, 34, 0.15);
  ghostRect(camX, right - 90, 150, 62, 34, 0.15);
  ghostRect(camX, left + 90, 168, right - left - 190, 3, 0.1);   // 바닥 배관
  ghostRect(camX, 640, 150, 3, 38, 0.1);
  ghostRect(camX, 920, 150, 3, 38, 0.1);
}

// 방 번호에 맞는 테마를 고름 (13-render.js 의 renderRoomLayer 가 히든방일 때 부름)
function drawHiddenTheme(camX, left, right, idx) {
  const g = hiddenGroup(idx);
  if (g === 1) drawLectureTheme(camX, left, right);
  else if (g === 2) drawLoungeTheme(camX, left, right, idx - HIDDEN_ROOM_IDX2);
  else if (g === 3) drawWorkshopTheme(camX, left, right);
  else if (g === 4) drawExperimentTheme(camX, left, right);
}

// ---- 히든방3의 컴퓨터(단서 오브젝트, 계산 미니게임): 모니터 + 받침 + 키보드. 풀고 나면(solved) 화면이 꺼짐 ----
function drawComputerTerminal(ex, y, solved) {
  const on = !solved;
  const glow = 0.55 + 0.25 * Math.sin(frameCount * 0.08);
  px(ex - 14, y - 15, 28, 20, '#2b3550');                         // 모니터 틀
  px(ex - 12, y - 13, 24, 15, on ? '#1f9fd6' : '#20242f');          // 화면
  if (on) {
    bctx.save(); bctx.globalAlpha = glow;
    px(ex - 9, y - 10, 12, 2, '#d8f6ff'); px(ex - 9, y - 6, 17, 2, '#d8f6ff'); px(ex - 9, y - 2, 9, 2, '#d8f6ff');
    bctx.restore();
  }
  px(ex - 3, y + 5, 6, 4, '#4a5575');                              // 받침 기둥
  px(ex - 9, y + 9, 18, 3, '#4a5575');                             // 받침
  px(ex - 12, y + 13, 24, 5, '#39425e');                           // 키보드
  px(ex - 10, y + 14, 20, 1, '#6c7aa6');
}
