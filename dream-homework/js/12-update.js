/* ============================================================
 * 파일: js/12-update.js
 * 역할: 매 프레임 게임 진행(update)
 * 들어있는 것: placeEnemyForFrame(적 위치 계산), resolveRoomWalls(히든방2 칸막이 충돌), 상태별 진행, 충전 소리 갱신, 시작 구역 자유 이동, 플레이어 이동/마찰/벽 충돌, 문 통과, 적·투사체 움직임과 충돌, 상자/단서/연구소 오브젝트 판정
 * 먼저 로드돼야 하는 파일: 10-rooms.js, 11-combat-camera.js
 * 주의: 일시정지(quizOpen)일 때 적이 멈추는 처리가 여기 들어 있음. 새 오브젝트 종류를 만들면 이 파일의 충돌 처리 분기와 13-render.js의 그리기 분기를 같이 수정
 * ============================================================ */
const BUILD_12 = 48; // 이 파일의 버전 번호 (index.html 의 "파일 버전 검사"가 씀). 파일을 크게 고치면 숫자를 올리고 index.html 의 검사 목록(BUILD)도 같이 올릴 것


// 지금 프레임(frameCount)에서 이 적이 있어야 할 위치를 계산해서 en.x / en.y 에 넣음
// update()가 매 프레임 쓰고, 13-render.js 가 히든방에서 나올 때 다음 방 미리보기를 그리기 전에도 씀 (전환되는 순간 적이 튀지 않게)
// 무기에 맞아 밀려난 거리(offX/offY, 11b-weapons.js)도 더해서, 맞은 적이 밀려났다가 원래 움직임으로 돌아오게 함
function placeEnemyForFrame(en) {
  const ox = en.offX || 0, oy = en.offY || 0;
  if (en.type === 'enemy' || en.type === 'thrower') {
    if (en.y0 === undefined) en.y0 = en.y; // 원래 높이를 기억해 둠 (밀려난 거리를 더해도 계속 쌓이지 않게)
    en.x = en.baseX + Math.sin(frameCount * en.speed * 0.02 + en.phase) * en.amp + ox;
    en.y = en.y0 + oy;
  } else if (en.type === 'hopper') {
    // 양옆으로도 움직이면서 통통 튀듯 위아래로 점프 (항상 양수 값이 되게 해서 반복적으로 튀어오름)
    en.x = en.baseX + Math.sin(frameCount * en.speed * 0.015 + en.sidePhase) * en.sideAmp + ox;
    en.y = (ROOM_HEIGHT - WALL_THICK - 26) - Math.abs(Math.sin(frameCount * en.speed * 0.05 + en.phase)) * en.amp + oy;
  } else {
    en.x = en.baseX;
  }
  if (ox || oy) { // 밀려난 적이 방 밖으로 나가지 않게
    en.x = Math.max(WALL_THICK + en.r, Math.min(ROOM_WIDTH - WALL_THICK - en.r, en.x));
    en.y = Math.max(WALL_THICK + en.r, Math.min(ROOM_HEIGHT - WALL_THICK - en.r, en.y));
  }
}

// 가까이 가면 E키로 상호작용할 수 있는 오브젝트 종류 (새 종류를 만들면 07-inventory-interact.js 의 interactWith 와 13-render.js 도 같이)
const WALL_EJECT_SPEED = 5; // 맞고 밀려난 뒤에도 벽 안에 있으면 방 안쪽으로 튕겨 나오는 속도 (클수록 멀리 튕김)
const INTERACTABLE_TYPES = { cluePoint: true, notebook: true, tornNote: true, pickup: true, drawer: true, breakable: true, prop: true };
function isInteractableNow(en) {
  if (en.type === 'cluePoint') return !en.solved;
  if (en.type === 'pickup') return !en.taken; // 한 번 주운 아이템은 다시 줍지 못함
  if (en.type === 'drawer') return !en.opened;
  if (en.type === 'breakable') return !en.broken;
  return true; // 노트와 쪽지는 언제든 다시 읽을 수 있음
}

