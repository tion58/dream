/* ============================================================
 * 파일: js/09b-clue-game-circle.js
 * 역할: 두 번째 단서 미니게임 - 원 안에서 보라색 몬스터의 공격을 피하기 (이동은 본 게임처럼 "차징 → 발사")
 * 들어있는 것: 원 경기장 상수, startCircleGame / resetCircleGame, 차징 입력(circleGamePress/Release), updateCircleGame(이동·공격·충돌), drawCircleGame
 * 먼저 로드돼야 하는 파일: 01-core.js, 03-world-player.js(충전 상수), 04-audio.js, 09-clue-game.js(힌트 글자 표시/종료)
 * 그림: 주인공/보라색 몬스터/잔상 구름은 03b-sprites.js 의 그림을 씀 (그림이 없으면 예전 네모 모양으로 대신 그림)
 * 주의: 첫 번째 미니게임(위/아래 두 칸 레인 피하기, 09-clue-game.js)과 규칙은 같음 - 공격을 하나 피할 때마다 정답 힌트 글자가 하나씩 공개되고, 맞아도 페널티는 없음(임시).
 *       어떤 단서가 이 미니게임을 쓰는지와 정답은 10-rooms.js 의 단서 오브젝트(game: 'circle', answer)에 있음.
 *       drawCircleGame 은 13-render.js 의 px() 함수를 씀
 * ============================================================ */
const BUILD_09B = 41; // 이 파일의 버전 번호 (index.html 의 "파일 버전 검사"가 씀). 파일을 크게 고치면 숫자를 올리고 index.html 의 검사 목록(BUILD)도 같이 올릴 것


// ---- 경기장과 난이도 (숫자를 바꿔서 쉽게/어렵게 조절) ----
const CIRCLE_R = 90;               // 경기장(원)의 반지름
const CIRCLE_CY_FRAC = 0.6;        // 원 중심의 세로 위치(화면 높이 비율). 위쪽 힌트 글자와 안 겹치게 조금 아래
const CIRCLE_EDGE_PAD = 9;         // 플레이어 중심이 원의 가장자리에서 이만큼 안쪽까지만 갈 수 있음
const CIRCLE_BOUNCE = 0.4;         // 가장자리에 부딪혔을 때 튕겨나오는 정도 (0이면 그냥 멈춤)
const CIRCLE_BULLET_R = 5;         // 몬스터가 쏘는 탄의 크기
const CIRCLE_BURST_COUNT = 10;     // "사방으로 퍼지는 공격"의 탄 개수 (적을수록 쉬움)
const CIRCLE_BURST_SPEED = 1.5;    // 사방으로 퍼지는 탄의 속도
const CIRCLE_AIM_SPEED = 2.1;      // "플레이어를 노리는 공격"의 탄 속도
const CIRCLE_TELEGRAPH_FRAMES = 45; // 공격 예고 시간 (60프레임 = 1초). 길수록 쉬움
const CIRCLE_AIM_LOCK_FRAMES = 15;  // 조준 공격은 발사 직전 이만큼은 조준선이 고정됨 (그동안 피할 수 있음)

let circleGame = null; // 미니게임 진행 상태 (플레이어 위치/속도, 충전, 공격 목록 등). 미니게임 밖에서는 null

function circleCenter() { return { x: GAME_W / 2, y: GAME_H * CIRCLE_CY_FRAC }; }

function startCircleGame(cp) {
  const c = circleCenter();
  circleGame = {
    frame: 0,
    x: c.x, y: c.y + CIRCLE_R * 0.55, vx: 0, vy: 0,        // 플레이어 (원 아래쪽에서 시작)
    charge: { up: null, down: null, left: null, right: null }, // 방향별 충전을 시작한 프레임
    attacks: [],       // 날아가는 공격 묶음 { bullets: [...], hit: 맞았는지 }
    spawnTimer: 70,    // 다음 공격을 준비하기까지 남은 프레임
    telegraph: null,   // 지금 예고 중인 공격 { kind, t, dur, angle }
    hitFlash: 0,
    trail: [],         // 충전 후 남는 잔상 구름 (03b-sprites.js)
    puff: 0,           // 발사 직후 구름이 부푼 모습을 유지하는 남은 프레임
    faceX: 1,          // 바라보는 방향 (1: 오른쪽, -1: 왼쪽)
    lastTx: c.x, lastTy: c.y + CIRCLE_R * 0.55,
  };
  currentCluePoint = cp;
  gameState = 'clueGameCircle';
  clueGameDodges = 0;
  clueGameHintSubEl.textContent = '보라색 몬스터의 공격을 피하면서 힌트를 모으자!';
  updateClueGameHintDisplay();
  clueGameHintEl.style.display = 'block';
}

