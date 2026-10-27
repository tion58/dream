/* ============================================================
 * 파일: js/12-update.js
 * 역할: 매 프레임 게임 진행(update)
 * 들어있는 것: 상태별 진행, 충전 소리 갱신, 플레이어 이동/마찰/벽 충돌, 문 통과, 적·투사체 움직임과 충돌, 상자/단서 판정
 * 먼저 로드돼야 하는 파일: 10-rooms.js, 11-combat-camera.js
 * 주의: 일시정지(quizOpen)일 때 적이 멈추는 처리가 여기 들어 있음. 새 오브젝트 종류를 만들면 이 파일의 충돌 처리 분기와 13-render.js의 그리기 분기를 같이 수정
 * ============================================================ */

function update() {
  if (blockedByPortrait) return;
  if (gameState === 'clueGame') { updateClueGame(); return; }
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
  if (camLocked && Math.abs(player.y - camLockEntryY) > CAM_UNLOCK_DIST) camLocked = false;

  ['up', 'down', 'left', 'right'].forEach(name => {
    if (chargeStart[name] !== null) {
      const frac = Math.min(1, (frameCount - chargeStart[name]) / MAX_CHARGE_FRAMES);
      updateChargeSound(name, frac);
    }
  });

  // 발사된 후에는 계속 미끄러지다가 마찰로 서서히 멈춤 (충전/발사는 releaseDir에서 처리)
  player.vx *= player.friction;
  player.vy *= player.friction;
  player.vx = Math.max(-player.maxSpeed, Math.min(player.maxSpeed, player.vx));
  player.vy = Math.max(-player.maxSpeed, Math.min(player.maxSpeed, player.vy));
  if (Math.abs(player.vx) < 0.02) player.vx = 0;
  if (Math.abs(player.vy) < 0.02) player.vy = 0;

  player.x += player.vx;
  player.y += player.vy;

  player.x += player.knockVX;
  player.y += player.knockVY;
  player.knockVX *= KNOCK_FRICTION;
  player.knockVY *= KNOCK_FRICTION;
  if (Math.abs(player.knockVX) < 0.05) player.knockVX = 0;
  if (Math.abs(player.knockVY) < 0.05) player.knockVY = 0;

  const hw = player.w / 2, hh = player.h / 2;

  // 좌우 벽은 항상 막힘 (단, 마지막 방은 오른쪽 위쪽에 최종 출구가 있음; 히든방은 폭이 더 좁음)
  const rb = roomBounds(roomIndex);
  if (player.x - hw < rb.left + WALL_THICK) { player.x = rb.left + WALL_THICK + hw; player.knockVX = 0; player.vx = 0; }
  if (player.x + hw > rb.right - WALL_THICK) {
    const isFinalRoom = roomIndex === MAIN_ROOM_COUNT - 1;
    const inRightGap = isFinalRoom && Math.abs(player.y - RIGHT_EXIT_Y_CENTER) < (RIGHT_EXIT_HALF_Y - hh);
    if (inRightGap) {
      if ((player.x + hw) - (rb.right - WALL_THICK) >= CROSS_MARGIN) { cleared = true; clearMsg.style.display = 'block'; }
    } else {
      player.x = rb.right - WALL_THICK - hw; player.knockVX = 0; player.vx = 0;
    }
  }

  // 위/아래 벽: 통로(구멍) 부분은 실제 넘어갈 때까지 자유롭게 이동 가능(캐릭터를 따라 카메라가 계속 움직임),
  // CROSS_MARGIN만큼 완전히 넘어가면 그때 다음/이전 방(혹은 히든방)으로 좌표를 이어붙여 전환
  // (화면이 이미 검은색으로 완전히 덮인 시점과 정확히 일치하므로, 위치 보정은 crossRoom 안에서만 일어나면 충분함)
  if (!cleared && player.y - hh < WALL_THICK) {
    const topInfo = resolveTopCrossing(hw);
    if (topInfo.matched) {
      const bleed = WALL_THICK - (player.y - hh);
      if (bleed >= CROSS_MARGIN) crossRoom(topInfo.destIdx, 'up', topInfo.entryXOverride);
    } else {
      player.y = WALL_THICK + hh; player.knockVY = 0; player.vy = 0;
    }
  }
  if (!cleared && player.y + hh > ROOM_HEIGHT - WALL_THICK) {
    const botInfo = resolveBottomCrossing(hw);
    if (botInfo.matched) {
      const bleed = (player.y + hh) - (ROOM_HEIGHT - WALL_THICK);
      if (bleed >= CROSS_MARGIN) crossRoom(botInfo.destIdx, 'down', botInfo.entryXOverride);
    } else {
      player.y = ROOM_HEIGHT - WALL_THICK - hh; player.knockVY = 0; player.vy = 0;
    }
  }

  if (player.stunTimer > 0) player.stunTimer--;
  if (cleared) return;

  enemies.forEach(en => {
    if (!quizOpen) {
      if (en.type === 'enemy' || en.type === 'thrower') {
        en.x = en.baseX + Math.sin(frameCount * en.speed * 0.02 + en.phase) * en.amp;
      } else if (en.type === 'hopper') {
        // 양옆으로도 움직이면서 통통 튀듯 위아래로 점프 (항상 양수 값이 되게 해서 반복적으로 튀어오름)
        en.x = en.baseX + Math.sin(frameCount * en.speed * 0.015 + en.sidePhase) * en.sideAmp;
        en.y = (ROOM_HEIGHT - WALL_THICK - 26) - Math.abs(Math.sin(frameCount * en.speed * 0.05 + en.phase)) * en.amp;
      } else {
        en.x = en.baseX;
      }
      if (en.hitCD > 0) en.hitCD--;
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

    if (en.type === 'cluePoint') {
      // 공격 판정 없음 - 가까이 가면 상호작용 가능 표시만 하고, E키(또는 상호작용 버튼)로 직접 시작함
      if (!en.solved) {
        const dxp = player.x - en.x, dyp = player.y - en.y;
        if (Math.sqrt(dxp * dxp + dyp * dyp) < en.r + player.w * 0.5 + 14) nearbyInteractable = en;
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

  interactPromptEl.style.display = (nearbyInteractable && !quizOpen) ? 'block' : 'none';
}
