/* ============================================================
 * 파일: js/03-world-player.js
 * 역할: 방(맵)의 크기와 문 위치 상수, 플레이어 정보, 충전 이동 상수
 * 들어있는 것: ROOM_WIDTH/HEIGHT, 문 위치(TOP_GAP_X 등), 히든방 번호, roomBounds(), player 객체(잠긴 방향 포함), 충전/발사 세기 상수
 * 먼저 로드돼야 하는 파일: 01-core.js
 * 주의: 방 번호: 0,1,2=메인 방 / 3=히든방1(강의실) / 4,5,6=히든방2(휴게실, 방 3개: 4(맨 아래) → 5 → 6(맨 위)) / 7=히든방3(작업실) / 8=히든방4(실험 공간).
 *       어느 방의 어느 통로가 어느 방으로 이어지는지는 10-rooms.js 의 DOOR_LINKS 표 하나로 정함. 플레이어 시작 위치(PLAYER_START_X, 튜토리얼 상자 x와 같음)와 처음 해금된 방향(lockedDirs)도 여기서 정함
 * 시작 구역 자유 이동(FREE_ZONE_*), 방향 누름 상태(heldDirs)도 여기에 있음
 * 조작감(충전 시간/발사 거리)을 바꾸고 싶으면: MAX_CHARGE_FRAMES(풀차징까지 걸리는 프레임), MAX_LAUNCH(발사 속도), player.friction(미끄러짐) 세 값을 조절
 * ============================================================ */
const BUILD_03 = 46; // 이 파일의 버전 번호 (index.html 의 "파일 버전 검사"가 씀). 파일을 크게 고치면 숫자를 올리고 index.html 의 검사 목록(BUILD)도 같이 올릴 것


// ---- 방(가로형) 공통 설정: 이제 좌우 벽은 항상 막혀있고, 위/아래 벽에 통로가 있음 ----
const ROOM_WIDTH = 1600;
const ROOM_HEIGHT = 250;
const WALL_THICK = 14;
const TOP_GAP_X = ROOM_WIDTH - 220;   // 위쪽 출구는 오른쪽에 (그림 참고)
const BOTTOM_GAP_X = 220;             // 아래쪽 입구는 왼쪽에
const GAP_HALF_X = 90; // 위/아래 벽에 뚫린 통로의 가로 폭
const HIDDEN_GAP_X = ROOM_WIDTH / 2;  // 히든방1으로 이어지는 검은 통로 (일반 통로와 다른 위치)
const MAIN_ROOM_COUNT = 3;
const HIDDEN_ROOM_IDX = 3;  // rooms 배열의 4번째 칸: 히든방1(강의실). 첫 방(0) 아래쪽 히든방
const HIDDEN_ROOM_IDX2 = 4; // 히든방2(휴게실)의 첫 방(맨 아래). 2번째 방(1) 위쪽 통로로 들어옴
const HIDDEN2_LAST = 6;     // 히든방2의 마지막 방(맨 위). 히든방2는 4 → 5 → 6 으로 이어 붙인 방 3개
const HIDDEN_ROOM_IDX3 = 7; // 히든방3(작업실). 히든방2의 맨 위 방(6) 왼쪽 끝 위쪽 통로로 들어옴
const HIDDEN_ROOM_IDX4 = 8; // 히든방4(실험 공간). 히든방3의 위쪽 통로로 들어옴
const ROOM_TOTAL = 9;       // 방 전체 개수 (메인 3 + 히든 6)
const EXTRA_HIDDEN_SOURCE_ROOM = 1;    // 위쪽에 히든 통로가 추가로 뚫려있는 방
const EXTRA_TOP_HIDDEN_GAP_X = 500;    // 그 방의 정상 출구(TOP_GAP_X)와 겹치지 않는 별도 위치
// 히든방별로 양옆을 좁히는 정도(HIDDEN_INSETS)에 맞춘 통로 위치. 안쪽 벽에서 106px 떨어진 곳이 "끝" 통로
// 히든방2는 예전 폭(1080)의 70%(756)로 줄였고, 아래 방(4)↔가운데 방(5), 가운데 방(5)↔위 방(6) 사이에는 가운데(H2_DOOR_M) 지름길 통로가 더 있음
const H2_DOOR_L = 542;   // 히든방2 왼쪽 끝 통로의 x
const H2_DOOR_M = 800;   // 히든방2 가운데 통로의 x (지름길)
const H2_DOOR_R = 1058;  // 히든방2 오른쪽 끝 통로의 x
const H3_DOOR_BOTTOM = 480;   // 히든방3 아래 통로 (왼쪽 끝, 히든방2의 맨 위 방 왼쪽 끝과 이어짐)
const H3_DOOR_TOP = 1120;     // 히든방3 위 통로 (오른쪽 끝, 히든방4로)
const H4_DOOR_BOTTOM = 1180;  // 히든방4 아래 통로 (오른쪽 끝)
function isHiddenRoom(idx) { return idx === HIDDEN_ROOM_IDX; }
function isHiddenRoom2(idx) { return idx >= HIDDEN_ROOM_IDX2 && idx <= HIDDEN2_LAST; }
function isHiddenRoom3(idx) { return idx === HIDDEN_ROOM_IDX3; }
function isHiddenRoom4(idx) { return idx === HIDDEN_ROOM_IDX4; }
function isAnyHidden(idx) { return idx >= HIDDEN_ROOM_IDX; }
// 히든방 번호(1~4): 히든방1=방3, 히든방2=방4·5·6, 히든방3=방7, 히든방4=방8. 메인 방이면 0
function hiddenGroup(idx) {
  if (isHiddenRoom(idx)) return 1;
  if (isHiddenRoom2(idx)) return 2;
  if (isHiddenRoom3(idx)) return 3;
  if (isHiddenRoom4(idx)) return 4;
  return 0;
}
const HIDDEN_INSETS = { 1: 260, 2: 422, 3: 360, 4: 300 }; // 히든방은 양옆을 이만큼 좁혀서 보여줌 (히든방 번호별). 문 위치 자체는 그대로 유지해 통로 연속성 유지
function roomBounds(idx) {
  const g = hiddenGroup(idx);
  if (g) return { left: HIDDEN_INSETS[g], right: ROOM_WIDTH - HIDDEN_INSETS[g] };
  return { left: 0, right: ROOM_WIDTH };
}