// 미니게임 중 충전하던 것과 소리를 멈춤 (창이 가려졌을 때, 미니게임이 끝났을 때)
function cancelCircleCharges() {
  if (!circleGame) return;
  ['up', 'down', 'left', 'right'].forEach(n => {
    if (circleGame.charge[n] !== null) { circleGame.charge[n] = null; stopChargeSound(n); }
  });
}
function resetCircleGame() {
  cancelCircleCharges();
  circleGame = null;
}

// ---- 입력: 본 게임처럼 방향키를 꾹 눌렀다 떼면 그 방향으로 발사 (방향 잠금과 상관없이 4방향 모두 가능) ----
function circleGamePress(name) {
  const g = circleGame;
  if (!g) return;
  if (name === 'left') g.faceX = -1;
  if (name === 'right') g.faceX = 1;
  if (g.charge[name] === null) { g.charge[name] = g.frame; startChargeSound(name); }
}
function circleGameRelease(name) {
  const g = circleGame;
  if (!g || g.charge[name] === null) return;
  const held = g.frame - g.charge[name];
  g.charge[name] = null;
  stopChargeSound(name);
  playReleaseThud();
  const frac = Math.min(1, held / chargeFramesNow());
  const power = MIN_LAUNCH + frac * frac * (MAX_LAUNCH - MIN_LAUNCH); // 본 게임(releaseDir)과 같은 공식
  if (name === 'left') g.vx = -power;
  if (name === 'right') g.vx = power;
  if (name === 'up') g.vy = -power;
  if (name === 'down') g.vy = power;
  g.puff = 18;
  addSleep(1); // 차징해서 발사할 때마다 졸음 스택 +1 (12b-sleep.js)
  if (power > 1.4) spawnAfterimage(g.trail, g.x, g.y, true); // 출발한 자리에 구름 잔상
  g.lastTx = g.x; g.lastTy = g.y;
}

// ---- 공격 ----
function fireCircleAttack(g, c, t) {
  const bullets = [];
  if (t.kind === 'burst') {
    // 몬스터에서 사방으로 고르게 퍼지는 탄 (탄 사이의 빈틈으로 들어가서 피함)
    for (let k = 0; k < CIRCLE_BURST_COUNT; k++) {
      const a = t.angle + (k * Math.PI * 2) / CIRCLE_BURST_COUNT;
      bullets.push({ x: c.x + Math.cos(a) * 14, y: c.y + Math.sin(a) * 14, vx: Math.cos(a) * CIRCLE_BURST_SPEED, vy: Math.sin(a) * CIRCLE_BURST_SPEED, r: CIRCLE_BULLET_R });
    }
  } else {
    // 플레이어 쪽으로 세 갈래로 날아가는 탄
    [-0.22, 0, 0.22].forEach(off => {
      const a = t.angle + off;
      bullets.push({ x: c.x + Math.cos(a) * 14, y: c.y + Math.sin(a) * 14, vx: Math.cos(a) * CIRCLE_AIM_SPEED, vy: Math.sin(a) * CIRCLE_AIM_SPEED, r: CIRCLE_BULLET_R });
    });
  }
  g.attacks.push({ bullets: bullets, hit: false });
}
// 탄이 플레이어에게 맞았는지 (테스트하거나 판정을 바꾸고 싶을 때는 이 함수만 고치면 됨)
function circleBulletHitsPlayer(g, b) {
  return Math.hypot(b.x - g.x, b.y - g.y) < b.r + 8;
}

