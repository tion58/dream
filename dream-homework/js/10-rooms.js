/* ============================================================
 * 파일: js/10-rooms.js
 * 역할: 방 연결 규칙과 적/장애물 배치
 * 들어있는 것: 문 연결 표(DOOR_LINKS)와 거기서 만든 통로 목록(topDoors/bottomDoors), 방 이동 판정(resolveTop/BottomCrossing), 방별 적·장애물 만들기(buildRoomHazards: 메인 방의 슬라롬 장애물 포함), rooms 배열(방 9개), 히든방 오브젝트(노트/쪽지/용기/서랍/상자/부품/컴퓨터), 단서·튜토리얼 상자 배치, 전투 상수
 * 먼저 로드돼야 하는 파일: 03-world-player.js
 * 주의: 배치는 랜덤이 아닌 고정 패턴. 새 방/적을 만들 때 여기서 시작. 문 앞은 비워 두기(적이 문을 막지 않게).
 *       방끼리 이어지는 통로를 바꾸려면 DOOR_LINKS 표만 고치면 됨(방 A의 위쪽 통로 x ↔ 방 B의 아래쪽 통로 x). 위쪽 통로로 올라가면 B의 아래쪽 통로로 나오고, B의 아래쪽 통로로 내려가면 A의 위쪽 통로로 나옴
 * ============================================================ */
const BUILD_10 = 48; // 이 파일의 버전 번호 (index.html 의 "파일 버전 검사"가 씀). 파일을 크게 고치면 숫자를 올리고 index.html 의 검사 목록(BUILD)도 같이 올릴 것


const ENEMY_MAX_HP = 10; // 적 체력 (한 번에 검 3 / 방패 1 / 화염방사기 0.25초마다 1: 11b-weapons.js 의 WEAPONS)

// ---- 문 연결 표: "방 a 의 위쪽 벽 통로(ax) ↔ 방 b 의 아래쪽 벽 통로(bx)" ----
// 위로 나가면 b 의 아래쪽 통로(bx)로 이어지고, b 의 아래쪽 통로로 내려가면 a 의 위쪽 통로(ax)로 이어짐. color: 'pink'(일반 통로) | 'black'(히든 통로)
// 한 방에 통로가 여러 개 있어도 됨 (예: 히든방2는 끝 통로 + 가운데 지름길)
const DOOR_LINKS = [
  { a: 0, ax: TOP_GAP_X, b: 1, bx: BOTTOM_GAP_X, color: 'pink' },                           // 방0 → 방1
  { a: 1, ax: TOP_GAP_X, b: 2, bx: BOTTOM_GAP_X, color: 'pink' },                           // 방1 → 방2
  { a: HIDDEN_ROOM_IDX, ax: HIDDEN_GAP_X, b: 0, bx: HIDDEN_GAP_X, color: 'black' },        // 방0 아래 ↔ 히든방1 위
  { a: 1, ax: EXTRA_TOP_HIDDEN_GAP_X, b: 4, bx: H2_DOOR_R, color: 'black' },                // 방1 위(별도 통로) ↔ 히든방2 맨 아래 방(4)
  { a: 4, ax: H2_DOOR_L, b: 5, bx: H2_DOOR_L, color: 'black' },                             // 히든방2: 방4 ↔ 방5 (왼쪽 끝)
  { a: 4, ax: H2_DOOR_M, b: 5, bx: H2_DOOR_M, color: 'black' },                             //          방4 ↔ 방5 (가운데 지름길)
  { a: 5, ax: H2_DOOR_R, b: 6, bx: H2_DOOR_R, color: 'black' },                             //          방5 ↔ 방6 (오른쪽 끝)
  { a: 5, ax: H2_DOOR_M, b: 6, bx: H2_DOOR_M, color: 'black' },                             //          방5 ↔ 방6 (가운데 지름길)
  { a: 6, ax: H2_DOOR_L, b: HIDDEN_ROOM_IDX3, bx: H3_DOOR_BOTTOM, color: 'black' },         // 히든방2 맨 위 방(6) 왼쪽 끝 위 ↔ 히든방3 아래
  { a: HIDDEN_ROOM_IDX3, ax: H3_DOOR_TOP, b: HIDDEN_ROOM_IDX4, bx: H4_DOOR_BOTTOM, color: 'black' }, // 히든방3 위 ↔ 히든방4 아래
];
// 방 idx 의 위쪽 벽 통로 목록: { x: 통로 위치, destIdx: 올라가면 도착하는 방, destX: 그 방의 아래쪽 통로 x, color }
function topDoors(idx) { return DOOR_LINKS.filter(l => l.a === idx).map(l => ({ x: l.ax, destIdx: l.b, destX: l.bx, color: l.color })); }
// 방 idx 의 아래쪽 벽 통로 목록: { x, destIdx: 내려가면 도착하는 방, destX: 그 방의 위쪽 통로 x, color }
function bottomDoors(idx) { return DOOR_LINKS.filter(l => l.b === idx).map(l => ({ x: l.bx, destIdx: l.a, destX: l.ax, color: l.color })); }
function topOpen(idx) { return topDoors(idx).length > 0; }
function bottomOpen(idx) { return bottomDoors(idx).length > 0; }