// 튜토리얼 상자(10-rooms.js)의 x좌표. 플레이어도 이 x에서 시작해서, 처음에 아래쪽 키만 열려 있어도 아래로만 내려가면 상자를 만나게 함
const TUTORIAL_BOX_X = WALL_THICK + 40;
const PLAYER_START_X = TUTORIAL_BOX_X;
const player = {
  x: PLAYER_START_X, y: WALL_THICK + 40, // 위쪽에서 시작해서 아래로 내려가며 탐험하게 함
  w: 14, h: 18,
  vx: 0, vy: 0,
  maxSpeed: 8, // 발사 속도(MAX_LAUNCH)보다 커야 발사 직후 속도가 깎이지 않음
  accel: 0.11,
  friction: 0.94, // 클수록 더 오래 미끄러짐 (예전 0.93)
  knockVX: 0, knockVY: 0,
  stunTimer: 0,
  wallPass: false, // 적에게 맞은 뒤 밀려나는 동안은 벽을 통과하고, 끝났는데 벽 안에 있으면 바깥으로 튕겨 나옴 (11-combat-camera.js 가 켜고, 12-update.js 가 처리)
  lockedDirs: { up: true, down: false, left: true, right: true }, // 처음엔 아래로만 갈 수 있음 (진행하며 해금)
  facing: 'down', // 마지막으로 향한 방향 (검을 휘두르는 방향, 방패로 막는 방향, 화염방사기가 나아가는 방향). 방향키를 누르는 순간 바뀜
  faceX: 1,       // 주인공 그림이 바라보는 좌우 (1: 오른쪽, -1: 왼쪽) - 03b-sprites.js
};

// ---- 시작 구역 자유 이동: 방0 왼쪽(투명한 노란선 안쪽) ----
// 위/아래 방향키를 해금하면, 이 구역 안에서는 충전 없이 방향키를 누르는 동안 자유롭게 걸어다닐 수 있음 (구역 밖은 예전처럼 충전-발사)
const FREE_ZONE_ROOM = 0;      // 이 구역이 있는 방 번호
const FREE_ZONE_RIGHT = 170;   // 구역의 오른쪽 경계(노란선)의 x좌표
const FREE_MOVE_SPEED = 2;     // 자유 이동 속도 (프레임당 픽셀)
const ADMIN_MOVE_SPEED = 3.5;  // 관리자 모드로 어디서든 자유 이동할 때의 속도 (넓은 방을 빨리 돌아다니며 확인하려고 조금 더 빠름)
function allDirsUnlocked() {
  return !player.lockedDirs.up && !player.lockedDirs.down && !player.lockedDirs.left && !player.lockedDirs.right;
}
// 시작 구역 자유 이동이 열리는 조건: 위/아래 방향키를 둘 다 해금했을 때 (왼쪽/오른쪽은 아직 잠겨 있어도 됨. 해금된 방향으로만 움직일 수 있음)
function freeZoneUnlocked() { return !player.lockedDirs.up && !player.lockedDirs.down; }
function freeMoveActive() {
  if (adminMode) return true; // 관리자 모드: 어느 방, 어느 곳에서나 충전 없이 자유 이동
  return roomIndex === FREE_ZONE_ROOM && player.x < FREE_ZONE_RIGHT && freeZoneUnlocked();
}
let quizUnlockKnown = false; // 튜토리얼 상자를 찾기 전까진 잠긴 방향키를 눌러도 문제가 안 나옴
let cleared = false;
let adminInvincible = false; // 관리자 모드의 무적 (관리자 도구에서 켜고 끔, 06-lock-quiz.js)
let adminMode = false; // 비밀 코드로 활성화되는 관리자 모드(모든 방향 해금 + 차징 없이 어디서든 자유 이동) - 절대 UI에 노출하지 않음

// ---- 이동 방식: 방향키를 누르고 있으면 충전되고, 떼는 순간 그 방향으로 "발사"되어 미끄러짐 ----
const MAX_CHARGE_FRAMES = 45; // 0.75초(60fps 기준)면 풀차징 (예전 75 = 1.25초)
const MIN_LAUNCH = 0.3, MAX_LAUNCH = 7.5; // 아주 살짝 누르면 아주 조금만 나가도록 최소값을 낮춤 (최대 속도는 예전 5.5)
let chargeStart = { up: null, down: null, left: null, right: null };
const heldDirs = { up: false, down: false, left: false, right: false }; // 지금 누르고 있는 방향키 (자유 이동에 씀)