function updateCircleGame() {
  const g = circleGame;
  if (!g) return;
  g.frame++;
  const c = circleCenter();

  // 충전 중인 방향의 바람 소리
  ['up', 'down', 'left', 'right'].forEach(n => {
    if (g.charge[n] !== null) updateChargeSound(n, Math.min(1, (g.frame - g.charge[n]) / chargeFramesNow()));
  });

  // 이동: 발사된 뒤 마찰로 서서히 멈춤 (본 게임과 같은 값)
  g.vx *= player.friction; g.vy *= player.friction;
  g.vx = Math.max(-player.maxSpeed, Math.min(player.maxSpeed, g.vx));
  g.vy = Math.max(-player.maxSpeed, Math.min(player.maxSpeed, g.vy));
  if (Math.abs(g.vx) < 0.02) g.vx = 0;
  if (Math.abs(g.vy) < 0.02) g.vy = 0;
  g.x += g.vx; g.y += g.vy;

  // 날아가는 길에 작은 구름을 남기고, 잔상이 서서히 사라지게 함
  if (g.puff > 0) g.puff--;
  if (Math.hypot(g.vx, g.vy) > 1.6 && Math.hypot(g.x - g.lastTx, g.y - g.lastTy) > 16) {
    spawnAfterimage(g.trail, g.x, g.y, false);
    g.lastTx = g.x; g.lastTy = g.y;
  }
  stepAfterimages(g.trail);

  // 원 밖으로는 나갈 수 없음: 가장자리에 닿으면 바깥으로 향하던 속도가 반대로 약하게 튕김
  const dx = g.x - c.x, dy = g.y - c.y;
  const d = Math.hypot(dx, dy);
  const lim = CIRCLE_R - CIRCLE_EDGE_PAD;
  if (d > lim) {
    const nx = dx / d, ny = dy / d;
    g.x = c.x + nx * lim; g.y = c.y + ny * lim;
    const vn = g.vx * nx + g.vy * ny;
    if (vn > 0) { g.vx -= (1 + CIRCLE_BOUNCE) * vn * nx; g.vy -= (1 + CIRCLE_BOUNCE) * vn * ny; }
  }

  // 공격 준비 → 발사 (힌트를 다 모아서 끝나가는 중에는 새 공격을 하지 않음)
  if (!clueGameFinishing) {
    if (g.telegraph) {
      const t = g.telegraph;
      t.t++;
      if (t.kind === 'aimed' && t.t < t.dur - CIRCLE_AIM_LOCK_FRAMES) t.angle = Math.atan2(g.y - c.y, g.x - c.x); // 조준선이 플레이어를 따라다니다가 마지막에 고정
      if (t.t >= t.dur) {
        fireCircleAttack(g, c, t);
        g.telegraph = null;
        g.spawnTimer = 70 + Math.floor(Math.random() * 40);
      }
    } else {
      g.spawnTimer--;
      if (g.spawnTimer <= 0) {
        g.telegraph = { kind: Math.random() < 0.6 ? 'burst' : 'aimed', t: 0, dur: CIRCLE_TELEGRAPH_FRAMES, angle: Math.random() * Math.PI * 2 };
      }
    }
  }

  // 탄 이동과 충돌: 한 번의 공격에서 날아간 탄이 전부 사라질 때까지 한 번도 안 맞았으면 "피했다"
  for (let i = g.attacks.length - 1; i >= 0; i--) {
    const atk = g.attacks[i];
    for (let j = atk.bullets.length - 1; j >= 0; j--) {
      const b = atk.bullets[j];
      b.x += b.vx; b.y += b.vy;
      if (circleBulletHitsPlayer(g, b)) {
        atk.hit = true;
        g.hitFlash = 14; // 맞음: 임시로 페널티는 없고 화면만 살짝 반응, 살짝 밀려남
        const ax = g.x - b.x, ay = g.y - b.y, al = Math.hypot(ax, ay) || 1;
        g.vx += (ax / al) * 2; g.vy += (ay / al) * 2;
        atk.bullets.splice(j, 1);
        continue;
      }
      if (Math.hypot(b.x - c.x, b.y - c.y) > CIRCLE_R + 14) atk.bullets.splice(j, 1);
    }
    if (atk.bullets.length === 0) {
      if (!atk.hit) { clueGameDodges++; updateClueGameHintDisplay(); }
      g.attacks.splice(i, 1);
    }
  }
  if (g.hitFlash > 0) g.hitFlash--;
}

