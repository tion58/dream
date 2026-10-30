/* ============================================================
 * 파일: js/10-rooms.js
 * 역할: 방 연결 규칙과 적/장애물 배치
 * 들어있는 것: 문 열림 여부(topOpen 등), 방 이동 판정(resolveTop/BottomCrossing), 방별 적·장애물 만들기(buildRoomHazards), rooms 배열, 단서·튜토리얼 상자 배치, 전투 상수
 * 먼저 로드돼야 하는 파일: 03-world-player.js
 * 주의: 배치는 랜덤이 아닌 고정 패턴. 새 방/적을 만들 때 여기서 시작. 문 앞은 비워 두기(적이 문을 막지 않게)
 * ============================================================ */

// ---- 맵 3개: 위/아래 벽에 뚫린 통로로 서로 이어짐 (맵1 출구=위쪽, 맵2 입구=아래쪽 방식) ----
// 마지막 방(idx === MAIN_ROOM_COUNT-1)은 위쪽 문이 없고, 대신 오른쪽 벽 위쪽에 최종 출구가 있음
function topOpen(idx) { return !isHiddenRoom2(idx) && idx !== MAIN_ROOM_COUNT - 1; }
function bottomOpen(idx) { return !isHiddenRoom(idx); }  // 히든방1만 아래쪽 문이 없음(유일한 문이 위쪽)

const RIGHT_EXIT_Y_CENTER = WALL_THICK + 55; // 최종 출구: 오른쪽 벽면 윗부분
const RIGHT_EXIT_HALF_Y = 42;

function topGapX(idx) { return isHiddenRoom(idx) ? HIDDEN_GAP_X : TOP_GAP_X; }
function bottomGapX(idx) {
  if (idx === 0) return HIDDEN_GAP_X;
  if (isHiddenRoom2(idx)) return HIDDEN_GAP_X2;
  return BOTTOM_GAP_X;
}
function topDoorColor(idx) { return isHiddenRoom(idx) ? 'black' : 'pink'; }
function bottomDoorColor(idx) { return (idx === 0 || isHiddenRoom2(idx)) ? 'black' : 'pink'; }

// 위/아래 벽 통과 시 어느 방으로 이어지는지 계산 (실시간 프리뷰 렌더링과 실제 전환 양쪽에서 재사용)
function resolveTopCrossing(hw) {
  const px_ = player.x;
  if (isHiddenRoom(roomIndex)) {
    if (Math.abs(px_ - topGapX(roomIndex)) < (GAP_HALF_X - hw)) return { matched: true, destIdx: 0 };
    return { matched: false };
  }
  if (roomIndex === EXTRA_HIDDEN_SOURCE_ROOM) {
    if (Math.abs(px_ - EXTRA_TOP_HIDDEN_GAP_X) < (GAP_HALF_X - hw)) return { matched: true, destIdx: HIDDEN_ROOM_IDX2 };
    if (topOpen(roomIndex) && Math.abs(px_ - TOP_GAP_X) < (GAP_HALF_X - hw)) return { matched: true, destIdx: roomIndex + 1 };
    return { matched: false };
  }
  if (topOpen(roomIndex) && Math.abs(px_ - topGapX(roomIndex)) < (GAP_HALF_X - hw)) {
    return { matched: true, destIdx: roomIndex + 1 };
  }
  return { matched: false };
}
function resolveBottomCrossing(hw) {
  if (!bottomOpen(roomIndex)) return { matched: false };
  if (Math.abs(player.x - bottomGapX(roomIndex)) >= (GAP_HALF_X - hw)) return { matched: false };
  if (roomIndex === 0) return { matched: true, destIdx: HIDDEN_ROOM_IDX };
  if (isHiddenRoom2(roomIndex)) return { matched: true, destIdx: EXTRA_HIDDEN_SOURCE_ROOM, entryXOverride: EXTRA_TOP_HIDDEN_GAP_X };
  return { matched: true, destIdx: roomIndex - 1 };
}

