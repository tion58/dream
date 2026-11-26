/* ============================================================
 * 파일: js/11-combat-camera.js
 * 역할: 피격 튕김, 카메라 x좌표, 방 전환 처리
 * 들어있는 것: 카메라 고정 상수, applyHitToPlayer(일반 피격), applyWallHitToPlayer(벽 장애물 피격), currentCamX, crossRoom(방 전환)
 * 먼저 로드돼야 하는 파일: 10-rooms.js
 * 주의: 방 전환 전에 플레이어 x를 미리 옮기면 통로 판정이 깨짐 → 위치 보정은 crossRoom 안에서만
 * ============================================================ */
const BUILD_11 = 47; // 이 파일의 버전 번호 (index.html 의 "파일 버전 검사"가 씀). 파일을 크게 고치면 숫자를 올리고 index.html 의 검사 목록(BUILD)도 같이 올릴 것


// ---- 방 전환 슬라이드 트랜지션 ----
let camLocked = false, camLockX = 0, camLockEntryY = 0, camLockEntryX = 0;
let camEaseOffset = 0; // 고정 카메라가 풀릴 때 화면이 튀지 않게, 고정 위치와 원래 위치의 차이를 서서히 줄이는 값 (12-update.js 에서 줄임)
const CAM_UNLOCK_DIST = 34; // 입구에서 이 정도 벗어나야 실제로 "들어간" 것으로 보고 카메라가 따라오기 시작함
const CROSS_MARGIN = 50; // 문을 완전히 넘어갔다고 확정하기까지 더 이동해야 하는 거리 (그동안 실시간으로 다음 방이 미리보기됨)

function applyHitToPlayer(srcX, srcY, srcR) {
  const dx = player.x - srcX, dy = player.y - srcY;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const minDist = player.w * 0.5 + srcR;
  if (dist >= minDist) return false;
  if (adminInvincible || rampage.active) return false; // 관리자 모드의 무적 / 폭주 중에는 무적
  if (shieldBlocks(srcX, srcY)) { onShieldBlock(); return false; } // 방패를 E로 들고 있으면 바라보는 앞쪽에서 오는 공격은 막음 (11b-weapons.js)
  cancelAllCharges(); // 공격에 맞으면 충전 중이던 것도 풀림
  stopFlame();        // 맞으면 화염방사기도 멈춤 (11b-weapons.js)
  const overlap = minDist - dist;
  const alreadyBouncing = Math.hypot(player.knockVX, player.knockVY) > 2;
  if (alreadyBouncing) {
    const mag = Math.hypot(player.knockVX, player.knockVY) || 1;
    const ux = player.knockVX / mag, uy = player.knockVY / mag;
    player.knockVX += ux * KNOCK_CHAIN_EXTRA;
    player.knockVY += uy * KNOCK_CHAIN_EXTRA;
    player.x += ux * overlap; player.y += uy * overlap;
  } else {
    const sideSign = -1; // 오른쪽으로 가지 않고 항상 왼쪽으로 튕기게
    const sideLean = Math.min(1, Math.abs(dx) / minDist);
    player.knockVX = sideSign * sideLean * KNOCK_SIDE_MAX;
    player.knockVY = KNOCK_DOWN;
    player.y += overlap;
  }
  player.stunTimer = STUN_DURATION;
  player.wallPass = true; // 맞아서 밀려나는 동안은 벽을 통과함. 끝났는데 벽 안이면 바깥으로 튕겨 나옴 (12-update.js)
  return true;
}