// ---- 그리기 ----
function drawCircleGame() {
  bctx.fillStyle = '#bdf5e0'; // 입장 연출(민트색 원이 퍼짐)과 같은 바탕색이라 자연스럽게 이어짐
  bctx.fillRect(0, 0, GAME_W, GAME_H);
  const g = circleGame;
  if (!g) return;
  const c = circleCenter();

  // 경기장
  bctx.fillStyle = '#f1eaff';
  bctx.beginPath(); bctx.arc(c.x, c.y, CIRCLE_R, 0, Math.PI * 2); bctx.fill();
  bctx.save();
  bctx.globalAlpha = 0.25;
  bctx.strokeStyle = '#8a63d2'; bctx.lineWidth = 1;
  bctx.beginPath(); bctx.arc(c.x, c.y, CIRCLE_R * 0.55, 0, Math.PI * 2); bctx.stroke(); // 안쪽 장식 링
  bctx.restore();
  bctx.strokeStyle = '#8a63d2'; bctx.lineWidth = 3;
  bctx.beginPath(); bctx.arc(c.x, c.y, CIRCLE_R, 0, Math.PI * 2); bctx.stroke();

  // 공격 예고
  const tg = g.telegraph;
  if (tg) {
    const p = tg.t / tg.dur;
    bctx.save();
    if (tg.kind === 'burst') {
      bctx.globalAlpha = 0.25 + 0.5 * p;
      bctx.strokeStyle = '#b06bff'; bctx.lineWidth = 2;
      bctx.beginPath(); bctx.arc(c.x, c.y, 16 + p * 22, 0, Math.PI * 2); bctx.stroke(); // 몬스터 주변에 점점 커지는 고리
    } else {
      const locked = tg.t >= tg.dur - CIRCLE_AIM_LOCK_FRAMES;
      bctx.globalAlpha = locked ? 0.85 : 0.3 + 0.3 * p;
      bctx.strokeStyle = locked ? '#ff4d6d' : '#b06bff'; bctx.lineWidth = 2; // 조준선: 고정되면 빨갛게
      [-0.22, 0, 0.22].forEach(off => {
        bctx.beginPath();
        bctx.moveTo(c.x + Math.cos(tg.angle + off) * 16, c.y + Math.sin(tg.angle + off) * 16);
        bctx.lineTo(c.x + Math.cos(tg.angle + off) * (CIRCLE_R + 10), c.y + Math.sin(tg.angle + off) * (CIRCLE_R + 10));
        bctx.stroke();
      });
    }
    bctx.restore();
  }

  // 충전 후 남는 잔상 구름 (몬스터와 플레이어 아래)
  drawAfterimages(g.trail, 0);

  // 보라색 몬스터 (공격을 준비할 때는 번쩍임)
  const flash = tg && (g.frame % 8 < 4);
  if (spriteReady('enemyPurple')) {
    const bob = Math.round(Math.sin(g.frame * 0.08) * 2);
    bctx.save();
    bctx.globalAlpha = 0.3;
    bctx.fillStyle = '#9a5ce0';
    bctx.beginPath(); bctx.ellipse(c.x, c.y + 34, 20, 6, 0, 0, Math.PI * 2); bctx.fill(); // 바닥의 보라색 그림자
    bctx.restore();
    drawSprite('enemyPurple', c.x, c.y + bob, { scale: 1.25 });
    if (flash) drawSprite('enemyPurple', c.x, c.y + bob, { scale: 1.25, tint: 'white', alpha: 0.55 });
  } else {
    px(c.x - 13, c.y - 13, 26, 26, '#5b2f9e');
    px(c.x - 11, c.y - 11, 22, 22, flash ? '#c79bff' : '#9b59e6');
    px(c.x - 7, c.y - 5, 5, 5, '#ffffff');
    px(c.x + 2, c.y - 5, 5, 5, '#ffffff');
    px(c.x - 5, c.y - 3, 2, 3, '#2a1050');
    px(c.x + 4, c.y - 3, 2, 3, '#2a1050');
    px(c.x - 5, c.y + 4, 10, 2, '#2a1050');
  }

  // 탄
  g.attacks.forEach(atk => atk.bullets.forEach(b => {
    bctx.fillStyle = '#c27bff';
    bctx.beginPath(); bctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); bctx.fill();
    bctx.fillStyle = '#ffffff';
    bctx.beginPath(); bctx.arc(b.x, b.y, b.r * 0.4, 0, Math.PI * 2); bctx.fill();
  }));

  // 플레이어 (첫 번째 미니게임과 같은 모양) + 충전 중이면 충전 막대
  let chargeFrac = 0;
  ['up', 'down', 'left', 'right'].forEach(n => {
    if (g.charge[n] !== null) chargeFrac = Math.max(chargeFrac, Math.min(1, (g.frame - g.charge[n]) / chargeFramesNow()));
  });
  const spd = Math.hypot(g.vx, g.vy);
  const pname = playerSpriteFor(chargeFrac, g.puff, spd); // 충전 단계에 맞는 구름 모습
  let sox = 0, soy = 0;
  if (chargeFrac >= 0.5) sox = ((g.frame >> 1) % 2 === 0) ? -1 : 1;
  else if (chargeFrac === 0 && spd < 0.5) soy = Math.round(Math.sin(g.frame * 0.07) * 1.2);
  if (drawSprite(pname, g.x + sox, g.y + soy, { flip: g.faceX < 0 })) {
    if (g.hitFlash > 0) drawSprite(pname, g.x + sox, g.y + soy, { flip: g.faceX < 0, tint: 'red', alpha: 0.5 });
  } else {
    const bodyColor = g.hitFlash > 0 ? '#ff5c5c' : '#ffffff';
    px(g.x - 8, g.y - 9, 16, 18, bodyColor);
    px(g.x - 5, g.y - 6, 3, 3, '#4a7fd6');
    px(g.x + 2, g.y - 6, 3, 3, '#4a7fd6');
  }
  let best = null;
  ['up', 'down', 'left', 'right'].forEach(n => {
    if (g.charge[n] !== null) {
      const f = Math.min(1, (g.frame - g.charge[n]) / chargeFramesNow());
      if (best === null || f > best) best = f;
    }
  });
  if (best !== null) {
    const by = g.y - (spriteReady('playerIdle') ? 28 : 16); // 그림이 있으면 구름 위쪽에
    px(g.x - 9, by, 18, 4, '#3a2a5a');
    px(g.x - 8, by + 1, 16 * best, 2, best >= 1 ? '#ff9f43' : '#ffe08a');
  }
}