function buildRoomHazards(topGapXOverride, bottomGapXOverride, extraTopGapX, empty, roomIdxParam) {
  const list = [];
  if (empty) return list; // 히든방: 아무것도 없이 비워둠
  const tGap = topGapXOverride !== undefined ? topGapXOverride : TOP_GAP_X;
  const bGap = bottomGapXOverride !== undefined ? bottomGapXOverride : BOTTOM_GAP_X;

  // 이동하는 적 - 간격을 좁혀서 연쇄 충돌(콤보)이 잘 이어지게 함
  const ENEMY_GAP = roomIdxParam === 0 ? 80 : 55; // 맵1(첫 방)은 적 스폰 간격을 넓혀서 밀도를 줄임
  let ex0 = 220, ei = 0;
  while (ex0 < ROOM_WIDTH - 220) {
    list.push({
      baseX: ex0 + ((ei % 2 === 0) ? 10 : -10),
      amp: 18 + (ei % 3) * 8,
      y: WALL_THICK + 40 + ((ei * 37) % (ROOM_HEIGHT - WALL_THICK * 2 - 80)),
      speed: 0.4 + (ei % 3) * 0.15,
      phase: (ei * Math.PI) / 4,
      r: 16, hitCD: 0,
      type: (ei % 3 === 2) ? 'thrower' : 'enemy',
      throwCD: 60 + (ei % 5) * 12,
    });
    ex0 += ENEMY_GAP;
    ei++;
  }

  // 벽에 붙은 장애물: 문(통로) 부분만 빼고 벽 처음부터 끝까지 이어지는 납작한 띠 형태
  // 단, 맨 앞의 2개는 빼서 시작하자마자 연쇄 충돌에 걸리지 않게 함
  const wallSegW = 30, wallHazardH = 10;
  const DOOR_CLEAR = GAP_HALF_X + 10;
  let topSegIdx = 0, botSegIdx = 0;
  for (let x = WALL_THICK + wallSegW / 2; x < ROOM_WIDTH - WALL_THICK - wallSegW / 2; x += wallSegW) {
    const nearExtra = extraTopGapX !== undefined && Math.abs(x - extraTopGapX) <= DOOR_CLEAR;
    if (!nearExtra && (tGap === null || Math.abs(x - tGap) > DOOR_CLEAR)) {
      if (topSegIdx >= 2) list.push({ baseX: x, amp: 0, y: WALL_THICK + wallHazardH / 2, speed: 0, phase: 0, r: 10, hitCD: 0, type: 'wall', wallW: wallSegW, wallH: wallHazardH });
      topSegIdx++;
    }
    if (bGap === null || Math.abs(x - bGap) > DOOR_CLEAR) {
      if (botSegIdx >= 2) list.push({ baseX: x, amp: 0, y: ROOM_HEIGHT - WALL_THICK - wallHazardH / 2, speed: 0, phase: 0, r: 10, hitCD: 0, type: 'wall', wallW: wallSegW, wallH: wallHazardH });
      botSegIdx++;
    }
  }

  // 바닥을 뛰어다니는(점프하며 양옆으로도 이동하는) 적 - 두 번째 방부터만 등장, 문/통로 부근은 피해서 배치
  if (roomIdxParam !== undefined && roomIdxParam >= 1) {
    const hopperXs = [ROOM_WIDTH * 0.3, ROOM_WIDTH * 0.62, ROOM_WIDTH * 0.85];
    hopperXs.forEach((x, hi) => {
      const nearExtra = extraTopGapX !== undefined && Math.abs(x - extraTopGapX) <= DOOR_CLEAR;
      const nearTop = !nearExtra && tGap !== null && Math.abs(x - tGap) <= DOOR_CLEAR;
      const nearBottom = bGap !== null && Math.abs(x - bGap) <= DOOR_CLEAR;
      if (nearTop || nearBottom) return; // 입출구 자리는 피함
      list.push({
        baseX: x, amp: 26 + (hi % 2) * 10,
        sideAmp: 45 + (hi % 3) * 15, sidePhase: (hi * Math.PI) / 2.3,
        y: ROOM_HEIGHT - WALL_THICK - 26,
        speed: 0.5 + (hi % 3) * 0.1,
        phase: (hi * Math.PI) / 3,
        r: 14, hitCD: 0, type: 'hopper',
      });
    });
  }

  // 맵 가운데: 맞으면 튕겨나가는 오브젝트 하나 + 그냥 벽처럼 막기만 하는(피격 없는) 오브젝트 여러 개를 일정한 간격으로
  list.push({ baseX: ROOM_WIDTH * 0.55, amp: 0, y: ROOM_HEIGHT / 2 - 20, speed: 0, phase: 0, r: 13, hitCD: 0, type: 'centerHazard' });
  for (let f = 0.22; f <= 0.82; f += 0.15) {
    list.push({ baseX: ROOM_WIDTH * f, amp: 0, y: ROOM_HEIGHT / 2 + 22, speed: 0, phase: 0, r: 12, hitCD: 0, type: 'centerBlock' });
  }

  return list;
}
const rooms = [
  buildRoomHazards(undefined, HIDDEN_GAP_X, undefined, false, 0), // 방0: 위쪽은 기본 출구(방1로), 아래쪽은 히든통로
  buildRoomHazards(undefined, undefined, EXTRA_TOP_HIDDEN_GAP_X, false, 1), // 방1: 기본 출구 + 별도 히든 통로
  buildRoomHazards(null, undefined, undefined, false, 2), // 방2(마지막): 위쪽 문이 없어짐(오른쪽 벽으로 이동) - 제외 영역 불필요
  buildRoomHazards(HIDDEN_GAP_X, null, undefined, true),   // 히든방1: 비어있음
  buildRoomHazards(null, HIDDEN_GAP_X2, undefined, true),  // 히든방2: 비어있음
];
// 임시: 히든방에 단서(수량 비교 퀴즈) 오브젝트 하나씩 배치 - 공격 판정 없이 가까이 가면 열림
rooms[HIDDEN_ROOM_IDX].push({ baseX: (roomBounds(HIDDEN_ROOM_IDX).left + roomBounds(HIDDEN_ROOM_IDX).right) / 2, amp: 0, y: ROOM_HEIGHT - WALL_THICK - 26, speed: 0, phase: 0, r: 14, hitCD: 0, type: 'cluePoint', solved: false });
rooms[HIDDEN_ROOM_IDX2].push({ baseX: (roomBounds(HIDDEN_ROOM_IDX2).left + roomBounds(HIDDEN_ROOM_IDX2).right) / 2, amp: 0, y: WALL_THICK + 40, speed: 0, phase: 0, r: 14, hitCD: 0, type: 'cluePoint', solved: false });
// 튜토리얼 상자: 플레이어 시작 x좌표(PLAYER_START_X) 바로 아래에 둠 - 처음엔 아래쪽 키만 열려 있으니, 아래로만 내려가도 만나게 함
// 상호작용 키 없이 닿기만 해도 열림
rooms[0].push({ baseX: PLAYER_START_X, amp: 0, y: ROOM_HEIGHT - WALL_THICK - 30, speed: 0, phase: 0, r: 13, hitCD: 0, type: 'tutorialBox', solved: false, noticed: false });
let roomIndex = 0;
let enemies = rooms[roomIndex];
let projectiles = [];

let frameCount = 0;
const KNOCK_DOWN = 9, KNOCK_SIDE_MAX = 4, KNOCK_CHAIN_EXTRA = 5, KNOCK_FRICTION = 0.88;
const STUN_DURATION = 30, ENEMY_HIT_CD = 18;
const PROJ_R = 6; // 거리에 비례해 아치 높이/체공 시간을 계산해서 물풍선을 던지듯 포물선을 그림