// 히든방2의 칸막이 벽(roomWalls)에 플레이어가 겹치면 가장 적게 겹친 쪽으로 밀어내고, 그 방향의 속도를 0으로 만듦
function resolveRoomWalls() {
  const walls = roomWalls[roomIndex];
  if (!walls || !walls.length) return;
  const hw = player.w / 2, hh = player.h / 2;
  walls.forEach(w => {
    const left = player.x - hw, right = player.x + hw, top = player.y - hh, bottom = player.y + hh;
    if (right <= w.x || left >= w.x + w.w || bottom <= w.y || top >= w.y + w.h) return;
    const pushLeft = right - w.x, pushRight = (w.x + w.w) - left, pushUp = bottom - w.y, pushDown = (w.y + w.h) - top;
    const m = Math.min(pushLeft, pushRight, pushUp, pushDown);
    if (m === pushUp) { player.y -= pushUp; if (player.vy > 0) player.vy = 0; if (player.knockVY > 0) player.knockVY = 0; }
    else if (m === pushDown) { player.y += pushDown; if (player.vy < 0) player.vy = 0; if (player.knockVY < 0) player.knockVY = 0; }
    else if (m === pushLeft) { player.x -= pushLeft; if (player.vx > 0) player.vx = 0; if (player.knockVX > 0) player.knockVX = 0; }
    else { player.x += pushRight; if (player.vx < 0) player.vx = 0; if (player.knockVX < 0) player.knockVX = 0; }
  });
}

