/* ============================================================
 * 파일: js/09c-clue-game-compute.js   (새 파일)
 * 역할: 세 번째 단서 미니게임 (히든방3 "작업실"의 컴퓨터) - 왼쪽에서는 보라색 몬스터의 공격을 피하고(이동은 본 게임처럼 "차징 → 발사"),
 *       오른쪽 컴퓨터 화면에서는 계산 문제(객관식)를 풀어요. 문제를 맞힐 때마다 정답 힌트 글자가 하나씩 공개되고, 다 모으면 끝나요.
 * 들어있는 것: 레이아웃(computeLayout), 문제 만들기(generateComputeQuestion ← 나중에 문제를 바꾸고 싶으면 이 함수만 고치면 됨), 보기 고르기(computeAnswer),
 *             시작/정리(startComputeGame/resetComputeGame), 차징 입력(computeGamePress/Release), updateComputeGame(이동·공격·충돌), drawComputeGame, positionComputeUI
 * 먼저 로드돼야 하는 파일: 01-core.js, 03-world-player.js(충전 상수), 04-audio.js, 09-clue-game.js(힌트 글자/종료), 09b(없어도 됨)
 * 입력: 숫자 키 1~4 또는 컴퓨터 화면의 보기를 누르기(터치/클릭). 방향키(D패드)는 충전-발사 이동. (키 처리는 05-input.js)
 * 규칙(임시, 정해지지 않아서 내가 정한 것):
 *   - 맞히면 정답 힌트 글자가 하나씩 공개(clueGameDodges++). 글자를 다 모으면(= 정답 글자 수만큼 맞히면) 단서를 얻고 끝남. 단서마다 보상(reward)이 있으면 처음 끝냈을 때 같이 얻음(부품3)
 *   - 틀리면 몬스터가 곧바로 공격 한 번을 터뜨림. 공격에 맞으면 졸음 스택 +3 (COMPUTE_HIT_SLEEP)
 * 그림: 주인공/보라색 몬스터/잔상 구름은 03b-sprites.js 의 그림을 씀. drawComputeGame 은 13-render.js 의 px() 함수를 씀
 * ============================================================ */
const BUILD_09C = 43; // 이 파일의 버전 번호 (index.html 의 "파일 버전 검사"가 씀)

// ---- 모양과 난이도 (숫자를 바꿔서 쉽게/어렵게 조절) ----
const COMPUTE_TOP = 68;            // 두 화면이 시작하는 높이 (위쪽 힌트 글자와 안 겹치게)
const COMPUTE_ARENA_FRAC = 0.36;   // 왼쪽 피하기 구역이 차지하는 가로 비율
const COMPUTE_EDGE_PAD = 9;        // 플레이어 중심이 가장자리에서 이만큼 안쪽까지만 갈 수 있음
const COMPUTE_BOUNCE = 0.4;        // 가장자리에 부딪혔을 때 튕겨나오는 정도
const COMPUTE_BULLET_R = 5;        // 탄의 크기
const COMPUTE_BURST_COUNT = 8;     // "사방으로 퍼지는 공격"의 탄 개수 (적을수록 쉬움)
const COMPUTE_BURST_SPEED = 1.3;   // 사방으로 퍼지는 탄의 속도
const COMPUTE_AIM_SPEED = 1.9;     // "플레이어를 노리는 공격"의 탄 속도
const COMPUTE_TELEGRAPH_FRAMES = 50; // 공격 예고 시간 (60프레임 = 1초). 길수록 쉬움
const COMPUTE_AIM_LOCK_FRAMES = 18;  // 조준 공격은 발사 직전 이만큼은 조준선이 고정됨
const COMPUTE_HIT_SLEEP = 3;       // 공격에 맞았을 때 늘어나는 졸음 스택

let computeGame = null; // 미니게임 진행 상태. 미니게임 밖에서는 null
const computeUIEl = document.getElementById('computeUI');
const computePanelEl = document.getElementById('computePanel');
const computeQEl = document.getElementById('computeQ');
const computeMsgEl = document.getElementById('computeMsg');
const computeOptEls = [0, 1, 2, 3].map(i => document.getElementById('computeOpt' + i));