// (마지막 방 오른쪽 벽의 맵 탈출구는 없앴음. 엔딩과 관련이 없어서. 엔딩이 일어나는 방법은 따로 정할 예정)

// 위/아래 벽 통과 시 어느 방으로 이어지는지 계산 (실시간 프리뷰 렌더링과 실제 전환 양쪽에서 재사용)
// 맞는 통로가 있으면 { matched: true, destIdx, entryXOverride: 도착할 x }
function findDoorAt(doors, hw) {
  for (const d of doors) if (Math.abs(player.x - d.x) < (GAP_HALF_X - hw)) return { matched: true, destIdx: d.destIdx, entryXOverride: d.destX };
  return { matched: false };
}
function resolveTopCrossing(hw) { return findDoorAt(topDoors(roomIndex), hw); }
function resolveBottomCrossing(hw) { return findDoorAt(bottomDoors(roomIndex), hw); }

// ---- 메인 방(0,1,2)의 슬라롬 장애물: 위에서 내려온 구름 기둥과 아래에서 올라온 구름 기둥이 번갈아 서 있어서, 위/아래로 번갈아 빈틈으로 지나가야 함 ----
const SLALOM_START_X = 340;     // 첫 기둥의 x (시작 지점과 입구는 비워 둠)
const SLALOM_STEP = 180;        // 기둥 사이 간격
const SLALOM_BLOCKS = 5;        // 기둥 하나를 이루는 구름 덩어리 개수 (많을수록 빈틈이 좁아짐: 5개면 빈틈 약 100px)
const SLALOM_DOOR_CLEAR = 115;  // 통로(문) 위치에서 이만큼은 기둥을 세우지 않음
function slalomColumnXs(idx) {
  const gaps = topDoors(idx).concat(bottomDoors(idx)).map(d => d.x);
  const xs = [];
  for (let x = SLALOM_START_X; x < ROOM_WIDTH - 220; x += SLALOM_STEP) {
    if (gaps.some(g => Math.abs(x - g) < SLALOM_DOOR_CLEAR)) continue;
    xs.push(x);
  }
  return xs;
}

