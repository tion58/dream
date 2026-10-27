/* ============================================================
 * 파일: js/11-combat-camera.js
 * 역할: 피격 튕김, 카메라 x좌표, 방 전환 처리
 * 들어있는 것: 카메라 고정 상수, applyHitToPlayer(일반 피격), applyWallHitToPlayer(벽 장애물 피격), currentCamX, crossRoom(방 전환)
 * 먼저 로드돼야 하는 파일: 10-rooms.js
 * 주의: 방 전환 전에 플레이어 x를 미리 옮기면 통로 판정이 깨짐 → 위치 보정은 crossRoom 안에서만
 * ============================================================ */

// ---- 방 전환 슬라이드 트랜지션 ----
let camLocked = false, camLockX = 0, camLockEntryY = 0;
const CAM_UNLOCK_DIST = 34; // 입구에서 이 정도 벗어나야 실제로 "들어간" 것으로 보고 카메라가 따라오기 시작함
const CROSS_MARGIN = 50; // 문을 완전히 넘어갔다고 확정하기까지 더 이동해야 하는 거리 (그동안 실시간으로 다음 방이 미리보기됨)

function applyHitToPlayer(srcX, srcY, srcR) {
  const dx = player.x - srcX, dy = player.y - srcY;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const minDist = player.w * 0.5 + srcR;
  if (dist >= minDist) return false;
  cancelAllCharges(); // 공격에 맞으면 충전 중이던 것도 풀림
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
  cancelAllCharges();
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
  return true;
}

function currentCamX() {
  if (camLocked) return camLockX;
  const rb = roomBounds(roomIndex);
  const w = rb.right - rb.left;
  let camX = player.x - GAME_W / 2;
  camX = Math.max(rb.left, Math.min(rb.left + w - GAME_W, camX));
  if (w < GAME_W) camX = rb.left - (GAME_W - w) / 2;
  return camX;
}

// 방을 실제로 넘어갈 때: 캐릭터의 이동을 끊지 않고 좌표만 이어붙여서(연속적으로) 다음 방으로 전환
// direction: 'up' = 위로 계속 이동하던 중(새 방의 아래쪽에서 이어짐), 'down' = 아래로 계속 이동하던 중(새 방의 위쪽에서 이어짐)
function crossingEntryX(destIdx, direction, entryXOverride) {
  if (direction === 'up') return (entryXOverride !== undefined) ? entryXOverride : bottomGapX(destIdx);
  return (entryXOverride !== undefined) ? entryXOverride : topGapX(destIdx);
}

function crossRoom(newIndex, direction, entryXOverride) {
  roomIndex = newIndex;
  enemies = rooms[roomIndex];
  projectiles = [];
  if (direction === 'up') {
    player.y += ROOM_HEIGHT;
    player.x = (entryXOverride !== undefined) ? entryXOverride : bottomGapX(newIndex);
  } else {
    player.y -= ROOM_HEIGHT;
    player.x = (entryXOverride !== undefined) ? entryXOverride : topGapX(newIndex);
  }
  // 히든방에 들어갈 때만: 실제로 안쪽으로 들어가기 전까진 카메라가 입구에 고정됨
  if (isAnyHidden(newIndex)) {
    camLocked = false;
    camLockX = currentCamX();
    camLocked = true;
    camLockEntryY = player.y;
  } else {
    camLocked = false;
  }
  // 단서를 챙긴 채로 (히든방이 아닌) 다음 방 입구에 들어서면, 그 자리에서 정답을 적어야 함
  if (pendingClue && !isAnyHidden(newIndex)) openClueAnswerScreen();
}