// 화면 배치 (버퍼 좌표): 왼쪽 피하기 구역(ax,ay,aw,ah)과 오른쪽 컴퓨터 화면(mx,my,mw,mh)
function computeLayout() {
  const top = COMPUTE_TOP, bottom = GAME_H - 12;
  const ax = 8, aw = Math.round(GAME_W * COMPUTE_ARENA_FRAC), ay = top, ah = bottom - top;
  const reserve = Math.round(GAME_W * 0.2); // 오른쪽 아래의 조작 버튼(방향 버튼 등)이 보기를 가리지 않게 컴퓨터 화면의 오른쪽을 비워 둠
  const mx = ax + aw + 10, mw = GAME_W - 8 - mx - reserve;
  return { ax: ax, ay: ay, aw: aw, ah: ah, mx: mx, my: top, mw: mw, mh: ah };
}

// ---- 문제 ----
// 임시 문제 (덧셈/뺄셈/곱셈). 이야기에 맞는 문제로 바꾸고 싶으면 이 함수만 고치면 됨.
// 돌려주는 모양: { text: '문제 글', options: ['보기1','보기2','보기3','보기4'], answer: 맞는 보기의 번호(0~3) }
function generateComputeQuestion() {
  const rnd = (n) => Math.floor(Math.random() * n);
  const kind = rnd(3);
  let text, ans;
  if (kind === 0) { const a = 10 + rnd(40), b = 10 + rnd(40); text = a + ' + ' + b + ' = ?'; ans = a + b; }
  else if (kind === 1) { const a = 30 + rnd(60), b = 5 + rnd(25); text = a + ' − ' + b + ' = ?'; ans = a - b; }
  else { const a = 3 + rnd(7), b = 3 + rnd(7); text = a + ' × ' + b + ' = ?'; ans = a * b; }
  const wrong = [];
  const near = [-10, -3, -2, -1, 1, 2, 3, 10];
  while (wrong.length < 3) { // 정답과 비슷한 숫자를 틀린 보기로
    const w = ans + near[rnd(near.length)];
    if (w > 0 && w !== ans && wrong.indexOf(w) < 0) wrong.push(w);
  }
  const options = wrong.concat([ans]);
  for (let i = options.length - 1; i > 0; i--) { const j = rnd(i + 1); const t = options[i]; options[i] = options[j]; options[j] = t; } // 섞기
  return { text: text, options: options.map(String), answer: options.indexOf(ans) };
}
function renderComputeQuestion() {
  const g = computeGame;
  if (!g) return;
  computeQEl.textContent = g.q.text;
  computeOptEls.forEach((el, i) => { el.textContent = (i + 1) + ') ' + g.q.options[i]; });
}
function setComputeMsg(text, good) {
  computeMsgEl.textContent = text;
  computeMsgEl.style.color = good ? '#9dffb4' : '#ff9a9a';
  if (computeGame) computeGame.msgT = 50;
}

// 보기를 골랐을 때 (숫자 키 1~4 → 05-input.js, 화면 보기 → 아래)
function computeAnswer(i) {
  const g = computeGame;
  if (!g || clueGameFinishing || i < 0 || i > 3) return;
  if (i === g.q.answer) {
    setComputeMsg('정답!', true);
    clueGameDodges++;                  // 정답 힌트 글자 하나 공개 (09-clue-game.js). 다 모으면 미니게임이 끝남
    updateClueGameHintDisplay();
    if (!clueGameFinishing) { g.q = generateComputeQuestion(); renderComputeQuestion(); }
  } else {
    setComputeMsg('땡! 몬스터가 화났다', false);
    const L = computeLayout();
    fireComputeAttack(g, L, { kind: 'aimed', angle: Math.atan2(g.y - (L.ay + 36), g.x - (L.ax + L.aw / 2)) }); // 틀리면 공격 한 번이 곧바로 터짐
    g.q = generateComputeQuestion();
    renderComputeQuestion();
  }
}
computeOptEls.forEach((el, i) => el.addEventListener('pointerdown', (e) => { e.preventDefault(); computeAnswer(i); }));

// ---- 시작 / 정리 ----
function startComputeGame(cp) {
  const L = computeLayout();
  const sx = L.ax + L.aw / 2, sy = L.ay + L.ah - 36;
  computeGame = {
    frame: 0,
    x: sx, y: sy, vx: 0, vy: 0,
    charge: { up: null, down: null, left: null, right: null },
    attacks: [], spawnTimer: 80, telegraph: null, hitFlash: 0,
    trail: [], puff: 0, faceX: 1, lastTx: sx, lastTy: sy,
    q: generateComputeQuestion(), msgT: 0,
  };
  currentCluePoint = cp;
  gameState = 'clueGameCompute';
  clueGameDodges = 0;
  clueGameHintSubEl.textContent = '문제를 풀어 힌트를 모으자! (숫자 1~4)';
  updateClueGameHintDisplay();
  clueGameHintEl.style.display = 'block';
  computeMsgEl.textContent = '';
  renderComputeQuestion();
  computeUIEl.style.display = 'block';
}
function cancelComputeCharges() {
  if (!computeGame) return;
  ['up', 'down', 'left', 'right'].forEach(n => {
    if (computeGame.charge[n] !== null) { computeGame.charge[n] = null; stopChargeSound(n); }
  });
}
function resetComputeGame() {
  cancelComputeCharges();
  computeGame = null;
  computeUIEl.style.display = 'none';
}

