/* ============================================================
 * 파일: js/13-render.js
 * 역할: 화면 그리기 (도트 스타일)
 * 들어있는 것: px() 사각형 그리기, 벽/구름/문, 적·장애물 그리기, 방 배경(스테이지별로 어두워짐), 히든방 연구실 투영, 방 전환 미리보기, 줌 연출, draw()
 * 먼저 로드돼야 하는 파일: 10-rooms.js, 11-combat-camera.js
 * 주의: 모든 도형은 정수 좌표의 사각형으로 그려서 도트 느낌을 유지. 새 오브젝트의 모양은 drawRoomHazards에 추가
 * ============================================================ */

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

function drawWallHorizontal(camX, yPos, isOpen, gapCenterX, doorColor, left, right) {
  const puffEdgeY = (yPos < ROOM_HEIGHT / 2) ? (yPos + WALL_THICK) : yPos; // 위쪽 벽은 아래쪽 가장자리, 아래쪽 벽은 위쪽 가장자리에 뭉게뭉게
  if (!isOpen) {
    px(left - camX, yPos, right - left, WALL_THICK, '#ffb3c6');
    for (let x = left; x < right; x += 8) px(x - camX, yPos + 2, 4, WALL_THICK - 4, '#ffd6e3');
    drawCloudPuffs(camX, puffEdgeY, left, right);
    return;
  }
  const leftW = gapCenterX - GAP_HALF_X, rightX = gapCenterX + GAP_HALF_X, rightW = right - rightX;
  px(left - camX, yPos, leftW - left, WALL_THICK, '#ffb3c6');
  px(rightX - camX, yPos, rightW, WALL_THICK, '#ffb3c6');
  for (let x = left; x < leftW; x += 8) px(x - camX, yPos + 2, 4, WALL_THICK - 4, '#ffd6e3');
  for (let x = rightX; x < right; x += 8) px(x - camX, yPos + 2, 4, WALL_THICK - 4, '#ffd6e3');
  drawCloudPuffs(camX, puffEdgeY, left, leftW);
  drawCloudPuffs(camX, puffEdgeY, rightX, right);
  if (doorColor === 'black') drawBlackDoorMarker(camX, yPos, gapCenterX);
}

