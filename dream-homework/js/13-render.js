/* ============================================================
 * 파일: js/13-render.js
 * 역할: 화면 그리기 (도트 스타일)
 * 들어있는 것: px() 사각형 그리기, 벽/구름/문(통로 여러 개 가능), 적·장애물·연구소 오브젝트 그리기(체력 막대 포함), 방 배경(스테이지별로 어두워짐), 히든방2 칸막이 벽, 시작 구역 노란선, 방 전환 미리보기(히든방 들어갈 때 / 나올 때 블러 포함), 줌 연출, draw()
 *             ※ 히든방 4곳의 테마 장식(강의실/휴게실/작업실/실험 공간)과 컴퓨터 모양은 13b-themes.js
 * 먼저 로드돼야 하는 파일: 10-rooms.js, 11-combat-camera.js
 * 주의: 모든 도형은 정수 좌표의 사각형으로 그려서 도트 느낌을 유지. 새 오브젝트의 모양은 drawRoomHazards에 추가
 * ============================================================ */
const BUILD_13 = 48; // 이 파일의 버전 번호 (index.html 의 "파일 버전 검사"가 씀). 파일을 크게 고치면 숫자를 올리고 index.html 의 검사 목록(BUILD)도 같이 올릴 것


function px(x, y, w, h, color) {
  bctx.fillStyle = color;
  bctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function drawBlackDoorMarker(camX, yPos, gapCenterX) {
  px(gapCenterX - GAP_HALF_X - camX, yPos - 4, GAP_HALF_X * 2, WALL_THICK + 8, '#0a0a12');
}

function drawCloudPuffs(camX, edgeY, x0, x1) {
  let x = x0, idx = 0;
  while (x < x1) {
    const r = 6 + (idx % 3); // 6~8 사이로 살짝 크기가 달라지는 뭉게구름 느낌 (과하지 않게)
    const cx = x - camX + r;
    bctx.fillStyle = '#ffb3c6';
    bctx.beginPath();
    bctx.arc(cx, edgeY, r, 0, Math.PI * 2);
    bctx.fill();
    bctx.fillStyle = 'rgba(255,255,255,0.3)'; // 아주 옅은 하이라이트로 입체감만 살짝
    bctx.beginPath();
    bctx.arc(cx - r * 0.3, edgeY - r * 0.3, r * 0.35, 0, Math.PI * 2);
    bctx.fill();
    x += r * 2 - 2; // 살짝 겹치게 이어붙여서 매끈한 뭉게구름 라인이 되게 함
    idx++;
  }
}

// gaps: 이 벽에 뚫린 통로 목록 [{ x: 통로 가운데, color: 'pink' | 'black' }, ...] (비어 있으면 막힌 벽). 10-rooms.js 의 topDoors/bottomDoors 가 만들어 줌
function drawWallHorizontal(camX, yPos, gaps, left, right) {
  const puffEdgeY = (yPos < ROOM_HEIGHT / 2) ? (yPos + WALL_THICK) : yPos; // 위쪽 벽은 아래쪽 가장자리, 아래쪽 벽은 위쪽 가장자리에 뭉게뭉게
  const sorted = gaps.slice().sort((p, q) => p.x - q.x);
  const segs = []; // 통로와 통로 사이의 벽 조각들 [시작 x, 끝 x]
  let cursor = left;
  sorted.forEach(g => { segs.push([cursor, g.x - GAP_HALF_X]); cursor = g.x + GAP_HALF_X; });
  segs.push([cursor, right]);
  segs.forEach(seg => {
    const x0 = seg[0], x1 = seg[1];
    if (x1 <= x0) return;
    px(x0 - camX, yPos, x1 - x0, WALL_THICK, '#ffb3c6');
    for (let x = x0; x < x1; x += 8) px(x - camX, yPos + 2, 4, WALL_THICK - 4, '#ffd6e3');
    drawCloudPuffs(camX, puffEdgeY, x0, x1);
  });
  sorted.forEach(g => { if (g.color === 'black') drawBlackDoorMarker(camX, yPos, g.x); });
}

function drawRoomHazards(camX, enemiesArr) {
  enemiesArr.forEach(en => {
    if (en.dead) return;
    const ex = en.x - camX;
    if (!isFinite(ex) || !isFinite(en.y)) return; // 아직 위치가 정해지지 않은 적(게임 시작 전 화면)은 그리지 않음
    if (ex < -20 || ex > GAME_W + 20) return;
    // 오브젝트에 sprite(그림 이름)가 있고 그림이 불러와졌으면 그림으로 그림 (서랍, 서류 뭉치, 장식 소품 등). 없으면 아래의 예전 도형
    if (en.sprite && spriteReady(en.sprite) && (en.type === 'drawer' || en.type === 'notebook' || en.type === 'prop')) {
      const sh = sprites[en.sprite].h;
      drawSprite(en.sprite, ex, en.y + (en.r || 12) - sh / 2 + (en.dy || 0), { alpha: en.opened ? 0.85 : 1 }); // 그림의 아래쪽을 바닥(오브젝트 아래)에 맞춤
      return;
    }
    if (en.type === 'wall') {
      // 벽에 완전히 붙어있는, 가로로 납작한 형태
      const ww = en.wallW || 40, wh = en.wallH || 10;
      px(ex - ww / 2, en.y - wh / 2, ww, wh, '#ff9fc0');
      px(ex - ww / 2 + 3, en.y - wh / 2 + 2, ww - 6, wh - 4, '#ffe1ec');
    } else if (en.type === 'thrower') {
      if (spriteReady('enemyPurple')) {
        // 보라색 적 그림 (후드를 쓴 유령). 바닥에 은은한 보라색 그림자, 위아래로 둥실, 맞으면 하얗게 번쩍임
        const bob = Math.round(Math.sin(frameCount * 0.08 + (en.phase || 0)) * 1.5);
        bctx.save();
        bctx.globalAlpha = 0.3;
        bctx.fillStyle = '#9a5ce0';
        bctx.beginPath(); bctx.ellipse(ex, en.y + 24, 11, 3.5, 0, 0, Math.PI * 2); bctx.fill();
        bctx.restore();
        drawSprite('enemyPurple', ex, en.y + bob, { tint: en.hurt > 0 ? 'white' : undefined });
      } else {
        px(ex - en.r * 0.6, en.y - en.r * 0.6, en.r * 1.2, en.r * 1.2, '#9a5ce0');
        px(ex - en.r * 0.35, en.y - en.r * 0.2, 3, 3, '#ffffff');
        px(ex + en.r * 0.15, en.y - en.r * 0.2, 3, 3, '#ffffff');
      }
    } else if (en.type === 'hopper') {
      // 배경 톤에 맞춘 복숭아빛 통통 튀는 생물
      px(ex - en.r * 0.6, en.y - en.r * 0.45, en.r * 1.2, en.r * 0.85, '#ffb385');
      px(ex - en.r * 0.4, en.y - en.r * 0.65, en.r * 0.8, en.r * 0.4, '#ffcda6');
      px(ex - en.r * 0.28, en.y - en.r * 0.15, 3, 3, '#7a4a2a');
      px(ex + en.r * 0.1, en.y - en.r * 0.15, 3, 3, '#7a4a2a');
    } else if (en.type === 'centerHazard') {
      // 돌 오브젝트 - 회색 톤의 도트 텍스처 (참고 이미지에서 영감만 받아 단순화)
      px(ex - en.r * 0.65, en.y - en.r * 0.65, en.r * 1.3, en.r * 1.3, '#9a9a9a');
      px(ex - en.r * 0.5, en.y - en.r * 0.05, en.r * 0.42, en.r * 0.42, '#767676');
      px(ex + en.r * 0.05, en.y - en.r * 0.5, en.r * 0.38, en.r * 0.38, '#b4b4b4');
      px(ex - en.r * 0.1, en.y + en.r * 0.18, en.r * 0.3, en.r * 0.3, '#828282');
      px(ex + en.r * 0.15, en.y + en.r * 0.05, en.r * 0.22, en.r * 0.22, '#c2c2c2');
    } else if (en.type === 'centerBlock') {
      // 그냥 막기만 하는 오브젝트 - 가장자리 벽과 같은 핑크 구름 텍스처로 통일
      px(ex - en.r * 0.75, en.y - en.r, en.r * 1.5, en.r * 2, '#ffb3c6');
      for (let dy2 = -en.r; dy2 < en.r; dy2 += 8) px(ex - en.r * 0.75 + 2, en.y + dy2 + 2, en.r * 1.5 - 4, 4, '#ffd6e3');
    } else if (en.type === 'cluePoint' && en.game === 'compute') {
      if (spriteReady('propComputer')) drawSprite('propComputer', ex, en.y + 2, { alpha: en.solved ? 0.6 : 1 }); // 컴퓨터 그림 (풀고 나면 흐려짐)
      else drawComputerTerminal(ex, en.y, en.solved); // 그림이 없으면 예전 도형 (13b-themes.js)
    } else if (en.type === 'cluePoint') {
      // 임시: 히든방 단서 오브젝트 - 은은하게 빛나는 구슬 느낌
      const glow = en.solved ? '#555568' : '#ffe9a8';
      const core = en.solved ? '#333340' : '#fff6dd';
      px(ex - en.r * 0.7, en.y - en.r * 0.7, en.r * 1.4, en.r * 1.4, glow);
      px(ex - en.r * 0.35, en.y - en.r * 0.35, en.r * 0.7, en.r * 0.7, core);
      if (!en.solved) px(ex - 2, en.y - 5, 4, 8, '#8a6d1a'); // 물음표 느낌의 작은 표시
    } else if (en.type === 'tutorialBox') {
      // 튜토리얼 상자 - 열리면 뚜껑이 열린 모습으로
      if (en.solved) {
        px(ex - en.r * 0.8, en.y - en.r * 0.3, en.r * 1.6, en.r * 1.1, '#caa06a');
        px(ex - en.r * 0.6, en.y - en.r * 1.1, en.r * 1.2, en.r * 0.5, '#e8c590'); // 열린 뚜껑
      } else {
        px(ex - en.r * 0.8, en.y - en.r * 0.6, en.r * 1.6, en.r * 1.4, '#caa06a');
        px(ex - en.r * 0.8, en.y - en.r * 0.15, en.r * 1.6, 4, '#8a6a3a');
        px(ex - 3, en.y - en.r * 0.1, 6, 6, '#5a4020'); // 자물쇠 느낌
      }
    } else if (en.type === 'notebook') {
      // 연구 노트 (임시 도형): 짙은 갈색 표지 + 누런 종이
      px(ex - 9, en.y - 7, 18, 14, '#5a3a22');
      px(ex - 6, en.y - 5, 14, 10, '#f1e6c8');
      px(ex - 9, en.y - 7, 3, 14, '#3a2414'); // 책등
      px(ex - 3, en.y - 3, 8, 1, '#a89a78');
      px(ex - 3, en.y - 1, 8, 1, '#a89a78');
      px(ex - 3, en.y + 1, 5, 1, '#a89a78');
    } else if (en.type === 'tornNote') {
      // 찢어진 쪽지 (임시 도형): 아래쪽이 삐죽삐죽 찢어진 종이
      px(ex - 6, en.y - 8, 12, 12, '#efe8d6');
      px(ex - 6, en.y + 4, 3, 3, '#efe8d6');
      px(ex - 1, en.y + 4, 3, 2, '#efe8d6');
      px(ex + 3, en.y + 4, 3, 4, '#efe8d6');
      px(ex - 4, en.y - 5, 8, 1, '#9b937f');
      px(ex - 4, en.y - 2, 8, 1, '#9b937f');
      px(ex - 4, en.y + 1, 5, 1, '#9b937f');
    } else if (en.type === 'pickup') {
      // 줍는 아이템: 한 번 주우면(taken) 맵에서 사라져서 다시 그려지지 않음
      if (!en.taken) {
        if (en.item === 'container') {
          // 용기 (임시 도형): 뚜껑 달린 유리병
          px(ex - 7, en.y - 3, 14, 12, '#9ad7e8');
          px(ex - 5, en.y - 8, 10, 5, '#bfe9f4');
          px(ex - 8, en.y - 10, 16, 3, '#6aa8b8');
          px(ex - 4, en.y - 1, 2, 7, '#e6f8fc');
        } else {
          // 그 밖의 아이템(무기 등): 받침 위에 아이콘 (임시 모양)
          const def = ITEM_DEFS[en.item] || { icon: '❔' };
          px(ex - 11, en.y - 11, 22, 22, '#3a3358');
          px(ex - 9, en.y - 9, 18, 18, '#5a4f86');
          bctx.save();
          bctx.font = '14px sans-serif'; bctx.textAlign = 'center'; bctx.textBaseline = 'middle';
          bctx.fillText(def.icon, ex, en.y + 1);
          bctx.restore();
        }
      }
    } else if (en.type === 'drawer') {
      // 서랍 (임시 도형): 나무색 서랍장. 열리면 위 서랍이 빠져나온 모습
      px(ex - 14, en.y - 9, 28, 18, '#6b4a2e');
      px(ex - 12, en.y + 0, 24, 7, '#8a6340');
      px(ex - 3, en.y + 2, 6, 2, '#d9c27a');
      if (en.opened) {
        px(ex - 12, en.y - 14, 24, 7, '#a07848');
        px(ex - 10, en.y - 12, 20, 3, '#2a1c10'); // 빈 서랍 안쪽
      } else {
        px(ex - 12, en.y - 7, 24, 7, '#8a6340');
        px(ex - 3, en.y - 5, 6, 2, '#d9c27a');
      }
    } else if (en.type === 'breakable') {
      // 금이 간 상자 (임시 도형): 망치로 부수면 부서진 조각만 남음
      if (!en.broken) {
        px(ex - 11, en.y - 11, 22, 22, '#6f7380');
        px(ex - 9, en.y - 9, 18, 18, '#9a9eab');
        px(ex - 1, en.y - 9, 2, 7, '#3f424d');   // 금
        px(ex + 1, en.y - 3, 6, 2, '#3f424d');
        px(ex - 6, en.y + 2, 7, 2, '#3f424d');
      } else {
        px(ex - 10, en.y + 4, 8, 5, '#6f7380');
        px(ex + 1, en.y + 2, 9, 6, '#9a9eab');
        px(ex - 4, en.y + 7, 6, 3, '#4c4f5a');
        px(ex + 6, en.y - 2, 4, 3, '#6f7380');
      }
    } else if (spriteReady('enemyRed')) {
      // 빨간 적: 머리 없는 작은 몸통에 붉은 빛이 일렁이며 돎. 위아래로 둥실, 맞으면 하얗게 번쩍임
      const ph = en.phase || 0;
      const bob = Math.round(Math.sin(frameCount * 0.1 + ph) * 1.5);
      const pulse = 0.5 + 0.5 * Math.sin(frameCount * 0.12 + ph * 2); // 붉은 빛이 커졌다 작아졌다
      const gy = en.y + bob;
      bctx.save();
      const glow = bctx.createRadialGradient(ex, gy, 3, ex, gy, 24);
      glow.addColorStop(0, 'rgba(255,70,70,' + (0.38 + 0.22 * pulse).toFixed(2) + ')');
      glow.addColorStop(1, 'rgba(255,70,70,0)');
      bctx.fillStyle = glow;
      bctx.beginPath(); bctx.arc(ex, gy, 24, 0, Math.PI * 2); bctx.fill();
      bctx.globalAlpha = 0.3;
      bctx.fillStyle = '#d63a3a';
      bctx.beginPath(); bctx.ellipse(ex, en.y + 17, 9, 3, 0, 0, Math.PI * 2); bctx.fill(); // 바닥의 붉은 그림자
      bctx.restore();
      drawSprite('enemyRed', ex, gy, { tint: en.hurt > 0 ? 'white' : undefined });
    } else {
      px(ex - en.r * 0.6, en.y - en.r * 0.6, en.r * 1.2, en.r * 1.2, '#e05a6b');
      px(ex - en.r * 0.35, en.y - en.r * 0.2, 3, 3, '#ffffff');
      px(ex + en.r * 0.15, en.y - en.r * 0.2, 3, 3, '#ffffff');
    }

    if (isDamageable(en)) {
      const ghost = (en.type === 'thrower' && spriteReady('enemyPurple')) || (en.type === 'enemy' && spriteReady('enemyRed')); // 그림이 있는 적은 그림 자체가 번쩍이고, 체력 막대는 더 위에
      if (en.hurt > 0 && !ghost) { // 망치에 맞은 순간 하얗게 번쩍임
        bctx.save();
        bctx.globalAlpha = 0.6;
        px(ex - en.r * 0.6, en.y - en.r * 0.6, en.r * 1.2, en.r * 1.2, '#ffffff');
        bctx.restore();
      }
      if (en.hp < en.maxHp) { // 체력이 깎인 적만 머리 위에 체력 막대를 보여줌
        const bw = 18;
        const barTop = ghost ? (en.type === 'thrower' ? 33 : 24) : en.r + 9;
        px(ex - bw / 2 - 1, en.y - barTop, bw + 2, 5, '#1a0a14');
        px(ex - bw / 2, en.y - barTop + 1, bw * Math.max(0, en.hp) / en.maxHp, 3, '#ff6b81');
      }
    }
  });
}

// 시작 구역(방0 왼쪽)의 경계: 투명한 노란 점선. 위/아래 방향키를 해금하면 더 또렷해짐 (그 안에서 자유 이동 가능)
function drawFreeZoneLine(camX) {
  const x = FREE_ZONE_RIGHT - camX;
  if (x < -4 || x > GAME_W + 4) return;
  bctx.save();
  bctx.globalAlpha = freeZoneUnlocked() ? 0.95 : 0.6; // 위/아래를 해금하면 더 또렷해짐 (밝은 배경에서도 보이게 진한 노랑)
  for (let y = WALL_THICK; y < ROOM_HEIGHT - WALL_THICK; y += 10) px(x - 1, y, 3, 6, '#f2b705');
  bctx.restore();
}

// 히든방2의 칸막이 벽 (책상처럼 보이는 어두운 파란 판). 충돌은 12-update.js 의 resolveRoomWalls
function drawRoomWalls(camX, idx) {
  const walls = roomWalls[idx];
  if (!walls) return;
  walls.forEach(w => {
    px(w.x - camX, w.y, w.w, w.h, '#262b52');
    px(w.x - camX, w.y, w.w, 2, '#4d558f');
    px(w.x - camX, w.y + w.h - 2, w.w, 2, '#161a38');
  });
}
// 칸막이(책상) 위에 놓인 실험 도구들 - 칸막이 위에 덧그림
function drawLabBenchTops(camX, idx) {
  const walls = roomWalls[idx];
  if (!walls) return;
  const colors = ['#9fd0ff', '#ffb3d1', '#b6ffcf'];
  walls.forEach(w => {
    let k = 0;
    for (let x = w.x + 30; x < w.x + w.w - 20; x += 54) {
      const cx = x - camX;
      if (cx < -10 || cx > GAME_W + 10) { k++; continue; }
      bctx.save();
      bctx.globalAlpha = 0.7;
      px(cx - 3, w.y + 2, 6, 7, colors[k % 3]);   // 플라스크
      px(cx - 1, w.y - 2, 2, 4, colors[k % 3]);   // 플라스크 목
      bctx.restore();
      k++;
    }
  });
}

const MAIN_ROOM_GRADIENTS = [
  ['#9fb8d9', '#f2b6c6', '#f6d3c0'], // 방0: 밝은 낮
  ['#6f7fae', '#c48aa0', '#d9a98f'], // 방1: 저녁 노을
  ['#3f4670', '#8a5570', '#a3735f'], // 방2: 어두운 밤 직전
];
function drawRoomBackground(isHidden, roomIdxForFlags) {
  const grad = bctx.createLinearGradient(0, 0, 0, ROOM_HEIGHT);
  if (isHidden) {
    // 히든방: 검은색과 남색 그 사이의 어두운 분위기
    grad.addColorStop(0, '#05040a');
    grad.addColorStop(0.5, '#0d0f2b');
    grad.addColorStop(1, '#05040a');
  } else {
    // 스테이지(맵)를 진행할수록 배경이 점점 어두워짐
    const stops = MAIN_ROOM_GRADIENTS[Math.min(roomIdxForFlags || 0, MAIN_ROOM_GRADIENTS.length - 1)];
    grad.addColorStop(0, stops[0]);
    grad.addColorStop(0.5, stops[1]);
    grad.addColorStop(1, stops[2]);
  }
  bctx.fillStyle = grad;
  // 카메라 위치와 무관하게 화면을 항상 덮도록 넉넉하게 채움
  bctx.fillRect(0, 0, Math.max(ROOM_WIDTH, GAME_W), ROOM_HEIGHT);
}

// roomIdxForFlags: 위/아래 통로 여부 판단용 방 인덱스. drawPlayerFlag: 플레이어를 이 레이어에 그릴지
function renderRoomLayer(offsetY, camYOffset, roomIdxForFlags, enemiesArr, camXVal, drawPlayerFlag, projArr, coverInfo) {
  bctx.save();
  bctx.beginPath();
  bctx.rect(0, camYOffset + offsetY, GAME_W, ROOM_HEIGHT);
  bctx.clip();
  bctx.translate(0, camYOffset + offsetY);

  const isHidden = isAnyHidden(roomIdxForFlags);
  const rb = roomBounds(roomIdxForFlags);
  drawRoomBackground(isHidden, roomIdxForFlags);
  if (isHidden) drawHiddenTheme(camXVal, rb.left, rb.right, roomIdxForFlags); // 히든방 테마 장식: 강의실/휴게실/작업실/실험 공간 (13b-themes.js)
  drawWallHorizontal(camXVal, 0, topDoors(roomIdxForFlags), rb.left, rb.right);
  drawWallHorizontal(camXVal, ROOM_HEIGHT - WALL_THICK, bottomDoors(roomIdxForFlags), rb.left, rb.right);
  px(rb.left - camXVal, 0, WALL_THICK, ROOM_HEIGHT, isHidden ? '#1a1a30' : '#ffb3c6');
  px(-camXVal + rb.right - WALL_THICK, 0, WALL_THICK, ROOM_HEIGHT, isHidden ? '#1a1a30' : '#ffb3c6'); // 오른쪽 벽 (맵 탈출구는 없앴음: 엔딩과 관련 없음)

  if (roomIdxForFlags === FREE_ZONE_ROOM) drawFreeZoneLine(camXVal); // 시작 구역의 노란선
  drawRoomWalls(camXVal, roomIdxForFlags);                           // 히든방2 칸막이 벽
  if (roomWalls[roomIdxForFlags] && roomWalls[roomIdxForFlags].length) drawLabBenchTops(camXVal, roomIdxForFlags);

  if (drawPlayerFlag) drawAfterimages(afterimages, -camXVal); // 충전 후 남는 잔상 구름 (적과 주인공 아래에 깔림)
  drawRoomHazards(camXVal, enemiesArr);

  if (projArr) {
    projArr.forEach(p => {
      const ex = p.x - camXVal;
      // 어두운 보라 테두리 + 밝은 보라 속을 겹쳐 그려서 배경 위에서도 잘 보이게 함
      px(ex - p.r / 2 - 1, p.y - p.r / 2 - 1, p.r + 2, p.r + 2, '#5a2f8f');
      px(ex - p.r / 2, p.y - p.r / 2, p.r, p.r, '#c99bff');
    });
  }

  if (drawPlayerFlag) {
    const pxScreen = player.x - camXVal;
    if (!drawPlayerSprite(pxScreen, player.y)) { // 그림이 아직 없으면 예전의 네모 모양
      const bodyColor = player.stunTimer > 0 ? '#ff5c5c' : '#ffffff';
      px(pxScreen - player.w/2, player.y - player.h/2, player.w, player.h, bodyColor);
      px(pxScreen - player.w/2 + 2, player.y - player.h/2 + 3, 3, 3, '#4a7fd6');
      px(pxScreen + player.w/2 - 5, player.y - player.h/2 + 3, 3, 3, '#4a7fd6');
    }
    drawWeaponEffects(camXVal); // 방패 보호막, 검/방패/작살 공격 모습 (11b-weapons.js)
  }

  // 문을 넘어가는 진행도만큼, 떠나는 쪽 방을 입구/출구 쪽부터 서서히 검게 덮음 (되돌아오면 다시 걷힘)
  if (coverInfo && coverInfo.frac > 0) {
    const coverH = ROOM_HEIGHT * coverInfo.frac;
    bctx.fillStyle = '#000000';
    if (coverInfo.side === 'top') bctx.fillRect(0, 0, ROOM_WIDTH, coverH);
    else bctx.fillRect(0, ROOM_HEIGHT - coverH, ROOM_WIDTH, coverH);
  }
  bctx.restore();
}

// 단서 미니게임 진입 애니메이션 중 배경으로 보여줄 현재 방의 단순 렌더 (교차 미리보기 없이)
function drawRoomSingleLayerToBuf() {
  const camYOffset = (GAME_H - ROOM_HEIGHT) / 2;
  bctx.fillStyle = '#1a1a2e';
  bctx.fillRect(0, 0, GAME_W, GAME_H);
  renderRoomLayer(0, camYOffset, roomIndex, enemies, currentCamX(), true, projectiles, null);
  if (camYOffset > 0) {
    const marginColor = isAnyHidden(roomIndex) ? '#05040a' : '#ffb3c6';
    bctx.fillStyle = marginColor;
    bctx.fillRect(0, 0, GAME_W, camYOffset);
    bctx.fillRect(0, GAME_H - camYOffset, GAME_W, camYOffset);
    if (!isAnyHidden(roomIndex)) {
      drawCloudPuffs(0, camYOffset, 0, GAME_W);
      drawCloudPuffs(0, GAME_H - camYOffset, 0, GAME_W);
    }
  }
}
function drawRoomSingleLayer() {
  drawRoomSingleLayerToBuf();
  const w2 = canvas.width, h2 = canvas.height;
  ctx.fillStyle = '#4a4a52';
  ctx.fillRect(0, 0, w2, h2);
  const scale2 = Math.min(w2 / GAME_W, h2 / GAME_H);
  const dw2 = GAME_W * scale2, dh2 = GAME_H * scale2;
  ctx.drawImage(buf, Math.floor((w2 - dw2) / 2), Math.floor((h2 - dh2) / 2), dw2, dh2);
}
// 상자를 발견했을 때: 화면이 상자 쪽으로 살짝 확대됐다가 다시 원래대로 돌아오는 연출
function drawRoomZoomed(zoomScale, focusWorldX, focusWorldY) {
  drawRoomSingleLayerToBuf();
  const w2 = canvas.width, h2 = canvas.height;
  ctx.fillStyle = '#4a4a52';
  ctx.fillRect(0, 0, w2, h2);
  const baseScale = Math.min(w2 / GAME_W, h2 / GAME_H);
  const scale2 = baseScale * zoomScale;
  const dw2 = GAME_W * scale2, dh2 = GAME_H * scale2;
  // 초점이 화면 중앙에 오도록 오프셋 계산 (focus는 버퍼 좌표계 기준)
  const camYOffset = (GAME_H - ROOM_HEIGHT) / 2;
  const focusBufX = focusWorldX - currentCamX();
  const focusBufY = focusWorldY + camYOffset;
  const baseDx = (w2 - GAME_W * baseScale) / 2, baseDy = (h2 - GAME_H * baseScale) / 2;
  const centerScreenX = baseDx + focusBufX * baseScale, centerScreenY = baseDy + focusBufY * baseScale;
  const dx2 = centerScreenX - focusBufX * scale2, dy2 = centerScreenY - focusBufY * scale2;
  ctx.drawImage(buf, dx2, dy2, dw2, dh2);
}

// ---- 히든방에서 나올 때: 다음 방을 흐리게(블러) 보여줬다가 거의 다 나오면 또렷하게 ----
// 브라우저마다 canvas 의 blur 필터 지원이 달라서(특히 아이폰), 그림을 1/2 → 1/4 → 1/8 로 줄였다가 다시 키우는 방식으로 흐리게 만듦
const BLUR_FULL_UNTIL = 0.45;  // 문 통과 진행도가 이 값까지는 가장 흐림
const BLUR_CLEAR_AT = 0.9;     // 이 값에 도달하면 완전히 또렷해짐
const blurSteps = [document.createElement('canvas'), document.createElement('canvas'), document.createElement('canvas')];
function blurLevelForProgress(frac) {
  if (frac <= BLUR_FULL_UNTIL) return 1;
  if (frac >= BLUR_CLEAR_AT) return 0;
  const t = (frac - BLUR_FULL_UNTIL) / (BLUR_CLEAR_AT - BLUR_FULL_UNTIL);
  return 1 - t * t * (3 - 2 * t); // 부드럽게 걷히는 곡선
}
// 화면(버퍼)의 가로띠 영역(bandY ~ bandY+bandH)을 흐리게 덮어 그림. level: 0(그대로) ~ 1(가장 흐림)
function blurBand(bandY, bandH, level) {
  if (level <= 0.01) return;
  const y0 = Math.max(0, Math.round(bandY)), y1 = Math.min(GAME_H, Math.round(bandY + bandH));
  const h = y1 - y0;
  if (h <= 0) return;
  let src = buf, sx = 0, sy = y0, sw = GAME_W, sh = h;
  blurSteps.forEach((c, i) => {
    const f = Math.pow(2, i + 1);
    const cw = Math.max(1, Math.ceil(GAME_W / f)), ch = Math.max(1, Math.ceil(h / f));
    if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
    const cx = c.getContext('2d');
    cx.imageSmoothingEnabled = true;
    cx.drawImage(src, sx, sy, sw, sh, 0, 0, cw, ch);
    src = c; sx = 0; sy = 0; sw = cw; sh = ch;
  });
  // 작은 그림에서 단계적으로 다시 키우면서 부드럽게 퍼지게 함
  for (let i = blurSteps.length - 1; i > 0; i--) {
    const big = blurSteps[i - 1], small = blurSteps[i];
    const cx = big.getContext('2d');
    cx.imageSmoothingEnabled = true;
    cx.drawImage(small, 0, 0, small.width, small.height, 0, 0, big.width, big.height);
  }
  bctx.save();
  bctx.beginPath();
  bctx.rect(0, y0, GAME_W, h);
  bctx.clip();
  bctx.imageSmoothingEnabled = true;
  bctx.globalAlpha = level; // 또렷한 그림 위에 흐린 그림을 level 만큼 겹쳐서, 흐림이 서서히 변하게 함
  bctx.drawImage(blurSteps[0], 0, 0, blurSteps[0].width, blurSteps[0].height, 0, y0, GAME_W, h);
  bctx.restore();
}

// 방을 넘어간 "직후"의 카메라 x를 미리 계산 (11-combat-camera.js 의 currentCamX 와 같은 규칙)
// 히든방 미리보기를 이 카메라로 그려두면, 실제로 전환되는 순간 화면이 튀지 않고 그대로 이어짐
function camXAfterCrossing(idx, worldX) {
  const rb = roomBounds(idx);
  const w = rb.right - rb.left;
  let camX = worldX - GAME_W / 2;
  camX = Math.max(rb.left, Math.min(rb.left + w - GAME_W, camX));
  if (w < GAME_W) camX = rb.left - (GAME_W - w) / 2;
  return camX;
}

function draw() {
  const w = canvas.width, h = canvas.height;

  if (gameState === 'clueGame' || gameState === 'clueGameCircle' || gameState === 'clueGameCompute') {
    if (gameState === 'clueGame') drawClueGame(); else if (gameState === 'clueGameCircle') drawCircleGame(); else drawComputeGame();
    ctx.fillStyle = '#4a4a52';
    ctx.fillRect(0, 0, w, h);
    const scale0 = Math.min(w / GAME_W, h / GAME_H);
    const dw0 = GAME_W * scale0, dh0 = GAME_H * scale0;
    const dx0 = Math.floor((w - dw0) / 2), dy0 = Math.floor((h - dh0) / 2);
    ctx.drawImage(buf, dx0, dy0, dw0, dh0);
    if (gameState === 'clueGameCompute') positionComputeUI(dx0, dy0, scale0); // 컴퓨터 화면의 글자/보기를 같은 자리에 (09c-clue-game-compute.js)
    return;
  }

  if (gameState === 'boxNotice' && boxNoticeTarget) {
    const zoom = 1 + (BOX_NOTICE_MAX_ZOOM - 1) * boxNoticeZoomAmount();
    drawRoomZoomed(zoom, boxNoticeTarget.x, boxNoticeTarget.y);
    return;
  }

  if (gameState === 'clueGameEnter') {
    drawRoomSingleLayer();
    const t = clueGameEnterTimer / CLUE_ENTER_DURATION;
    const maxR = Math.hypot(w, h);
    ctx.save();
    ctx.globalAlpha = Math.min(1, t * 1.2);
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, maxR * t, 0, Math.PI * 2);
    ctx.fillStyle = '#bdf5e0';
    ctx.fill();
    ctx.restore();
    return;
  }

  const camYOffset = (GAME_H - ROOM_HEIGHT) / 2;

  bctx.fillStyle = '#1a1a2e';
  bctx.fillRect(0, 0, GAME_W, GAME_H);

  // 실제로 캐릭터가 지금 문틈을 넘어가고 있는 중인지(=벽 두께를 이미 넘어섰는지)를 매 프레임 계산해서,
  // 그 진행도만큼 다음 방을 실시간으로 겹쳐 보여줌 (정해진 시간이 아니라 실제 이동에 따라 움직임)
  const hw = player.w / 2, hh = player.h / 2;
  let peek = null;
  if (player.y - hh < WALL_THICK) {
    const info = resolveTopCrossing(hw);
    if (info.matched) {
      const bleed = Math.max(0, WALL_THICK - (player.y - hh));
      if (bleed > 0) peek = { destIdx: info.destIdx, dirSign: 1, frac: Math.min(1, bleed / CROSS_MARGIN), entryX: crossingEntryX(info.destIdx, 'up', info.entryXOverride) };
    }
  }
  if (!peek && player.y + hh > ROOM_HEIGHT - WALL_THICK) {
    const info = resolveBottomCrossing(hw);
    if (info.matched) {
      const bleed = Math.max(0, (player.y + hh) - (ROOM_HEIGHT - WALL_THICK));
      if (bleed > 0) peek = { destIdx: info.destIdx, dirSign: -1, frac: Math.min(1, bleed / CROSS_MARGIN), entryX: crossingEntryX(info.destIdx, 'down', info.entryXOverride) };
    }
  }

  if (peek) {
    const oldOffset = peek.dirSign * peek.frac * GAME_H;
    const newOffset = oldOffset - peek.dirSign * GAME_H;
    const coverSide = peek.dirSign === 1 ? 'top' : 'bottom';
    const enteringHidden = isAnyHidden(peek.destIdx) && !isAnyHidden(roomIndex);
    const leavingHidden = isAnyHidden(roomIndex) && !isAnyHidden(peek.destIdx);
    const hiddenHop = isAnyHidden(roomIndex) && isAnyHidden(peek.destIdx); // 히든방2 안에서 위/아래 방으로 이동
    if (enteringHidden || leavingHidden || hiddenHop) {
      // 히든방을 드나들 때: 두 방 사이의 틈도 검은색으로 채워서, 검게 덮이는 부분과 자연스럽게 이어지게 함
      bctx.fillStyle = '#000000';
      bctx.fillRect(0, 0, GAME_W, GAME_H);
    }
    renderRoomLayer(oldOffset, camYOffset, roomIndex, enemies, currentCamX(), true, projectiles, { side: coverSide, frac: peek.frac });
    if (!isAnyHidden(peek.destIdx) && !isAnyHidden(roomIndex)) {
      renderRoomLayer(newOffset, camYOffset, peek.destIdx, rooms[peek.destIdx], currentCamX(), false, null, null);
    } else if (enteringHidden || hiddenHop) {
      // 히든방으로 "들어갈" 때(히든방끼리 오갈 때도 같음): 원래 맵은 검게 덮이고, 그 밑(아래/위)에서 히든방이 따라 들어오는 모습을 보여줌
      // (히든방엔 움직이는 적이 없어서 미리 보여줘도 어색하지 않음)
      rooms[peek.destIdx].forEach(en => { if (en.x === undefined) en.x = en.baseX; }); // 처음 가는 방은 x가 비어 있어서 단서 오브젝트가 안 그려지므로 채워 둠
      renderRoomLayer(newOffset, camYOffset, peek.destIdx, rooms[peek.destIdx], camXAfterCrossing(peek.destIdx, peek.entryX), false, null, null);
    } else if (leavingHidden) {
      // 히든방에서 "나올" 때: 다음 방을 흐리게 보여주다가, 거의 다 나오면 또렷하게 (적 위치는 지금 프레임에 맞춰 둬서 전환 순간에 튀지 않게 함)
      if (!quizOpen) rooms[peek.destIdx].forEach(placeEnemyForFrame);
      renderRoomLayer(newOffset, camYOffset, peek.destIdx, rooms[peek.destIdx], camXAfterCrossing(peek.destIdx, peek.entryX), false, null, null);
      blurBand(camYOffset + newOffset, ROOM_HEIGHT, blurLevelForProgress(peek.frac));
    }
  } else {
    renderRoomLayer(0, camYOffset, roomIndex, enemies, currentCamX(), true, projectiles, null);
  }

  // 방 위/아래로 살짝 남는 여백도 벽처럼(구름 무늬) 채워서 배경이 뜨지 않게 함 (히든방이면 어둡게)
  if (!peek && camYOffset > 0) {
    const marginColor = isAnyHidden(roomIndex) ? '#05040a' : '#ffb3c6';
    bctx.fillStyle = marginColor;
    bctx.fillRect(0, 0, GAME_W, camYOffset);
    bctx.fillRect(0, GAME_H - camYOffset, GAME_W, camYOffset);
    if (!isAnyHidden(roomIndex)) {
      drawCloudPuffs(0, camYOffset, 0, GAME_W);
      drawCloudPuffs(0, GAME_H - camYOffset, 0, GAME_W);
    }
  }

  ctx.fillStyle = '#4a4a52';
  ctx.fillRect(0, 0, w, h);
  const scale = Math.min(w / GAME_W, h / GAME_H);
  const drawW = GAME_W * scale, drawH = GAME_H * scale;
  const dx = Math.floor((w - drawW) / 2), dy = Math.floor((h - drawH) / 2);
  ctx.drawImage(buf, dx, dy, drawW, drawH);
}
