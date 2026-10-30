/* ============================================================
 * 파일: js/03-world-player.js
 * 역할: 방(맵)의 크기와 문 위치 상수, 플레이어 정보, 충전 이동 상수
 * 들어있는 것: ROOM_WIDTH/HEIGHT, 문 위치(TOP_GAP_X 등), 히든방 번호, roomBounds(), player 객체(잠긴 방향 포함), 충전/발사 세기 상수
 * 먼저 로드돼야 하는 파일: 01-core.js
 * 주의: 방 번호: 0,1,2=메인 방 / 3=히든방1 / 4=히든방2. 플레이어 시작 위치(PLAYER_START_X)와 처음 해금된 방향(lockedDirs)도 여기서 정함
 * 조작감(충전 시간/발사 거리)을 바꾸고 싶으면: MAX_CHARGE_FRAMES(풀차징까지 걸리는 프레임), MAX_LAUNCH(발사 속도), player.friction(미끄러짐) 세 값을 조절
 * ============================================================ */

// ---- 방(가로형) 공통 설정: 이제 좌우 벽은 항상 막혀있고, 위/아래 벽에 통로가 있음 ----
const ROOM_WIDTH = 1600;
const ROOM_HEIGHT = 250;
const WALL_THICK = 14;
const TOP_GAP_X = ROOM_WIDTH - 220;   // 위쪽 출구는 오른쪽에 (그림 참고)
const BOTTOM_GAP_X = 220;             // 아래쪽 입구는 왼쪽에
const GAP_HALF_X = 90; // 위/아래 벽에 뚫린 통로의 가로 폭
const HIDDEN_GAP_X = ROOM_WIDTH / 2;  // 히든방1으로 이어지는 검은 통로 (일반 통로와 다른 위치)
const MAIN_ROOM_COUNT = 3;
const HIDDEN_ROOM_IDX = 3;  // rooms 배열의 4번째 칸: 첫 방(0) 아래쪽 히든방
const HIDDEN_ROOM_IDX2 = 4; // rooms 배열의 5번째 칸: 2번째 방(1) 위쪽 히든방 (위/아래 양쪽에 히든방)
const EXTRA_HIDDEN_SOURCE_ROOM = 1;    // 위쪽에 히든 통로가 추가로 뚫려있는 방
const EXTRA_TOP_HIDDEN_GAP_X = 500;    // 그 방의 정상 출구(TOP_GAP_X)와 겹치지 않는 별도 위치
const HIDDEN_GAP_X2 = ROOM_WIDTH / 2;  // 히든방2의 유일한 통로(아래쪽) 위치
function isHiddenRoom(idx) { return idx === HIDDEN_ROOM_IDX; }
function isHiddenRoom2(idx) { return idx === HIDDEN_ROOM_IDX2; }
function isAnyHidden(idx) { return isHiddenRoom(idx) || isHiddenRoom2(idx); }
const HIDDEN_INSET = 260; // 히든방은 양옆을 이만큼 좁혀서 보여줌 (문 위치 자체는 그대로 유지해 통로 연속성 유지)
function roomBounds(idx) {
  if (isAnyHidden(idx)) return { left: HIDDEN_INSET, right: ROOM_WIDTH - HIDDEN_INSET };
  return { left: 0, right: ROOM_WIDTH };
}

// 플레이어가 처음 서는 x좌표. 튜토리얼 상자(10-rooms.js)도 같은 x에 둬서, 시작하자마자 아래로만 내려가도 상자에 닿게 함
const PLAYER_START_X = BOTTOM_GAP_X;
const player = {
  x: PLAYER_START_X, y: WALL_THICK + 40, // 위쪽에서 시작해서 아래로 내려가며 탐험하게 함
  w: 14, h: 18,
  vx: 0, vy: 0,
  maxSpeed: 8, // 발사 속도(MAX_LAUNCH)보다 커야 발사 직후 속도가 깎이지 않음
  accel: 0.11,
  friction: 0.94, // 클수록 더 오래 미끄러짐 (예전 0.93)
  knockVX: 0, knockVY: 0,
  stunTimer: 0,
  lockedDirs: { up: true, down: false, left: true, right: true }, // 처음엔 아래로만 갈 수 있음 (진행하며 해금)
};
let quizUnlockKnown = false; // 튜토리얼 상자를 찾기 전까진 잠긴 방향키를 눌러도 문제가 안 나옴
let cleared = false;
let adminMode = false; // 비밀 코드로 활성화되는 관리자 모드(차징 없이 즉시 발사) - 절대 UI에 노출하지 않음

// ---- 이동 방식: 방향키를 누르고 있으면 충전되고, 떼는 순간 그 방향으로 "발사"되어 미끄러짐 ----
const MAX_CHARGE_FRAMES = 45; // 0.75초(60fps 기준)면 풀차징 (예전 75 = 1.25초)
const MIN_LAUNCH = 0.3, MAX_LAUNCH = 7.5; // 아주 살짝 누르면 아주 조금만 나가도록 최소값을 낮춤 (최대 속도는 예전 5.5)
let chargeStart = { up: null, down: null, left: null, right: null };