// 벽에 붙은 장애물("wall"/"spike")은 항상 붙어있는 벽에서 멀어지는 방향(수직)으로만 튕겨나감
// 벽에 붙은 장애물: 기존(applyHitToPlayer)과 같은 튕김/콤보 방식을 쓰되,
// 세로 방향은 왠만하면 그 벽 쪽으로 붙게 만들어서(벽에서 멀어지지 않게) 옆으로 쭉 이어서 연쇄 충돌이 잘 되게 함
function applyWallHitToPlayer(en) {
  const dx = player.x - en.x, dy = player.y - en.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const minDist = player.w * 0.5 + en.r;
  if (dist >= minDist) return false;
  if (adminInvincible || rampage.active) return false;
  if (shieldBlocks(en.x, en.y)) { onShieldBlock(); return false; } // 방패: 앞쪽에 있는 벽 장애물의 공격도 막음
  cancelAllCharges();
  stopFlame();
  const overlap = minDist - dist;
  const towardWall = en.y < ROOM_HEIGHT / 2 ? -1 : 1; // 위쪽 벽이면 위로(벽 쪽), 아래쪽 벽이면 아래로(벽 쪽)
  const alreadyBouncing = Math.hypot(player.knockVX, player.knockVY) > 2;
  if (alreadyBouncing) {
    const mag = Math.hypot(player.knockVX, player.knockVY) || 1;
    const ux = player.knockVX / mag, uy = player.knockVY / mag;
    player.knockVX += ux * KNOCK_CHAIN_EXTRA;
    player.knockVY += uy * KNOCK_CHAIN_EXTRA;
    player.x += ux * overlap; player.y += uy * overlap;
  } else {
    player.knockVX = -KNOCK_SIDE_MAX; // 왼쪽으로
    player.knockVY = towardWall * KNOCK_DOWN * 0.5; // 벽 쪽으로 붙듯이(벽 충돌 판정이 곧바로 다시 벽 근처로 되돌림)
    player.x += -overlap;
    player.y += towardWall * overlap * 0.5;
  }
  player.stunTimer = STUN_DURATION;
  player.wallPass = true; // 맞아서 밀려나는 동안은 벽을 통과함. 끝났는데 벽 안이면 바깥으로 튕겨 나옴 (12-update.js)
  return true;
}

function currentCamX() {
  if (camLocked) return camLockX;
  return baseCamX() + camEaseOffset;
}
// 카메라 고정/보정을 빼고, 플레이어를 따라가는 기본 카메라 x
function baseCamX() {
  const rb = roomBounds(roomIndex);
  const w = rb.right - rb.left;
  let camX = player.x - GAME_W / 2;
  camX = Math.max(rb.left, Math.min(rb.left + w - GAME_W, camX));
  if (w < GAME_W) camX = rb.left - (GAME_W - w) / 2;
  return camX;
}

// 방을 실제로 넘어갈 때: 캐릭터의 이동을 끊지 않고 좌표만 이어붙여서(연속적으로) 다음 방으로 전환
// direction: 'up' = 위로 계속 이동하던 중(새 방의 아래쪽에서 이어짐), 'down' = 아래로 계속 이동하던 중(새 방의 위쪽에서 이어짐)
// entryXOverride 는 10-rooms.js 의 resolveTop/BottomCrossing 이 문 연결 표(DOOR_LINKS)에서 찾아 준 도착 x 좌표
function crossingEntryX(destIdx, direction, entryXOverride) {
  if (entryXOverride !== undefined) return entryXOverride;
  const doors = direction === 'up' ? bottomDoors(destIdx) : topDoors(destIdx); // (표에서 못 찾았을 때만) 그 방의 첫 통로
  return doors.length ? doors[0].x : ROOM_WIDTH / 2;
}

function crossRoom(newIndex, direction, entryXOverride) {
  const prevRoom = roomIndex; // 어느 방에서 왔는지 (스토리 대사용)
  roomIndex = newIndex;
  enemies = rooms[roomIndex];
  afterimages.length = 0; // 잔상 구름은 방 안 좌표라서 방을 옮기면 비움
  enemies.forEach(placeEnemyForFrame); // 처음 가는 방의 적도 위치를 먼저 정해 둠 (도착하자마자 정답 입력 창이 떠서 게임이 멈춰 있어도 위치가 비지 않게)
  projectiles = [];
  if (direction === 'up') player.y += ROOM_HEIGHT; else player.y -= ROOM_HEIGHT;
  player.x = crossingEntryX(newIndex, direction, entryXOverride);
  // 히든방에 들어갈 때만: 실제로 안쪽으로 들어가기 전까진 카메라가 입구에 고정됨
  camEaseOffset = 0;
  stopFlame(); // 방을 옮기면 화염방사기도 멈춤
  if (isAnyHidden(newIndex)) {
    camLocked = false;
    camLockX = currentCamX();
    camLocked = true;
    camLockEntryY = player.y;
    camLockEntryX = player.x;
  } else {
    camLocked = false;
  }
  // 단서를 챙긴 채로, 그 단서를 쓰기로 정해진 방(pendingClue.useAtRoom)으로 넘어가면 그 자리에서 정답을 적어야 함
  // (첫 단서는 2번째 방(방1)으로 넘어갈 때, 두 번째 단서는 방2로 넘어갈 때)
  if (pendingClue && newIndex === pendingClue.useAtRoom) openClueAnswerScreen();
  onRoomEntered(newIndex, prevRoom); // 방에 처음 들어갈 때의 혼잣말 등 (07d-dialogue.js)
}