// ---- 입력: 본 게임처럼 방향키를 꾹 눌렀다 떼면 그 방향으로 발사 (방향 잠금과 상관없이 4방향 모두 가능) ----
function computeGamePress(name) {
  const g = computeGame;
  if (!g) return;
  if (name === 'left') g.faceX = -1;
  if (name === 'right') g.faceX = 1;
  if (g.charge[name] === null) { g.charge[name] = g.frame; startChargeSound(name); }
}
function computeGameRelease(name) {
  const g = computeGame;
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
  if (power > 1.4) spawnAfterimage(g.trail, g.x, g.y, true);
  g.lastTx = g.x; g.lastTy = g.y;
}

// ---- 공격 (몬스터는 왼쪽 구역 위쪽 가운데에 있음) ----
function computeMonsterPos(L) { return { x: L.ax + L.aw / 2, y: L.ay + 36 }; }
function fireComputeAttack(g, L, t) {
  const c = computeMonsterPos(L);
  const bullets = [];
  if (t.kind === 'burst') {
    for (let k = 0; k < COMPUTE_BURST_COUNT; k++) {
      const a = t.angle + (k * Math.PI * 2) / COMPUTE_BURST_COUNT;
      bullets.push({ x: c.x + Math.cos(a) * 14, y: c.y + Math.sin(a) * 14, vx: Math.cos(a) * COMPUTE_BURST_SPEED, vy: Math.sin(a) * COMPUTE_BURST_SPEED, r: COMPUTE_BULLET_R });
    }
  } else {
    [-0.22, 0, 0.22].forEach(off => {
      const a = t.angle + off;
      bullets.push({ x: c.x + Math.cos(a) * 14, y: c.y + Math.sin(a) * 14, vx: Math.cos(a) * COMPUTE_AIM_SPEED, vy: Math.sin(a) * COMPUTE_AIM_SPEED, r: COMPUTE_BULLET_R });
    });
  }
  g.attacks.push({ bullets: bullets, hit: false });
}

function updateComputeGame() {
  const g = computeGame;
  if (!g) return;
  g.frame++;
  const L = computeLayout();
  const c = computeMonsterPos(L);
  if (g.msgT > 0 && --g.msgT === 0) computeMsgEl.textContent = '';

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

  if (g.puff > 0) g.puff--;
  if (Math.hypot(g.vx, g.vy) > 1.6 && Math.hypot(g.x - g.lastTx, g.y - g.lastTy) > 16) {
    spawnAfterimage(g.trail, g.x, g.y, false);
    g.lastTx = g.x; g.lastTy = g.y;
  }
  stepAfterimages(g.trail);

  // 구역 밖으로는 나갈 수 없음: 가장자리에 닿으면 약하게 튕김
  const minX = L.ax + COMPUTE_EDGE_PAD, maxX = L.ax + L.aw - COMPUTE_EDGE_PAD;
  const minY = L.ay + COMPUTE_EDGE_PAD, maxY = L.ay + L.ah - COMPUTE_EDGE_PAD;
  if (g.x < minX) { g.x = minX; if (g.vx < 0) g.vx = -g.vx * COMPUTE_BOUNCE; }
  if (g.x > maxX) { g.x = maxX; if (g.vx > 0) g.vx = -g.vx * COMPUTE_BOUNCE; }
  if (g.y < minY) { g.y = minY; if (g.vy < 0) g.vy = -g.vy * COMPUTE_BOUNCE; }
  if (g.y > maxY) { g.y = maxY; if (g.vy > 0) g.vy = -g.vy * COMPUTE_BOUNCE; }

  // 공격 준비 → 발사 (힌트를 다 모아서 끝나가는 중에는 새 공격을 하지 않음)
  if (!clueGameFinishing) {
    if (g.telegraph) {
      const t = g.telegraph;
      t.t++;
      if (t.kind === 'aimed' && t.t < t.dur - COMPUTE_AIM_LOCK_FRAMES) t.angle = Math.atan2(g.y - c.y, g.x - c.x);
      if (t.t >= t.dur) {
        fireComputeAttack(g, L, t);
        g.telegraph = null;
        g.spawnTimer = 80 + Math.floor(Math.random() * 50);
      }
    } else {
      g.spawnTimer--;
      if (g.spawnTimer <= 0) {
        g.telegraph = { kind: Math.random() < 0.55 ? 'burst' : 'aimed', t: 0, dur: COMPUTE_TELEGRAPH_FRAMES, angle: Math.random() * Math.PI * 2 };
      }
    }
  }

  // 탄 이동과 충돌: 맞으면 졸음 +3과 약한 밀려남. 구역 밖으로 나간 탄은 사라짐
  for (let i = g.attacks.length - 1; i >= 0; i--) {
    const atk = g.attacks[i];
    for (let j = atk.bullets.length - 1; j >= 0; j--) {
      const b = atk.bullets[j];
      b.x += b.vx; b.y += b.vy;
      if (Math.hypot(b.x - g.x, b.y - g.y) < b.r + 8) {
        atk.hit = true;
        g.hitFlash = 14;
        addSleep(COMPUTE_HIT_SLEEP);
        const ax = g.x - b.x, ay = g.y - b.y, al = Math.hypot(ax, ay) || 1;
        g.vx += (ax / al) * 2; g.vy += (ay / al) * 2;
        atk.bullets.splice(j, 1);
        continue;
      }
      if (b.x < L.ax - 12 || b.x > L.ax + L.aw + 12 || b.y < L.ay - 12 || b.y > L.ay + L.ah + 12) atk.bullets.splice(j, 1);
    }
    if (atk.bullets.length === 0) g.attacks.splice(i, 1);
  }
  if (g.hitFlash > 0) g.hitFlash--;
}