function buildRoomHazards(roomIdxParam) {
  const list = [];
  if (isAnyHidden(roomIdxParam)) return list; // 히든방: 아무것도 없이 비워둠
  const tops = topDoors(roomIdxParam), bots = bottomDoors(roomIdxParam);
  const regularTops = tops.filter(d => d.color === 'pink'), hiddenTops = tops.filter(d => d.color === 'black');

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
      r: (ei % 3 === 2) ? 16 : 13, hitCD: 0, hp: ENEMY_MAX_HP, maxHp: ENEMY_MAX_HP, // 빨간 적(enemy)은 보라색 적(thrower)보다 조금 작음
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
    if (!tops.some(d => Math.abs(x - d.x) <= DOOR_CLEAR)) {
      if (topSegIdx >= 2) list.push({ baseX: x, amp: 0, y: WALL_THICK + wallHazardH / 2, speed: 0, phase: 0, r: 10, hitCD: 0, type: 'wall', wallW: wallSegW, wallH: wallHazardH });
      topSegIdx++;
    }
    if (!bots.some(d => Math.abs(x - d.x) <= DOOR_CLEAR)) {
      if (botSegIdx >= 2) list.push({ baseX: x, amp: 0, y: ROOM_HEIGHT - WALL_THICK - wallHazardH / 2, speed: 0, phase: 0, r: 10, hitCD: 0, type: 'wall', wallW: wallSegW, wallH: wallHazardH });
      botSegIdx++;
    }
  }

  // 바닥을 뛰어다니는(점프하며 양옆으로도 이동하는) 적 - 두 번째 방부터만 등장, 문/통로 부근은 피해서 배치
  if (roomIdxParam >= 1) {
    const hopperXs = [ROOM_WIDTH * 0.3, ROOM_WIDTH * 0.62, ROOM_WIDTH * 0.85];
    hopperXs.forEach((x, hi) => {
      const nearExtra = hiddenTops.some(d => Math.abs(x - d.x) <= DOOR_CLEAR);
      const nearTop = !nearExtra && regularTops.some(d => Math.abs(x - d.x) <= DOOR_CLEAR);
      const nearBottom = bots.some(d => Math.abs(x - d.x) <= DOOR_CLEAR);
      if (nearTop || nearBottom) return; // 입출구 자리는 피함
      list.push({
        baseX: x, amp: 26 + (hi % 2) * 10,
        sideAmp: 45 + (hi % 3) * 15, sidePhase: (hi * Math.PI) / 2.3,
        y: ROOM_HEIGHT - WALL_THICK - 26,
        speed: 0.5 + (hi % 3) * 0.1,
        phase: (hi * Math.PI) / 3,
        r: 14, hitCD: 0, hp: ENEMY_MAX_HP, maxHp: ENEMY_MAX_HP, type: 'hopper',
      });
    });
  }

  // 맵 가운데: 맞으면 튕겨나가는 오브젝트 하나
  list.push({ baseX: ROOM_WIDTH * 0.55, amp: 0, y: ROOM_HEIGHT / 2 - 20, speed: 0, phase: 0, r: 13, hitCD: 0, type: 'centerHazard' });
  // 슬라롬: 위/아래에서 번갈아 내려오고 올라온 구름 기둥 (그냥 막기만 하는 centerBlock 을 쌓아서 만듦. 피격은 없음)
  slalomColumnXs(roomIdxParam).forEach((x, ci) => {
    const fromTop = ci % 2 === 0; // 첫 기둥은 위에서 내려옴 → 아래로 빈틈
    for (let k = 0; k < SLALOM_BLOCKS; k++) {
      const y = fromTop ? WALL_THICK + 12 + k * 24 : ROOM_HEIGHT - WALL_THICK - 12 - k * 24;
      list.push({ baseX: x, amp: 0, y: y, speed: 0, phase: 0, r: 12, hitCD: 0, type: 'centerBlock' });
    }
  });

  return list;
}
const rooms = [];
for (let ri = 0; ri < ROOM_TOTAL; ri++) rooms.push(buildRoomHazards(ri)); // 메인 방 0,1,2 는 적/장애물이 있고, 히든방 3~8 은 비어 있음
// ---- 히든방 오브젝트 ----
// 공통 모양을 만들어 주는 도우미 (움직이지 않는 오브젝트용)
function makeObject(type, x, y, r, extra) {
  return Object.assign({ baseX: x, amp: 0, y: y, speed: 0, phase: 0, r: r, hitCD: 0, type: type }, extra || {});
}
const H1 = roomBounds(HIDDEN_ROOM_IDX), H2 = roomBounds(HIDDEN_ROOM_IDX2), H3 = roomBounds(HIDDEN_ROOM_IDX3), H4 = roomBounds(HIDDEN_ROOM_IDX4);
const H1_LEFT = H1.left + WALL_THICK, H1_RIGHT = H1.right - WALL_THICK; // 히든방1 안쪽 벽 x좌표
const H2_LEFT = H2.left + WALL_THICK, H2_RIGHT = H2.right - WALL_THICK; // 히든방2 안쪽 벽 x좌표
const H3_LEFT = H3.left + WALL_THICK, H3_RIGHT = H3.right - WALL_THICK; // 히든방3 안쪽 벽 x좌표
const H4_LEFT = H4.left + WALL_THICK, H4_RIGHT = H4.right - WALL_THICK; // 히든방4 안쪽 벽 x좌표
const LAB_FLOOR_Y = ROOM_HEIGHT - WALL_THICK - 24; // 바닥(아래쪽 벽 바로 위)에 놓는 물건의 y