function drawRoomHazards(camX, enemiesArr) {
  enemiesArr.forEach(en => {
    const ex = en.x - camX;
    if (ex < -20 || ex > GAME_W + 20) return;
    if (en.type === 'wall') {
      // 벽에 완전히 붙어있는, 가로로 납작한 형태
      const ww = en.wallW || 40, wh = en.wallH || 10;
      px(ex - ww / 2, en.y - wh / 2, ww, wh, '#ff9fc0');
      px(ex - ww / 2 + 3, en.y - wh / 2 + 2, ww - 6, wh - 4, '#ffe1ec');
    } else if (en.type === 'thrower') {
      px(ex - en.r * 0.6, en.y - en.r * 0.6, en.r * 1.2, en.r * 1.2, '#9a5ce0');
      px(ex - en.r * 0.35, en.y - en.r * 0.2, 3, 3, '#ffffff');
      px(ex + en.r * 0.15, en.y - en.r * 0.2, 3, 3, '#ffffff');
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
    } else {
      px(ex - en.r * 0.6, en.y - en.r * 0.6, en.r * 1.2, en.r * 1.2, '#e05a6b');
      px(ex - en.r * 0.35, en.y - en.r * 0.2, 3, 3, '#ffffff');
      px(ex + en.r * 0.15, en.y - en.r * 0.2, 3, 3, '#ffffff');
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

// 히든방: "기억이 투영된" 대학원 연구실 느낌 - 반투명한 가구 실루엣이 겹쳐 보이는 이중노출 효과
function drawLabOverlay(camX, left, right) {
  bctx.save();
  bctx.globalAlpha = 0.14;
  bctx.fillStyle = '#e8ecff';
  // 탑뷰(위에서 내려다본) 책상 - 단순한 직사각형
  const deskX = left + 55;
  px(deskX - camX, ROOM_HEIGHT / 2 - 30, 70, 40, '#e8ecff');
  // 탑뷰 의자 - 책상 옆 작은 원
  bctx.globalAlpha = 0.12;
  bctx.beginPath();
  bctx.arc(deskX - camX + 35, ROOM_HEIGHT / 2 + 26, 12, 0, Math.PI * 2);
  bctx.fill();
  // 탑뷰 책장 - 벽을 따라 길쭉한 직사각형
  bctx.globalAlpha = 0.16;
  const shelfX = right - 80;
  px(shelfX - camX, ROOM_HEIGHT / 2 - 55, 26, 110, '#e8ecff');
  bctx.globalAlpha = 0.24;
  for (let i = 0; i < 4; i++) {
    px(shelfX - camX + 3, ROOM_HEIGHT / 2 - 48 + i * 26, 20, 3, '#0d0f2b');
  }
  // 탑뷰 스탠드 조명
  bctx.globalAlpha = 0.13;
  bctx.beginPath();
  bctx.arc(deskX - camX + 60, ROOM_HEIGHT / 2 - 40, 8, 0, Math.PI * 2);
  bctx.fill();
  bctx.restore();
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
  if (isHidden) drawLabOverlay(camXVal, rb.left, rb.right);
  drawWallHorizontal(camXVal, 0, topOpen(roomIdxForFlags), topGapX(roomIdxForFlags), topDoorColor(roomIdxForFlags), rb.left, rb.right);
  if (roomIdxForFlags === EXTRA_HIDDEN_SOURCE_ROOM) {
    drawBlackDoorMarker(camXVal, 0, EXTRA_TOP_HIDDEN_GAP_X); // 정상 출구 옆에 별도로 뚫린 히든 통로
  }
  drawWallHorizontal(camXVal, ROOM_HEIGHT - WALL_THICK, bottomOpen(roomIdxForFlags), bottomGapX(roomIdxForFlags), bottomDoorColor(roomIdxForFlags), rb.left, rb.right);
  px(rb.left - camXVal, 0, WALL_THICK, ROOM_HEIGHT, isHidden ? '#1a1a30' : '#ffb3c6');
  if (roomIdxForFlags === MAIN_ROOM_COUNT - 1) {
    // 마지막 방: 오른쪽 벽 위쪽에 최종 출구가 뚫려있음
    const rx = rb.right - WALL_THICK;
    const gapTop = RIGHT_EXIT_Y_CENTER - RIGHT_EXIT_HALF_Y, gapBot = RIGHT_EXIT_Y_CENTER + RIGHT_EXIT_HALF_Y;
    px(-camXVal + rx, 0, WALL_THICK, gapTop, '#ffb3c6');
    px(-camXVal + rx, gapBot, WALL_THICK, ROOM_HEIGHT - gapBot, '#ffb3c6');
    px(-camXVal + rx - 2, gapTop - 3, WALL_THICK + 4, (gapBot - gapTop) + 6, '#ffe08a'); // 최종 출구 강조
  } else {
    px(-camXVal + rb.right - WALL_THICK, 0, WALL_THICK, ROOM_HEIGHT, isHidden ? '#1a1a30' : '#ffb3c6');
  }

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
    const bodyColor = player.stunTimer > 0 ? '#ff5c5c' : '#ffffff';
    px(pxScreen - player.w/2, player.y - player.h/2, player.w, player.h, bodyColor);
    px(pxScreen - player.w/2 + 2, player.y - player.h/2 + 3, 3, 3, '#4a7fd6');
    px(pxScreen + player.w/2 - 5, player.y - player.h/2 + 3, 3, 3, '#4a7fd6');
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

function draw() {
  const w = canvas.width, h = canvas.height;

  if (gameState === 'clueGame') {
    drawClueGame();
    ctx.fillStyle = '#4a4a52';
    ctx.fillRect(0, 0, w, h);
    const scale0 = Math.min(w / GAME_W, h / GAME_H);
    const dw0 = GAME_W * scale0, dh0 = GAME_H * scale0;
    ctx.drawImage(buf, Math.floor((w - dw0) / 2), Math.floor((h - dh0) / 2), dw0, dh0);
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
      if (bleed > 0) peek = { destIdx: info.destIdx, dirSign: 1, frac: Math.min(1, bleed / CROSS_MARGIN) };
    }
  }
  if (!peek && player.y + hh > ROOM_HEIGHT - WALL_THICK) {
    const info = resolveBottomCrossing(hw);
    if (info.matched) {
      const bleed = Math.max(0, (player.y + hh) - (ROOM_HEIGHT - WALL_THICK));
      if (bleed > 0) peek = { destIdx: info.destIdx, dirSign: -1, frac: Math.min(1, bleed / CROSS_MARGIN) };
    }
  }

  if (peek) {
    const oldOffset = peek.dirSign * peek.frac * GAME_H;
    const newOffset = oldOffset - peek.dirSign * GAME_H;
    const coverSide = peek.dirSign === 1 ? 'top' : 'bottom';
    renderRoomLayer(oldOffset, camYOffset, roomIndex, enemies, currentCamX(), true, projectiles, { side: coverSide, frac: peek.frac });
    // 히든방으로 "들어가거나" 히든방에서 "나올" 때는 다음 방을 미리 보여주지 않고,
    // 원래 맵이 검게 덮이기만 하다가 완전히 전환된 뒤에 보이게 함 (정지된 적이 미리 보이는 부자연스러움 방지)
    if (!isAnyHidden(peek.destIdx) && !isAnyHidden(roomIndex)) {
      renderRoomLayer(newOffset, camYOffset, peek.destIdx, rooms[peek.destIdx], currentCamX(), false, null, null);
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