function update() {
  stepSleepEffects(); // 졸음 스택에 따른 화면 어두워짐 / 게임 오버 연출 (12b-sleep.js)
  if (blockedByPortrait) return;
  if (gameState === 'clueGame') { updateClueGame(); return; }
  if (gameState === 'clueGameCircle') { updateCircleGame(); return; }
  if (gameState === 'clueGameCompute') { updateComputeGame(); return; }
  if (gameState === 'boxNotice') { updateBoxNotice(); return; }
  if (gameState === 'clueGameEnter') {
    clueGameEnterTimer++;
    if (clueGameEnterTimer >= CLUE_ENTER_DURATION) { startClueGame(pendingClueStart); pendingClueStart = null; }
    return;
  }
  if (gameState !== 'playing') return;
  frameCount++;
  if (cleared) return;

  nearbyInteractable = null; // 매 프레임 다시 판정 (멀어지면 자동으로 꺼짐)
  // 히든방 입구에 고정된 카메라: 입구에서 조금(가로든 세로든) 벗어나면 풀리고, 풀릴 때 화면이 튀지 않게 서서히 따라옴
  if (camLocked && Math.hypot(player.x - camLockEntryX, player.y - camLockEntryY) > CAM_UNLOCK_DIST) {
    camEaseOffset = camLockX - baseCamX();
    camLocked = false;
  }
  if (camEaseOffset !== 0) {
    camEaseOffset *= 0.9;
    if (Math.abs(camEaseOffset) < 0.3) camEaseOffset = 0;
  }

  ['up', 'down', 'left', 'right'].forEach(name => {
    if (chargeStart[name] !== null) {
      const frac = Math.min(1, (frameCount - chargeStart[name]) / chargeFramesNow()); // 졸음이 쌓일수록 풀차징까지 오래 걸림
      updateChargeSound(name, frac);
    }
  });

  stepRampage(); // ■■를 먹은 뒤의 폭주 (12c-story-events.js)
  stepAnomaly(); // 히든방3에 오래 있으면 히든방2로 되돌아가는 이상 증세 (12c-story-events.js)

  // 화염방사기를 뿜는 동안에는 바라보는 방향으로 가속하고 앞쪽을 태움 (안 뿜을 때는 연료가 참, 11b-weapons.js)
  stepFlame();

  // 발사된 후에는 계속 미끄러지다가 마찰로 서서히 멈춤 (충전/발사는 releaseDir에서 처리)
  player.vx *= player.friction;
  player.vy *= player.friction;
  player.vx = Math.max(-player.maxSpeed, Math.min(player.maxSpeed, player.vx));
  player.vy = Math.max(-player.maxSpeed, Math.min(player.maxSpeed, player.vy));
  if (Math.abs(player.vx) < 0.02) player.vx = 0;
  if (Math.abs(player.vy) < 0.02) player.vy = 0;

  // 시작 구역(노란선 안쪽)에서는 방향키를 모두 해금했다면(관리자 모드는 어디서나), 누르고 있는 동안 충전 없이 걸어다닐 수 있음
  let freeVX = 0, freeVY = 0;
  if (player.stunTimer <= 0 && !quizOpen && freeMoveActive()) {
    freeVX = (heldDirs.right ? 1 : 0) - (heldDirs.left ? 1 : 0);
    freeVY = (heldDirs.down ? 1 : 0) - (heldDirs.up ? 1 : 0);
    if (freeVX && freeVY) { freeVX *= 0.7071; freeVY *= 0.7071; } // 대각선도 같은 속도
    if (freeVX) player.faceX = freeVX > 0 ? 1 : -1;
    if (freeVX || freeVY) {
      if (Math.abs(freeVX) >= Math.abs(freeVY)) player.facing = freeVX > 0 ? 'right' : 'left';
      else player.facing = freeVY > 0 ? 'down' : 'up';
    }
    const moveSpeed = adminMode ? ADMIN_MOVE_SPEED : FREE_MOVE_SPEED;
    freeVX *= moveSpeed; freeVY *= moveSpeed;
  }
  player.x += player.vx + freeVX;
  player.y += player.vy + freeVY;

  player.x += player.knockVX;
  player.y += player.knockVY;
  player.knockVX *= KNOCK_FRICTION;
  player.knockVY *= KNOCK_FRICTION;
  if (Math.abs(player.knockVX) < 0.05) player.knockVX = 0;
  if (Math.abs(player.knockVY) < 0.05) player.knockVY = 0;

  resolveRoomWalls(); // 히든방2의 칸막이 벽

  const hw = player.w / 2, hh = player.h / 2;

  // 벽 처리. 평소에는 좌우/위아래 벽이 항상 막고 있음 (단, 위/아래 통로 부분은 실제로 넘어갈 때까지 자유롭게 이동).
  // 단, 적에게 맞은 뒤(player.wallPass)에는: 밀려나는 동안은 벽을 통과하고(방 바깥으로는 못 나감), 다 밀려났는데도 벽 안에 있으면 방 안쪽으로 튕겨 나옴 → 구석에 갇히지 않음
  const rb = roomBounds(roomIndex);
  const T = WALL_THICK;
  const passing = player.wallPass;
  const knockActive = player.stunTimer > 0 || Math.hypot(player.knockVX, player.knockVY) > 0.5;
  let stillInWall = false;
  if (player.x - hw < rb.left + T) { // 왼쪽 벽
    if (!passing) { player.x = rb.left + T + hw; player.knockVX = 0; player.vx = 0; }
    else {
      stillInWall = true;
      if (player.x - hw < rb.left) { player.x = rb.left + hw; if (player.knockVX < 0) player.knockVX = 0; if (player.vx < 0) player.vx = 0; }
      if (!knockActive) { player.knockVX = WALL_EJECT_SPEED; player.vx = 0; }
    }
  }
  if (player.x + hw > rb.right - T) { // 오른쪽 벽
    if (!passing) { // (맵 탈출구는 없앴음: 모든 방의 오른쪽 벽이 막혀 있음)
      player.x = rb.right - T - hw; player.knockVX = 0; player.vx = 0;
    } else {
      stillInWall = true;
      if (player.x + hw > rb.right) { player.x = rb.right - hw; if (player.knockVX > 0) player.knockVX = 0; if (player.vx > 0) player.vx = 0; }
      if (!knockActive) { player.knockVX = -WALL_EJECT_SPEED; player.vx = 0; }
    }
  }

  // 위/아래 벽: 통로(구멍) 부분은 실제 넘어갈 때까지 자유롭게 이동 가능(캐릭터를 따라 카메라가 계속 움직임),
  // CROSS_MARGIN만큼 완전히 넘어가면 그때 다음/이전 방(혹은 히든방)으로 좌표를 이어붙여 전환
  // (화면이 이미 검은색으로 완전히 덮인 시점과 정확히 일치하므로, 위치 보정은 crossRoom 안에서만 일어나면 충분함)
  if (!cleared && player.y - hh < T) {
    const topInfo = resolveTopCrossing(hw);
    if (topInfo.matched) {
      const bleed = T - (player.y - hh);
      if (bleed >= CROSS_MARGIN) crossRoom(topInfo.destIdx, 'up', topInfo.entryXOverride);
    } else if (!passing) {
      player.y = T + hh; player.knockVY = 0; player.vy = 0;
    } else {
      stillInWall = true;
      if (player.y - hh < 0) { player.y = hh; if (player.knockVY < 0) player.knockVY = 0; if (player.vy < 0) player.vy = 0; }
      if (!knockActive) { player.knockVY = WALL_EJECT_SPEED; player.vy = 0; }
    }
  }
  if (!cleared && player.y + hh > ROOM_HEIGHT - T) {
    const botInfo = resolveBottomCrossing(hw);
    if (botInfo.matched) {
      const bleed = (player.y + hh) - (ROOM_HEIGHT - T);
      if (bleed >= CROSS_MARGIN) crossRoom(botInfo.destIdx, 'down', botInfo.entryXOverride);
    } else if (!passing) {
      player.y = ROOM_HEIGHT - T - hh; player.knockVY = 0; player.vy = 0;
    } else {
      stillInWall = true;
      if (player.y + hh > ROOM_HEIGHT) { player.y = ROOM_HEIGHT - hh; if (player.knockVY > 0) player.knockVY = 0; if (player.vy > 0) player.vy = 0; }
      if (!knockActive) { player.knockVY = -WALL_EJECT_SPEED; player.vy = 0; }
    }
  }
  if (player.wallPass && !knockActive && !stillInWall) player.wallPass = false; // 다 밀려났고 벽 밖이면 다시 평소처럼 벽이 막음

  if (player.stunTimer > 0) player.stunTimer--;
  if (cleared) return;

  let bestInteractDist = Infinity; // 가까이에 상호작용할 것이 여러 개면 가장 가까운 것을 고름
  enemies.forEach(en => {
    if (en.dead) return;
    if (!quizOpen) {
      stepEnemyKnock(en);
      placeEnemyForFrame(en);
      if (en.hitCD > 0) en.hitCD--;
      if (en.hurt > 0) en.hurt--;
    }

    if (en.type === 'centerBlock') {
      // 일반 벽처럼 물리적으로 막기만 함 - 피격/스턴/충전취소 없음
      const dx0 = player.x - en.x, dy0 = player.y - en.y;
      const dist0 = Math.sqrt(dx0 * dx0 + dy0 * dy0) || 1;
      const minDist0 = player.w * 0.5 + en.r;
      if (dist0 < minDist0) {
        const overlap0 = minDist0 - dist0;
        const ux0 = dx0 / dist0, uy0 = dy0 / dist0;
        player.x += ux0 * overlap0; player.y += uy0 * overlap0;
      }
      return;
    }

    if (INTERACTABLE_TYPES[en.type]) {
      // 공격 판정 없음 - 가까이 가면 상호작용 가능 표시만 하고, E키(또는 상호작용 버튼)로 직접 함 (동작은 07-inventory-interact.js 의 interactWith)
      if (isInteractableNow(en)) {
        const dxp = player.x - en.x, dyp = player.y - en.y;
        const dI = Math.sqrt(dxp * dxp + dyp * dyp);
        if (dI < en.r + player.w * 0.5 + 14 && dI < bestInteractDist) { nearbyInteractable = en; bestInteractDist = dI; }
      }
      return;
    }

    if (en.type === 'tutorialBox') {
      // 1단계: 멀리서 처음 발견하면 화면이 상자 쪽으로 확대됐다가 돌아오며 대사가 뜸
      // 2단계: 상호작용 키 없이 닿기만 하면 자동으로 열려서 해금됨
      if (!en.solved) {
        const dxp = player.x - en.x, dyp = player.y - en.y;
        const dist = Math.sqrt(dxp * dxp + dyp * dyp);
        if (!en.noticed && dist < 80) {
          en.noticed = true;
          startBoxNotice(en);
        }
        if (dist < en.r + player.w * 0.5 + 6) {
          en.solved = true;
          quizUnlockKnown = true;
          showTutorialBoxPopup();
        }
      }
      return;
    }

    const dx = player.x - en.x, dy = player.y - en.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const minDist = (player.w * 0.5) + en.r;
    if (dist < minDist && en.hitCD <= 0) {
      const alreadyBouncing = Math.hypot(player.knockVX, player.knockVY) > 2;
      if (!quizOpen || alreadyBouncing) {
        en.hitCD = ENEMY_HIT_CD;
        if (en.type === 'wall') applyWallHitToPlayer(en); // 벽 장애물: 벽 쪽으로 붙으며 튕김
        else applyHitToPlayer(en.x, en.y, en.r);
      }
    }
    if (en.type === 'thrower' && !quizOpen) {
      en.throwCD--;
      if (en.throwCD <= 0) {
        en.throwCD = 90 + Math.random() * 60;
        const sx = en.x, sy = en.y;
        // 플레이어를 조준하지 않고, 스스로를 기준으로 랜덤한 방향으로 던짐 - 목표 지점을 항상 벽까지 닿게 계산
        const throwAngle = Math.random() * Math.PI * 2;
        const dcos = Math.cos(throwAngle), dsin = Math.sin(throwAngle);
        // 그 방향으로 쭉 나아갔을 때 방의 벽(안쪽 경계선)에 닿는 지점을 계산
        let tMax = Infinity;
        if (dcos > 0.0001) tMax = Math.min(tMax, (ROOM_WIDTH - WALL_THICK - sx) / dcos);
        else if (dcos < -0.0001) tMax = Math.min(tMax, (WALL_THICK - sx) / dcos);
        if (dsin > 0.0001) tMax = Math.min(tMax, (ROOM_HEIGHT - WALL_THICK - sy) / dsin);
        else if (dsin < -0.0001) tMax = Math.min(tMax, (WALL_THICK - sy) / dsin);
        if (!isFinite(tMax) || tMax <= 0) tMax = 200;
        const ex = sx + dcos * tMax, ey = sy + dsin * tMax;
        const throwDist = tMax;
        // 물풍선 던지듯: 거리가 멀수록 더 높이 뜨고 더 오래 날아감 (탄속을 확 낮춤)
        const arcHeight = Math.max(45, Math.min(140, throwDist * 0.55));
        const duration = Math.max(90, Math.min(260, throwDist / 0.9));
        projectiles.push({
          startX: sx, startY: sy, endX: ex, endY: ey,
          ctrlX: (sx + ex) / 2, ctrlY: (sy + ey) / 2 - arcHeight,
          x: sx, y: sy, t: 0, duration, r: PROJ_R,
        });
      }
    }
  });

  for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].dead) enemies.splice(i, 1); // 체력이 0이 된 적은 사라짐
  stepWeapons(); // 무기 쿨다운, 공격 모습 (11b-weapons.js)
  if (!quizOpen) stepPlayerEffects(); // 부푼 구름 모습, 잔상 구름 (03b-sprites.js)

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    if (!quizOpen) {
      p.t = Math.min(1, p.t + 1 / p.duration);
      const mt = 1 - p.t;
      p.x = mt * mt * p.startX + 2 * mt * p.t * p.ctrlX + p.t * p.t * p.endX;
      p.y = mt * mt * p.startY + 2 * mt * p.t * p.ctrlY + p.t * p.t * p.endY;
      // 벽(방 경계)에 실제로 닿을 때만 사라짐 - 그 전까지는 계속 남아있음
      if (p.x <= WALL_THICK || p.x >= ROOM_WIDTH - WALL_THICK || p.y <= WALL_THICK || p.y >= ROOM_HEIGHT - WALL_THICK) {
        projectiles.splice(i, 1); continue;
      }
    }
    const dx = player.x - p.x, dy = player.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const minDist = player.w * 0.5 + p.r;
    if (dist < minDist) {
      const alreadyBouncing = Math.hypot(player.knockVX, player.knockVY) > 2;
      if (!quizOpen || alreadyBouncing) { applyHitToPlayer(p.x, p.y, p.r); projectiles.splice(i, 1); }
    }
  }

  if (nearbyInteractable && !quizOpen) {
    interactPromptEl.textContent = nearbyInteractable.prompt || 'E 상호작용';
    interactPromptEl.style.display = 'block';
  } else {
    interactPromptEl.style.display = 'none';
  }
}