// 히든방1 (강의실): 가운데 아래에 첫 단서(정답은 방1로 넘어갈 때 입력), 왼쪽 구석에 연구 노트와 찢어진 쪽지, 오른쪽 구석에 용기, 부품1
rooms[HIDDEN_ROOM_IDX].push(makeObject('cluePoint', (H1.left + H1.right) / 2, ROOM_HEIGHT - WALL_THICK - 26, 14, { solved: false, useAtRoom: 1, game: 'lanes', answer: '졸음신호' })); // 첫 번째 미니게임(레인 회피). 정답은 임시
rooms[HIDDEN_ROOM_IDX].push(makeObject('notebook', H1_LEFT + 32, LAB_FLOOR_Y, 12, { prompt: 'E 연구 노트 읽기' }));
rooms[HIDDEN_ROOM_IDX].push(makeObject('tornNote', H1_LEFT + 72, LAB_FLOOR_Y, 11, { giveItem: 'tornNote', prompt: 'E 쪽지 읽기' }));
rooms[HIDDEN_ROOM_IDX].push(makeObject('pickup', H1_RIGHT - 32, LAB_FLOOR_Y, 13, { item: 'container', taken: false, prompt: 'E 용기 줍기' })); // 한 번 주우면 사라지고 다시 못 줍는다
rooms[HIDDEN_ROOM_IDX].push(makeObject('pickup', H1_LEFT + 170, LAB_FLOOR_Y, 12, { item: 'part1', taken: false, prompt: 'E 부품 줍기' })); // 부품1: 모든 무기에 들어가는 기본 부품 (위치는 임시)

// 히든방2 (휴게실): 방 3개를 이어 붙임. 아래에서부터 방4 → 방5 → 방6. 방 사이는 끝 통로(왼쪽/오른쪽)와 가운데 지름길로 이어짐
//   방4(맨 아래): 오른쪽 끝에서 들어옴. 막다른 왼쪽 끝에 서랍(문제를 풀면 망치)
//   방5(가운데): 단서(미니게임 없이 바로 얻음, 정답은 방2로 넘어갈 때 입력)
//   방6(맨 위): 왼쪽 끝에 부술 수 있는 상자(철 조각이 들어 있음), 오른쪽 위 구석에 부품2, 왼쪽 끝 위 통로는 히든방3으로
// 통로 위치는 03-world-player.js 의 H2_DOOR_*, 연결은 위의 DOOR_LINKS
const roomWalls = []; // 방 안에 세우는 칸막이 벽(사각형 충돌). 지금은 쓰지 않아서 모두 비어 있음 (12-update.js 의 resolveRoomWalls)
for (let ri = 0; ri < ROOM_TOTAL; ri++) roomWalls.push([]);
rooms[HIDDEN_ROOM_IDX2].push(makeObject('drawer', H2_LEFT + 34, LAB_FLOOR_Y, 14, { sprite: 'propDrawer', opened: false, prompt: 'E 서랍 열기' }));
rooms[HIDDEN_ROOM_IDX2].push(makeObject('notebook', H2_LEFT + 96, LAB_FLOOR_Y, 12, { sprite: 'propDocs', title: '서류 뭉치', pages: RECIPE_DOC_PAGES, giveItem: 'recipeDoc', prompt: 'E 서류 뭉치 읽기' })); // 도구(무기) 만드는 법 (글은 07b-reader.js)
rooms[HIDDEN_ROOM_IDX2 + 1].push(makeObject('notebook', H2_LEFT + 30, LAB_FLOOR_Y, 12, { title: '낡은 메모', pages: ESCAPE_NOTE_PAGES, giveItem: 'escapeNote', prompt: 'E 낡은 메모 읽기' })); // "■■를 먹으면 탈출할 수 있다"는 내용 (글은 01b-story-text.js)
rooms[HIDDEN_ROOM_IDX2 + 1].push(makeObject('cluePoint', 1000, ROOM_HEIGHT - WALL_THICK - 26, 14, { solved: false, useAtRoom: 2, answer: '꿈속열쇠', prompt: 'E 단서 조사' })); // game 이 없으면 미니게임 없이 바로 얻음. 정답은 임시 (미니게임을 붙이려면 game: 'circle')
rooms[HIDDEN2_LAST].push(makeObject('breakable', H2_LEFT + 50, LAB_FLOOR_Y, 14, { broken: false, prompt: 'E 조사하기' }));
rooms[HIDDEN2_LAST].push(makeObject('pickup', H2_RIGHT - 34, WALL_THICK + 34, 12, { item: 'part2', taken: false, prompt: 'E 부품 줍기' })); // 부품2 (위치는 임시)