// ---- 그리기 ----
function drawComputeGame() {
  const L = computeLayout();
  bctx.fillStyle = '#101a2c'; // 어두운 작업실 바탕
  bctx.fillRect(0, 0, GAME_W, GAME_H);
  // 오른쪽: 컴퓨터 화면 (글자와 보기는 index.html 의 #computeUI 가 위에 올라옴)
  px(L.mx - 3, L.my - 3, L.mw + 6, L.mh + 6, '#2b3550');
  px(L.mx, L.my, L.mw, L.mh, '#0b1424');
  px(L.mx, L.my, L.mw, 10, '#1f6fb5');
  px(L.mx + 4, L.my + 3, 4, 4, '#ff6b6b'); px(L.mx + 11, L.my + 3, 4, 4, '#ffd86b'); px(L.mx + 18, L.my + 3, 4, 4, '#6bff9d');
  // 왼쪽: 피하기 구역
  px(L.ax - 2, L.ay - 2, L.aw + 4, L.ah + 4, '#5a7fb8');
  px(L.ax, L.ay, L.aw, L.ah, '#1b2c47');
  bctx.save();
  bctx.globalAlpha = 0.12;
  for (let x = L.ax + 10; x < L.ax + L.aw; x += 16) px(x, L.ay, 1, L.ah, '#9fd0ff'); // 격자 무늬
  for (let y = L.ay + 10; y < L.ay + L.ah; y += 16) px(L.ax, y, L.aw, 1, '#9fd0ff');
  bctx.restore();
  const g = computeGame;
  if (!g) return;
  const c = computeMonsterPos(L);

  // 공격 예고
  const tg = g.telegraph;
  if (tg) {
    const p = tg.t / tg.dur;
    bctx.save();
    bctx.beginPath(); bctx.rect(L.ax, L.ay, L.aw, L.ah); bctx.clip();
    if (tg.kind === 'burst') {
      bctx.globalAlpha = 0.25 + 0.5 * p;
      bctx.strokeStyle = '#b06bff'; bctx.lineWidth = 2;
      bctx.beginPath(); bctx.arc(c.x, c.y, 16 + p * 22, 0, Math.PI * 2); bctx.stroke();
    } else {
      const locked = tg.t >= tg.dur - COMPUTE_AIM_LOCK_FRAMES;
      bctx.globalAlpha = locked ? 0.85 : 0.3 + 0.3 * p;
      bctx.strokeStyle = locked ? '#ff4d6d' : '#b06bff'; bctx.lineWidth = 2;
      [-0.22, 0, 0.22].forEach(off => {
        bctx.beginPath();
        bctx.moveTo(c.x + Math.cos(tg.angle + off) * 16, c.y + Math.sin(tg.angle + off) * 16);
        bctx.lineTo(c.x + Math.cos(tg.angle + off) * 260, c.y + Math.sin(tg.angle + off) * 260);
        bctx.stroke();
      });
    }
    bctx.restore();
  }

  bctx.save();
  bctx.beginPath(); bctx.rect(L.ax, L.ay, L.aw, L.ah); bctx.clip(); // 구역 밖으로 그려지지 않게
  drawAfterimages(g.trail, 0);

  // 보라색 몬스터 (공격을 준비할 때는 번쩍임)
  const flash = tg && (g.frame % 8 < 4);
  if (spriteReady('enemyPurple')) {
    const bob = Math.round(Math.sin(g.frame * 0.08) * 2);
    drawSprite('enemyPurple', c.x, c.y + bob, { scale: 1 });
    if (flash) drawSprite('enemyPurple', c.x, c.y + bob, { scale: 1, tint: 'white', alpha: 0.55 });
  } else {
    px(c.x - 11, c.y - 11, 22, 22, flash ? '#c79bff' : '#9b59e6');
    px(c.x - 6, c.y - 4, 4, 4, '#ffffff'); px(c.x + 2, c.y - 4, 4, 4, '#ffffff');
  }

  // 탄
  g.attacks.forEach(atk => atk.bullets.forEach(b => {
    bctx.fillStyle = '#c27bff';
    bctx.beginPath(); bctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); bctx.fill();
    bctx.fillStyle = '#ffffff';
    bctx.beginPath(); bctx.arc(b.x, b.y, b.r * 0.4, 0, Math.PI * 2); bctx.fill();
  }));

  // 플레이어 (충전 단계에 맞는 구름 모습) + 충전 중이면 충전 막대
  let chargeFrac = 0;
  ['up', 'down', 'left', 'right'].forEach(n => {
    if (g.charge[n] !== null) chargeFrac = Math.max(chargeFrac, Math.min(1, (g.frame - g.charge[n]) / chargeFramesNow()));
  });
  const spd = Math.hypot(g.vx, g.vy);
  const pname = playerSpriteFor(chargeFrac, g.puff, spd);
  let soy = 0;
  if (chargeFrac === 0 && spd < 0.5) soy = Math.round(Math.sin(g.frame * 0.07) * 1.2);
  if (drawSprite(pname, g.x, g.y + soy, { flip: g.faceX < 0 })) {
    if (g.hitFlash > 0) drawSprite(pname, g.x, g.y + soy, { flip: g.faceX < 0, tint: 'red', alpha: 0.5 });
  } else {
    px(g.x - 8, g.y - 9, 16, 18, g.hitFlash > 0 ? '#ff5c5c' : '#ffffff');
    px(g.x - 5, g.y - 6, 3, 3, '#4a7fd6'); px(g.x + 2, g.y - 6, 3, 3, '#4a7fd6');
  }
  if (chargeFrac > 0) {
    const by = g.y - (spriteReady('playerIdle') ? 28 : 16);
    px(g.x - 9, by, 18, 4, '#3a2a5a');
    px(g.x - 8, by + 1, 16 * chargeFrac, 2, chargeFrac >= 1 ? '#ff9f43' : '#ffe08a');
  }
  bctx.restore();
}

// 컴퓨터 화면 글자/보기(HTML)를 그려진 게임 화면 위의 같은 자리에 맞춰 놓음 (13-render.js 의 draw 가 화면 크기가 정해진 뒤에 부름)
// (dx, dy): 게임 화면이 그려진 왼쪽 위 좌표, scale: 게임 한 칸이 화면에서 몇 픽셀인지
function positionComputeUI(dx, dy, scale) {
  if (!computeGame) return;
  const L = computeLayout();
  computeUIEl.style.left = dx + 'px';
  computeUIEl.style.top = dy + 'px';
  computeUIEl.style.width = (GAME_W * scale) + 'px';
  computeUIEl.style.height = (GAME_H * scale) + 'px';
  computeUIEl.style.fontSize = (scale * 8) + 'px'; // 안의 글자는 em 으로 정해서 화면 크기에 같이 커지고 작아짐
  computePanelEl.style.left = (L.mx * scale) + 'px';
  computePanelEl.style.top = ((L.my + 12) * scale) + 'px';
  computePanelEl.style.width = (L.mw * scale) + 'px';
  computePanelEl.style.height = ((L.mh - 14) * scale) + 'px';
}