rooms[HIDDEN_ROOM_IDX3].push(makeObject('notebook', H3_LEFT + 150, LAB_FLOOR_Y, 12, { title: '작업 일지', pages: WORKROOM_LOG_PAGES, prompt: 'E 작업 일지 읽기' }));
rooms[HIDDEN_ROOM_IDX3].push(makeObject('pickup', H3_RIGHT - 70, LAB_FLOOR_Y, 12, { item: 'medicine', taken: false, prompt: 'E 약품 줍기' })); // ■■의 재료 (세 번째 히든방에서 얻음)
// 히든방3 (작업실): 가운데 컴퓨터. 문제를 4번 맞히면 부품3과 단서(정답은 히든방4로 넘어갈 때 입력)를 얻음 (09c-clue-game-compute.js)
rooms[HIDDEN_ROOM_IDX3].push(makeObject('cluePoint', (H3.left + H3.right) / 2 + 60, LAB_FLOOR_Y, 15, { solved: false, useAtRoom: HIDDEN_ROOM_IDX4, game: 'compute', answer: '전원버튼', reward: 'part3', rewarded: false, prompt: 'E 컴퓨터 사용하기' })); // 정답은 임시

rooms[HIDDEN_ROOM_IDX4].push(makeObject('notebook', H4_LEFT + 130, LAB_FLOOR_Y, 12, { title: '실험 기록', pages: LAB_RECORD_PAGES, prompt: 'E 실험 기록 읽기' })); // 인체 실험의 흔적
// 히든방4 (실험 공간)의 장식 소품(그림 + E로 살펴보면 한 줄 설명). 화학 기계, 실험용 장갑, 실험 안경, 스위치. 위치는 임시
rooms[HIDDEN_ROOM_IDX4].push(makeObject('prop', H4_LEFT + 240, LAB_FLOOR_Y, 14, { sprite: 'propChem', text: 'chem', prompt: 'E 화학 기계 살펴보기' }));
rooms[HIDDEN_ROOM_IDX4].push(makeObject('prop', H4_LEFT + 330, LAB_FLOOR_Y, 10, { sprite: 'propGlove', text: 'glove', prompt: 'E 장갑 살펴보기' }));
rooms[HIDDEN_ROOM_IDX4].push(makeObject('prop', H4_LEFT + 380, LAB_FLOOR_Y, 10, { sprite: 'propGoggles', text: 'goggles', prompt: 'E 실험 안경 살펴보기' }));
rooms[HIDDEN_ROOM_IDX4].push(makeObject('prop', H4_RIGHT - 60, WALL_THICK + 44, 10, { sprite: 'propSwitch', text: 'sw', dy: -10, prompt: 'E 스위치 살펴보기' })); // 벽에 붙은 스위치
// 히든방4 (실험 공간): 막다른 왼쪽 끝에 부품4 (위치는 임시)
rooms[HIDDEN_ROOM_IDX4].push(makeObject('pickup', H4_LEFT + 60, LAB_FLOOR_Y, 12, { item: 'part4', taken: false, prompt: 'E 부품 줍기' }));
// 튜토리얼 상자: 방0 왼쪽 아래. 플레이어가 이 x(TUTORIAL_BOX_X)에서 시작하므로, 아래로만 내려가도 만남
// 상호작용 키 없이 닿기만 해도 열림
rooms[0].push({ baseX: TUTORIAL_BOX_X, amp: 0, y: ROOM_HEIGHT - WALL_THICK - 30, speed: 0, phase: 0, r: 13, hitCD: 0, type: 'tutorialBox', solved: false, noticed: false });
let roomIndex = 0;
let enemies = rooms[roomIndex];
let projectiles = [];

let frameCount = 0;
const KNOCK_DOWN = 9, KNOCK_SIDE_MAX = 4, KNOCK_CHAIN_EXTRA = 5, KNOCK_FRICTION = 0.88;
const STUN_DURATION = 30, ENEMY_HIT_CD = 18;
const PROJ_R = 6; // 거리에 비례해 아치 높이/체공 시간을 계산해서 물풍선을 던지듯 포물선을 그림
